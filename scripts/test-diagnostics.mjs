import assert from "node:assert/strict";

const listeners = new Map();
let copied = "";
let unloaded = null;
let alerted = false;

globalThis.window = {
  addEventListener(type, callback) { listeners.set(type, callback); },
  removeEventListener(type, callback) {
    if (listeners.get(type) === callback) listeners.delete(type);
  },
  addUnloadListener(callback) { unloaded = callback; },
  gZenViewSplitter: {
    currentView: 0,
    _data: [{ tabs: [{}, {}] }],
    getSplitNodeFromTab() {},
    resetTabState() {},
    activateSplitView() {},
  },
};

globalThis.document = {
  readyState: "complete",
  documentElement: { hasAttribute: name => name === "pane-ready" },
  querySelectorAll(selector) {
    if (selector === ".browserSidebarContainer[is-zen-split]") return [{}, {}];
    if (selector.includes(".zen-view-splitter-header")) return [{}, {}];
    if (selector === ".pane-button") return [{}, {}];
    return [];
  },
};

globalThis.Services = {
  prefs: {
    PREF_BOOL: 128,
    PREF_INT: 64,
    PREF_STRING: 32,
    getPrefType: name => name === "sine.allow-unsafe-js" ? 128 : 0,
    getBoolPref: name => name === "sine.allow-unsafe-js",
  },
  appinfo: {
    version: "154.0.1",
    platformVersion: "154.0.1",
    appBuildID: "20260827000000",
    OS: "WINNT",
    XPCOMABI: "x86_64-msvc-x64",
  },
  prompt: { alert() { alerted = true; } },
};

globalThis.Ci = { nsIClipboardHelper: Symbol("clipboard") };
globalThis.Cc = new Proxy({}, {
  get: () => ({ getService: () => ({ copyString: text => { copied = text; } }) }),
});

await import(`../pane-diagnostics.uc.mjs?test=${Date.now()}`);

const diagnostics = window.__paneDiagnostics;
assert.ok(diagnostics, "diagnostics bootstrap should publish its API");
assert.equal(typeof window.PaneDiagnostics.report, "function");
assert.equal(typeof unloaded, "function", "diagnostics should register a Sine unload callback");

diagnostics.log("privacy test", {
  title: "PRIVATE TITLE",
  url: "https://private.example/secret",
  query: "PRIVATE QUERY",
  path: "C:\\Private\\secret.txt",
  stack: "PRIVATE STACK",
  safe: "expected https://private.example/redact",
});

const report = diagnostics.report();
for (const secret of ["PRIVATE TITLE", "private.example", "PRIVATE QUERY", "Private\\secret", "PRIVATE STACK"]) {
  assert.ok(!report.includes(secret), `report leaked ${secret}`);
}
assert.match(report, /unofficialJavaScriptAllowed: true/u);
assert.match(report, /activePaneCount: 2/u);
assert.match(report, /privacy test \{"safe":"expected \[url\]"\}/u);

assert.equal(diagnostics.copy(), true);
assert.match(copied, /^Pane diagnostics/mu);

const shortcut = listeners.get("keydown");
assert.equal(typeof shortcut, "function");
shortcut({
  ctrlKey: true,
  altKey: true,
  shiftKey: false,
  metaKey: false,
  key: "d",
  preventDefault() {},
  stopPropagation() {},
});
assert.equal(alerted, true);

// Custom diagnostic preferences are read on every keypress.
Services.prefs.getPrefType = name => name === "mod.pane.diagnostics-keybinding" ? 32 : 0;
Services.prefs.getStringPref = () => "Command+Shift+P";
Services.prefs.getIntPref = () => 0;
const customEvent = { key: "P", ctrlKey: false, altKey: false, shiftKey: true, metaKey: true, preventDefault() {}, stopPropagation() {} };
alerted = false;
shortcut(customEvent);
assert.equal(alerted, true, "custom diagnostic binding must work immediately");
Services.prefs.getIntPref = () => 3;
alerted = false;
shortcut(customEvent);
assert.equal(alerted, false, "picker wins overlapping bindings");

await unloaded();
assert.equal(window.__paneDiagnostics, undefined);
console.log("Pane diagnostics privacy and copy tests passed.");
