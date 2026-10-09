import assert from 'node:assert/strict';
import { createMultiwindow, presentationModes, accordionSizes, modeLabels } from '../multiwindow.mjs';
import { encodeTree } from '../split-persistence.mjs';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
assert.deepEqual(accordionSizes(1200, 4), {expanded:1068, strip:44});
assert.deepEqual(accordionSizes(1200, 4, 2000), {expanded:1104, strip:32});
assert.deepEqual(accordionSizes(1200, 4, 0), {expanded:320, strip:880/3});
assert.deepEqual(accordionSizes(100, 4, 2000), {expanded:50, strip:50/3});
assert.deepEqual(accordionSizes(0, 4, 500), {expanded:0, strip:0});
assert.deepEqual(accordionSizes(500, 1, 20), {expanded:500, strip:0});
const fractional = accordionSizes(1200.75, 4, 800.125);
near(fractional.expanded, 800.125);
near(fractional.expanded + fractional.strip * 3, 1200.75);
assert.ok(!Number.isInteger(fractional.strip));

for (const width of [0, 80.125, 400, 1200.75]) for (const count of [2, 3, 4]) {
  for (const desired of [-100, 350.125, 10000]) {
    const sizes = accordionSizes(width, count, desired);
    near(sizes.expanded + sizes.strip * (count - 1), width);
    assert.ok(sizes.strip >= Math.min(32, width / (count + 2)) - 1e-9);
    assert.ok(sizes.expanded >= 0);
  }
}

