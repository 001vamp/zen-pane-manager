import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createMultiwindow } from '../multiwindow.mjs';
import { activatePlan } from '../picker-model.mjs';
import { remapPresentation } from '../presentation-snapshot.mjs';

// A paused Scrolling strip belongs to a live Pane. Once Pane tears down (Sine
// disable/reload or window close) or the split switches to a grid or the picker
// adds or replaces a page, docking the floated page must leave a plain split
// behind. A torn-down Pane's leftover float controls must not drive the split.
class Node {
  constructor(doc, name = 'div') {
    this.ownerDocument = doc; this.name = name; this.children = []; this.attrs = new Map();
    this.listeners = new Map(); this.className = ''; this.dataset = {}; this.isConnected = true;
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
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(n => n !== this); this.isConnected = false; }
  getBoundingClientRect() { return {left:0,top:0,right:1200,bottom:900,width:1200,height:900}; }
  matches(s) {
    if (s.startsWith('[data-mode]')) return (this.hasAttribute('data-mode') || this.dataset.mode !== undefined) && (!s.includes('aria-pressed') || this.getAttribute('aria-pressed') === 'true');
    return s.startsWith('.') ? this.className.split(' ').includes(s.slice(1)) : this.name === s; }
  querySelectorAll(s) { return this.children.flatMap(n => [...(s.split(',').some(x => n.matches(x)) ? [n] : []), ...n.querySelectorAll(s)]); }
  querySelector(s) { return this.querySelectorAll(s)[0] ?? null; }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
  closest(s) { return this.matches(s) ? this : this.parent?.closest(s); }
  addEventListener(name, fn, options = {}) {
    const list = this.listeners.get(name) ?? []; list.push(fn); this.listeners.set(name,list);
    options.signal?.addEventListener('abort', () => this.removeEventListener(name, fn));
  }
  removeEventListener(name, fn) { this.listeners.set(name,(this.listeners.get(name) ?? []).filter(f => f !== fn)); }
  focus() { this.ownerDocument.activeElement = this; }
  animate() { return {cancel(){}}; }
}

