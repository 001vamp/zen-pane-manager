import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { reduce } from "../picker-keys.mjs";
import { modeLabels, normalizeMode } from "../layout-modes.mjs";

const source = await readFile(new URL("../pane.uc.mjs", import.meta.url), "utf8");
const take = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const body = [
  take("function selectResult", "function highlighted"),
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
  vm.runInNewContext(`${body}\nthis.selectResult=selectResult;this.hoverResult=hoverResult;this.paintMode=paintMode;this.applyPickerKey=applyPickerKey;`, context);
  const key = extra => ({
    key: "", code: "", keyCode: 0, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, isComposing: false,
    target: active, preventDefault() { this.prevented = true; },
    ...extra,
  });
  return { context, items, filtered, key, activated: () => activated, help, search, document };
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
  context.hoverResult(2);
  assert.equal(context.selectedIndex, 2);
  assert.equal(context.document.activeElement, items[2], "hover moves focus when a row already has it");
  context.applyPickerKey(key({ key: "Enter", target: items[2] }));
  assert.equal(activated().row, filtered[2], "Tab then hover then Enter opens the hovered row");
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
  const { context, items, key, activated } = harness();
  context.document.activeElement = context.search;
  context.selectResult(0);
  items[0].focus = () => { throw new Error("hover must not steal search focus"); };
  context.hoverResult(2);
  assert.equal(context.selectedIndex, 2);
  assert.equal(context.document.activeElement, context.search);
  context.applyPickerKey(key({ key: "Enter", target: context.search }));
  assert.equal(activated().row.label, "Docs");
}

const keys = await readFile(new URL("../picker-keys.mjs", import.meta.url), "utf8");
assert.ok(!source.includes("export { isHubCycleChord }"));
assert.ok(!keys.includes("export { isHubCycleChord }"), "the chord lives in keybindings, not a picker re-export");
assert.ok(!keys.includes(".closest"), "the reducer stays DOM-free");
console.log("Picker wiring: roving focus, hover follows list focus, cycle keeps focus.");
