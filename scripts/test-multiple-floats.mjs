import assert from 'node:assert/strict';
import { createMultiwindow } from '../multiwindow.mjs';

// Minimal browser-chrome fixture exercising the controller with real DOM-like events.
class Node {
  constructor(doc, name = 'div') {
    this.ownerDocument = doc; this.name = name; this.children = []; this.attrs = new Map();
    this.listeners = new Map(); this.className = ''; this.dataset = {}; this.isConnected = true;
    this.animations = [];
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
  getBoundingClientRect() {return {left:0,top:0,right:1200,bottom:900,width:1200,height:900};}
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
const timers = new Map(); let timerId = 0;
const motion = new Node(doc); motion.matches = false;
Object.assign(win, {document:doc, AbortController, gZenViewSplitter:view,
  gBrowser:{tabs,selectedTab:tabs[0],tabContainer:new Node(doc)},
  requestAnimationFrame:fn => { queued=fn; return 1; }, cancelAnimationFrame(){queued=null;},
  setTimeout:fn => { timers.set(++timerId,fn); return timerId; }, clearTimeout:id => timers.delete(id),
  matchMedia:()=>motion,
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
const sessionValues = key => key==='pane-floating-v1' ? savedFloats : key==='pane-scrolling-v1' ? savedScrollings : savedLayouts;
win.SessionStore = {
  getCustomTabValue: (tab,key) => sessionValues(key).get(tab) ?? '',
  setCustomTabValue: (tab, key, value) => sessionValues(key).set(tab, value),
  deleteCustomTabValue: (tab,key) => sessionValues(key).delete(tab),
};
const options = {notify(){},chooseTab(){},appearance(){},origins:{begin(){},end(){},destroy(){}}};
const beforeRestart = createMultiwindow(win, options);
beforeRestart.arrange(tabs[0], 'accordion');
assert.equal(savedLayouts.size, 2, 'accordion is saved on its member tabs');
const preservedTree = data.layoutTree;
options.origins.shuttingDown=true; beforeRestart.destroy(); options.origins.shuttingDown=false;
assert.equal(savedLayouts.size, 2, 'unload preserves restart metadata');
view._sessionRestoring = true;
const afterRestart = createMultiwindow(win, options); flush();
assert.equal(doc.querySelectorAll('.pane-accordion-handle').length, 0, 'wait for native session restore');
view._sessionRestoring = false;
win.emit('SSWindowStateReady'); flush();
assert.equal(doc.querySelectorAll('.pane-accordion-handle').length, 2, 'restore accordion after restart');
assert.equal(data.layoutTree, preservedTree, 'restoration keeps the native layout tree');
afterRestart.arrange(tabs[0], 'tiles');
assert.equal(savedLayouts.size, 0, 'explicit return to tiles clears saved accordion');
afterRestart.destroy();
const finalRestart = createMultiwindow(win, options); flush();
assert.equal(doc.querySelectorAll('.pane-accordion-handle').length, 0, 'tiles stay tiled after next restart');
finalRestart.destroy();
// First scrolling prototype: stable native pages, modifier-gated wheel and cleanup.
const scrolling = createMultiwindow(win, {...options,prefs:{...prefs,getIntPref:(key,fallback)=>fallback}});
win.emit('keydown',{key:'l',altKey:true,shiftKey:true});
assert.ok(doc.querySelector('.pane-layout-menu'),'layout shortcut opens menu in a tiled split');
scrolling.closeMenu();
win.navigator = {platform:'MacIntel'};
win.emit('keydown',{key:'Ò',code:'KeyL',altKey:true,shiftKey:true,getModifierState:()=>true,view:{navigator:{platform:''}}});
assert.ok(doc.querySelector('.pane-layout-menu'),'Mac Option+Shift+L works with an empty event platform');
scrolling.closeMenu();
win.navigator = {platform:'Win32'};
win.emit('keydown',{key:'l',altKey:true,shiftKey:true,target:{ownerDocument:{documentElement:{hasAttribute:()=>true}}}});
assert.equal(doc.querySelector('.pane-layout-menu'),null,'shortcut recording does not open a layout menu');
scrolling.arrange(tabs[0], 'scrolling');
win.emit('keydown', {type:'keydown',altKey:true,shiftKey:true});
const firstWidth = container(tabs[0]).getAttribute('--pane-scrolling-width');
assert.equal(firstWidth, '780px');
let consumed = false;
const wheel = {target:tabs[0].linkedBrowser, deltaY:100, deltaX:0, deltaMode:0, preventDefault(){consumed=true;}};
win.emit('wheel', {...wheel,deltaY:0});
assert.equal(consumed, true, 'held gesture is reserved even without wheel modifier flags');
win.emit('wheel', {...wheel, altKey:true, shiftKey:true});
assert.equal(consumed, true, 'modifier wheel pans');
assert.equal(container(tabs[0]).getAttribute('--pane-scrolling-x'), '-100px');
scrolling.scrollStep(data, 1);
assert.equal(win.gBrowser.selectedTab, tabs[0], 'overview step preserves the native selected tab');
assert.equal(container(tabs[1]).getAttribute('--pane-scrolling-x'), '420px', 'overview step respects the last-column boundary');
scrolling.add(tabs[1],tabs[2],'grid');
win.emit('keydown', {type:'keydown',altKey:true,shiftKey:true});
assert.equal(container(tabs[0]).getAttribute('--pane-scrolling-width'), firstWidth, 'new columns do not shrink existing pages');
assert.equal(container(tabs[2]).hasAttribute('pane-scrolling'), true);
consumed = false;
win.emit('wheel', {...wheel, altKey:true, shiftKey:true, deltaY:10000});
assert.equal(container(tabs[2]).getAttribute('--pane-scrolling-x'), '420px', 'last column reaches the right edge');
assert.equal(consumed, true);
assert.equal(container(tabs[2]).hasAttribute('pane-scrolling-landing'), true, 'highlight identifies release target');
assert.equal(container(tabs[0]).hasAttribute('pane-scrolling-landing'), false);
consumed = false;
win.emit('wheel', {...wheel, altKey:true, shiftKey:true, deltaY:100});
assert.equal(consumed, true, 'gesture stays intercepted at right boundary');
assert.equal(container(tabs[2]).getAttribute('--pane-scrolling-x'), '420px');
consumed = false;
win.emit('wheel', {...wheel, deltaY:100});
assert.equal(consumed, true, 'wheel flags cannot release a gesture while the key remains held');
const selectedDuringOverview=win.gBrowser.selectedTab;
scrolling.scrollStep(data,-1);
assert.equal(win.gBrowser.selectedTab,selectedDuringOverview,'overview navigation does not steal native focus');
scrolling.scrollStep(data,1);
win.emit('blur',{type:'blur',target:tabs[2].linkedBrowser});
assert.equal(container(tabs[2]).hasAttribute('pane-scrolling-overview'),true,'child focus changes do not close the overview');
win.emit('keyup', {type:'keyup',altKey:false,shiftKey:false});
assert.equal(doc.activeElement,tabs[2].linkedBrowser,'release focuses the landing page');
consumed=false;
win.emit('wheel',wheel);
assert.equal(consumed,false,'page scrolling resumes after actual key release');
assert.equal(container(tabs[2]).getAttribute('--pane-scrolling-width'), '1200px', 'release returns focused page to full width');
assert.equal(win.gBrowser.selectedTab, tabs[2], 'release activates column nearest view center');
assert.equal(doc.querySelectorAll('.pane-scrolling-handoff').length,1,'native handoff is covered before a new frame');
flush(); flush();
assert.equal(doc.querySelectorAll('.pane-scrolling-handoff').length,1,'animation frames alone do not reveal the page');
tabs[2].linkedBrowser.isRemoteBrowser=true;
tabs[2].linkedBrowser.hasLayers=false;
win.emit('MozAfterPaint',{transactionId:1});
assert.equal(doc.querySelectorAll('.pane-scrolling-handoff').length,1,'unready destination layers keep the cover');
const slowTimer=[...timers.entries()].at(-1);
timers.delete(slowTimer[0]); slowTimer[1]();
assert.equal(doc.querySelectorAll('.pane-scrolling-handoff').length,1,'timeout cannot reveal unready layers');
assert.ok(doc.querySelector('.pane-scrolling-wait'),'slow destination offers tiled recovery');
tabs[2].linkedBrowser.hasLayers=true;
win.gBrowser._switcher={visibleTab:tabs[1]};
win.emit('MozAfterPaint',{transactionId:2});
assert.equal(doc.querySelectorAll('.pane-scrolling-handoff').length,1,'outgoing native surface stays covered');
win.gBrowser._switcher.visibleTab=tabs[2];
win.emit('MozAfterPaint',{transactionId:3});
delete win.gBrowser._switcher;
assert.equal((win.listeners.get('MozAfterPaint')??[]).length,0,'paint listener cleans up after reveal');
assert.equal(doc.querySelectorAll('.pane-scrolling-handoff').length,0,'completed paint releases the cover');
win.emit('keydown',{type:'keydown',altKey:true,shiftKey:true});
win.emit('wheel',{...wheel,deltaY:-10000});
win.emit('keydown',{type:'keydown',key:'Escape',altKey:true,shiftKey:true});
assert.equal(win.gBrowser.selectedTab,tabs[2],'Escape restores the starting tab');
assert.equal(container(tabs[2]).hasAttribute('pane-scrolling-overview'),false,'Escape closes overview');
win.emit('keydown',{type:'keydown',key:'ArrowLeft',altKey:true,shiftKey:true});
assert.equal(container(tabs[2]).hasAttribute('pane-scrolling-overview'),false,'cancelled gesture cannot reopen while held');
win.emit('keyup',{type:'keyup',altKey:false,shiftKey:false});
assert.equal(win.gBrowser.selectedTab,tabs[2],'release after Escape does not commit');
// The menu shortcut cancels a held overview without committing its landing tab.
win.emit('keydown',{type:'keydown',altKey:true,shiftKey:true});
win.emit('wheel',{...wheel,deltaY:-10000});
win.emit('keydown',{type:'keydown',key:'l',altKey:true,shiftKey:true});
assert.ok(doc.querySelector('.pane-layout-menu'),'menu opens during overview');
assert.equal(container(tabs[2]).hasAttribute('pane-scrolling-overview'),false,'menu suspends overview');
win.emit('keyup',{type:'keyup',altKey:false,shiftKey:false});
assert.equal(win.gBrowser.selectedTab,tabs[2],'releasing menu shortcut preserves selection');
scrolling.closeMenu();
win.emit('keyup',{type:'keyup',altKey:false,shiftKey:false});
// Custom widths survive re-entering scrolling and a failed layout change.
container(tabs[0]).querySelector('.pane-scrolling-resize').emit('keydown',{key:'ArrowRight'});
scrolling.arrange(tabs[2],'scrolling');
win.emit('keydown',{type:'keydown',altKey:true,shiftKey:true});
assert.equal(container(tabs[0]).getAttribute('--pane-scrolling-width'),'800px','re-entering scrolling preserves individual widths');
win.emit('keyup',{type:'keyup',altKey:false,shiftKey:false});
const calculateBeforeFailure=view.calculateLayoutTree;
view.calculateLayoutTree=()=>{throw new Error('layout failure');};
assert.throws(()=>scrolling.arrange(tabs[0],'below'),/layout failure/);
view.calculateLayoutTree=calculateBeforeFailure;
assert.equal(win.gBrowser.selectedTab,tabs[2],'failed layout restores starting selection');
win.emit('keydown',{type:'keydown',altKey:true,shiftKey:true});
assert.equal(container(tabs[0]).getAttribute('--pane-scrolling-width'),'800px','failed layout restores custom widths');
win.emit('keyup',{type:'keyup',altKey:false,shiftKey:false});
scrolling.arrange(tabs[2], 'accordion');
assert.equal(container(tabs[2]).hasAttribute('pane-scrolling'), false, 'accordion clears scrolling styles');
scrolling.arrange(tabs[0], 'scrolling');
win.emit('keydown', {type:'keydown',altKey:true,shiftKey:true});
scrolling.arrange(tabs[0], 'tiles');
assert.equal(doc.querySelectorAll('.pane-scrolling-header').length, 0);
scrolling.arrange(tabs[0], 'scrolling');
win.emit('keydown', {type:'keydown',altKey:true,shiftKey:true});
scrolling.arrange(tabs[2],'normal');
assert.equal(container(tabs[0]).hasAttribute('pane-scrolling'),true,'remaining scrolling split keeps its presentation');
scrolling.add(tabs[0],tabs[2],'grid');
options.origins.shuttingDown=true; scrolling.destroy(); options.origins.shuttingDown=false;
assert.equal(doc.querySelectorAll('.pane-scrolling-header').length, 0, 'unload cleans scrolling headers');
assert.equal((win.listeners.get('wheel') ?? []).length, 0, 'unload removes wheel interception');
console.log('Multiple floats and accordion: navigation, state preservation, limits, rollback and cleanup passed.');

assert.equal(savedScrollings.size,3,'scrolling metadata survives unload');
const restoredScrolling=createMultiwindow(win,{...options,prefs:{...prefs,getIntPref:(key,fallback)=>fallback}}); flush();
assert.equal(doc.querySelectorAll('.pane-scrolling-header').length,3,'scrolling returns automatically after restart');
restoredScrolling.arrange(tabs[0],'tiles');
assert.equal(savedScrollings.size,0,'explicit tiles clears scrolling persistence');
restoredScrolling.destroy();
assert.equal(savedScrollings.size,0,'disabling clears scrolling recovery metadata');

const snapshotPrototype=createMultiwindow(win,{...options,prefs:{...prefs,getIntPref:(key,fallback)=>fallback}});
snapshotPrototype.arrange(tabs[0],'snapshot');
const snapshotWidth=container(tabs[0]).getAttribute('--pane-scrolling-width');
win.emit('keydown',{type:'keydown',altKey:true,shiftKey:true});
assert.equal(container(tabs[0]).getAttribute('--pane-scrolling-width'),snapshotWidth,'snapshot overview never resizes live page');
assert.equal(doc.querySelectorAll('.pane-snapshot-card').length,3,'one snapshot card per native tab');
assert.equal(doc.querySelectorAll('.pane-snapshot-overview').length,1,'overview is separate from webpage containers');
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
assert.equal(container(tabs[0]).hasAttribute('pane-scrolling-overview'),false,'background split does not retain gesture state');
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
for (const mode of ['right', 'below', 'grid', 'accordion', 'snapshot', 'scrolling', 'float']) {
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
    if (['snapshot', 'scrolling'].includes(mode)) assert.equal(presentation.scrolling.snapshot, mode === 'snapshot');
    if (mode === 'float') assert.ok(hub.floatingTabs.includes(tabs[2]));
    if (['right', 'below', 'grid'].includes(mode)) assert.equal(data.gridType, {right:'vsep', below:'hsep', grid:'grid'}[mode]);
    hub.destroy();
  }
}
console.log('Picker layouts: add and join preserve pages and apply every layout.');
