import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { pickerBinding, pickerShortcutAction, shortcutLabel } from "../keybindings.mjs";
import { reduce } from "../picker-keys.mjs";
import { modeLabels, normalizeMode } from "../layout-modes.mjs";

const source = await readFile(new URL("../pane.uc.mjs", import.meta.url), "utf8");
const take = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const body = [
  take("function pickerRows", "function highlighted"),
  take("function paintMode", "function setMode"),
  take("function pickerKeyInput", "function onShortcut"),
].join("\n");

function node(extra = {}) {
  const item = {
    className: extra.className ?? "",
    tag: extra.tag ?? "div",
    parent: extra.parent ?? null,
    children: extra.children ?? [],
    attrs: {},
    textContent: extra.textContent ?? "",
    dataset: extra.dataset ?? {},
    classList: {
      add(name) { item.className = `${item.className} ${name}`.trim(); },
      toggle(name, on) {
        const bits = item.className.split(" ").filter(Boolean);
        item.className = (on ? [...new Set([...bits, name])] : bits.filter(bit => bit !== name)).join(" ");
      },
    },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    getAttribute(name) { return this.attrs[name] ?? null; },
    append(...nodes) { for (const child of nodes) { child.parent = this; this.children.push(child); } },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); },
    querySelector(sel) {
      if (sel.startsWith(".")) return this.children.find(child => child.className.split(" ").includes(sel.slice(1))) ?? null;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === "button") return this.children.filter(child => child.tag === "button" || child.dataset.mode);
      if (sel === ".pane-item") return this.children.filter(child => child.className.split(" ").includes("pane-item"));
      return [];
    },
    contains(other) { return this === other || this.children.some(child => child.contains(other)); },
    closest(sel) {
      if (sel === ".pane-item" && this.className.split(" ").includes("pane-item")) return this;
      if (sel === "button" && (this.tag === "button" || this.dataset.mode)) return this;
      return this.parent?.closest(sel) ?? null;
    },
    focus() { item.ownerDocument.activeElement = this; },
    scrollIntoView() {},
    ...extra,
  };
  return item;
}

function harness() {
  const help = node({ id: "pane-help" });
  const search = node({ tag: "input", value: "" });
  const results = node({ className: "results" });
  const modeBar = node({ className: "modes" });
  const items = [0, 1, 2].map(index => {
    const action = node({ className: "pane-action", textContent: "Split right" });
    const item = node({
      className: index === 0 ? "pane-item pane-split-choice" : "pane-item",
      tag: index === 0 ? "div" : "button",
      parent: results,
      children: [action],
    });
    action.parent = item;
    results.children.push(item);
    return item;
  });
  const unsplit = node({ tag: "button", className: "pane-split-unsplit", textContent: "Unsplit" });
  items[0].append(unsplit);
  for (const mode of ["replace", "right", "below", "grid", "float"]) {
    modeBar.append(node({ tag: "button", dataset: { mode } }));
  }
  let active = search;
  const document = {
    get activeElement() { return active; },
    set activeElement(value) { active = value; },
    getElementById(id) { return id === "pane-help" ? help : null; },
  };
  items.forEach(item => { item.ownerDocument = document; item.focus = () => { active = item; }; });
  unsplit.ownerDocument = document;
  unsplit.focus = () => { active = unsplit; };
  search.ownerDocument = document;
  search.focus = () => { active = search; };
  results.contains = other => results === other || results.children.some(child => child === other || child.contains(other));

  const filtered = [
    { kind: "split", group: { tabs: [] } },
    { kind: "tab", label: "Notes" },
    { kind: "tab", label: "Docs" },
  ];
  let activated = null;
  const context = {
    selectedIndex: 0,
    openMode: "right",
    filtered,
    expanded: false,
    pickerInSplit: false,
    search,
    results,
    modeBar,
    document,
    reduce,
    normalizeMode,
    modeLabels,
    tabTitle: row => row.label ?? "Split",
    paneIcon: () => node({ className: "pane-svg pane-mode-check" }),
    openCandidate(row, mode) { activated = { row, mode }; },
    closePicker() { context.closed = true; },
    renderResults() { context.rebuilt = (context.rebuilt ?? 0) + 1; },
  };
  vm.runInNewContext(`${body}\nthis.selectResult=selectResult;this.hoverResult=hoverResult;this.onResultsPointerMove=onResultsPointerMove;this.onResultsFocusIn=onResultsFocusIn;this.paintMode=paintMode;this.applyPickerKey=applyPickerKey;`, context);
  const key = extra => ({
    key: "", code: "", keyCode: 0, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, isComposing: false,
    target: active, preventDefault() { this.prevented = true; },
    ...extra,
  });
  return { context, items, filtered, key, activated: () => activated, help, search, document, unsplit };
}

