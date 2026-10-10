import assert from "node:assert/strict";
import { arrangeOptions } from "../layout-options.mjs";

const modes = options => options.map(row => row.mode);
const byMode = (options, mode) => options.find(row => row.mode === mode);

const solo = arrangeOptions({ groupSize: 1, currentMode: "normal", presentation: null });
assert.deepEqual(modes(solo), ["right", "below", "grid", "float", "add"]);
for (const mode of ["right", "below", "grid", "float"]) {
  assert.equal(byMode(solo, mode).needsDestination, true, `${mode} on a solo tab needs a destination`);
}
assert.equal(byMode(solo, "add").needsDestination, true);
assert.equal(byMode(solo, "normal"), undefined, "Normal is hidden on a solo tab");
assert.equal(byMode(solo, "accordion"), undefined);
assert.equal(byMode(solo, "scrolling"), undefined);
assert.equal(byMode(solo, "tiles"), undefined);
assert.equal(byMode(solo, "reset"), undefined);
assert.equal(byMode(solo, "snapshot"), undefined);

const two = arrangeOptions({ groupSize: 2, currentMode: "right", presentation: null });
assert.deepEqual(modes(two), ["right", "below", "grid", "scrolling", "accordion", "float", "normal", "add"]);
assert.equal(byMode(two, "right").needsDestination, false);
assert.equal(byMode(two, "below").needsDestination, false);
assert.equal(byMode(two, "float").needsDestination, false);
assert.equal(byMode(two, "grid").needsDestination, true, "Grid on two panes still needs a third tab");
assert.equal(byMode(two, "accordion").needsDestination, false);
assert.equal(byMode(two, "scrolling").needsDestination, false);
assert.equal(byMode(two, "normal").needsDestination, false);
assert.equal(byMode(two, "right").current, true);
assert.equal(byMode(two, "reset"), undefined);
assert.equal(byMode(two, "snapshot"), undefined);

const four = arrangeOptions({ groupSize: 4, currentMode: "grid", presentation: null });
assert.equal(byMode(four, "grid").needsDestination, false, "four panes already satisfy grid");
assert.equal(byMode(four, "grid").current, true);
assert.equal(byMode(four, "reset"), undefined);
assert.ok(modes(four).includes("accordion"));
assert.ok(modes(four).includes("scrolling"));
assert.equal(byMode(four, "snapshot"), undefined);

for (const presentation of [null, "float", "normal"]) {
  const rows = arrangeOptions({ groupSize: 2, currentMode: "below", presentation });
  assert.equal(byMode(rows, "tiles"), undefined, `${presentation} does not offer restore tiles`);
  assert.equal(byMode(rows, "reset"), undefined, `${presentation} does not offer reset`);
  assert.equal(byMode(rows, "snapshot"), undefined);
}

const accordion = arrangeOptions({ groupSize: 2, currentMode: "accordion", presentation: "accordion" });
assert.ok(modes(accordion).includes("tiles"));
assert.equal(byMode(accordion, "tiles").needsDestination, false);
assert.equal(byMode(accordion, "accordion").current, true);
assert.equal(byMode(accordion, "reset"), undefined);
assert.equal(byMode(accordion, "snapshot"), undefined);

const scrolling = arrangeOptions({ groupSize: 3, currentMode: "scrolling", presentation: "scrolling" });
assert.ok(modes(scrolling).includes("tiles"));
assert.ok(modes(scrolling).includes("reset"));
assert.equal(byMode(scrolling, "reset").label, "Reset all column widths");
assert.equal(byMode(scrolling, "reset").needsDestination, false);
assert.equal(byMode(scrolling, "scrolling").current, true);
assert.equal(byMode(scrolling, "grid").needsDestination, false);
assert.equal(byMode(scrolling, "snapshot"), undefined);
assert.equal(scrolling.filter(row => row.mode === "scrolling").length, 1);

const fourScroll = arrangeOptions({ groupSize: 4, currentMode: "scrolling", presentation: "scrolling" });
assert.ok(modes(fourScroll).includes("reset"));
assert.equal(byMode(fourScroll, "snapshot"), undefined);

assert.equal(byMode(two, "grid").label, "Grid");
assert.equal(byMode(two, "add").label, "Add another tab…");

import { arrangeOptions as fromModel } from "../picker-model.mjs";
assert.deepEqual(fromModel({ groupSize: 2, currentMode: "right" }), arrangeOptions({ groupSize: 2, currentMode: "right" }), "picker-model re-exports the same arrangeOptions rows");

assert.equal(globalThis.gBrowser, undefined, "layout-options fixtures never touch gBrowser");
assert.equal(globalThis.Services, undefined, "layout-options fixtures never touch Services");

console.log("Layout options: solo, 2-pane, 4-pane, and presentation tables passed.");
