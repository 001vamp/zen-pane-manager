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
  closest(s) { return this.matches(s) ? this : this.parent?.closest(s); }
  addEventListener(name, fn, options = {}) {
    const list = this.listeners.get(name) ?? []; list.push(fn); this.listeners.set(name,list);
    options.signal?.addEventListener('abort', () => this.listeners.set(name, (this.listeners.get(name) ?? []).filter(f => f !== fn)));
  }
  removeEventListener(name, fn) { this.listeners.set(name,(this.listeners.get(name) ?? []).filter(f => f !== fn)); }
  emit(name, props = {}) { for (const fn of this.listeners.get(name) ?? []) fn({ target:this, preventDefault(){}, stopPropagation(){}, ...props }); }
  focus() {}
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
const controller = createMultiwindow(win,{notify(){},chooseTab(){},appearance(){}});
const container = tab => tab.linkedBrowser.parent;
const header = tab => container(tab).querySelector('.pane-float-header');
const flush = () => {const fn=queued;queued=null;fn?.();};
controller.add(tabs[0],tabs[1],'float');
const originalBrowser = tabs[1].linkedBrowser;
const before = container(tabs[1]).getAttribute('--pane-float-x');
controller.add(tabs[0],tabs[2],'float');
assert.deepEqual(controller.floatingTabs,[tabs[1],tabs[2]]);
assert.equal(tabs[1].linkedBrowser,originalBrowser);
assert.equal(container(tabs[1]).getAttribute('--pane-float-x'),before);
assert.deepEqual(lastLayout.children.map(n=>n.tab),[tabs[0]]);
header(tabs[2]).emit('keydown',{key:'ArrowLeft'});
assert.equal(container(tabs[1]).getAttribute('--pane-float-x'),before,'moving one float must not move its neighbor');
const pin = header(tabs[1]).querySelectorAll('button').find(b => b.getAttribute('aria-label')==='Keep header visible');
pin.emit('click'); assert.equal(pin.getAttribute('aria-pressed'),'true');
controller.sync();flush(); assert.ok(header(tabs[1]).hasAttribute('data-pinned'));
controller.add(tabs[0],tabs[3],'float');
assert.equal(controller.floatingTabs.length,3);
assert.throws(()=>controller.add(tabs[0],tabs[4],'float'),/limit/);
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
controller.destroy();
assert.equal(doc.querySelectorAll('.pane-float-header').length,0);
assert.equal(controller.floatingTabs.length,0);
assert.deepEqual(lastLayout,data.layoutTree,'unload restores the full native split');
console.log('Multiple floats: geometry, pinning, docking, close, tab switching, limits, rollback and unload passed.');
