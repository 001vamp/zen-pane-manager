import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { defaultMode, activatePlan } from "../picker-model.mjs";
import { modeLabels, normalizeMode } from "../layout-modes.mjs";
import { reduce } from "../picker-keys.mjs";

const source = await readFile(new URL("../pane.uc.mjs", import.meta.url), "utf8");
const take = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));

test("saved layouts preselect the operation, retaining safe contextual fallbacks", () => {
  assert.equal(defaultMode({ inSplit: false, savedMode: "below" }), "below");
  for (const savedMode of Object.keys(modeLabels)) {
    assert.equal(defaultMode({ inSplit: true, savedMode }), savedMode);
    assert.equal(defaultMode({ inSplit: false, savedMode }), savedMode === "replace" ? "right" : savedMode);
  }
  for (const savedMode of ["", "unknown", "__proto__", "constructor", null, 7]) {
    assert.equal(defaultMode({ inSplit: false, savedMode }), "right");
    assert.equal(defaultMode({ inSplit: true, savedMode }), "replace");
  }
  assert.equal(defaultMode({ savedMode: "snapshot" }), "scrolling");
});

function harness(storage = new Map()) {
  const pref = "mod.pane.default-layout";
  const button = { attrs: {}, setAttribute(key, value) { this.attrs[key] = value; } };
  const modes = Object.keys(modeLabels).map(mode => ({
    dataset: { mode }, setAttribute() {}, querySelector() {}, append() {},
  }));
  const tab = { label: "Current" };
  const sandbox = {
    modeLabels, normalizeMode, defaultMode, activatePlan, reduce,
    PREF: { defaultLayout: pref },
    Services: { prefs: {
      setStringPref(key, value) { storage.set(key, value); },
      clearUserPref(key) { storage.delete(key); },
      prefHasUserValue(key) { return storage.has(key); },
    } },
    stringPref: (key, fallback) => storage.get(key) ?? fallback,
    boolPref: (_key, fallback) => fallback,
    openMode: "right", modeBar: { querySelectorAll: () => modes, querySelector: () => ({}) },
    results: { querySelectorAll: () => [], setAttribute() {} }, filtered: [],
    document: { getElementById: id => id === "pane-default-layout" ? button : {} },
    paneIcon: () => ({ classList: { add() {} } }),
    multiwindow: { closeMenu() {}, add(_target, _tab, mode) { sandbox.applied = mode; } },
    splitter: () => ({}), compatible: () => true, activeData: () => ({ tabs: [] }),
    isSupportedTab: () => true, eligibleTabs: () => [], tabTitle: item => item.label,
    heading: {}, context: {}, dialog: { toggleAttribute() {} },
    applyAppearance() {}, renderResults() {},
    search: { focus() {} }, pointer: {}, overlay: { hidden: true },
    diagnosticLog() {}, requestAnimationFrame: callback => callback(),
    closePicker() {}, showToast() {},
  };
  vm.createContext(sandbox);
  vm.runInContext([
    take("function paintMode", "function openCandidate"),
    take("function openCandidate", "function buildPicker"),
    take("function openPicker", "function dispatch"),
  ].join("\n"), sandbox);
  return { sandbox, storage, button, tab, pref };
}

test("explicit toggle persists across picker instances and Enter applies the saved layout", () => {
  const first = harness();
  first.sandbox.openPicker(first.tab);
  first.sandbox.setMode("below");
  assert.equal(first.storage.size, 0, "choosing a layout does not save it");
  first.sandbox.toggleDefaultLayout();
  assert.equal(first.storage.get(first.pref), "below");
  assert.equal(first.button.attrs["aria-pressed"], "true");
  assert.equal(first.button.textContent, "Default");

  const reopened = harness(first.storage);
  reopened.sandbox.openPicker(reopened.tab);
  assert.equal(reopened.sandbox.openMode, "below", "a fresh picker reads the saved preference");
  const row = { kind: "tab", label: "Notes" };
  const { action } = reduce({ mode: reopened.sandbox.openMode, rows: [row], selectedIndex: 0 }, { key: "Enter" });
  reopened.sandbox.openCandidate(row, action.mode);
  assert.equal(reopened.sandbox.applied, "below");

  reopened.sandbox.toggleDefaultLayout();
  assert.equal(reopened.button.attrs["aria-pressed"], "false");
  reopened.sandbox.openPicker(reopened.tab);
  assert.equal(reopened.sandbox.openMode, "right", "clearing restores contextual behavior");
});

test("temporary choices, keyboard cycling, and requested modes never overwrite the default", () => {
  const { sandbox, storage, pref, button, tab } = harness();
  storage.set(pref, "grid");
  sandbox.openPicker(tab, false, "below");
  assert.equal(sandbox.openMode, "below", "explicit entry-point intent wins");
  assert.equal(button.attrs["aria-pressed"], "false");
  const { state } = reduce({ mode: "below", inSplit: false }, {
    code: "BracketRight", ctrlKey: true, shiftKey: true,
  });
  sandbox.paintMode(state.mode);
  assert.equal(storage.get(pref), "grid");
  sandbox.setMode("float");
  assert.equal(storage.get(pref), "grid");
  sandbox.toggleDefaultLayout();
  assert.equal(storage.get(pref), "float", "saving replaces the one previous default");
  sandbox.openPicker(tab);
  assert.equal(sandbox.openMode, "float");
});

test("solo fallback does not erase saved Replace, and legacy defaults can be cleared", () => {
  const { sandbox, storage, pref, button, tab } = harness();
  storage.set(pref, "replace");
  sandbox.openPicker(tab);
  assert.equal(sandbox.openMode, "right");
  assert.equal(storage.get(pref), "replace");
  assert.equal(button.attrs["aria-pressed"], "false");
  sandbox.activeData = () => ({ tabs: [tab, {}] });
  sandbox.openPicker(tab);
  assert.equal(sandbox.openMode, "replace");
  assert.equal(button.attrs["aria-pressed"], "true");
  storage.set(pref, "snapshot");
  sandbox.openPicker(tab);
  assert.equal(sandbox.openMode, "scrolling");
  sandbox.toggleDefaultLayout();
  assert.equal(defaultMode({ inSplit: true, savedMode: storage.get(pref) }), "replace");
});

test("settings expose every layout and the picker toggle participates in keyboard focus", async () => {
  const preferences = JSON.parse(await readFile(new URL("../preferences.json", import.meta.url), "utf8"));
  const setting = preferences.find(item => item.property === "mod.pane.default-layout");
  assert.equal(setting?.defaultValue, "");
  assert.equal(setting.type, "dropdown");
  assert.deepEqual(setting.options.map(option => option.value), ["", ...Object.keys(modeLabels)]);
  const markup = take("function buildPicker", "function applyAppearance");
  assert.match(markup, /id = "pane-default-layout"/);
  assert.match(markup, /addEventListener\("click", toggleDefaultLayout\)/);
  assert.match(markup, /modeBar\.append\(defaultLayout\)/);
  assert.match(take("function trapDialogFocus", "function onSplitActivated"), /modeBar\.querySelectorAll\("button:not\(\[hidden\]\)"\)/);
});
