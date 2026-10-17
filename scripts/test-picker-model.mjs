import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { modeLabels, normalizeMode } from "../layout-modes.mjs";
import { reduce } from "../picker-keys.mjs";
import { eligibleDestinations, filterDestinations, defaultMode, activatePlan } from "../picker-model.mjs";

const tab = (id, extra = {}) => ({
  id,
  title: extra.title ?? id,
  url: extra.url ?? `${id}.example`,
  lastUsed: extra.lastUsed ?? 0,
  splitView: extra.splitView ?? false,
  closing: extra.closing ?? false,
  hidden: extra.hidden ?? false,
  supported: extra.supported ?? true,
  connected: extra.connected ?? true,
});

const target = tab("here", { lastUsed: 50 });
const notes = tab("notes", { title: "Notes", url: "notes.local", lastUsed: 30 });
const docs = tab("docs", { title: "Docs", url: "docs.local", lastUsed: 10 });
const old = tab("old", { title: "Old tab", lastUsed: 1 });

{
  const listed = eligibleDestinations({
    target,
    currentGroupTabs: [],
    tabs: [target, notes, docs, old],
    groups: [],
    recentFirst: true,
  });
  assert.deepEqual(listed.map(row => row.id), ["notes", "docs", "old"]);
  assert.ok(listed.every(row => row.kind === "tab"));
}

{
  const listed = eligibleDestinations({
    target,
    currentGroupTabs: [],
    tabs: [notes, docs, old],
    groups: [],
    recentFirst: false,
  });
  assert.deepEqual(listed.map(row => row.id), ["notes", "docs", "old"], "recentFirst false keeps caller order");
}

{
  const group = { tabs: [tab("a"), tab("b")] };
  const otherSplitTab = tab("a", { splitView: true });
  const listed = eligibleDestinations({
    target,
    currentGroupTabs: [],
    tabs: [notes, otherSplitTab],
    groups: [group],
    recentFirst: true,
  });
  assert.equal(listed[0].kind, "split");
  assert.equal(listed[0].group, group);
  assert.equal(listed.some(row => row.id === "a"), false, "tabs already in another split are not listed as tabs");
  assert.deepEqual(listed.filter(row => row.kind === "tab").map(row => row.id), ["notes"]);
}

{
  const listed = eligibleDestinations({
    target: tab("here", { splitView: true }),
    currentGroupTabs: [tab("here", { splitView: true }), tab("mate")],
    tabs: [notes, tab("a", { splitView: true })],
    groups: [{ tabs: [tab("a"), tab("b")] }],
    recentFirst: true,
  });
  assert.equal(listed.some(row => row.kind === "split"), false, "in-split hides other group cards");
  assert.deepEqual(listed.map(row => row.id), ["notes"]);
}

{
  const listed = eligibleDestinations({
    target: tab("here"),
    currentGroupTabs: [tab("here"), tab("mate")],
    tabs: [notes],
    groups: [{ tabs: [tab("a"), tab("b")] }],
    recentFirst: true,
  });
  assert.equal(listed.some(row => row.kind === "split"), false, "currentGroupTabs alone means in-split even if splitView is stale");
}

{
  const mate = tab("mate");
  const listed = eligibleDestinations({
    target,
    currentGroupTabs: [target, mate],
    tabs: [notes, mate],
    groups: [],
    recentFirst: true,
  });
  assert.deepEqual(listed.map(row => row.id), ["notes"], "tabs already in this split are excluded");
}

{
  const listed = eligibleDestinations({
    target,
    currentGroupTabs: [],
    tabs: [
      notes,
      tab("gone", { closing: true }),
      tab("hid", { hidden: true }),
      tab("empty", { supported: false }),
    ],
    groups: [
      { tabs: [tab("only")] },
      { tabs: [tab("x", { closing: true }), tab("y")] },
      { tabs: [tab("here"), tab("other")] },
      { tabs: [tab("ok"), tab("also")] },
    ],
    recentFirst: true,
  });
  assert.deepEqual(listed.filter(row => row.kind === "tab").map(row => row.id), ["notes"]);
  assert.deepEqual(
    listed.filter(row => row.kind === "split").map(row => row.tabs.map(member => member.id)),
    [["ok", "also"]],
    "tiny, closing, or self-including groups are dropped"
  );
}

{
  const listed = eligibleDestinations({
    target,
    currentGroupTabs: [],
    tabs: [tab("other-ws")],
    groups: [],
    recentFirst: true,
  });
  assert.equal(listed.length, 1, "workspace filtering is the caller's job; the model keeps handed-in tabs");
}