// Minimal browser-chrome fixture exercising the controller with real DOM-like events.
class Node {
  constructor(doc, name = 'div') {
    this.ownerDocument = doc; this.name = name; this.children = []; this.attrs = new Map();
    this.listeners = new Map(); this.className = ''; this.dataset = {}; this.isConnected = true;
    this.animations = [];
    this.classList = { add: name => { this.className += ` ${name}`; } };
    this.style = { setProperty: (k,v) => this.attrs.set(k,v), removeProperty: k => this.attrs.delete(k) };
    this.offsetWidth = 280; this.offsetHeight = 320;
  }
  setAttribute(k,v) { this.attrs.set(k,String(v)); }
  getAttribute(k) { return this.attrs.get(k) ?? null; }
  hasAttribute(k) { return this.attrs.has(k); }
  removeAttribute(k) { this.attrs.delete(k); }
  toggleAttribute(k, force = !this.hasAttribute(k)) { force ? this.setAttribute(k,'') : this.removeAttribute(k); return force; }
  append(...nodes) { for (const n of nodes) { n.parent = this; this.children.push(n); } }
  prepend(...nodes) { for (const n of nodes) n.parent = this; this.children.unshift(...nodes); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter(n => n !== this);
    const disconnect = node => { node.isConnected = false; for (const child of node.children) disconnect(child); };
    disconnect(this);
  }
  getBoundingClientRect() {
    if (!this.isConnected) return {left:0,top:0,right:0,bottom:0,width:0,height:0};
    return this.box ?? {left:0,top:0,right:1200,bottom:900,width:1200,height:900};
  }
  matches(s) { if (s.startsWith('[data-mode]')) return (this.hasAttribute('data-mode') || this.dataset.mode !== undefined) && (!s.includes('aria-pressed') || this.getAttribute('aria-pressed')==='true'); return s.startsWith('.') ? this.className.split(' ').includes(s.slice(1)) : this.name === s; }
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
  setPointerCapture(id) { this.capturedPointer = id; }
  hasPointerCapture(id) { return this.capturedPointer === id; }
  releasePointerCapture(id) { assert.equal(this.capturedPointer, id); this.capturedPointer = null; }
  focus() { this.ownerDocument.activeElement = this; }
  animate(keyframes,options) { const animation = {keyframes,options,cancel(){this.cancelled=true;}}; this.animations.push(animation); return animation; }
}
const doc = new Node(null); doc.ownerDocument = doc; doc.documentElement=doc;
doc.createElementNS = (ns,tag) => new Node(doc,tag);
doc.createTextNode = text => {const node=new Node(doc,'#text');node.textContent=text;return node;};
const tabs = Array.from({length:5}, (_,i) => {
  const tab = new Node(doc,'tab'); tab.label = `Tab ${i}`;
  const container = new Node(doc); container.className = 'browserSidebarContainer'; doc.append(container);
  tab.linkedBrowser = new Node(doc,'browser'); container.append(tab.linkedBrowser);
  return tab;
});
const tree = (tabs, type = 'grid') => ({ type, children: tabs.map(tab => ({ tab })) });
const layoutSizes = node => [node.sizeInParent, ...(node.children ?? []).flatMap(layoutSizes)].filter(size => size !== undefined);
const data = {tabs:[tabs[0]], gridType:'vsep', layoutTree:tree([tabs[0]])};
let lastLayout;
let splitCalls = 0;
const view = {
  _data:[data], currentView:0, MAX_TABS:4, _tabToSplitNode:new Map(),
  tabBrowserPanel:{getBoundingClientRect:()=>({width:1200,height:900})},
  calculateLayoutTree(tabs,type) { return {...tree(tabs,type), sizeInParent:50}; },
  removeSplitters(){}, applyGridLayout(t){lastLayout=t;},
  activateSplitView(d){this.currentView=this._data.indexOf(d);},
  splitTabs([target,incoming]) {splitCalls++; data.tabs.push(incoming); incoming.splitView=true; data.layoutTree=tree(data.tabs); return data;},
  removeTabFromGroup(tab) {data.tabs=data.tabs.filter(t=>t!==tab);tab.splitView=false;data.layoutTree=tree(data.tabs);},
};
const win = new Node(doc); const frames=new Map(); let frameId=0;
const timers = new Map(); let timerId = 0;
const motion = new Node(doc); motion.matches = false;
Object.assign(win, {document:doc, AbortController, navigator:{platform:'Win32'}, gZenViewSplitter:view,
  gBrowser:{tabs,selectedTab:tabs[0],tabContainer:new Node(doc)},
  requestAnimationFrame:fn => {frames.set(++frameId,fn);return frameId;}, cancelAnimationFrame:id=>frames.delete(id),
  setTimeout:fn => { timers.set(++timerId,fn); return timerId; }, clearTimeout:id => timers.delete(id),
  matchMedia:()=>motion, innerWidth:1200, innerHeight:900,
});
const shortcutPrefs = new Map();
const prefs = {getStringPref:(key,fallback)=>shortcutPrefs.get(key) ?? fallback,getIntPref:()=>0,getBoolPref:(key,fallback)=>fallback};
const controller = createMultiwindow(win,{notify(){},chooseTab(){},appearance(){},prefs,origins:{begin(){},end(){},destroy(){}}});
const container = tab => tab.linkedBrowser.parent;
const header = tab => container(tab).querySelector('.pane-float-header');
const accordionResize = side => doc.querySelectorAll(`.pane-accordion-resize-${side}`).find(node => !node.hidden);
const flush = () => {for (const [id,fn] of [...frames]) {frames.delete(id);fn();}};
const guardedPress = (node, name, fallback) => {
  let prevented = false, stopped = false;
  node.emit(name, {
    button:0, pointerId:41, clientX:500,
    preventDefault(){ prevented = true; },
    stopPropagation(){ stopped = true; },
    stopImmediatePropagation(){ stopped = true; },
  });
  if (!stopped) fallback?.();
  return { prevented, stopped };
};
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
const customTree = () => ({
  children: [
    { sizeInParent: 62, children: [{ tab: tabs[0], sizeInParent: 30 }, { tab: tabs[2], sizeInParent: 70 }] },
    { tab: tabs[3], sizeInParent: 38 },
  ],
});
const resetCustomTree = () => {
  data.tabs = [tabs[0], tabs[2], tabs[3]];
  data.gridType = 'vsep';
  data.layoutTree = customTree();
  for (const tab of tabs) tab.splitView = data.tabs.includes(tab);
  tabs[4].splitView = false;
};
resetCustomTree();
win.gBrowser.selectedTab = tabs[2];
controller.join(data, tabs[4], 'right');
assert.equal(data.gridType, 'vsep', 'joining right preserves the existing group type');
assert.equal(data.layoutTree.children[0].sizeInParent, 62, 'joining right preserves the resized nested branch');
assert.equal(data.layoutTree.children[1].sizeInParent, 38, 'joining right preserves sibling size');
assert.equal(data.layoutTree.children[0].children[0].sizeInParent, 30, 'joining right preserves existing leaf size');
assert.equal(data.layoutTree.children[0].children[1].sizeInParent, 70, 'joining right keeps the selected leaf size over calculated defaults');
assert.equal(data.layoutTree.children[0].children[1].type, 'vsep', 'joining right splits the selected leaf horizontally');
assert.deepEqual(data.layoutTree.children[0].children[1].children.map(n => n.tab), [tabs[2], tabs[4]]);
assert.equal(data.layoutTree.children[0].parent, data.layoutTree, 'joining right restores parent links on preserved branches');
assert.equal(data.layoutTree.children[0].children[1].parent, data.layoutTree.children[0], 'joining right parents the inserted branch');
assert.equal(data.layoutTree.children[0].children[1].children[0].parent, data.layoutTree.children[0].children[1], 'joining right parents inserted leaves');
resetCustomTree();
win.gBrowser.selectedTab = tabs[0];
controller.join(data, tabs[4], 'below');
assert.equal(data.gridType, 'vsep', 'joining below preserves the existing group type');
assert.equal(data.layoutTree.children[0].sizeInParent, 62, 'joining below preserves the resized nested branch');
assert.equal(data.layoutTree.children[1].sizeInParent, 38, 'joining below preserves sibling size');
assert.equal(data.layoutTree.children[0].children[1].sizeInParent, 70, 'joining below preserves existing leaf size');
assert.equal(data.layoutTree.children[0].children[0].sizeInParent, 30, 'joining below keeps the target leaf size over calculated defaults');
assert.equal(data.layoutTree.children[0].children[0].type, 'hsep', 'joining below splits the target leaf vertically');
assert.deepEqual(data.layoutTree.children[0].children[0].children.map(n => n.tab), [tabs[0], tabs[4]]);
data.tabs = [tabs[0]];
data.gridType = 'vsep';
data.layoutTree = tree(data.tabs);
for (const tab of tabs) tab.splitView = data.tabs.includes(tab);
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
const resizeRight = accordionResize('right');
assert.equal(resizeRight.hidden, false);
for (const name of ['pointerdown', 'mousedown', 'click']) {
  const beforePress = win.gBrowser.selectedTab;
  const press = guardedPress(resizeRight, name, () => { win.gBrowser.selectedTab = tabs[3]; });
  assert.equal(press.prevented, true, `${name} on resize target is prevented`);
  assert.equal(press.stopped, true, `${name} on resize target cannot reach strip selection`);
  assert.equal(win.gBrowser.selectedTab, beforePress, `${name} on resize target does not switch tabs`);
  if (name === 'pointerdown') {
    assert.equal(resizeRight.capturedPointer, 41, 'resize target captures the pointer before drag');
    resizeRight.emit('pointercancel', {pointerId:41});
  }
}
resizeRight.emit('pointerdown', {button:2, pointerId:7, clientX:500});
resizeRight.emit('pointermove', {pointerId:7, clientX:520}); flush();
assert.equal(container(tabs[2]).getAttribute('--pane-accordion-left'), '44px', 'secondary button does not resize');
resizeRight.emit('pointerdown', {button:0, pointerId:7, clientX:500});
resizeRight.emit('pointermove', {pointerId:8, clientX:900});
resizeRight.emit('pointermove', {pointerId:7, clientX:509});
resizeRight.emit('pointermove', {pointerId:7, clientX:510.125});
assert.equal(container(tabs[2]).getAttribute('--pane-accordion-left'), '44px', 'pointer moves wait for a rendering frame');
flush();
near(parseFloat(container(tabs[2]).getAttribute('--pane-accordion-left')), 33.875);
resizeRight.emit('pointerup', {pointerId:7});
container(tabs[0]).querySelector('.pane-accordion-handle').emit('click');
near(parseFloat(container(tabs[0]).getAttribute('--pane-accordion-right')), 67.75);
assert.equal(container(tabs[0]).querySelector('.pane-accordion-resize-left').hidden, true);
container(tabs[2]).querySelector('.pane-accordion-handle').emit('click');
near(parseFloat(container(tabs[2]).getAttribute('--pane-accordion-left')), 33.875, 'width survives selection');
container(tabs[2]).querySelector('.pane-accordion-handle').emit('keydown', {key:'ArrowRight'});
near(parseFloat(container(tabs[0]).getAttribute('--pane-accordion-right')), 67.75, 'keyboard selection keeps resized width');
container(tabs[2]).querySelector('.pane-accordion-handle').emit('click');
const resizeLeft = accordionResize('left');
resizeLeft.emit('pointerdown', {button:0, pointerId:9, clientX:500});
resizeLeft.emit('pointermove', {pointerId:9, clientX:510.125});
resizeLeft.emit('pointercancel', {pointerId:9});
assert.equal(container(tabs[2]).getAttribute('--pane-accordion-left'), '44px', 'left drag shrinks and cancellation flushes');
resizeLeft.emit('pointermove', {pointerId:9, clientX:900}); flush();
assert.equal(container(tabs[2]).getAttribute('--pane-accordion-left'), '44px', 'cancel ends the drag');

// Uneven neighbors: the active pane has one strip to its left and two to its right.
controller.join(data, tabs[1], 'right');
controller.arrange(tabs[2], 'accordion');
const fourPaneTree = data.layoutTree;
const fourRight = accordionResize('right');
fourRight.emit('pointerdown', {button:0, pointerId:10, clientX:500});
fourRight.emit('pointermove', {pointerId:10, clientX:484}); flush();
near(parseFloat(container(tabs[2]).getAttribute('--pane-accordion-left')), 52);
near(parseFloat(container(tabs[2]).getAttribute('--pane-accordion-right')), 104);
fourRight.emit('pointerup', {pointerId:10});
const fourLeft = accordionResize('left');
fourLeft.emit('pointerdown', {button:0, pointerId:11, clientX:500});
fourLeft.emit('pointermove', {pointerId:11, clientX:508}); flush();
near(parseFloat(container(tabs[2]).getAttribute('--pane-accordion-left')), 60);
near(parseFloat(container(tabs[2]).getAttribute('--pane-accordion-right')), 120);
fourLeft.emit('pointerup', {pointerId:11});
assert.equal(data.layoutTree, fourPaneTree, 'resizing preserves the native four-pane tree');
const panelBounds = view.tabBrowserPanel.getBoundingClientRect;
view.tabBrowserPanel.getBoundingClientRect = () => ({width:2400, height:900});
controller.sync(); flush();
near(parseFloat(container(tabs[2]).getAttribute('--pane-accordion-left')), 120);
near(parseFloat(container(tabs[2]).getAttribute('--pane-accordion-right')), 240);
view.tabBrowserPanel.getBoundingClientRect = panelBounds;
controller.sync(); flush();

