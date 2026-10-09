import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

class Node {
  constructor(doc, name = "div") {
    this.ownerDocument = doc; this.name = name; this.children = []; this.attrs = new Map();
    this.listeners = new Map(); this.className = ""; this.dataset = {}; this.isConnected = true;
    this.style = { values:new Map(), length:0, setProperty:(k,v)=>this.style.values.set(k,v), getPropertyValue:k=>this.style.values.get(k) ?? "", removeProperty:k=>this.style.values.delete(k), [Symbol.iterator]:function*(){ yield* this.values.keys(); } };
    this.classList = { add:name => { if (!this.className.split(" ").includes(name)) this.className = `${this.className} ${name}`.trim(); } };
  }
  set id(value) { this.setAttribute("id", value); }
  get id() { return this.getAttribute("id") ?? ""; }
  setAttribute(k, v) { this.attrs.set(k, String(v)); if (k === "class") this.className = String(v); }
  getAttribute(k) { return this.attrs.get(k) ?? null; }
  hasAttribute(k) { return this.attrs.has(k); }
  removeAttribute(k) { this.attrs.delete(k); }
  toggleAttribute(k, force = !this.hasAttribute(k)) { force ? this.setAttribute(k, "") : this.removeAttribute(k); return force; }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  appendChild(node) { this.append(node); return node; }
  prepend(...nodes) { for (const node of nodes.reverse()) { node.parent = this; this.children.unshift(node); } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.isConnected = false; }
  addEventListener(name, fn, options = {}) {
    const list = this.listeners.get(name) ?? []; list.push(fn); this.listeners.set(name, list);
    options.signal?.addEventListener("abort", () => this.removeEventListener(name, fn));
  }
  removeEventListener(name, fn) { this.listeners.set(name, (this.listeners.get(name) ?? []).filter(listener => listener !== fn)); }
  focus() { this.ownerDocument.activeElement = this; }
  matches(selector) {
    if (selector.includes(",")) return selector.split(",").some(part => this.matches(part.trim()));
    if (selector === ".browserSidebarContainer[is-zen-split]") return this.className.split(" ").includes("browserSidebarContainer") && this.hasAttribute("is-zen-split");
    if (selector.startsWith("#")) return this.id === selector.slice(1);
    if (selector.startsWith(".")) return this.className.split(" ").includes(selector.slice(1));
    if (selector.startsWith("[") && selector.endsWith("]")) return this.hasAttribute(selector.slice(1, -1));
    return this.name === selector;
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector); }
}

function createDocument() {
  const doc = new Node(null, "document"); doc.ownerDocument = doc; doc.documentElement = doc;
  doc.createElement = tag => new Node(doc, tag);
  doc.createElementNS = (ns, tag) => new Node(doc, tag);
  doc.createXULElement = tag => new Node(doc, tag);
  doc.createTextNode = text => { const node = new Node(doc, "#text"); node.textContent = text; return node; };
  doc.getElementById = id => doc.querySelector(`#${id}`);
  return doc;
}

