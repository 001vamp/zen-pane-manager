import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../pane.uc.mjs", import.meta.url), "utf8");
const code = source.slice(source.indexOf("const UPDATE_NOTICES ="), source.indexOf("function closePicker("));
const values = new Map();
let focused = false, queued, attached = 0, visible;
const node = () => ({ children: [], setAttribute() {}, appendChild(child) { this.children.push(child); }, append(...children) { this.children.push(...children); }, addEventListener(type, fn) { this.click = fn; }, remove() { this.removed = true; } });
const context = vm.createContext({
  updateNotice: null, updateNoticeTimer: null,
  pickerBinding: () => ({ label: "Control+Option+R" }), setPaneIcon() {},
  Services: { prefs: {
    getStringPref: (key, fallback) => values.get(key) ?? fallback,
    getBoolPref: (key, fallback) => values.get(key) ?? fallback,
    setStringPref: (key, value) => values.set(key, value),
  } },
  document: { hasFocus: () => focused, createElement: node },
  root: { appendChild(child) { attached++; visible = child; } },
  setTimeout: fn => { queued = fn; return 1; },
});
vm.runInContext(code, context);
assert.equal(context.missedUpdates("").length, 2);
assert.equal(context.missedUpdates("accordion-motion-2026-10").length, 1);
assert.equal(context.missedUpdates("quick-start-2026-10").length, 0);
assert.equal(context.missedUpdates("unknown-release").length, 2);
context.showUpdateNotice();
assert.equal(attached, 0); assert.equal(values.size, 0);
focused = true; queued();
assert.equal(attached, 1);
assert.equal(visible.children[2].children.length, 7, "guide and both missed cards");
assert.equal(values.has("mod.pane.last-read-update"), false);
visible.children[1].click();
assert.equal(visible.removed, true);
assert.equal(values.has("mod.pane.last-read-update"), false, "closing is not acknowledgement");
context.showUpdateNotice(); assert.equal(attached, 1, "one delivery per update across windows");
context.showUpdateNotice(true); assert.equal(attached, 2, "manual reopening");
visible.children.at(-1).click();
assert.equal(values.get("mod.pane.quick-start-seen"), "quick-start-2026-10");
assert.equal(context.missedUpdates(values.get("mod.pane.last-read-update")).length, 0);
context.showUpdateNotice(); assert.equal(attached, 2);
// People who saw the old toast still get the guide with this update.
values.clear(); values.set("mod.pane.last-update-notice", "accordion-motion-2026-10");
context.showUpdateNotice(); assert.equal(attached, 3);
values.clear(); values.set("mod.pane.update-notices", false);
context.showUpdateNotice(); assert.equal(attached, 3);
context.showUpdateNotice(true); assert.equal(attached, 4, "opt-out still permits manual guide");
assert.match(source, /clearTimeout\(updateNoticeTimer\)/);
assert.match(source, /updateNotice\?\.remove\(\)/);
console.log("Update cards: backlog, migration, focus, delivery, acknowledgement, reopening, opt-out and cleanup passed.");