function fixture(tabCount = 2, looseCount = 0) {
  const doc = new Node(null); doc.ownerDocument = doc; doc.documentElement = doc;
  doc.createElementNS = (ns,tag) => new Node(doc,tag);
  doc.createTextNode = text => { const node = new Node(doc,'#text'); node.textContent = text; return node; };
  const tabs = Array.from({length:tabCount + looseCount}, (_,i) => {
    const tab = new Node(doc,'tab'); tab.label = `Tab ${i}`; tab.splitView = i < tabCount;
    const container = new Node(doc); container.className = 'browserSidebarContainer'; doc.append(container);
    tab.linkedBrowser = new Node(doc,'browser'); container.append(tab.linkedBrowser);
    return tab;
  });
  const tree = list => ({type:'grid', children:list.map(tab => ({tab}))});
  const split = tabs.slice(0, tabCount);
  const data = {tabs:[...split], gridType:'vsep', layoutTree:tree(split)};
  const view = {
    _data:[data], currentView:0, MAX_TABS:4, _tabToSplitNode:new Map(),
    tabBrowserPanel:{getBoundingClientRect:() => ({width:1200,height:900})},
    calculateLayoutTree(list,type) { return {...tree(list), type}; },
    removeSplitters(){}, applyGridLayout(){},
    activateSplitView(d) { this.currentView = this._data.indexOf(d); },
    removeTabFromGroup(tab) { data.tabs = data.tabs.filter(t => t !== tab); tab.splitView = false; },
    splitTabs([, incoming]) { data.tabs.push(incoming); incoming.splitView = true; return data; },
    getSplitNodeFromTab(tab) { return data.layoutTree.children.find(node => node.tab === tab) ?? null; },
    resetTabState(tab) { tab.splitView = false; },
  };
  const scrollingRecords = new Map(), writes = [], sessionWrites = [];
  const win = new Node(doc);
  const tabContainer = new Node(doc);
  Object.assign(win, {
    document:doc, AbortController, navigator:{platform:'Win32'}, gZenViewSplitter:view,
    gBrowser:{tabs, selectedTab:tabs[0], tabContainer, moveTabToExistingGroup(){}, ungroupTab(){}, removeTab(){}},
    requestAnimationFrame:() => 1, cancelAnimationFrame(){}, setTimeout:() => 1, clearTimeout(){},
    matchMedia:() => null, innerWidth:1200, innerHeight:900,
    SessionStore:{
      getCustomTabValue:(tab,key) => key === 'pane-scrolling-v1' ? scrollingRecords.get(tab) ?? '' : '',
      setCustomTabValue:(tab,key,value) => { sessionWrites.push(key); if (key === 'pane-scrolling-v1') { writes.push(tab); scrollingRecords.set(tab,value); } },
      deleteCustomTabValue:(tab,key) => { sessionWrites.push(key); if (key === 'pane-scrolling-v1') scrollingRecords.delete(tab); },
    },
  });
  const prefs = {getStringPref:(k,f) => f, getIntPref:() => 0, getBoolPref:(k,f) => f};
  const controller = createMultiwindow(win, {notify(){}, chooseTab(){}, appearance(){}, prefs, origins:{begin(){},end(){},destroy(){}}});
  const container = tab => tab.linkedBrowser.parent;
  const listenerCount = node => [...node.listeners.values()].reduce((sum, list) => sum + list.length, 0)
    + node.children.reduce((sum, child) => sum + listenerCount(child), 0);
  const leftovers = () => listenerCount(win) + listenerCount(tabContainer) + listenerCount(doc);
  const scrollingVisible = () => tabs.some(tab => container(tab).hasAttribute('pane-scrolling'));
  // Two-tab Scrolling, then float one page: one column is left, so Scrolling pauses.
  function pause() {
    controller.arrange(tabs[0], 'scrolling');
    assert.ok(scrollingVisible(), 'setup starts Scrolling');
    controller.arrange(tabs[1], 'float');
    assert.equal(controller.capturePresentation(data).scrolling, undefined, 'setup pauses Scrolling');
    assert.equal(scrollingRecords.size, 0, 'setup leaves no saved Scrolling record while paused');
    writes.length = 0;
  }
  return {win, tabs, data, view, controller, writes, sessionWrites, scrollingRecords, leftovers, scrollingVisible, pause, container};
}

const failures = [];
function scenario(name, run) {
  try { run(); console.log(`ok - ${name}`); }
  catch (error) { failures.push(name); console.error(`not ok - ${name}\n  ${error.message.split('\n')[0]}`); }
}