assert.equal(defaultMode({ inSplit: true }), "replace");
assert.equal(defaultMode({ inSplit: false }), "right");
for (const savedMode of Object.keys(modeLabels)) {
  assert.equal(defaultMode({ inSplit: true, savedMode }), "replace", `in a split, Replace wins over a saved ${savedMode}`);
  assert.equal(defaultMode({ inSplit: false, savedMode }), savedMode === "replace" ? "right" : savedMode);
}
for (const savedMode of ["", "unknown", "snapshot", "__proto__", "constructor", null, 7]) {
  assert.equal(defaultMode({ inSplit: false, savedMode }), "right", `unknown saved layout ${String(savedMode)} falls back`);
}

const hits = filterDestinations([
  { kind: "tab", title: "Notes", url: "notes.local" },
  { kind: "tab", title: "Grid notes", url: "wiki" },
  { kind: "split", tabs: [{ title: "Alpha", url: "a.test" }, { title: "Beta", url: "b.test" }] },
], "notes");
assert.deepEqual(hits.map(row => row.title ?? "split"), ["Notes", "Grid notes"]);

assert.equal(filterDestinations([{ kind: "tab", title: "Notes", url: "" }], "  ").length, 1, "blank query keeps every row");
assert.equal(filterDestinations([{ kind: "split", tabs: [{ title: "Alpha", url: "host" }] }], "HOST").length, 1);
assert.equal(filterDestinations([{ kind: "tab", title: "Notes", url: "" }], "zzz").length, 0);

assert.deepEqual(activatePlan({ kind: "split", mode: "float" }), { op: "join", mode: "float" });
assert.deepEqual(activatePlan({ kind: "split", mode: "grid" }), { op: "join", mode: "grid" });
assert.deepEqual(activatePlan({ kind: "split", mode: "replace" }), { op: "join", mode: "grid" }, "Replace on a split card is add-to-grid");
assert.deepEqual(activatePlan({ kind: "split", mode: "below" }), { op: "join", mode: "below" });
assert.deepEqual(activatePlan({ kind: "split", mode: "snapshot" }), { op: "join", mode: "scrolling" });
assert.deepEqual(activatePlan({ kind: "tab", mode: "replace" }), { op: "replace", mode: "replace" });
assert.deepEqual(activatePlan({ kind: "tab", mode: "right" }), { op: "add", mode: "right" });
assert.deepEqual(activatePlan({ kind: "tab", mode: "snapshot" }), { op: "add", mode: "scrolling" });
assert.ok(!("shiftKey" in activatePlan({ kind: "split", mode: "float" })));

await defaultLayoutPicker();

assert.equal(globalThis.gBrowser, undefined, "picker-model fixtures never touch gBrowser");
assert.equal(globalThis.Services, undefined, "picker-model fixtures never touch Services");

console.log("Picker model: eligibility, filter, default mode, activatePlan, and default-layout toggle passed.");