fourRight.emit('pointerdown', {button:0, pointerId:12, clientX:500});
fourRight.emit('pointermove', {pointerId:12, clientX:492});
container(tabs[2]).querySelector('.pane-accordion-bar').remove();
controller.sync(); flush();
assert.equal(fourRight.hasAttribute('data-dragging'), false, 'rebuilding ends the old drag');
assert.equal(fourRight.capturedPointer, null, 'rebuilding releases pointer capture');
const rebuiltRight = accordionResize('right');
assert.equal(rebuiltRight, fourRight, 'active chrome rebuild keeps the neighbor-strip resize target');
const rebuiltWidth = container(tabs[2]).getAttribute('--pane-accordion-left');
fourRight.emit('pointermove', {pointerId:12, clientX:900}); flush();
assert.equal(container(tabs[2]).getAttribute('--pane-accordion-left'), rebuiltWidth, 'old target cannot continue resizing');
rebuiltRight.emit('pointerdown', {button:0, pointerId:13, clientX:500});
rebuiltRight.emit('pointermove', {pointerId:13, clientX:516}); flush();
near(parseFloat(container(tabs[2]).getAttribute('--pane-accordion-left')), 56);
rebuiltRight.emit('pointerup', {pointerId:13});
// Missing strips are rebuilt rather than dereferenced during layout.
rebuiltRight.emit('pointerdown', {button:0, pointerId:15, clientX:500});
rebuiltRight.remove();
controller.sync(); flush();
assert.equal(rebuiltRight.capturedPointer, null, 'removing the strip itself ends its drag');
assert.ok(accordionResize('right'), 'removing the strip itself rebuilds a visible resize target');
rebuiltRight.emit('pointerdown', {button:0, pointerId:17, clientX:500});
assert.equal(rebuiltRight.capturedPointer, null, 'removed targets cannot start another drag');
const countChangeRight = accordionResize('right');
countChangeRight.emit('pointerdown', {button:0, pointerId:16, clientX:500});
countChangeRight.emit('pointermove', {pointerId:16, clientX:492});
view.removeTabFromGroup(tabs[1]);
controller.sync(); flush();
assert.equal(countChangeRight.hasAttribute('data-dragging'), false, 'member removal ends accordion resize');
assert.equal(countChangeRight.capturedPointer, null, 'member removal releases accordion pointer capture');
const countChangeWidth = container(tabs[2]).getAttribute('--pane-accordion-left');
countChangeRight.emit('pointermove', {pointerId:16, clientX:900}); flush();
assert.equal(container(tabs[2]).getAttribute('--pane-accordion-left'), countChangeWidth, 'old member count cannot keep resizing');
controller.arrange(tabs[2], 'tiles');
data.tabs = data.tabs.filter(tab => tab !== tabs[1]);
tabs[1].splitView = false;
data.layoutTree = tiledTree;
controller.arrange(tabs[2], 'accordion');
const hoverHandle = container(tabs[0]).querySelector('.pane-accordion-handle');
hoverHandle.emit('pointerenter',{clientX:20,clientY:50});
assert.equal(doc.querySelector('.pane-accordion-edge-hint'),null,'hint waits before appearing');
for (const [id,fn] of [...timers]) { timers.delete(id); fn(); }
assert.equal(doc.querySelector('.pane-accordion-hint-title').textContent,tabs[0].label,'hover identifies the background tab');
hoverHandle.emit('pointerleave');
assert.equal(doc.querySelector('.pane-accordion-edge-hint'),null,'leaving an edge hides its hint');
hoverHandle.emit('pointerenter',{clientX:20,clientY:50}); hoverHandle.emit('pointerleave');
assert.equal(timers.size,0,'brief edge crossings cancel the delayed hint');
container(tabs[0]).querySelector('.pane-accordion-handle').emit('click');
assert.equal(win.gBrowser.selectedTab,tabs[0],'clicking a strip focuses its original tab');
const firstMotion = container(tabs[0]).animations.at(-1);
assert.equal(firstMotion.options.duration,160,'switching uses a short position animation');
container(tabs[0]).querySelector('.pane-accordion-handle').emit('keydown',{key:'ArrowRight'});
assert.equal(win.gBrowser.selectedTab,tabs[2],'Right expands the next accordion tab');
assert.ok(firstMotion.cancelled,'rapid switches cancel the previous animation');
container(tabs[2]).querySelector('.pane-accordion-handle').emit('keydown',{key:'End'});
assert.equal(win.gBrowser.selectedTab,tabs[3]);
const shortcut = {key:'ArrowRight',altKey:true,shiftKey:true,ctrlKey:false,metaKey:false};
win.emit('keydown',shortcut);
assert.equal(win.gBrowser.selectedTab,tabs[0],'global Next wraps to the first tab');
assert.equal(doc.activeElement,tabs[0].linkedBrowser,'navigation focuses the newly expanded page');
win.emit('keydown',{...shortcut,key:'ArrowLeft'});
assert.equal(win.gBrowser.selectedTab,tabs[3],'global Previous wraps to the last tab');
motion.matches = true; motion.emit('change');
assert.ok(container(tabs[3]).animations.at(-1).cancelled,'enabling reduced motion stops an in-flight animation');
const motionCount = container(tabs[0]).animations.length;
win.emit('keydown',shortcut);
assert.equal(container(tabs[0]).animations.length,motionCount,'reduced motion prevents new switch animations');
win.emit('keydown',{...shortcut,key:'ArrowLeft'});
motion.matches = false;
win.emit('keydown',{...shortcut,altKey:false,shiftKey:false});
assert.equal(win.gBrowser.selectedTab,tabs[3],'ordinary arrows leave page navigation alone');
shortcutPrefs.set('mod.pane.accordion-next','Disabled');
win.emit('keydown',shortcut);
assert.equal(win.gBrowser.selectedTab,tabs[3],'disabled navigation does not switch');
shortcutPrefs.set('mod.pane.accordion-next','Ctrl+F8');
win.emit('keydown',{key:'F8',ctrlKey:true});
assert.equal(win.gBrowser.selectedTab,tabs[0],'custom shortcuts update without reloading');
shortcutPrefs.clear();
const shortcutRightBefore = parseFloat(container(tabs[0]).getAttribute('--pane-accordion-right'));
const dragIgnored = accordionResize('right');
dragIgnored.emit('pointerdown', {button:0, pointerId:42, clientX:500});
win.emit('keydown',{key:'=',code:'Equal',altKey:true,shiftKey:true,ctrlKey:false,metaKey:false});
near(parseFloat(container(tabs[0]).getAttribute('--pane-accordion-right')), shortcutRightBefore, 'resize shortcuts are ignored during pointer drag');
dragIgnored.emit('pointercancel', {pointerId:42});
win.emit('keydown',{key:'=',code:'Equal',altKey:true,shiftKey:true,ctrlKey:false,metaKey:false});
const shortcutRightWider = parseFloat(container(tabs[0]).getAttribute('--pane-accordion-right'));
assert.ok(shortcutRightWider < shortcutRightBefore, 'widen shortcut expands the active accordion tab');
win.emit('keydown',{key:'_',code:'Minus',altKey:true,shiftKey:true,ctrlKey:false,metaKey:false});
assert.ok(parseFloat(container(tabs[0]).getAttribute('--pane-accordion-right')) > shortcutRightWider, 'narrow shortcut shrinks the active accordion tab');
for (let i = 0; i < 30; i++) win.emit('keydown',{key:'_',code:'Minus',altKey:true,shiftKey:true,ctrlKey:false,metaKey:false});
near(parseFloat(container(tabs[0]).getAttribute('--pane-accordion-right')), 880);
for (let i = 0; i < 30; i++) win.emit('keydown',{key:'=',code:'Equal',altKey:true,shiftKey:true,ctrlKey:false,metaKey:false});
near(parseFloat(container(tabs[0]).getAttribute('--pane-accordion-right')), 64);
shortcutPrefs.set('mod.pane.accordion-widen','Disabled');
win.emit('keydown',{key:'=',code:'Equal',altKey:true,shiftKey:true,ctrlKey:false,metaKey:false});
near(parseFloat(container(tabs[0]).getAttribute('--pane-accordion-right')), 64, 'disabled resize shortcut does not resize');
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
assert.deepEqual(layoutSizes(tiledTree),[36,50],'every divider size survives accordion');
assert.equal(doc.querySelectorAll('.pane-accordion-handle').length,0);
assert.equal(doc.querySelectorAll('.pane-accordion-bar').length,0);
assert.equal(doc.querySelectorAll('.pane-accordion-resize').length,0, 'returning to tiles removes resize targets');
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
assert.equal(container(tabs[0]).hasAttribute('pane-accordion'),true,'remaining accordion stays accordion');
const removeBeforeFailure=view.removeTabFromGroup;
view.removeTabFromGroup=()=>{throw new Error('detach failed');};
assert.throws(()=>controller.arrange(tabs[0],'normal'),/detach failed/);
assert.equal(container(tabs[0]).hasAttribute('pane-accordion'),true,'failed detach restores presentation');
view.removeTabFromGroup=removeBeforeFailure;
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
container(tabs[1]).querySelector('.pane-accordion-handle').emit('pointerenter',{clientX:10,clientY:50});
unloadingAccordion.destroy();
assert.equal(timers.size,0,'unload cancels pending hover hints');
assert.equal(doc.querySelectorAll('.pane-accordion-handle').length,0,'unloading restores tiled presentation');
assert.equal(lastLayout,data.layoutTree,'unloading accordion restores the unchanged native tree');
assert.equal((win.listeners.get('keydown') ?? []).length,0,'unload removes accordion shortcuts');
assert.ok(tabs.every(tab=>!container(tab).hasAttribute('--pane-accordion-line-left')),'unload removes separator geometry');
// Recreate the controller against restored native tabs, as a browser restart does.
const savedLayouts = new Map();
const savedScrollings = new Map();
const savedFloats = new Map();
const savedSplits = new Map();
const sessionValues = key => key==='pane-split-v1' ? savedSplits : key==='pane-floating-v1' ? savedFloats : key==='pane-scrolling-v1' ? savedScrollings : savedLayouts;
win.SessionStore = {
  getCustomTabValue: (tab,key) => sessionValues(key).get(tab) ?? '',
  setCustomTabValue: (tab, key, value) => sessionValues(key).set(tab, value),
  deleteCustomTabValue: (tab,key) => sessionValues(key).delete(tab),
};
const options = {notify(){},chooseTab(){},appearance(){},origins:{begin(){},end(){},destroy(){}}};
const hiddenUnloadController = createMultiwindow(win, options); flush();
const reloadTree = {children:[{tab:0,sizeInParent:50},{tab:1,sizeInParent:50}]};
savedSplits.clear();
for (const [index, tab] of [tabs[3], tabs[4]].entries()) savedSplits.set(tab, JSON.stringify({version:1,group:'reload-hidden',count:2,type:'grid',index,tree:reloadTree}));
tabs[3].hidden = tabs[4].hidden = true;
hiddenUnloadController.destroy();
assert.equal(savedSplits.size,2,'real unload preserves hidden pending split records');
hiddenUnloadController.destroy();
assert.equal(savedSplits.size,2,'double destroy is a no-op for preserved hidden records');
tabs[3].hidden = tabs[4].hidden = false;
const hiddenRestoreBefore = splitCalls;
const hiddenRestoreController = createMultiwindow(win, options);
win.emit('SSTabRestored'); flush();
assert.equal(splitCalls,hiddenRestoreBefore + 1,'hidden pending records restore when shown after unload');
hiddenRestoreController.destroy();
data.tabs = [tabs[0], tabs[1]]; data.layoutTree = tree(data.tabs); data.gridType = 'vsep';
for (const tab of tabs) tab.splitView = data.tabs.includes(tab);
savedSplits.clear(); tabs[4].hidden = false;
const nullController = createMultiwindow(win, options); flush();
nullController.destroy(null);
assert.equal(savedSplits.size,0,'destroy(null) uses real unload cleanup for visible records');
data.tabs = [tabs[0]]; data.layoutTree = tree(data.tabs); data.gridType = 'vsep';
for (const tab of tabs) tab.splitView = data.tabs.includes(tab);
const visibleReinitBefore = splitCalls;
const visibleReinit = createMultiwindow(win, options); flush();
assert.equal(splitCalls,visibleReinitBefore,'re-init after visible unload and native unsplit does not re-split');
visibleReinit.destroy();
data.tabs = [tabs[0], tabs[1]]; data.layoutTree = tree(data.tabs); data.gridType = 'vsep';
for (const tab of tabs) tab.splitView = data.tabs.includes(tab);
savedSplits.clear(); savedFloats.clear();
const detachController = createMultiwindow(win, options); flush();
savedFloats.set(tabs[1], JSON.stringify({version:1,rect:{x:10,y:10,width:300,height:200},headerPinned:false}));
assert.ok(savedSplits.size > 0, 'active controller has split metadata before stale detach');
detachController.destroy({detachOnly:true});
assert.ok(savedSplits.size > 0, 'stale detach leaves live split records alone');
assert.equal(savedFloats.size,1,'stale detach leaves live float records alone');
assert.deepEqual(data.tabs,[tabs[0],tabs[1]],'stale detach does not mutate the live split group');
const mouseupController = createMultiwindow(win, options); flush();
const hiddenTree = {children:[{tab:0,sizeInParent:50},{tab:1,sizeInParent:50}]};
for (const [index, tab] of [tabs[3], tabs[4]].entries()) savedSplits.set(tab, JSON.stringify({version:1,group:'hidden',count:2,type:'grid',index,tree:hiddenTree}));
tabs[4].hidden = true;
const beforeMouseupSplits = splitCalls;
win.emit('mouseup'); flush();
assert.equal(splitCalls,beforeMouseupSplits,'mouseup only saves changed layout state and never runs split restore');
mouseupController.destroy();
assert.equal(savedSplits.size,0,'real unload clears mixed-visibility pending groups atomically');
savedSplits.clear();
tabs[4].hidden = false;
data.tabs = [tabs[3], tabs[4]]; data.layoutTree = tree(data.tabs); data.gridType = 'vsep';
for (const tab of tabs) { tab.splitView = data.tabs.includes(tab); tab.hidden = data.tabs.includes(tab); }
const hiddenWorkspaceController = createMultiwindow(win, options); flush();
assert.ok(savedSplits.size > 0, 'hidden workspace split records are saved while Pane is active');
hiddenWorkspaceController.destroy();
assert.equal(savedSplits.size,0,'disable clears restored split records in hidden workspaces');
data.tabs = [tabs[3]]; data.layoutTree = tree(data.tabs); data.gridType = 'vsep';
for (const tab of tabs) { tab.splitView = data.tabs.includes(tab); tab.hidden = false; }
const hiddenReinitBefore = splitCalls;
const hiddenWorkspaceReinit = createMultiwindow(win, options); flush();
assert.equal(splitCalls,hiddenReinitBefore,'re-init after hidden-workspace native unsplit does not re-split');
hiddenWorkspaceReinit.destroy();
data.tabs = [tabs[0], tabs[1]]; data.layoutTree = tree(data.tabs); data.gridType = 'vsep';
for (const tab of tabs) tab.splitView = data.tabs.includes(tab);
const closingController = createMultiwindow(win, options); flush();
assert.ok(savedSplits.size > 0, 'active controller has split metadata to preserve on close');
win.emit('SSWindowClosing');
closingController.destroy();
assert.ok(savedSplits.size > 0, 'window close shortcut preserves split recovery metadata');
const cancelledCloseController = createMultiwindow(win, options); flush();
win.emit('close');
const closeReset = [...timers.entries()].at(-1);
timers.delete(closeReset[0]); closeReset[1]();
cancelledCloseController.destroy();
assert.equal(savedSplits.size,0,'cancelled close resets the close flag before disable cleanup');
const beforeRestart = createMultiwindow(win, options);
beforeRestart.arrange(tabs[0], 'accordion');
assert.equal(savedLayouts.size, 2, 'accordion is saved on its member tabs');
const restartResize = accordionResize('right');
restartResize.emit('pointerdown', {button:0, pointerId:31, clientX:500});
restartResize.emit('pointermove', {pointerId:31, clientX:507.125});
restartResize.emit('pointerup', {pointerId:31});
near(parseFloat(container(tabs[0]).getAttribute('--pane-accordion-right')), 36.875);
assert.ok([...savedLayouts.values()].every(value =>
  Object.keys(JSON.parse(value)).sort().join(',') === 'active,group'),
  'resize leaves existing accordion restart metadata unchanged');