scenario('a late dock after Sine reload teardown does not resume Scrolling', () => {
  const f = fixture();
  f.pause();
  f.controller.destroy({detachOnly:true});
  f.controller.clearFloat(true, f.tabs[1]);
  assert.equal(f.controller.capturePresentation(f.data).scrolling, undefined, 'a dock after reload teardown must not resume Scrolling');
  assert.ok(!f.scrollingVisible(), 'no Scrolling columns after reload teardown');
  assert.equal(f.writes.length, 0, 'no Scrolling record is written after reload teardown');
  assert.equal(f.leftovers(), 0, 'reload teardown leaves no listeners');
});
scenario('a reloaded runtime never writes Scrolling records for the new owner', () => {
  const f = fixture(3);
  f.controller.arrange(f.tabs[0], 'scrolling');
  f.controller.arrange(f.tabs[2], 'float');
  assert.ok(f.controller.capturePresentation(f.data).scrolling, 'setup keeps two Scrolling columns');
  f.controller.destroy({detachOnly:true});
  f.writes.length = 0;
  f.controller.clearFloat(true, f.tabs[2]);
  assert.equal(f.writes.length, 0, 'a dock on the detached runtime writes no Scrolling record');
});
scenario('Sine disable docks floats without resuming Scrolling', () => {
  const f = fixture();
  f.pause();
  f.controller.destroy();
  assert.equal(f.controller.capturePresentation(f.data).scrolling, undefined, 'disable must not resume Scrolling');
  assert.ok(!f.scrollingVisible(), 'no Scrolling columns after disable');
  assert.equal(f.writes.length, 0, 'no Scrolling record is written after disable');
  assert.equal(f.leftovers(), 0, 'disable leaves no listeners');
  f.controller.clearFloat(true, f.tabs[1]);
  assert.ok(!f.scrollingVisible(), 'a late dock after disable does not resume Scrolling');
});
scenario('window close docks floats without resuming or saving Scrolling', () => {
  const f = fixture();
  f.pause();
  f.win.emit = name => { for (const fn of f.win.listeners.get(name) ?? []) fn({}); };
  f.win.emit('SSWindowClosing');
  f.controller.destroy();
  assert.equal(f.controller.capturePresentation(f.data).scrolling, undefined, 'window close must not resume Scrolling');
  assert.ok(!f.scrollingVisible(), 'no Scrolling columns after window close');
  assert.equal(f.writes.length, 0, 'no Scrolling record is written while the window closes');
  assert.equal(f.scrollingRecords.size, 0, 'window close leaves no saved Scrolling record');
  assert.equal(f.leftovers(), 0, 'window close leaves no listeners');
});

// Switching the split to a grid replaces the paused Scrolling strip.
for (const mode of ['grid', 'right', 'below', 'tiles']) scenario(`${mode} on a three-tab split clears paused Scrolling`, () => {
  const f = fixture(3);
  f.controller.arrange(f.tabs[0], 'scrolling');
  f.controller.arrange(f.tabs[1], 'float');
  f.controller.arrange(f.tabs[2], 'float');
  assert.equal(f.controller.capturePresentation(f.data).scrolling, undefined, `${mode}: setup pauses Scrolling`);
  f.controller.arrange(f.tabs[0], mode);
  f.controller.clearFloat(true, f.tabs[1]);
  f.controller.clearFloat(true, f.tabs[2]);
  assert.equal(f.controller.capturePresentation(f.data).scrolling, undefined, `${mode}: docking after a grid switch must not resume Scrolling`);
  assert.ok(!f.scrollingVisible(), `${mode}: no Scrolling columns after a grid switch`);
  f.controller.destroy();
});
scenario('grid on a two-tab split clears paused Scrolling', () => {
  const f = fixture(2);
  f.pause();
  f.controller.arrange(f.tabs[0], 'grid');
  f.controller.clearFloat(true, f.tabs[1]);
  assert.equal(f.controller.capturePresentation(f.data).scrolling, undefined, 'two-tab grid switch must not resume Scrolling');
  assert.ok(!f.scrollingVisible(), 'no Scrolling columns after a two-tab grid switch');
  f.controller.destroy();
});

// A Sine reload leaves the old copy's float on screen until the new copy takes
// over. Its controls belong to a dead runtime and must not touch the split.
scenario('a torn-down runtime ignores clicks on its old float controls', () => {
  const f = fixture(3);
  f.controller.arrange(f.tabs[2], 'float');
  const header = f.container(f.tabs[2]).querySelector('.pane-float-header');
  const control = label => header.querySelectorAll('button').find(b => b.getAttribute('aria-label') === label);
  const before = {tabs:[...f.data.tabs], tree:f.data.layoutTree, floating:f.controller.floatingTabs};
  f.controller.destroy({detachOnly:true});
  f.sessionWrites.length = 0;
  const click = {preventDefault(){}, stopPropagation(){}};
  for (const label of ['Keep header visible', 'Arrange floating tab', 'Return floating tab to sidebar']) {
    for (const fn of control(label).listeners.get('click') ?? []) fn(click);
  }
  for (const fn of header.listeners.get('keydown') ?? []) fn({key:'ArrowLeft', target:header, preventDefault(){}, stopPropagation(){}});
  assert.deepEqual(f.data.tabs, before.tabs, 'old float buttons must not change the split');
  assert.equal(f.data.layoutTree, before.tree, 'old float buttons must not change the layout');
  assert.ok(f.tabs[2].splitView, 'old float close must not unsplit the tab');
  assert.deepEqual(f.controller.floatingTabs, before.floating, 'old float buttons must not dock the float');
  assert.equal(f.win.document.querySelector('.pane-layout-menu'), null, 'old float arrange must not open a layout menu');
  assert.deepEqual(f.sessionWrites, [], 'old float controls must not save anything');
});