{
  const { context, items, filtered, key, activated } = harness();
  items[0].focus();
  context.selectResult(0);
  context.applyPickerKey(key({ key: "ArrowDown", target: items[0] }));
  assert.equal(context.selectedIndex, 1, "↓ from a focused card moves the highlight to row 1");
  assert.equal(context.document.activeElement, items[1], "focus follows the highlight");
  context.applyPickerKey(key({ key: "ArrowDown", target: items[1] }));
  assert.equal(context.selectedIndex, 2);
  assert.equal(context.document.activeElement, items[2]);
  context.applyPickerKey(key({ key: "Enter", target: items[2] }));
  assert.equal(activated().row, filtered[2], "Enter activates the highlighted row, not the card you first Tabbed to");
  assert.equal(activated().mode, "right");
}

{
  const { context, items, filtered, key, activated } = harness();
  items[0].focus();
  context.selectResult(0);
  context.onResultsPointerMove({ clientX: 4, clientY: 8, target: items[2] });
  assert.equal(context.selectedIndex, 2);
  assert.equal(context.document.activeElement, items[2], "hover moves focus when a row already has it");
  context.applyPickerKey(key({ key: "Enter", target: items[2] }));
  assert.equal(activated().row, filtered[2], "Tab then hover then Enter opens the hovered row");
}

{
  const { context, items, unsplit } = harness();
  unsplit.focus();
  context.selectResult(0);
  context.onResultsPointerMove({ clientX: 12, clientY: 16, target: unsplit });
  assert.equal(context.document.activeElement, unsplit, "hovering the same card leaves Unsplit focused");
  assert.equal(context.selectedIndex, 0);
  context.onResultsPointerMove({ clientX: 20, clientY: 16, target: items[2] });
  assert.equal(context.document.activeElement, unsplit, "hover does not steal focus from Unsplit");
  assert.equal(context.selectedIndex, 0, "hover does not move the highlight while Unsplit has focus");
}

{
  const { context, items } = harness();
  items[0].focus();
  context.selectResult(0);
  context.onResultsPointerMove({ clientX: 7, clientY: 7, target: items[0] });
  context.onResultsPointerMove({ clientX: 7, clientY: 7, target: items[2] });
  assert.equal(context.selectedIndex, 0, "same pointer coords after a keyboard scroll do not hover");
  assert.equal(context.document.activeElement, items[0]);
}

{
  const { context, items, key } = harness();
  items[1].focus();
  context.selectResult(1);
  const before = items[1];
  context.applyPickerKey(key({
    key: "}", code: "BracketRight", ctrlKey: true, shiftKey: true, target: items[1],
  }));
  assert.equal(context.openMode, "below");
  assert.equal(context.rebuilt, undefined, "cycle does not rebuild the list");
  assert.equal(context.document.activeElement, before, "cycle keeps focus on the same row");
  assert.equal(context.selectedIndex, 1);
  assert.equal(items[1].querySelector(".pane-action").textContent, "Split below", "cycle rewrites the row verb in place");
  context.applyPickerKey(key({ key: "Escape", target: before }));
  assert.equal(context.closed, true, "Escape still reaches the dialog after a cycle");
}

{
  const { context, items, help } = harness();
  context.selectResult(0);
  context.onResultsFocusIn({ target: items[2] });
  assert.equal(context.selectedIndex, 2, "Tab into a row updates the highlight");
  help.innerHTML = "unchanged";
  context.onResultsFocusIn({ target: items[2] });
  assert.equal(help.innerHTML, "unchanged", "focusin skips a no-op re-select");
  assert.equal(context.selectedIndex, 2);
}

