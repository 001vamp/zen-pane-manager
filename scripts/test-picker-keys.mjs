import assert from "node:assert/strict";
import { isHubCycleChord } from "../keybindings.mjs";
import { reduce, visibleModes, cycleMode } from "../picker-keys.mjs";

const modes = visibleModes({ inSplit: true });
assert.deepEqual(modes[0], "replace");
assert.deepEqual(visibleModes({ inSplit: false }), modes.filter(mode => mode !== "replace"));

const state = (extra = {}) => ({
  query: "",
  expanded: false,
  selectedIndex: 0,
  mode: extra.mode ?? "right",
  scope: null,
  peek: null,
  pending: null,
  inSplit: extra.inSplit ?? false,
  rows: extra.rows ?? [{ kind: "tab" }],
  ...extra,
});

const key = extra => ({
  key: "",
  code: "",
  keyCode: 0,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  isComposing: false,
  ...extra,
});

const cycleRight = key({ code: "BracketRight", key: "}", ctrlKey: true, shiftKey: true });
const cycleLeft = key({ code: "BracketLeft", key: "{", ctrlKey: true, shiftKey: true });

assert.equal(isHubCycleChord(cycleRight), true);
assert.equal(isHubCycleChord({ ...cycleRight, altKey: true }), false, "AltGr is Ctrl+Alt and must not cycle");
assert.equal(isHubCycleChord({ ...cycleRight, metaKey: true }), false);
assert.equal(isHubCycleChord(key({ key: "[", code: "BracketLeft" })), false, "bare brackets type");

{
  const solo = visibleModes({ inSplit: false });
  let current = state({ inSplit: false, mode: solo.at(-1) });
  const walked = [];
  for (let i = 0; i < solo.length; i++) {
    const next = reduce(current, cycleRight);
    assert.equal(next.action.type, "cycleMode");
    assert.notEqual(next.state.mode, "replace", "solo cycle skips Replace");
    walked.push(next.state.mode);
    current = next.state;
  }
  assert.deepEqual(walked, solo);
}

{
  const first = reduce(state({ inSplit: true, mode: "replace" }), cycleRight);
  assert.equal(first.state.mode, "right");
  const wrap = reduce(state({ inSplit: true, mode: "scrolling" }), cycleRight);
  assert.equal(wrap.state.mode, "replace");
  const back = reduce(state({ inSplit: false, mode: "right" }), cycleLeft);
  assert.equal(back.state.mode, "scrolling");
}

{
  const typed = reduce(state({ query: "note", mode: "below" }), cycleRight);
  assert.equal(typed.state.mode, "grid", "non-empty query still cycles the default layout");
  assert.equal(typed.state.query, "note");
}

assert.equal(reduce(state(), key({ ...cycleRight, altKey: true })).action, null);
assert.equal(reduce(state({ query: "[Draft]" }), key({ key: "[", code: "BracketLeft" })).action, null);
assert.equal(reduce(state(), key({ key: "1", code: "Digit1" })).action, null);
assert.equal(reduce(state(), key({ key: "P", code: "KeyP" })).action, null);
assert.equal(reduce(state(), key({ key: "Tab" })).action, null);
assert.equal(reduce(state(), key({ key: "ArrowLeft" })).action, null);
assert.equal(reduce(state(), key({ key: "ArrowRight" })).action, null);
assert.equal(reduce(state(), key({ key: "ArrowLeft", altKey: true })).action, null);

for (const blocked of [
  key({ key: "Enter" }),
  key({ key: "Enter", shiftKey: true }),
  key({ key: "Escape" }),
  key({ key: "ArrowDown" }),
  key({ key: "ArrowUp" }),
  cycleRight,
  cycleLeft,
]) {
  assert.equal(reduce(state(), { ...blocked, isComposing: true }).action, null, `isComposing no-ops ${blocked.key || blocked.code}`);
  assert.equal(reduce(state(), { ...blocked, keyCode: 229 }).action, null, `keyCode 229 no-ops ${blocked.key || blocked.code}`);
}

{
  const down = reduce(state({ rows: [{ kind: "tab" }, { kind: "split" }], selectedIndex: 0 }), key({ key: "ArrowDown" }));
  assert.equal(down.state.selectedIndex, 1);
  assert.equal(down.action.preventDefault, true);
  const wrap = reduce(down.state, key({ key: "ArrowDown" }));
  assert.equal(wrap.state.selectedIndex, 0);
}

{
  const enter = reduce(state({ mode: "replace", rows: [{ kind: "tab" }] }), key({ key: "Enter" }));
  assert.deepEqual(enter.action, { type: "activate", kind: "tab", mode: "replace", preventDefault: true });
  const shiftTab = reduce(state({ mode: "replace", rows: [{ kind: "tab" }] }), key({ key: "Enter", shiftKey: true }));
  assert.deepEqual(shiftTab.action, { type: "activate", kind: "tab", mode: "replace", preventDefault: true }, "Shift+Enter on a tab row is still Enter");
  const shiftSplit = reduce(state({ mode: "replace", rows: [{ kind: "split" }] }), key({ key: "Enter", shiftKey: true }));
  assert.deepEqual(shiftSplit.action, { type: "activate", kind: "split", mode: "float", preventDefault: true });
  const splitEnter = reduce(state({ mode: "below", rows: [{ kind: "split" }] }), key({ key: "Enter" }));
  assert.deepEqual(splitEnter.action, { type: "activate", kind: "split", mode: "below", preventDefault: true });
}

{
  const clear = reduce(state({ query: "notes", expanded: true }), key({ key: "Escape" }));
  assert.equal(clear.action.type, "clearQuery");
  assert.equal(clear.state.query, "");
  assert.equal(clear.state.expanded, false);
  const collapse = reduce(state({ query: "", expanded: true }), key({ key: "Escape" }));
  assert.equal(collapse.action.type, "collapse");
  assert.equal(collapse.state.expanded, false);
  const close = reduce(state({ query: "", expanded: false }), key({ key: "Escape" }));
  assert.equal(close.action.type, "close");
}

assert.equal(cycleMode("replace", 1, { inSplit: false }), "right");

{
  const cycled = reduce(state({ selectedIndex: 1, mode: "right", rows: [{ kind: "tab" }, { kind: "tab" }] }), cycleRight);
  assert.equal(cycled.state.selectedIndex, 1, "reducer keeps the highlight across a cycle");
  assert.equal(cycled.action.type, "cycleMode");
}

assert.equal(globalThis.gBrowser, undefined);
assert.equal(globalThis.Services, undefined);

console.log("Picker keys: cycle, IME, Escape stages, and Shift+Enter split-only float passed.");
