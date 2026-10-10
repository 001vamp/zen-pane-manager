import assert from "node:assert/strict";
import { reduce, isHubCycleChord, visibleModes, cycleMode, selectedIndexForKey, selectionAfterRender, shouldDeferEnterToButton } from "../picker-keys.mjs";

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

const item = () => {
  const node = {
    closest(selector) {
      if (selector === ".pane-item") return this;
      if (selector === "button") return this.tag === "button" ? this : null;
      return null;
    },
  };
  return node;
};
const nestedButton = parent => ({
  closest(selector) {
    if (selector === "button") return this;
    if (selector === ".pane-item") return parent;
    return null;
  },
});
const cards = [item(), item()];
assert.equal(selectedIndexForKey({ selectedIndex: 0 }, cards[1], cards), 1, "Enter uses the focused card, not the highlighted row");
assert.equal(selectedIndexForKey({ selectedIndex: 1 }, cards[0], cards), 0);
assert.equal(selectedIndexForKey({ selectedIndex: 0 }, { closest: () => null }, cards), 0, "search / empty target keeps the highlight");
assert.equal(shouldDeferEnterToButton(nestedButton(cards[0]), {}), true, "Add/Floating/Unsplit keep their own Enter");
assert.equal(shouldDeferEnterToButton(cards[0], {}), false);
{
  const rows = [{ kind: "split" }, { kind: "split" }];
  const index = selectedIndexForKey({ selectedIndex: 0 }, cards[1], cards);
  const { action } = reduce(state({ selectedIndex: index, mode: "right", rows }), key({ key: "Enter" }));
  assert.deepEqual(action, { type: "activate", kind: "split", mode: "right", preventDefault: true });
}

{
  const cycled = reduce(state({ selectedIndex: 1, mode: "right", rows: [{ kind: "tab" }, { kind: "tab" }] }), cycleRight);
  assert.equal(cycled.state.selectedIndex, 1, "reducer keeps the highlight across a cycle");
  assert.equal(cycled.action.type, "cycleMode");
  assert.equal(selectionAfterRender(cycled.state.selectedIndex, 2, { keepSelection: true }), 1, "re-render after cycle keeps the highlight");
  assert.equal(selectionAfterRender(cycled.state.selectedIndex, 2, { keepSelection: false }), 0, "chip click still resets to the first row");
  assert.equal(selectionAfterRender(5, 3, { keepSelection: true }), 2);
}

assert.equal(globalThis.gBrowser, undefined);
assert.equal(globalThis.Services, undefined);

console.log("Picker keys: cycle, IME, Escape stages, focused-card Enter, and kept highlight passed.");
