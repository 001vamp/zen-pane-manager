import assert from "node:assert/strict";
import { createTabOrigins } from "../tab-origins.mjs";

class EventTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(name, fn) {
    const list = this.listeners.get(name) ?? [];
    list.push(fn); this.listeners.set(name, list);
  }
  removeEventListener(name, fn) {
    this.listeners.set(name, (this.listeners.get(name) ?? []).filter(listener => listener !== fn));
  }
}

class Element extends EventTarget {
  constructor(id = "") { super(); this.id = id; this.children = []; this.attrs = new Map(); this.isConnected = true; }
  append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
  insertBefore(node, before) {
    node.parentElement = this;
    const index = before ? this.children.indexOf(before) : -1;
    if (index < 0) this.children.push(node); else this.children.splice(index, 0, node);
  }
  remove() { this.isConnected = false; this.parentElement?.children.splice(this.parentElement.children.indexOf(this), 1); }
  setAttribute(key, value) { this.attrs.set(key, String(value)); }
  getAttribute(key) { return this.attrs.get(key) ?? null; }
  hasAttribute(key) { return this.attrs.has(key); }
  removeAttribute(key) { this.attrs.delete(key); }
}

const tab = (id, pinned = false) => Object.assign(new Element(id), {
  pinned, closing:false, label:id, linkedBrowser:{focus(){}}, elementIndex:0, group:null,
});
const normalSection = new Element("normal");
normalSection.setAttribute("zen-workspace-id", "w");
const tabs = [tab("a", true), tab("b", false)];
normalSection.append(...tabs);
const values = new Map();
let removedFromGroup = 0, timer = 0;
const tabContainer = new EventTarget();
const data = { tabs:[...tabs] };
const win = new EventTarget();
Object.assign(win, {
  closed:false,
  document:{
    createElementNS:() => new Element(),
    getElementById:id => id === normalSection.id ? normalSection : null,
    querySelectorAll:selector => selector === ".zen-workspace-pinned-tabs-section" || selector === ".zen-workspace-normal-tabs-section" ? [normalSection] : [],
  },
  gBrowser:{
    tabs, tabContainer, selectedTab:tabs[0],
    pinTab(tab) { tab.pinned = true; },
    unpinTab(tab) { tab.pinned = false; },
    ungroupTab(){},
    moveTabToExistingGroup(){},
    zenHandleTabMove(tab, move) { move(); },
  },
  gZenViewSplitter:{
    _data:[data],
    removeTabFromGroup(tab) { removedFromGroup++; data.tabs = data.tabs.filter(member => member !== tab); },
  },
  gZenWorkspaces:{ activeWorkspace:"w", getEssentialsSection:() => normalSection },
  gZenPinnedTabManager:{ removeEssentials(){}, onTabIconChanged(){} },
  SessionStore:{
    setCustomTabValue:(tab, key, value) => values.set(`${tab.id}:${key}`, value),
    getCustomTabValue:(tab, key) => values.get(`${tab.id}:${key}`) ?? "",
    deleteCustomTabValue:(tab, key) => values.delete(`${tab.id}:${key}`),
  },
  Services:{ obs:{ addObserver(){}, removeObserver(){} } },
  setTimeout(fn) { timer += 1; return timer; },
  clearTimeout(){},
});

const origins = createTabOrigins(win);
origins.begin(tabs);
origins.end();
assert.ok(values.get("a:pane-original-tab-v1"), "origin record is saved for pinned tab");
assert.ok(values.get("b:pane-original-tab-v1"), "origin record is saved for companion tab");
origins.destroy({detachOnly:true});
assert.equal(removedFromGroup, 0, "detach-only origins teardown does not unsplit live groups");
assert.deepEqual(data.tabs, tabs, "detach-only origins teardown leaves split membership intact");
assert.ok(values.get("a:pane-original-tab-v1"), "detach-only origins teardown keeps pinned origin record");
assert.ok(values.get("b:pane-original-tab-v1"), "detach-only origins teardown keeps companion origin record");
assert.equal((tabContainer.listeners.get("TabClose") ?? []).length, 0, "detach-only origins teardown removes tab listeners");

console.log("Tab origins detach-only teardown passed.");