// The picker runs these functions from pane.uc.mjs against the real controller.
const paneSource = await readFile(new URL('../pane.uc.mjs', import.meta.url), 'utf8');
const pickerSource = paneSource.slice(paneSource.indexOf('function openCandidate'), paneSource.indexOf('function buildPicker'))
  + paneSource.slice(paneSource.indexOf('function replacePane(incoming)'), paneSource.indexOf('const toolbarReveals'));
function openFromPicker(f, target, incoming, openMode) {
  const splitGroup = {hasAttribute:name => name === 'split-view-group'};
  for (const tab of f.data.tabs) tab.group = splitGroup;
  const toasts = [];
  vm.runInNewContext(`${pickerSource}\nopenCandidate(incoming);`, {
    incoming, targetTab:target, openMode, activatePlan, remapPresentation, multiwindow:f.controller,
    splitter:() => f.view, activeData:() => f.data, gBrowser:f.win.gBrowser, closePicker(){}, diagnosticLog(){},
    showToast:(message, type) => toasts.push({message, type}), workspaceId:() => 1, boolPref:(k, fallback) => fallback,
    PREF:{keep:'keep'}, dispatch(){}, TAG:'[Pane]', console, tabTitle:tab => tab.label, Map,
  });
  assert.deepEqual(toasts.filter(t => t.type === 'warning'), [], 'picker action succeeds');
}
for (const [name, openMode] of [['Add', 'right'], ['Add floating', 'float'], ['Replace', 'replace']]) scenario(`picker ${name} clears paused Scrolling`, () => {
  const f = fixture(2, 1);
  f.pause();
  openFromPicker(f, f.tabs[0], f.tabs[2], openMode);
  assert.ok(f.data.tabs.includes(f.tabs[2]), `${name}: the picked tab joins the split`);
  f.controller.clearFloat(true, f.tabs[1]);
  assert.equal(f.controller.capturePresentation(f.data).scrolling, undefined, `${name}: docking after a picker ${name} must not resume Scrolling`);
  assert.ok(!f.scrollingVisible(), `${name}: no Scrolling columns after a picker ${name}`);
  assert.equal(f.scrollingRecords.size, 0, `${name}: no saved Scrolling record after a picker ${name}`);
  f.controller.destroy();
});

// Split shortcuts use the platform Pane resolved at startup, not a per-keypress read.
scenario('split shortcuts use the startup platform', () => {
  const f = fixture(2);
  f.win.navigator = {get platform() { throw new Error('platform must not be read after startup'); }};
  const press = {type:'keydown', key:'L', code:'KeyL', altKey:true, shiftKey:true, ctrlKey:false, metaKey:false, preventDefault(){}, stopPropagation(){}};
  for (const fn of f.win.listeners.get('keydown') ?? []) fn(press);
  assert.ok(f.win.document.querySelector('.pane-layout-menu'), 'the startup Windows binding still opens the layout menu');
  f.controller.closeMenu();
  f.controller.destroy();
});

if (failures.length) { console.error(`${failures.length} Scrolling teardown scenario(s) failed`); process.exit(1); }
console.log('Paused Scrolling stays off after teardown, grid switches, and picker Add/Replace; stale float controls are inert; shortcuts use the startup platform.');