// Builds the real picker from pane.uc.mjs in a tiny DOM, then drives it.
async function defaultLayoutPicker() {
  const source = await readFile(new URL("../pane.uc.mjs", import.meta.url), "utf8");
  const take = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
  const runtime = [
    take("function paintMode", "function openCandidate"),
    take("function openCandidate", "function buildPicker"),
    take("function buildPicker", "function applyAppearance"),
    take("function openPicker", "function dispatch"),
    take("function trapDialogFocus", "function onSplitActivated"),
    take("const prefObserver", "const historyProgress"),
    "this.prefObserver = prefObserver;",
  ].join("\n");

  const preferences = JSON.parse(await readFile(new URL("../preferences.json", import.meta.url), "utf8"));
  const setting = preferences.find(item => item.property === "mod.pane.default-layout");
  assert.equal(setting?.defaultValue, "");
  assert.deepEqual(setting.options.map(option => option.value), ["", ...Object.keys(modeLabels)]);
  assert.match(setting.options.find(option => option.value === "replace").label, /only.*inside a split/i,
    "Settings says Replace only applies inside a split");

  const matches = (el, selector) => selector.split(":not(").reduce((ok, part, index) => {
    if (!ok) return false;
    if (index > 0) return !matches(el, part.replace(/\)$/, ""));
    if (part === ":disabled") return Boolean(el.disabled);
    const attr = part.match(/^(\w*)\[(data-mode|hidden)(?:="([^"]*)")?\]$/);
    if (attr) {
      if (attr[1] && el.tag !== attr[1]) return false;
      return attr[2] === "hidden" ? Boolean(el.hidden) : el.dataset.mode === attr[3];
    }
    if (part.startsWith(".")) return el.className.split(" ").includes(part.slice(1));
    if (part.startsWith("#")) return el.id === part.slice(1);
    return el.tag === part;
  }, true);
  const descendants = el => el.children.flatMap(child => [child, ...descendants(child)]);
  const visibleText = el => el.textContent + el.children.map(visibleText).join("");

  function harness(storage = new Map()) {
    const pref = "mod.pane.default-layout";
    const doc = { activeElement: null };
    const element = tag => {
      const el = {
        tag, id: "", className: "", textContent: "", title: "", hidden: false, disabled: false,
        children: [], parent: null, attrs: {}, dataset: {}, listeners: {}, style: { setProperty() {} },
        classList: {
          add(name) { el.className = `${el.className} ${name}`.trim(); },
          toggle() {},
        },
        setAttribute(name, value) { el.attrs[name] = String(value); },
        getAttribute(name) { return el.attrs[name] ?? null; },
        toggleAttribute() {},
        addEventListener(type, listener) { el.listeners[type] = listener; },
        append(...nodes) { for (const child of nodes) { child.parent = el; el.children.push(child); } },
        appendChild(child) { el.append(child); return child; },
        remove() { if (el.parent) el.parent.children = el.parent.children.filter(child => child !== el); },
        querySelectorAll(selector) {
          if (selector.includes(" ")) return [];
          return descendants(el).filter(child => matches(child, selector));
        },
        querySelector(selector) { return el.querySelectorAll(selector)[0] ?? null; },
        focus() { doc.activeElement = el; },
        click() { el.listeners.click?.({}); },
      };
      return el;
    };
    const root = element("html");
    Object.assign(doc, {
      documentElement: root,
      createElement: element,
      createTextNode: text => Object.assign(element("#text"), { textContent: text }),
      getElementById: id => descendants(root).find(el => el.id === id) ?? null,
    });
    const icon = () => Object.assign(element("svg"), { className: "pane-svg" });
    const tab = { label: "Current" };
    const sandbox = {
      modeLabels, normalizeMode, defaultMode, activatePlan, reduce,
      document: doc, root, window: {},
      PREF: { defaultLayout: pref, recent: "mod.pane.recent", compact: "mod.pane.compact", button: "mod.pane.button" },
      stringPref: (key, fallback) => storage.get(key) ?? fallback,
      boolPref: (_key, fallback) => fallback,
      paneIcon: icon, setPaneIcon() {},
      filtered: [], selectedIndex: 0, pointer: {},
      renderCount: 0, renderResults() { sandbox.renderCount += 1; },
      applyAppearance() {}, ensurePaneButtons() {}, syncToolbarReveals() {}, positionDialog() {},
      onBackdropMouseDown() {}, onPickerDialogKey() {}, onResultsPointerMove() {}, onResultsFocusIn() {},
      multiwindow: { closeMenu() {}, sync() {}, add(_target, _tab, mode) { sandbox.applied = mode; } },
      splitter: () => ({}), compatible: () => true, activeData: () => ({ tabs: [] }),
      isSupportedTab: () => true, eligibleTabs: () => [], tabTitle: item => item.label,
      diagnosticLog() {}, requestAnimationFrame: callback => callback(),
      closePicker() {}, showToast() {},
    };
    // Gecko notifies pref observers synchronously, and only when the value changes.
    const notify = key => sandbox.prefObserver.observe(null, "nsPref:changed", key);
    sandbox.Services = { prefs: {
      setStringPref(key, value) { const changed = storage.get(key) !== value; storage.set(key, value); if (changed) notify(key); },
      clearUserPref(key) { if (storage.delete(key)) notify(key); },
    } };
    vm.createContext(sandbox);
    vm.runInContext(runtime, sandbox);
    sandbox.buildPicker();
    const toggle = doc.getElementById("pane-default-layout");
    const chip = mode => sandbox.modeBar.querySelector(`[data-mode="${mode}"]`);
    const open = (...args) => { sandbox.openPicker(...args); sandbox.overlay.hidden = false; };
    return { sandbox, storage, pref, tab, toggle, chip, open, doc };
  }

  {
    // The toggle is its own control, outside the layout chips, and its label never changes width.
    const { sandbox, toggle, chip, open, tab, doc } = harness();
    assert.ok(toggle, "picker renders a default-layout toggle");
    assert.ok(!sandbox.modeBar.querySelectorAll("button").includes(toggle), "toggle is not one of the layout chips");
    assert.equal(toggle.dataset.mode, undefined);
    assert.equal(toggle.getAttribute("role"), "switch", "toggle is announced as a switch, not a layout");
    open(tab);
    const offText = visibleText(toggle);
    toggle.click();
    assert.equal(toggle.getAttribute("aria-checked"), "true");
    assert.equal(visibleText(toggle), offText, "turning the default on does not change the visible label");
    chip("below").click();
    assert.equal(toggle.getAttribute("aria-checked"), "false", "the switch follows the selected chip");
    assert.equal(visibleText(toggle), offText);

    // Tab moves from the last chip onto the toggle, so keyboard users reach it.
    const chips = sandbox.modeBar.querySelectorAll("button:not([hidden])");
    chips.at(-1).focus();
    sandbox.trapDialogFocus({ key: "Tab", shiftKey: false, preventDefault() {} });
    assert.equal(doc.activeElement, toggle);
  }

  {
    // One click, one repaint: only the switch updates; chips and rows stay put.
    const { sandbox, toggle, chip, open, tab } = harness();
    open(tab);
    chip("grid").click();
    let switchPaints = 0;
    let chipPaints = 0;
    const paintSwitch = toggle.setAttribute;
    toggle.setAttribute = (name, value) => { if (name === "aria-checked") switchPaints += 1; paintSwitch(name, value); };
    const paintChip = chip("grid").setAttribute;
    chip("grid").setAttribute = (name, value) => { if (name === "aria-pressed") chipPaints += 1; paintChip(name, value); };
    const renders = sandbox.renderCount;
    toggle.click();
    assert.equal(switchPaints, 1, "a toggle click repaints the switch once");
    assert.equal(chipPaints, 0, "a toggle click does not repaint the chips");
    assert.equal(sandbox.renderCount, renders, "a toggle click does not rebuild the rows");
    toggle.click();
    assert.equal(switchPaints, 2, "clearing also repaints once");
    assert.equal(sandbox.renderCount, renders);
  }

  {
    // Settings can change the default while the picker is open; the switch follows.
    const { sandbox, storage, pref, toggle, chip, open, tab } = harness();
    open(tab);
    chip("float").click();
    sandbox.Services.prefs.setStringPref(pref, "float");
    assert.equal(toggle.getAttribute("aria-checked"), "true");
    assert.equal(storage.get(pref), "float");
  }

  {
    // Saving persists across picker instances, and Enter applies the saved layout.
    const first = harness();
    first.open(first.tab);
    first.chip("below").click();
    assert.equal(first.storage.size, 0, "choosing a layout does not save it");
    first.toggle.click();
    assert.equal(first.storage.get(first.pref), "below");

    const reopened = harness(first.storage);
    reopened.open(reopened.tab);
    assert.equal(reopened.sandbox.openMode, "below", "a fresh picker preselects the saved layout");
    assert.equal(reopened.chip("below").getAttribute("aria-pressed"), "true");
    assert.equal(reopened.toggle.getAttribute("aria-checked"), "true");
    const row = { kind: "tab", label: "Notes" };
    const { action } = reduce({ mode: reopened.sandbox.openMode, rows: [row], selectedIndex: 0 }, { key: "Enter" });
    reopened.sandbox.openCandidate(row, action.mode);
    assert.equal(reopened.sandbox.applied, "below");

    reopened.toggle.click();
    assert.equal(reopened.storage.has(reopened.pref), false, "clicking again clears the default");
    reopened.open(reopened.tab);
    assert.equal(reopened.sandbox.openMode, "right", "clearing restores Split right");
  }

  {
    // Temporary choices, keyboard cycling, and requested modes never overwrite the default.
    const { sandbox, storage, pref, toggle, chip, open, tab } = harness();
    storage.set(pref, "grid");
    open(tab, false, "below");
    assert.equal(sandbox.openMode, "below", "explicit entry-point intent wins");
    assert.equal(toggle.getAttribute("aria-checked"), "false");
    const { state } = reduce({ mode: "below", inSplit: false }, { code: "BracketRight", ctrlKey: true, shiftKey: true });
    sandbox.paintMode(state.mode);
    chip("float").click();
    assert.equal(storage.get(pref), "grid");
    toggle.click();
    assert.equal(storage.get(pref), "float", "saving replaces the one previous default");
    open(tab);
    assert.equal(sandbox.openMode, "float");
  }

  {
    // Inside a split the picker preselects Replace, even with a saved default.
    const { sandbox, storage, pref, chip, open, tab } = harness();
    storage.set(pref, "below");
    sandbox.activeData = () => ({ tabs: [tab, { label: "Mate" }] });
    open(tab);
    assert.equal(sandbox.openMode, "replace");
    assert.equal(chip("replace").getAttribute("aria-pressed"), "true");
    assert.equal(chip("below").getAttribute("aria-pressed"), "false");
    assert.equal(storage.get(pref), "below", "the saved default is kept for later");

    // Outside a split the saved default is preselected.
    sandbox.activeData = () => ({ tabs: [] });
    open(tab);
    assert.equal(sandbox.openMode, "below");
    assert.equal(chip("below").getAttribute("aria-pressed"), "true");
    assert.equal(chip("replace").hidden, true);
  }

  {
    // A saved Replace has nothing to replace outside a split, so Split right is used.
    const { sandbox, storage, pref, open, tab } = harness();
    storage.set(pref, "replace");
    open(tab);
    assert.equal(sandbox.openMode, "right");
    assert.equal(storage.get(pref), "replace");
  }
}