function runPane({failAfterReady = false, createMultiwindow} = {}) {
  const doc = createDocument();
  const container = doc.createElement("div"); container.className = "browserSidebarContainer"; container.setAttribute("is-zen-split", "true");
  const header = doc.createElement("div"); header.className = "zen-view-splitter-header";
  const browser = doc.createElement("browser");
  container.append(header, browser); doc.append(container);
  const tab = { linkedBrowser:browser, closing:false, isConnected:true };
  const gBrowser = { tabs:[tab], selectedTab:tab, tabContainer:new Node(doc, "tabs"), getTabForBrowser:node => node === browser ? tab : null, addTabsProgressListener(){}, removeTabsProgressListener(){} };
  const window = new Node(doc, "window");
  const timers = new Map();
  Object.assign(window, { document:doc, gBrowser, addUnloadListener(){}, openTrustedLinkIn(){}, setTimeout(fn) { timers.set(timers.size + 1, fn); return timers.size; }, clearTimeout:id => timers.delete(id) });
  const prefs = {
    getBoolPref:(key, fallback) => fallback,
    getIntPref:(key, fallback) => key === "mod.pane.toolbar-visibility" ? 1 : fallback,
    getStringPref:(key, fallback) => fallback,
    addObserver(){},
    removeObserver(){},
  };
  const errors = [];
  const context = {
    window, document:doc, gBrowser, Services:{ prefs }, MutationObserver:class { observe(){} disconnect(){ this.disconnected = true; } },
    AbortController, CSS:{ supports:() => true }, console:{ log(){}, error(...args){ errors.push(args); } }, setTimeout:window.setTimeout, clearTimeout:window.clearTimeout,
  };
  context.__errors = errors;
  if (failAfterReady) context.setTimeout = window.setTimeout = () => { throw new Error("forced init failure"); };
  context.globalThis = context;
  context.__createMultiwindow = createMultiwindow ?? (() => ({ sync(){}, destroy(){}, openMenu(){}, clearFloat(){} }));
  window.__createMultiwindow = context.__createMultiwindow;
  const source = readFileSync(new URL("../pane.uc.mjs", import.meta.url), "utf8").replace(/^import .+;\n/gm, "");
  const stubs = `
    const setPaneIcon = (node, name) => node.setAttribute("data-pane-icon", name);
    const setPaneNativeIcon = setPaneIcon;
    const paneIcon = (doc, name) => { const node = doc.createElement("span"); node.className = "pane-svg"; node.setAttribute("data-pane-icon", name); return node; };
    const createMultiwindow = window.__createMultiwindow;
    const modeLabels = { replace:"Replace", right:"Split right" };
    const tabWorkspace = () => "";
    const isSupportedTab = () => true;
    const addHistoryControls = () => {};
    const updateHistoryControls = () => {};
    const numericValue = name => name === "picker-width" ? 520 : name === "corner-radius" ? 12 : 20;
    const glassPresets = Array.from({length:5}, () => ({ light:"rgba(255,255,255,.8)", dark:"rgba(0,0,0,.8)", blur:20, radius:12 }));
    const matchesBinding = () => false;
    const pickerBinding = () => null;
  `;
  vm.runInNewContext(`${stubs}\n${source}`, context);
  return { context, doc, window, gBrowser, errors };
}

const failed = runPane({ failAfterReady:true });
assert.equal(failed.doc.querySelector(".pane-button"), null, "failed init removes pane toolbar buttons");
assert.equal(failed.doc.documentElement.hasAttribute("pane-ready"), false, "failed init removes pane-ready");
assert.equal(failed.doc.documentElement.hasAttribute("pane-toolbar-always"), false, "failed init removes toolbar visibility state");
assert.equal(failed.window.__paneInstance, undefined, "failed init leaves no owner key behind");

const splitRecords = new Map([[{}, "split"]]);
const floatRecords = new Map([[{}, "float"]]);
let destroyOptions;
const stale = runPane({
  createMultiwindow: () => ({
    sync(){},
    openMenu(){},
    clearFloat(){},
    destroy(options) {
      destroyOptions = options;
      if (!options?.detachOnly) { splitRecords.clear(); floatRecords.clear(); }
    },
  }),
});
assert.equal(stale.errors.length, 0, `runtime should initialize before stale teardown test: ${stale.errors.at(-1)?.[2]?.message}`);
const staleDestroy = stale.window.__paneInstance.destroy;
stale.window.__paneInstance = { destroy() {} };
staleDestroy();
assert.equal(destroyOptions?.detachOnly, true, "stale runtime uses detach-only multiwindow teardown");
assert.equal(splitRecords.size, 1, "stale runtime does not clear live split records");
assert.equal(floatRecords.size, 1, "stale runtime does not clear live float records");

console.log("Pane runtime teardown ownership tests passed.");
