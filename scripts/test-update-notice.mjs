import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../pane.uc.mjs", import.meta.url), "utf8");
const code = source.slice(source.indexOf("const UPDATE_NOTICE ="), source.indexOf("function closePicker("));
const values = new Map();
let focused = false, queued, attached = 0;
const node = () => ({ setAttribute() {}, appendChild() {}, append() {}, addEventListener(type, fn) { this.click = fn; }, remove() { this.removed = true; } });
const context = vm.createContext({
  updateNotice: null, updateNoticeTimer: null,
  Services: { prefs: {
    getStringPref: (key, fallback) => values.get(key) ?? fallback,
    getBoolPref: (key, fallback) => values.get(key) ?? fallback,
    setStringPref: (key, value) => values.set(key, value),
  } },
  document: { hasFocus: () => focused, createElement: node },
  root: { appendChild() { attached++; } },
  setTimeout: fn => { queued = fn; return 1; },
});
vm.runInContext(code, context);
context.showUpdateNotice();
assert.equal(attached, 0);
assert.equal(values.size, 0);
focused = true; queued();
assert.equal(attached, 1);
context.showUpdateNotice();
assert.equal(attached, 1, "same announcement must not repeat");
values.clear(); values.set("mod.pane.update-notices", false);
context.showUpdateNotice();
assert.equal(attached, 1, "disabled notices must stay hidden");
assert.match(source, /clearTimeout\(updateNoticeTimer\)/);
assert.match(source, /updateNotice\?\.remove\(\)/);
console.log("Update notices: focused-window delivery, once-only persistence, opt-out and cleanup passed.");
