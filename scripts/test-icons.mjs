import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const icons = await readFile("icons.mjs", "utf8");
const pane = await readFile("pane.uc.mjs", "utf8");
const multiwindow = await readFile("multiwindow.mjs", "utf8");
for (const name of ["check","down","up","plus","settings","info","close","search","swap","more","back","forward","pin","right","below","grid","float","normal","grip","unsplit"]) {
  assert.match(icons, new RegExp(`\\b${name}:`), `missing Lucide ${name} icon`);
}
for (const glyph of ["⚙", "ⓘ", "⌕", "⇄", "⌖", "+ Add another"]) {
  assert.equal(pane.includes(glyph) || multiwindow.includes(glyph), false, `platform glyph remains: ${glyph}`);
}
assert.match(icons, /Lucide Icons 1\.41\.0/);
assert.match(icons, /stroke=\"context-stroke\"/);
assert.match(pane, /setPaneNativeIcon\(nativeRearrange, "grip"\)/);
assert.match(pane, /setPaneNativeIcon\(nativeUnsplit, "unsplit"\)/);
console.log("Lucide icon set and platform-glyph cleanup passed.");