{
  const { context, items, key, activated } = harness();
  context.document.activeElement = context.search;
  context.selectResult(0);
  items[0].focus = () => { throw new Error("hover must not steal search focus"); };
  context.onResultsPointerMove({ clientX: 3, clientY: 9, target: items[2] });
  assert.equal(context.selectedIndex, 2);
  assert.equal(context.document.activeElement, context.search);
  context.applyPickerKey(key({ key: "Enter", target: context.search }));
  assert.equal(activated().row.label, "Docs");
}

const keys = await readFile(new URL("../picker-keys.mjs", import.meta.url), "utf8");
assert.ok(!source.includes("export { isHubCycleChord }"));
assert.ok(!keys.includes("export { isHubCycleChord }"), "the chord lives in keybindings, not a picker re-export");
assert.ok(!keys.includes(".closest"), "the reducer stays DOM-free");
console.log("Picker wiring: roving focus, hover follows row focus, nested buttons keep highlight.");

// Run the real capture listener with a macOS Option-generated character.
{
  let opened = 0, closed = 0;
  const shortcutLogs = [];
  const context = vm.createContext({
    window: {navigator: {platform: "MacIntel"}, addEventListener(type, listener, capture) {
      assert.equal(type, "keydown");
      assert.equal(capture, true, "the picker shortcut runs before page listeners");
      this.listener = listener;
    }},
    Services: {prefs: {getIntPref: () => 3, getStringPref: () => "Alt+Shift+R"}},
    pickerBinding, pickerShortcutAction, shortcutLabel, overlay: {hidden: true},
    diagnosticLog(event, details) { shortcutLogs.push(details.binding); },
    openPicker() { opened++; context.overlay.hidden = false; },
    closePicker() { closed++; context.overlay.hidden = true; },
  });
  const registration = source.match(/window\.addEventListener\("keydown", onShortcut, true\);/)?.[0];
  assert.ok(registration, "shortcut capture listener is registered");
  vm.runInContext(take("function onShortcut", "function onBackdropMouseDown") + registration, context);
  const press = extra => {
    const event = {key: "‰", code: "KeyR", altKey: true, shiftKey: true, ctrlKey: false, metaKey: false,
      getModifierState: name => name === "AltGraph",
      preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...extra};
    context.window.listener(event);
    return event;
  };
  for (const state of ["open", "close"]) {
    const event = press();
    assert.equal(event.prevented, true, `${state} prevents text insertion`);
    assert.equal(event.stopped, true, `${state} stops the event before page handlers`);
  }
  assert.equal(opened, 1);
  assert.equal(closed, 1);
  assert.deepEqual(shortcutLogs, ['Option+Shift+R', 'Option+Shift+R'], 'shortcut diagnostics use the platform formatter');
  const ordinary = press({key: "r", altKey: false, shiftKey: false, getModifierState: () => false});
  assert.ok(!ordinary.prevented && !ordinary.stopped, "ordinary typing reaches the page");
}

// Privileged module globals need not expose navigator: each surface must use
// the browser window's platform, including Settings conflict detection.
const bindingsSource = await readFile(new URL("../keybindings.mjs", import.meta.url), "utf8");
for (const platform of ["MacIntel", "Win32", "Linux x86_64"]) {
  const expected = platform === "MacIntel" ? "Ctrl+Alt+R" : "Alt+Shift+P";
  const prefs = { getIntPref: () => 0 };
  const context = vm.createContext({
    window: { navigator: { platform } },
    Services: { prefs }, prefs, platform,
  });
  vm.runInContext(bindingsSource.replace(/^export /gm, ""), context);
  for (const file of ["pane.uc.mjs", "pane-settings.uc.mjs", "pane-diagnostics.uc.mjs"]) {
    const text = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    const calls = [...text.matchAll(/pickerBinding\([^()]*\)/g)];
    assert.ok(calls.length, `${file} has picker consumers`);
    for (const call of calls) {
      const binding = vm.runInContext(call[0], context);
      assert.equal(binding.label, expected, `${platform}: ${file}: ${call[0]} agrees with the handler`);
    }
  }
}
console.log("Picker platform: handler, guide, startup log, Settings and diagnostics agree on Mac/Windows/Linux.");
