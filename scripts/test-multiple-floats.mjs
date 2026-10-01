import assert from 'node:assert/strict';
import { createMultiwindow } from '../multiwindow.mjs';

// Minimal browser-chrome fixture exercising the controller with real DOM-like events.
class Node {
  constructor(doc, name = 'div') {
    this.ownerDocument = doc; this.name = name; this.children = []; this.attrs = new Map();
    this.listeners = new Map(); this.className = ''; this.dataset = {}; this.isConnected = true;
    this.classList = { add: name => { this.className += ` ${name}`; } };
    this.style = { setProperty: (k,v) => this.attrs.set(k,v), removeProperty: k => this.attrs.delete(k) };
  }
  setAttribute(k,v) { this.attrs.set(k,String(v)); }
  getAttribute(k) { return this.attrs.get(k) ?? null; }
  hasAttribute(k) { return this.attrs.has(k); }
  removeAttribute(k) { this.attrs.delete(k); }
  toggleAttribute(k, force = !this.hasAttribute(k)) { force ? this.setAttribute(k,'') : this.removeAttribute(k); return force; }
  append(...nodes) { for (const n of nodes) { n.parent = this; this.children.push(n); } }
  prepend(...nodes) { for (const n of nodes) n.parent = this; this.children.unshift(...nodes); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  remove() { this.parent.children = this.parent.children.filter(n => n !== this); this.isConnected = false; }
  matches(s) { return s.startsWith('.') ? this.className.split(' ').includes(s.slice(1)) : this.name === s; }
  querySelectorAll(s) { return this.children.flatMap(n => [...(s.split(',').some(x => n.matches(x)) ? [n] : []), ...n.querySelectorAll(s)]); }
  querySelector(s) { return this.querySelectorAll(s)[0] ?? null; }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
  closest(s) { return this.matches(s) ? this : this.parent?.closest(s); }
  addEventListener(name, fn, options = {}) {
    const list = this.listeners.get(name) ?? []; list.push(fn); this.listeners.set(name,list);
    options.signal?.addEventListener('abort', () => this.listeners.set(name, (this.listeners.get(name) ?? []).filter(f => f !== fn)));
  }
  removeEventListener(name, fn) { this.listeners.set(name,(this.listeners.get(name) ?? []).filter(f => f !== fn)); }
  emit(name, props = {}) { for (const fn of this.listeners.get(name) ?? []) fn({ target:this, preventDefault(){}, stopPropagation(){}, ...props }); }
  focus() { this.ownerDocument.activeElement = this; }
}
const doc = new Node(null); doc.ownerDocument = doc;
doc.createElementNS = (ns,tag) => new Node(doc,tag);
const tabs = Array.from({length:5}, (_,i) => {
  const tab = new Node(doc,'tab'); tab.label = `Tab ${i}`;
  const container = new Node(doc); container.className = 'browserSidebarContainer'; doc.append(container);
  tab.linkedBrowser = new Node(doc,'browser'); container.append(tab.linkedBrowser);
  return tab;
});
const tree = tabs => ({ children: tabs.map(tab => ({ tab })) });
const data = {tabs:[tabs[0]], gridType:'vsep', layoutTree:tree([tabs[0]])};
let lastLayout;
const view = {
  _data:[data], currentView:0, MAX_TABS:4, _tabToSplitNode:new Map(),
  tabBrowserPanel:{getBoundingClientRect:()=>({width:1200,height:900})},
  calculateLayoutTree:tree, removeSplitters(){}, applyGridLayout(t){lastLayout=t;},
  activateSplitView(d){this.currentView=this._data.indexOf(d);},
  splitTabs([target,incoming]) {data.tabs.push(incoming); incoming.splitView=true; data.layoutTree=tree(data.tabs); return data;},
  removeTabFromGroup(tab) {data.tabs=data.tabs.filter(t=>t!==tab);tab.splitView=false;data.layoutTree=tree(data.tabs);},
};
const win = new Node(doc); let queued;
Object.assign(win, {document:doc, AbortController, gZenViewSplitter:view,
  gBrowser:{selectedTab:tabs[0],tabContainer:new Node(doc)},
  requestAnimationFrame:fn => { queued=fn; return 1; }, cancelAnimationFrame(){queued=null;},
});
const shortcutPrefs = new Map();
const prefs = {getStringPref:(key,fallback)=>shortcutPrefs.get(key) ?? fallback,getIntPref:()=>0,getBoolPref:(key,fallback)=>fallback};
const controller = createMultiwindow(win,{notify(){},chooseTab(){},appearance(){},prefs,origins:{begin(){},end(){},destroy(){}}});
const container = tab => tab.linkedBrowser.parent;
const header = tab => container(tab).querySelector('.pane-float-header');
const flush = () => {const fn=queued;queued=null;fn?.();};
controller.add(tabs[0],tabs[1],'float');
const originalBrowser = tabs[1].linkedBrowser;
const before = container(tabs[1]).getAttribute('--pane-float-x');
assert.throws(()=>controller.join({tabs:[tabs[0],tabs[1]]},tabs[2]),/no longer available/);
controller.join(data,tabs[2],'float');
assert.deepEqual(controller.floatingTabs,[tabs[1],tabs[2]]);
assert.equal(tabs[1].linkedBrowser,originalBrowser);
assert.equal(container(tabs[1]).getAttribute('--pane-float-x'),before);
assert.deepEqual(lastLayout.children.map(n=>n.tab),[tabs[0]]);
header(tabs[2]).emit('keydown',{key:'ArrowLeft'});
assert.equal(container(tabs[1]).getAttribute('--pane-float-x'),before,'moving one float must not move its neighbor');
const pin = header(tabs[1]).querySelectorAll('button').find(b => b.getAttribute('aria-label')==='Keep header visible');
pin.emit('click'); assert.equal(pin.getAttribute('aria-pressed'),'true');
controller.sync();flush(); assert.ok(header(tabs[1]).hasAttribute('data-pinned'));
controller.join(data,tabs[3],'grid');
assert.equal(data.gridType,'grid');
assert.ok(!controller.floatingTabs.includes(tabs[3]),'Add joins as a docked grid tab');
controller.arrange(tabs[3],'float');
assert.equal(controller.floatingTabs.length,3);
assert.throws(()=>controller.add(tabs[0],tabs[4],'float'),/limit/);
assert.throws(()=>controller.join(data,tabs[4],'float'),/limit/);
assert.throws(()=>controller.arrange(tabs[0],'float'),/background/);
controller.arrange(tabs[2],'right');
assert.deepEqual(controller.floatingTabs,[tabs[1],tabs[3]],'docking one preserves the others');
assert.ok(header(tabs[1]).hasAttribute('data-pinned'));
const close = header(tabs[3]).querySelectorAll('button').find(b=>b.getAttribute('aria-label')==='Return floating tab to sidebar');
close.emit('click'); assert.deepEqual(controller.floatingTabs,[tabs[1]]);
assert.ok(!tabs[3].closing,'closing a float returns its tab without closing the page');
view.currentView=-1;controller.sync();flush();assert.deepEqual(controller.floatingTabs,[tabs[1]]);
view.currentView=0;controller.sync();flush();assert.ok(container(tabs[1]).hasAttribute('pane-floating'));
view.removeTabFromGroup(tabs[1]);controller.sync();flush();assert.equal(controller.floatingTabs.length,0);
controller.add(tabs[0],tabs[1],'float');
const split = view.splitTabs;view.splitTabs = () => {throw new Error('injected');};
assert.throws(()=>controller.add(tabs[0],tabs[3],'float'),/injected/);
assert.deepEqual(controller.floatingTabs,[tabs[1]],'a failed add preserves existing floats');
view.splitTabs = split;
const memberBrowsers = data.tabs.map(tab => tab.linkedBrowser);
const memberTabs = [...data.tabs];
const selectedBeforeUnsplit = win.gBrowser.selectedTab;
controller.unsplit(data);
assert.equal(controller.floatingTabs.length,0,'unsplit removes floating controls');
assert.equal(win.gBrowser.selectedTab,selectedBeforeUnsplit,'unsplit retains current selection');
assert.ok(memberTabs.every((tab,i)=>!tab.splitView && tab.linkedBrowser===memberBrowsers[i] && !tab.closing),'unsplit keeps the original pages open');
assert.throws(()=>controller.unsplit({tabs:memberTabs}),/no longer available/);
data.tabs = [tabs[0]];
data.layoutTree = tree(data.tabs);
controller.add(tabs[0],tabs[2],'right');
controller.add(tabs[0],tabs[3],'below');
data.layoutTree.children[0].sizeInParent = 36;
const tiledTree = data.layoutTree;
const accordionBrowsers = data.tabs.map(t => t.linkedBrowser);
controller.arrange(tabs[2],'accordion');
assert.equal(data.layoutTree,tiledTree,'accordion must leave the native layout untouched');
assert.equal(container(tabs[2]).hasAttribute('pane-accordion-active'),true);
assert.equal(tabs[0].linkedBrowser.hasAttribute('inert'),true,'background pages cannot take keyboard focus');
assert.equal(tabs[2].linkedBrowser.hasAttribute('inert'),false,'the active page remains interactive');
assert.equal(container(tabs[0]).getAttribute('--pane-accordion-right'),'88px','background pages keep a full width');
assert.equal(container(tabs[2]).getAttribute('--pane-accordion-left'),'44px');
const hoverHandle = container(tabs[0]).querySelector('.pane-accordion-handle');
hoverHandle.emit('pointerenter',{clientX:20,clientY:50});
assert.equal(doc.querySelector('.pane-accordion-hint-title').textContent,tabs[0].label,'hover identifies the background tab');
hoverHandle.emit('pointerleave');
assert.equal(doc.querySelector('.pane-accordion-edge-hint'),null,'leaving an edge hides its hint');
container(tabs[0]).querySelector('.pane-accordion-handle').emit('click');
assert.equal(win.gBrowser.selectedTab,tabs[0],'clicking a strip focuses its original tab');
container(tabs[0]).querySelector('.pane-accordion-handle').emit('keydown',{key:'ArrowRight'});
assert.equal(win.gBrowser.selectedTab,tabs[2],'Right expands the next accordion tab');
container(tabs[2]).querySelector('.pane-accordion-handle').emit('keydown',{key:'End'});
assert.equal(win.gBrowser.selectedTab,tabs[3]);
const shortcut = {key:'ArrowRight',altKey:true,shiftKey:true,ctrlKey:false,metaKey:false};
win.emit('keydown',shortcut);
assert.equal(win.gBrowser.selectedTab,tabs[0],'global Next wraps to the first tab');
assert.equal(doc.activeElement,tabs[0].linkedBrowser,'navigation focuses the newly expanded page');
win.emit('keydown',{...shortcut,key:'ArrowLeft'});
assert.equal(win.gBrowser.selectedTab,tabs[3],'global Previous wraps to the last tab');
win.emit('keydown',{...shortcut,altKey:false,shiftKey:false});
assert.equal(win.gBrowser.selectedTab,tabs[3],'ordinary arrows leave page navigation alone');
shortcutPrefs.set('mod.pane.accordion-next','Disabled');
win.emit('keydown',shortcut);
assert.equal(win.gBrowser.selectedTab,tabs[3],'disabled navigation does not switch');
shortcutPrefs.set('mod.pane.accordion-next','Ctrl+F8');
win.emit('keydown',{key:'F8',ctrlKey:true});
assert.equal(win.gBrowser.selectedTab,tabs[0],'custom shortcuts update without reloading');
shortcutPrefs.clear();
container(tabs[0]).querySelector('.pane-accordion-bar').remove();
controller.sync(); flush();
assert.ok(container(tabs[0]).querySelector('.pane-accordion-handle'),'rebuilt native chrome gets new accordion controls');
assert.equal(container(tabs[0]).querySelector('.pane-accordion-handle').hasAttribute('title'),false,'edge hover has no native tooltip');
assert.ok(data.tabs.every((t,i)=>t.linkedBrowser===accordionBrowsers[i]),'accordion preserves original browsers');
controller.arrange(tabs[3],'tiles');
win.emit('keydown',shortcut);
assert.equal(win.gBrowser.selectedTab,tabs[0],'accordion shortcuts do not act in tiled layouts');
assert.equal(lastLayout,tiledTree,'returning to tiles restores the same tree');
assert.equal(tiledTree.children[0].sizeInParent,36,'divider size survives accordion');
assert.equal(doc.querySelectorAll('.pane-accordion-handle').length,0);
assert.equal(doc.querySelectorAll('.pane-accordion-bar').length,0);
assert.ok(data.tabs.every(t=>!t.linkedBrowser.hasAttribute('inert')),'tile restoration restores page interactivity');
win.gBrowser.selectedTab = tabs[3];
controller.arrange(tabs[2],'normal');
assert.equal(win.gBrowser.selectedTab,tabs[3],'detaching another tab preserves the selected split pane');
assert.equal(data.tabs.length,2,'the remaining split stays intact');
assert.equal(tabs[2].splitView,false,'the detached tab returns to a normal tab');
controller.add(tabs[0],tabs[2],'right');
win.gBrowser.selectedTab = tabs[2];
controller.arrange(tabs[2],'normal');
assert.ok(data.tabs.includes(win.gBrowser.selectedTab),'detaching the selected pane keeps focus in the remaining split');
controller.add(tabs[0],tabs[2],'right');
controller.arrange(tabs[2],'accordion');
tabs[2].closing = true;
view.removeTabFromGroup(tabs[2]); controller.sync(); flush();
assert.equal(container(tabs[2]).hasAttribute('pane-accordion'),false,'removed tabs lose accordion controls');
assert.ok(data.tabs.includes(win.gBrowser.selectedTab),'closing an accordion pane keeps selection in the remaining split');
tabs[2].closing = false;
controller.add(tabs[0],tabs[2],'right');
assert.equal(doc.querySelectorAll('.pane-accordion-handle').length,0,'adding a tab restores the native tiled layout');
assert.ok(data.tabs.includes(tabs[2]),'the added tab joins the original split');
controller.arrange(tabs[0],'accordion');
win.gBrowser.selectedTab = tabs[0];
controller.arrange(tabs[2],'normal');
assert.equal(win.gBrowser.selectedTab,tabs[0],'detaching in accordion keeps the remaining pane selected');
assert.equal(container(tabs[2]).hasAttribute('pane-accordion'),false,'detaching cleans up accordion styles');
controller.arrange(tabs[0],'accordion');
controller.arrange(tabs[0],'float');
assert.equal(doc.querySelectorAll('.pane-accordion-handle').length,0,'floating returns the group to tiles');
assert.throws(()=>controller.arrange(tabs[3],'accordion'),/Dock/);
controller.clearFloat();
controller.arrange(tabs[3],'accordion');
controller.unsplit(data); flush();
assert.equal(doc.querySelectorAll('.pane-accordion-handle').length,0,'unsplit clears accordion presentation');
data.tabs = [tabs[0]];
data.layoutTree = tree(data.tabs);
controller.add(tabs[0],tabs[1],'float');
controller.destroy();
assert.equal(doc.querySelectorAll('.pane-float-header').length,0);
assert.equal(controller.floatingTabs.length,0);
assert.deepEqual(lastLayout,data.layoutTree,'unload restores the full native split');
const unloadingAccordion = createMultiwindow(win,{notify(){},chooseTab(){},appearance(){},origins:{destroy(){}}});
unloadingAccordion.arrange(tabs[0],'accordion');
unloadingAccordion.destroy();
assert.equal(doc.querySelectorAll('.pane-accordion-handle').length,0,'unloading restores tiled presentation');
assert.equal(lastLayout,data.layoutTree,'unloading accordion restores the unchanged native tree');
assert.equal((win.listeners.get('keydown') ?? []).length,0,'unload removes accordion shortcuts');
assert.ok(tabs.every(tab=>!container(tab).hasAttribute('--pane-accordion-line-left')),'unload removes separator geometry');
console.log('Multiple floats and accordion: navigation, state preservation, limits, rollback and cleanup passed.');