const preservedTree = data.layoutTree;
const preservedEncodedTree = encodeTree(data.layoutTree,data.tabs);
options.origins.shuttingDown=true; beforeRestart.destroy(); options.origins.shuttingDown=false;
assert.equal(savedLayouts.size, 2, 'unload preserves restart metadata');
view._sessionRestoring = true;
const afterRestart = createMultiwindow(win, options); flush();
assert.equal(doc.querySelectorAll('.pane-accordion-handle').length, 0, 'wait for native session restore');
view._sessionRestoring = false;
win.emit('SSWindowStateReady'); flush();
assert.equal(doc.querySelectorAll('.pane-accordion-handle').length, 2, 'restore accordion after restart');
assert.equal(container(tabs[0]).getAttribute('--pane-accordion-right'), '44px', 'restart restores accordion with default session-only width');
assert.equal(data.layoutTree, preservedTree, 'restart keeps Zen native layout nodes');
assert.deepEqual(encodeTree(data.layoutTree,data.tabs), preservedEncodedTree, 'restart keeps every native divider size');
afterRestart.arrange(tabs[0], 'tiles');
assert.equal(savedLayouts.size, 0, 'explicit return to tiles clears saved accordion');
afterRestart.destroy();
const finalRestart = createMultiwindow(win, options); flush();
assert.equal(doc.querySelectorAll('.pane-accordion-handle').length, 0, 'tiles stay tiled after next restart');
finalRestart.destroy();
// First scrolling prototype: stable native pages, modifier-gated wheel and cleanup.
const scrolling = createMultiwindow(win, {...options,prefs:{...prefs,getIntPref:(key,fallback)=>fallback}});
win.navigator = {platform:'Win32'};
win.emit('keydown',{key:'l',altKey:true,shiftKey:true});
assert.ok(doc.querySelector('.pane-layout-menu'),'layout shortcut opens menu in a tiled split');
const layoutChoices=doc.querySelector('.pane-layout-menu').querySelectorAll('[data-mode]').map(node=>node.dataset.mode);
assert.equal(layoutChoices.filter(mode=>mode==='scrolling').length,1,'menu has one scrolling choice');
assert.equal(layoutChoices.includes('snapshot'),false);
assert.equal(Object.keys(modeLabels).filter(mode=>['snapshot','scrolling'].includes(mode)).length,1,'picker has one scrolling choice');
scrolling.closeMenu();
win.navigator = {platform:'MacIntel'};
win.emit('keydown',{key:'l',code:'KeyL',ctrlKey:true,shiftKey:true,view:{navigator:{platform:''}}});
assert.ok(doc.querySelector('.pane-layout-menu'),'Mac Ctrl+Shift+L opens the layout menu');
scrolling.closeMenu();
win.navigator = {platform:'Win32'};
win.emit('keydown',{key:'l',altKey:true,shiftKey:true,target:{ownerDocument:{documentElement:{hasAttribute:()=>true}}}});
assert.equal(doc.querySelector('.pane-layout-menu'),null,'shortcut recording does not open a layout menu');
scrolling.arrange(tabs[0], 'scrolling');
win.emit('keydown', {type:'keydown',altKey:true,shiftKey:true});
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,1,'modifier opens the snapshot overview');
assert.equal(container(tabs[0]).getAttribute('--pane-scrolling-width'), '1200px');
let consumed = false;
const wheel = {target:tabs[0].linkedBrowser, deltaY:100, deltaX:0, deltaMode:0, preventDefault(){consumed=true;}};
win.emit('wheel', {...wheel,deltaY:0});
assert.equal(consumed, true, 'held gesture is reserved even without wheel modifier flags');
consumed = false;
win.emit('wheel', {...wheel, altKey:true, shiftKey:true});
assert.equal(consumed, true, 'modifier wheel pans');
assert.equal(doc.querySelector('.pane-snapshot-strip').getAttribute('transform'), 'translateX(-100px)');
scrolling.scrollStep(data, 1);
assert.equal(win.gBrowser.selectedTab, tabs[0], 'overview step preserves the native selected tab');
assert.equal(doc.querySelector('.pane-snapshot-strip').getAttribute('transform'), 'translateX(-370px)', 'overview step respects the last-column boundary');
scrolling.add(tabs[1],tabs[2],'grid');
win.emit('keydown', {type:'keydown',altKey:true,shiftKey:true});
assert.equal(container(tabs[0]).getAttribute('--pane-scrolling-width'), '1200px', 'new columns do not shrink existing pages');
assert.equal(container(tabs[2]).hasAttribute('pane-scrolling'), true);
assert.equal(doc.querySelectorAll('.pane-snapshot-card').length, 3);
consumed = false;
win.emit('wheel', {...wheel, altKey:true, shiftKey:true, deltaY:10000});
assert.equal(doc.querySelector('.pane-snapshot-strip').getAttribute('transform'), 'translateX(-1160px)', 'last column reaches the right edge');
assert.equal(consumed, true);
assert.equal(container(tabs[2]).hasAttribute('pane-scrolling-landing'), true, 'highlight identifies release target');
assert.equal(container(tabs[0]).hasAttribute('pane-scrolling-landing'), false);
consumed = false;
win.emit('wheel', {...wheel, altKey:true, shiftKey:true, deltaY:100});
assert.equal(consumed, true, 'gesture stays intercepted at right boundary');
assert.equal(doc.querySelector('.pane-snapshot-strip').getAttribute('transform'), 'translateX(-1160px)');
consumed = false;
win.emit('wheel', {...wheel, deltaY:100});
assert.equal(consumed, true, 'wheel flags cannot release a gesture while the key remains held');
const selectedDuringOverview=win.gBrowser.selectedTab;
scrolling.scrollStep(data,-1);
assert.equal(win.gBrowser.selectedTab,selectedDuringOverview,'overview navigation does not steal native focus');
scrolling.scrollStep(data,1);
win.emit('blur',{type:'blur',target:tabs[2].linkedBrowser});
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,1,'child focus changes do not close the overview');
win.emit('wheel', {...wheel, altKey:true, shiftKey:true, deltaY:-10000});
assert.equal(container(tabs[0]).hasAttribute('pane-scrolling-landing'), true, 'preview highlight can leave the selected tab');
assert.equal(win.gBrowser.selectedTab,tabs[2],'panning does not steal native focus');
const cardArrange = [...doc.querySelectorAll('.pane-scrolling-control')].find(node => node.getAttribute('aria-label')==='Arrange scrolling tabs' && node.closest('.pane-snapshot-card'));
cardArrange.box = {left:420,top:60,right:452,bottom:92,width:32,height:32};
cardArrange.emit('click');
const cardMenu = doc.querySelector('.pane-layout-menu');
assert.ok(cardMenu,'card Arrange opens the layout menu');
assert.equal(cardMenu.style.left,'172px','card Arrange menu anchors to the button, not 0,0');
assert.equal(cardMenu.style.top,'92px');
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,0,'opening the menu cancels the overview');
assert.equal(win.gBrowser.selectedTab,tabs[2],'menu cancel does not commit the landing tab');
scrolling.closeMenu();
win.emit('keyup',{type:'keyup',altKey:false,shiftKey:false});
assert.equal(win.gBrowser.selectedTab,tabs[2],'releasing after a card menu keeps the selection');
win.emit('keydown', {type:'keydown',altKey:true,shiftKey:true});
win.emit('wheel', {...wheel, altKey:true, shiftKey:true, deltaY:10000});
win.emit('keyup', {type:'keyup',altKey:false,shiftKey:false});
assert.equal(doc.activeElement,tabs[2].linkedBrowser,'release focuses the landing page');
consumed=false;
win.emit('wheel',wheel);
assert.equal(consumed,false,'page scrolling resumes after actual key release');
assert.equal(container(tabs[2]).getAttribute('--pane-scrolling-width'), '1200px', 'release returns focused page to full width');
assert.equal(win.gBrowser.selectedTab, tabs[2], 'release activates column nearest view center');
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,1,'native handoff is covered before a new frame');
flush(); flush();
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,1,'animation frames alone do not reveal the page');
tabs[2].linkedBrowser.isRemoteBrowser=true;
tabs[2].linkedBrowser.hasLayers=false;
win.emit('MozAfterPaint',{transactionId:1});
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,1,'unready destination layers keep the cover');
const slowTimer=[...timers.entries()].at(-1);
timers.delete(slowTimer[0]); slowTimer[1]();
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,1,'timeout cannot reveal unready layers');
assert.ok(doc.querySelector('.pane-scrolling-wait'),'slow destination offers tiled recovery');
tabs[2].linkedBrowser.hasLayers=true;
win.gBrowser._switcher={visibleTab:tabs[1]};
win.emit('MozAfterPaint',{transactionId:2});
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,1,'outgoing native surface stays covered');
win.gBrowser._switcher.visibleTab=tabs[2];
win.emit('MozAfterPaint',{transactionId:3});
delete win.gBrowser._switcher;
assert.equal((win.listeners.get('MozAfterPaint')??[]).length,0,'paint listener cleans up after reveal');
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,0,'completed paint releases the cover');
win.emit('keydown',{type:'keydown',altKey:true,shiftKey:true});
win.emit('wheel',{...wheel,deltaY:-10000});
win.emit('keydown',{type:'keydown',key:'Escape',altKey:true,shiftKey:true});
assert.equal(win.gBrowser.selectedTab,tabs[2],'Escape restores the starting tab');
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,0,'Escape closes overview');
win.emit('keydown',{type:'keydown',key:'ArrowLeft',altKey:true,shiftKey:true});
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,0,'cancelled gesture cannot reopen while held');
win.emit('keyup',{type:'keyup',altKey:false,shiftKey:false});
assert.equal(win.gBrowser.selectedTab,tabs[2],'release after Escape does not commit');
win.emit('keydown',{type:'keydown',altKey:true,shiftKey:true});
win.emit('wheel',{...wheel,deltaY:-10000});
win.emit('keydown',{type:'keydown',key:'l',altKey:true,shiftKey:true});
assert.ok(doc.querySelector('.pane-layout-menu'),'menu opens during overview');
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,0,'menu suspends overview');
win.emit('keyup',{type:'keyup',altKey:false,shiftKey:false});
assert.equal(win.gBrowser.selectedTab,tabs[2],'releasing menu shortcut preserves selection');
scrolling.closeMenu();
win.emit('keyup',{type:'keyup',altKey:false,shiftKey:false});
win.emit('keydown',{type:'keydown',altKey:true,shiftKey:true});
doc.querySelector('.pane-snapshot-card').querySelector('.pane-scrolling-resize').emit('keydown',{key:'ArrowRight'});
assert.equal(doc.querySelector('.pane-snapshot-card').getAttribute('width'),'800px','re-entering scrolling preserves individual widths');
win.emit('keyup',{type:'keyup',altKey:false,shiftKey:false});
scrolling.arrange(tabs[2],'scrolling');
win.emit('keydown',{type:'keydown',altKey:true,shiftKey:true});
assert.equal(doc.querySelector('.pane-snapshot-card').getAttribute('width'),'800px','re-entering scrolling preserves individual widths');
win.emit('keyup',{type:'keyup',altKey:false,shiftKey:false});
const calculateBeforeFailure=view.calculateLayoutTree;
view.calculateLayoutTree=()=>{throw new Error('layout failure');};
assert.throws(()=>scrolling.arrange(tabs[0],'below'),/layout failure/);
view.calculateLayoutTree=calculateBeforeFailure;
assert.equal(win.gBrowser.selectedTab,tabs[2],'failed layout restores starting selection');
assert.equal(scrolling.capturePresentation(data).scrolling.widths.get(tabs[0]),800,'failed layout restores custom widths');
scrolling.arrange(tabs[2], 'accordion');
assert.equal(container(tabs[2]).hasAttribute('pane-scrolling'), false, 'accordion clears scrolling styles');
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length, 0, 'accordion removes the snapshot overlay');
scrolling.arrange(tabs[0], 'scrolling');
win.emit('keydown', {type:'keydown',altKey:true,shiftKey:true});
scrolling.arrange(tabs[0], 'tiles');
assert.equal(doc.querySelectorAll('.pane-scrolling-header').length, 0);
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length, 0);
scrolling.arrange(tabs[0], 'scrolling');
win.emit('keydown', {type:'keydown',altKey:true,shiftKey:true});
doc.querySelector('.pane-snapshot-card').querySelector('.pane-scrolling-resize').emit('keydown',{key:'ArrowRight'});
scrolling.arrange(tabs[2],'normal');
assert.equal(container(tabs[0]).hasAttribute('pane-scrolling'),true,'remaining scrolling split keeps its presentation');
scrolling.add(tabs[0],tabs[2],'scrolling');
win.emit('keydown', {type:'keydown',altKey:true,shiftKey:true});
assert.equal(doc.querySelector('.pane-snapshot-card').getAttribute('width'),'800px','adding in scrolling mode preserves custom widths');
win.emit('keyup',{type:'keyup',altKey:false,shiftKey:false});
options.origins.shuttingDown=true; scrolling.destroy(); options.origins.shuttingDown=false;
assert.equal(doc.querySelectorAll('.pane-scrolling-header').length, 0, 'unload cleans scrolling headers');
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length, 0, 'unload removes the snapshot overlay');
assert.equal((win.listeners.get('wheel') ?? []).length, 0, 'unload removes wheel interception');
assert.equal(savedScrollings.size,3,'scrolling metadata survives unload');
const restoredScrolling=createMultiwindow(win,{...options,prefs:{...prefs,getIntPref:(key,fallback)=>fallback}}); flush();
assert.equal(doc.querySelectorAll('.pane-scrolling-header').length,3,'scrolling returns automatically after restart');
win.emit('keydown', {type:'keydown',altKey:true,shiftKey:true});
assert.equal(doc.querySelector('.pane-snapshot-card').getAttribute('width'),'800px','custom column width round-trips through SessionStore');
win.emit('keyup',{type:'keyup',altKey:false,shiftKey:false});
restoredScrolling.arrange(tabs[0],'tiles');
assert.equal(savedScrollings.size,0,'explicit tiles clears scrolling persistence');
restoredScrolling.destroy();
assert.equal(savedScrollings.size,0,'disabling clears scrolling recovery metadata');
data.tabs = [tabs[0],tabs[1]]; data.layoutTree=tree(data.tabs);
for (const tab of tabs) tab.splitView=data.tabs.includes(tab);
win.gBrowser.selectedTab=tabs[0];
// Both legacy IDs and PR #3's boolean records recover into the single layout.
for (const oldMode of ['snapshot', 'scrolling']) {
  data.tabs = [tabs[0],tabs[1],tabs[2]]; data.layoutTree=tree(data.tabs);
  for (const tab of tabs) tab.splitView=data.tabs.includes(tab);
  win.gBrowser.selectedTab=tabs[0];
  const merged=createMultiwindow(win,options);
  merged.arrange(tabs[0],oldMode);
  assert.equal(container(tabs[0]).getAttribute('--pane-scrolling-width'),'1200px');
  win.emit('keydown',{type:'keydown',altKey:true,shiftKey:true});
  assert.equal(container(tabs[0]).getAttribute('--pane-scrolling-width'),'1200px','live viewport stays full width');
  assert.equal(doc.querySelectorAll('.pane-snapshot-card').length,3);
  let consumed=false;
  win.emit('wheel',{target:tabs[0].linkedBrowser,deltaY:10000,deltaX:0,deltaMode:0,preventDefault(){consumed=true;}});
  assert.equal(consumed,true);
  assert.equal(container(tabs[2]).hasAttribute('pane-scrolling-landing'),true);
  win.emit('keydown',{type:'keydown',key:'Escape',altKey:true,shiftKey:true});
  assert.equal(win.gBrowser.selectedTab,tabs[0],'Escape restores start tab');
  assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,0);
  win.emit('keyup',{type:'keyup'});
  win.emit('keydown',{type:'keydown',altKey:true,shiftKey:true});
  const card=doc.querySelector('.pane-snapshot-card');
  card.querySelector('.pane-scrolling-resize').emit('keydown',{key:'ArrowRight'});
  assert.equal(card.getAttribute('width'),'800px','preview resize uses shared column controls');
  win.emit('keyup',{type:'keyup'}); flush();
  win.emit('MozAfterPaint',{transactionId:10});
  assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,0,'paint clears preview cover');
  const originalLayout=view.calculateLayoutTree;
  view.calculateLayoutTree=()=>{throw Error('layout failure');};
  assert.throws(()=>merged.arrange(tabs[0],'below'),/layout failure/);
  view.calculateLayoutTree=originalLayout;
  assert.equal(merged.capturePresentation(data).scrolling.widths.get(tabs[0]),800,'failed layout restores scrolling widths');
  const widths=merged.capturePresentation(data).scrolling.widths;
  assert.equal(widths.get(tabs[0]),800);
  merged.add(tabs[0],tabs[3],oldMode);
  assert.equal(merged.capturePresentation(data).scrolling.widths.get(tabs[0]),800,'legacy add preserves widths');
  const splitTabs=[...data.tabs];
  options.origins.shuttingDown=true; merged.destroy(); options.origins.shuttingDown=false;
  for (const tab of splitTabs) {
    const record=JSON.parse(savedScrollings.get(tab));
    record.snapshot=oldMode==='snapshot'; delete record.mode; record.width=800.125;
    savedScrollings.set(tab,JSON.stringify(record));
  }
  const recovered=createMultiwindow(win,options); flush();
  assert.deepEqual(data.tabs,splitTabs,'migration preserves split membership');
  assert.equal(recovered.capturePresentation(data).scrolling.widths.get(tabs[0]),800.125,'migration keeps float widths');
  win.emit('keydown',{type:'keydown',altKey:true,shiftKey:true});
  assert.equal(container(tabs[0]).getAttribute('--pane-scrolling-width'),'1200px');
  assert.equal(doc.querySelector('.pane-snapshot-card').getAttribute('width'),'800.125px');
  assert.equal(JSON.parse(savedScrollings.get(tabs[0])).mode,'scrolling','record rewritten to canonical ID');
  recovered.destroy();
}
data.tabs = [tabs[0],tabs[1],tabs[2]]; data.layoutTree=tree(data.tabs);
for (const tab of tabs) tab.splitView=data.tabs.includes(tab);
win.gBrowser.selectedTab=tabs[0];
const experimentalId=createMultiwindow(win,options);
experimentalId.arrange(tabs[0],'experimental-scrolling');
assert.equal(container(tabs[0]).hasAttribute('pane-scrolling'),true,'IDs containing experimental still enter scrolling');
const experimentalTabs=[...data.tabs];
options.origins.shuttingDown=true; experimentalId.destroy(); options.origins.shuttingDown=false;
for (const tab of experimentalTabs) {
  const record=JSON.parse(savedScrollings.get(tab));
  record.mode='experimental-scrolling';
  savedScrollings.set(tab,JSON.stringify(record));
}
const experimentalRecovered=createMultiwindow(win,options); flush();
assert.ok(experimentalRecovered.capturePresentation(data).scrolling,'saved experimental IDs restore scrolling');
assert.equal(JSON.parse(savedScrollings.get(tabs[0])).mode,'scrolling','experimental ID rewrites to canonical scrolling');
experimentalRecovered.destroy();
data.tabs=[tabs[0],tabs[1],tabs[2]];data.layoutTree=tree(data.tabs);
for (const tab of tabs) tab.splitView=data.tabs.includes(tab);
const snapshotPrototype=createMultiwindow(win,{...options,prefs:{...prefs,getIntPref:(key,fallback)=>fallback}});
snapshotPrototype.arrange(tabs[0],'snapshot');
const snapshotWidth=container(tabs[0]).getAttribute('--pane-scrolling-width');
win.emit('keydown',{type:'keydown',altKey:true,shiftKey:true});
assert.equal(container(tabs[0]).getAttribute('--pane-scrolling-width'),snapshotWidth,'snapshot overview never resizes live page');
assert.equal(doc.querySelectorAll('.pane-snapshot-card').length,3,'one snapshot card per native tab');
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,1,'overview is separate from webpage containers');
snapshotPrototype.scrollStep(data,1);
const previewLanding=container(tabs[1]);
assert.equal(previewLanding.hasAttribute('pane-scrolling-landing'),true);
win.emit('keyup',{type:'keyup'});
assert.equal(win.gBrowser.selectedTab,tabs[1],'release opens preview landing');
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,1,'preview covers native handoff');
tabs[1].linkedBrowser.isRemoteBrowser=true; tabs[1].linkedBrowser.hasLayers=false;
flush(); win.emit('MozAfterPaint',{transactionId:20});
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,1,'unready page stays covered');
for (const [id,fn] of [...timers]) {timers.delete(id);fn();}
assert.ok(doc.querySelector('.pane-scrolling-wait'),'slow page offers tiled recovery');
tabs[1].linkedBrowser.hasLayers=true;
win.emit('MozAfterPaint',{transactionId:21});
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,0,'ready paint reveals page');
win.emit('keydown',{type:'keydown',altKey:true,shiftKey:true});
const removedPreviewTab=data.tabs.pop();
snapshotPrototype.sync(); flush();
assert.equal(doc.querySelectorAll('.pane-snapshot-card').length,2,'removed tabs leave no stale snapshot cards');
view.tabBrowserPanel.getBoundingClientRect=()=>({left:20,top:30,width:1000,height:700});
snapshotPrototype.sync(); flush();
assert.equal(doc.querySelector('.pane-snapshot-overview').getAttribute('width'),'1000px','snapshot bounds follow window resize');
const otherGroup={tabs:[tabs[4]],gridType:'vsep',layoutTree:tree([tabs[4]])};
view._data.push(otherGroup); view.currentView=1; win.gBrowser.selectedTab=tabs[4];
snapshotPrototype.sync(); flush();
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,0,'leaving a split removes its overview');
assert.equal(container(tabs[0]).hasAttribute('pane-scrolling-landing'),false,'background split does not retain gesture state');
view.currentView=0; win.gBrowser.selectedTab=data.tabs[0];
data.tabs.push(removedPreviewTab);
snapshotPrototype.destroy();
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,0,'unload removes snapshot overlay');

