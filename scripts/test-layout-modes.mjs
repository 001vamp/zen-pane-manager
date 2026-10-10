import assert from "node:assert/strict";
import { layoutTypes, presentationModes, modeLabels, normalizeMode } from "../layout-modes.mjs";
import { isSupportedTab, tabWorkspace } from "../tab-eligibility.mjs";

assert.deepEqual(layoutTypes, { right: "vsep", below: "hsep", grid: "grid" });
assert.deepEqual(presentationModes, ["accordion", "scrolling"]);
assert.equal(modeLabels.scrolling, "Scrolling");
assert.equal(modeLabels.snapshot, undefined);
assert.equal(normalizeMode("snapshot"), "scrolling");
assert.equal(normalizeMode("scrolling"), "scrolling");
assert.equal(normalizeMode("grid"), "grid");
for (const [name, label] of Object.entries(modeLabels)) {
  assert.doesNotMatch(label, /experimental/i, `${name} must not ship an experimental label`);
}

const ordinary = { pinned: false, hidden: false, closing: false, hasAttribute: () => false, closest: () => null };
assert.equal(isSupportedTab(ordinary), true);
assert.equal(isSupportedTab({ ...ordinary, pinned: true }), true);
const folderTab = { ...ordinary, pinned: true, closest: () => ({ collapsed: true }) };
assert.equal(isSupportedTab(folderTab), true);
assert.equal(isSupportedTab({ ...folderTab, hidden: true }), false);
assert.equal(isSupportedTab({ ...folderTab, closing: true }), false);
assert.equal(isSupportedTab({ ...folderTab, hasAttribute: name => name === "zen-empty-tab" }), false);
const essential = { ...ordinary, hasAttribute: name => name === "zen-essential" };
assert.equal(isSupportedTab(essential), true);
assert.equal(tabWorkspace({ gZenWorkspaces: { activeWorkspace: "active" } }, essential), "active");

console.log("Layout modes and tab eligibility passed.");