// Floats recover original tabs and fit geometry to the restored browser bounds.
const floatSession=createMultiwindow(win,options); flush();
floatSession.arrange(data.tabs[0],'scrolling');
floatSession.arrange(data.tabs[1],'float');
assert.equal(savedScrollings.size,0,'floating replaces scrolling presentation and clears its restart metadata');
floatSession.arrange(data.tabs[2],'float');
const originalPage=data.tabs[1].linkedBrowser;
const state=floatSession.capturePresentation(data);
state.floating[0].rect={x:900,y:600,width:600,height:500};
state.floating[0].headerPinned=true;
floatSession.restorePresentation(data,state);
assert.equal(savedFloats.size,2);
options.origins.shuttingDown=true;floatSession.destroy();options.origins.shuttingDown=false;
assert.equal(savedFloats.size,2,'shutdown retains floating metadata');
view.tabBrowserPanel.getBoundingClientRect=()=>({left:0,top:0,width:400,height:300});
view._sessionRestoring=true;
const restoredFloats=createMultiwindow(win,options);flush();
assert.equal(restoredFloats.floatingTabs.length,0,'wait for native session restore before floating');
view._sessionRestoring=false;win.emit('SSWindowStateReady');flush();
assert.equal(restoredFloats.floatingTabs.length,2,'multiple floats recover');
const recovered=restoredFloats.capturePresentation(data).floating;
assert.deepEqual(recovered[0].rect,{x:0,y:0,width:400,height:300});
assert.equal(recovered[0].headerPinned,true,'header pin survives restart');
assert.equal(data.tabs[1].linkedBrowser,originalPage,'restore keeps original page instance');
restoredFloats.arrange(data.tabs[1],'grid');
assert.equal(savedFloats.has(data.tabs[1]),false,'docking clears saved geometry');
restoredFloats.destroy();
assert.equal(savedFloats.size,0,'disable clears floating session state');
savedFloats.set(data.tabs[1],JSON.stringify({version:1,rect:{x:0,y:0,width:-2,height:10}}));
savedFloats.set(data.tabs[2],JSON.stringify({version:99,rect:{x:0,y:0,width:300,height:200}}));
const invalidFloats=createMultiwindow(win,options);flush();
assert.equal(invalidFloats.floatingTabs.length,0,'invalid and future schema records do not restore');
assert.equal(savedFloats.size,0,'invalid floating metadata is discarded');
invalidFloats.destroy();
console.log('Floating sessions: multiple panels, pins, smaller bounds, original pages, docking and disable passed.');

// Picker modes use the same add/join controller as ordinary tile choices.
for (const mode of ['right', 'below', 'grid', ...presentationModes, 'float']) {
  for (const joining of [false, true]) {
    data.tabs = [tabs[0], tabs[1]];
    data.layoutTree = tree(data.tabs); data.gridType = 'vsep'; view.currentView = 0;
    for (const tab of tabs) tab.splitView = data.tabs.includes(tab);
    win.gBrowser.selectedTab = tabs[0];
    const pages = data.tabs.map(tab => tab.linkedBrowser);
    const hub = createMultiwindow(win, options); flush();
    if (joining) hub.join(data, tabs[2], mode);
    else hub.add(tabs[0], tabs[2], mode);
    assert.ok(data.tabs.includes(tabs[2]), `${mode} adds incoming tab`);
    assert.deepEqual(data.tabs.slice(0, 2).map(tab => tab.linkedBrowser), pages, `${mode} preserves existing pages`);
    const presentation = hub.capturePresentation(data);
    if (mode === 'accordion') assert.equal(presentation.accordion, tabs[2]);
    if (['snapshot', 'scrolling'].includes(mode)) assert.ok(presentation.scrolling.widths instanceof Map);
    if (mode === 'float') assert.ok(hub.floatingTabs.includes(tabs[2]));
    if (mode === 'grid') assert.equal(data.gridType, 'grid');
    if (['right', 'below'].includes(mode)) assert.equal(data.gridType, 'vsep');
    hub.destroy();
  }
}
console.log('Picker layouts: add and join preserve pages and apply every layout.');

// Persist the actual tree produced by PR #1's join path, but do not overwrite
// Zen's native session tree when Zen already restored the group.
savedSplits.clear(); savedScrollings.clear(); savedLayouts.clear(); savedFloats.clear();
resetCustomTree();
win.gBrowser.selectedTab=tabs[2];
const savingJoin=createMultiwindow(win,options); flush();
savingJoin.join(data,tabs[4],'right'); flush();
const joinedTree=encodeTree(data.layoutTree,data.tabs);
assert.equal(joinedTree.children[0].children[1].sizeInParent,70);
options.origins.shuttingDown=true; savingJoin.destroy(); options.origins.shuttingDown=false;
assert.deepEqual(JSON.parse(savedSplits.get(tabs[0])).tree,joinedTree,'saved layout uses the live joined tree and its preserved sizes');
const nativeDefaultTree = data.layoutTree = tree(data.tabs);
const recoveringJoin=createMultiwindow(win,options); flush();
assert.equal(data.layoutTree,nativeDefaultTree,'native-restored split trees are not replaced by Pane fallback data');
recoveringJoin.destroy();
