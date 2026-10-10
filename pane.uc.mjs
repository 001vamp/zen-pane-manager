import { setPaneIcon, setPaneNativeIcon, paneIcon } from "./icons.mjs?pane=0.11.0-icons2";
import { createMultiwindow, modeLabels, normalizeMode, tabWorkspace, isSupportedTab, addHistoryControls, updateHistoryControls } from "./multiwindow.mjs?pane=0.11.0-picker-focus";
import { remapPresentation } from "./presentation-snapshot.mjs?pane=0.11.0-picker";
import { eligibleDestinations, filterDestinations, defaultMode, activatePlan } from "./picker-model.mjs?pane=0.11.0-picker";
import { numericValue, glassPresets } from "./appearance.mjs?pane=0.11.0-labels";
import { pickerBinding, pickerShortcutAction } from "./keybindings.mjs?pane=0.11.0-hub-fix";
import { reduce } from "./picker-keys.mjs?pane=0.11.0-picker-focus";
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Pane for Zen Browser — replace a pane, preserve its layout leaf.
const TAG = "[Pane]";
const root = document.documentElement;
const INSTANCE_KEY = "__paneInstance";
const DIAGNOSTICS_KEY = "__paneDiagnostics";
const diagnosticLog = (event, details = {}) => window[DIAGNOSTICS_KEY]?.log?.(event, details);
let destroyed = false;

// Sine can reload a user script without restarting the browser. Tear down a
// previous v0.3+ instance and remove any orphaned UI from older releases.
window[INSTANCE_KEY]?.destroy?.();
document.getElementById("pane-overlay")?.remove();
document.getElementById("pane-toast")?.remove();
document.querySelectorAll(".pane-button,.pane-layout-button,.pane-history-button").forEach(button => button.remove());
const PREF = {
  urls: "mod.pane.show-urls",
  recent: "mod.pane.recent-first",
  button: "mod.pane.pane-button",
  keep: "mod.pane.keep-old-tab",
  compact: "mod.pane.compact-picker",
  preset: "mod.pane.style-preset",
  tintLight: "mod.pane.tint-light",
  tintDark: "mod.pane.tint-dark",
  accent: "mod.pane.accent-color",
  blur: "mod.pane.glass-blur",
  radius: "mod.pane.corner-radius",
  width: "mod.pane.picker-width",
  position: "mod.pane.picker-position",
  recentCount: "mod.pane.recent-count",
  columns: "mod.pane.grid-columns",
  dim: "mod.pane.dim-background",
  help: "mod.pane.show-help",
};

let overlay, dialog, heading, context, search, results, count, sectionLabel, expandButton;
let multiwindow, modeBar, updateNotice;
let updateNoticeTimer;
let openMode = "replace", renderGeneration = 0;
let targetTab = null;
let candidates = [];
let filtered = [];
let selectedIndex = 0;
let expanded = false;
let pickerInSplit = false;
let paneAnchorTab = null;
let toastTimer;
let buttonObserver = null;
let buttonFrame = 0;
let lastButtonSummary = "";

const boolPref = (name, fallback) => {
  try { return Services.prefs.getBoolPref(name, fallback); } catch (e) { return fallback; }
};
const intPref = (name, fallback) => {
  try { return Services.prefs.getIntPref(name, fallback); } catch (e) { return fallback; }
};
const stringPref = (name, fallback) => {
  try { return Services.prefs.getStringPref(name, fallback); } catch (e) { return fallback; }
};
const choice = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;
const safeColor = (value, fallback) => {
  const color = String(value || "").trim();
  try { return CSS.supports("color", color) ? color : fallback; } catch (e) { return fallback; }
};
const safeAccent = (value, fallback) => {
  const color = safeColor(value, fallback);
  try {
    const rgba = InspectorUtils.colorToRGBA(color);
    return rgba && rgba.a < 0.3 ? fallback : color;
  } catch (e) {
    return color.toLocaleLowerCase() === "transparent" ? fallback : color;
  }
};
const splitter = () => window.gZenViewSplitter;
const activeData = () => {
  const view = splitter();
  return view?.currentView >= 0 ? view._data?.[view.currentView] : null;
};
const compatible = view =>
  view &&
  Array.isArray(view._data) &&
  typeof view.getSplitNodeFromTab === "function" &&
  typeof view.resetTabState === "function" &&
  typeof view.activateSplitView === "function" &&
  ["splitTabs", "calculateLayoutTree", "removeTabFromGroup", "applyGridLayout", "removeSplitters"].every(name => typeof view[name] === "function");
const workspaceId = tab => tabWorkspace(window, tab);
const tabTitle = tab => tab?.label?.trim() || "Untitled tab";
const lastUsed = tab => tab?._lastAccessed ?? tab?.lastSeenActive ?? 0;

function displayUrl(tab) {
  try {
    const uri = tab.linkedBrowser?.currentURI;
    if (!uri) return "";
    return uri.scheme === "http" || uri.scheme === "https"
      ? uri.displayHost || uri.host || uri.displaySpec
      : uri.displaySpec ?? uri.spec ?? "";
  } catch (e) { return ""; }
}

function tabRecord(tab) {
  return {
    id: tab,
    title: tabTitle(tab),
    url: displayUrl(tab),
    lastUsed: lastUsed(tab),
    splitView: Boolean(tab.splitView),
    closing: Boolean(tab.closing),
    hidden: Boolean(tab.hidden),
    supported: isSupportedTab(tab),
    connected: Boolean(tab.isConnected),
    ref: tab,
  };
}

function eligibleTabs(target, data) {
  const workspace = workspaceId(target);
  return eligibleDestinations({
    target: tabRecord(target),
    currentGroupTabs: (data?.tabs ?? []).map(tabRecord),
    tabs: [...gBrowser.tabs].filter(tab => workspaceId(tab) === workspace).map(tabRecord),
    groups: splitter()._data
      .filter(group => group.tabs.every(tab => workspaceId(tab) === workspace))
      .map(group => ({ tabs: group.tabs.map(tabRecord), ref: group })),
    recentFirst: boolPref(PREF.recent, true),
  }).map(item => item.kind === "split" ? { kind: "split", group: item.group.ref } : item.ref);
}

const candidateTitle = candidate => candidate.kind === "split"
  ? candidate.group.tabs.map(tabTitle).join(" + ") : tabTitle(candidate);

function showToast(message, kind = "info") {
  let toast = document.getElementById("pane-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "pane-toast";
    toast.hidden = true;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    root.appendChild(toast);
  }
  toast.dataset.kind = kind;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), 2600);
}

// Keep feature announcements oldest first. Preserve IDs so missed cards can be found.
const UPDATE_NOTICES = [
  { id: "accordion-motion-2026-10", title: "Accordion tabs", message: "Keep one page expanded and switch through the others from their edges, with smoother motion and keyboard navigation." },
  { id: "quick-start-2026-10", title: "A quick start for everyone", message: "The guide below covers splitting, floating, accordion, and putting tabs back." },
  { id: "pane-0.11.0", title: "Pane 0.11.0", message: "Open the layout menu with Ctrl+Shift+L on Mac or Alt+Shift+L on Windows/Linux. This changed because Option modifies letter keys before Pane can read them on real macOS. Settings and layout recovery are more consistent. Scrolling and floating position/pin recovery are experimental and optional; use the layout menu to return to tiles." },
  { id: "layout-labels-2026-10", title: "Plain layout names", message: "Scrolling is no longer marked experimental in the picker, layout menu, and settings. Updating does not change your current layout.", skipOnFreshInstall: true },
];
const QUICK_START_ID = "quick-start-2026-10";

function missedUpdates(lastRead) {
  const index = UPDATE_NOTICES.findIndex(update => update.id === lastRead);
  return UPDATE_NOTICES.slice(index + 1).toReversed();
}

function showUpdateNotice(manual = false) {
  const prefs = Services.prefs;
  const latest = UPDATE_NOTICES.at(-1).id;
  const unread = missedUpdates(prefs.getStringPref("mod.pane.last-read-update", ""));
  const guideNeeded = prefs.getStringPref("mod.pane.quick-start-seen", "") !== QUICK_START_ID;
  if (!manual && (!prefs.getBoolPref("mod.pane.update-notices", true) ||
      (!unread.length && !guideNeeded) ||
      prefs.getStringPref("mod.pane.last-update-notice", "") === latest)) return;
  if (!manual && !document.hasFocus()) {
    updateNoticeTimer = setTimeout(() => showUpdateNotice(), 3000);
    return;
  }
  updateNotice?.remove();
  updateNotice = document.createElement("section");
  updateNotice.id = "pane-update-notice";
  updateNotice.setAttribute("role", "region");
  updateNotice.setAttribute("aria-label", "Pane quick start and updates");
  const heading = document.createElement("strong");
  heading.textContent = guideNeeded || manual ? "Welcome to Pane" : "What’s new in Pane";
  const close = document.createElement("button");
  close.className = "pane-update-close";
  close.type = "button";
  close.setAttribute("aria-label", "Close quick start and updates");
  setPaneIcon(close, "close");
  close.addEventListener("click", () => { updateNotice?.remove(); updateNotice = null; });
  updateNotice.append(heading, close);
  const body = document.createElement("div");
  body.className = "pane-update-cards";
  const card = (title, text) => {
    const section = document.createElement("article");
    const label = document.createElement("strong"); label.textContent = title;
    const message = document.createElement("p"); message.textContent = text;
    section.append(label, message); body.appendChild(section);
    return section;
  };
  if (guideNeeded || manual) {
    const binding = pickerBinding(prefs)?.label;
    card("1. Open Pane", binding ? `Press ${binding}, or use the swap button at the top of a split pane.` : "Use the swap button at the top of a split pane. You can enable a shortcut in Sine’s Pane settings.");
    card("2. Split or replace", "Pick an open tab and choose a layout. Replace swaps a page without changing your split.");
    card("3. Float a tab", "Choose Floating. Drag the title bar to move it, or an edge to resize. Its menu lets you put it back into a split.");
    const accordion = card("4. Try accordion", "Choose Horizontal accordion in a split’s layout menu. Click a page edge to switch, or focus it and use Left/Right. Shortcuts are customizable in Pane settings.");
    const preview = document.createElement("div"); preview.className = "pane-update-preview";
    preview.setAttribute("aria-hidden", "true");
    for (const text of ["Notes", "Design", "Your page"]) {
      const pane = document.createElement("span"); pane.textContent = text; preview.appendChild(pane);
    }
    accordion.appendChild(preview);
    card("5. Put tabs back", "Return to a normal tab removes one pane. Unsplit separates the whole group. Pages stay open. Use Restore tiled layout to leave accordion.");
  }
  for (const update of manual ? UPDATE_NOTICES.toReversed() : unread) {
    if (update.skipOnFreshInstall && guideNeeded) continue;
    card(update.title, update.message);
  }
  const done = document.createElement("button"); done.type = "button"; done.textContent = "Got it";
  done.addEventListener("click", () => {
    prefs.setStringPref("mod.pane.last-read-update", latest);
    prefs.setStringPref("mod.pane.quick-start-seen", QUICK_START_ID);
    updateNotice?.remove(); updateNotice = null;
  });
  updateNotice.append(body, done);
  root.appendChild(updateNotice);
  // Delivery and acknowledgement are separate: closing does not mark cards read.
  prefs.setStringPref("mod.pane.last-update-notice", latest);
}

function closePicker(restoreFocus = true) {
  if (!overlay || overlay.hidden) return;
  const oldTarget = targetTab;
  overlay.hidden = true;
  renderGeneration++;
  results.replaceChildren();
  targetTab = null;
  pickerInSplit = false;
  paneAnchorTab = null;
  positionDialog();
  candidates = [];
  filtered = [];
  if (restoreFocus) oldTarget?.linkedBrowser?.focus();
}

function selectResult(index, { moveFocus = false } = {}) {
  if (!filtered.length) return;
  selectedIndex = ((index % filtered.length) + filtered.length) % filtered.length;
  const items = [...results.querySelectorAll(".pane-item")];
  items.forEach((item, i) => {
    item.setAttribute("aria-selected", String(i === selectedIndex));
    item.tabIndex = i === selectedIndex ? 0 : -1;
  });
  items[selectedIndex]?.scrollIntoView({ block: "nearest" });
  if (moveFocus) items[selectedIndex]?.focus();
  if (filtered[selectedIndex]?.kind === "split") {
    document.getElementById("pane-help").innerHTML = `<span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>Enter</kbd> ${openMode === "replace" ? "Add" : modeLabels[openMode]}</span><span><kbd>Shift</kbd>+<kbd>Enter</kbd> Floating</span><span><kbd>Esc</kbd> Cancel</span>`;
  } else {
    document.getElementById("pane-help").innerHTML = `<span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>Enter</kbd> ${modeLabels[openMode]}</span><span><kbd>Esc</kbd> Cancel</span>`;
  }
}

// Last real mouse position. Same coords after a keyboard scroll are not a hover.
const pointer = { x: NaN, y: NaN };

function onResultsPointerMove(event) {
  if (event.clientX === pointer.x && event.clientY === pointer.y) return;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  const item = event.target?.closest?.(".pane-item");
  if (!item) return;
  const index = [...results.querySelectorAll(".pane-item")].indexOf(item);
  if (index >= 0) hoverResult(index);
}

// Hover moves focus only when the focused thing is the row itself, not Add / Unsplit.
function hoverResult(index) {
  if (index === selectedIndex) return;
  const items = [...results.querySelectorAll(".pane-item")];
  selectResult(index, { moveFocus: items.includes(document.activeElement) });
}

function highlighted(text, query) {
  const frag = document.createDocumentFragment();
  const at = query ? text.toLocaleLowerCase().indexOf(query) : -1;
  if (at < 0) { frag.append(text); return frag; }
  frag.append(text.slice(0, at));
  const mark = document.createElement("mark");
  mark.textContent = text.slice(at, at + query.length);
  frag.append(mark, text.slice(at + query.length));
  return frag;
}

function renderResults() {
  const generation = ++renderGeneration;
  const query = search.value.trim().toLocaleLowerCase();
  const matches = filterDestinations(candidates.map(tab => tab.kind === "split"
    ? { kind: "split", tabs: tab.group.tabs.map(member => ({ title: tabTitle(member), url: displayUrl(member) })), ref: tab }
    : { kind: "tab", title: tabTitle(tab), url: displayUrl(tab), ref: tab }
  ), query).map(item => item.ref);
  const showAll = Boolean(query) || expanded;
  const previewCount = numericValue("recent-count", Services.prefs);
  filtered = showAll ? matches : matches.slice(0, previewCount);
  results.replaceChildren();
  dialog.toggleAttribute("expanded", showAll);
  dialog.toggleAttribute("searching", Boolean(query));
  sectionLabel.hidden = !query && candidates.some(candidate => candidate.kind === "split");
  sectionLabel.textContent = query
    ? "Search results"
    : expanded
      ? "All open tabs"
      : boolPref(PREF.recent, true) ? "Recently used" : "Open tabs";
  count.textContent = query ? `${matches.length} found` : `${candidates.length} open`;
  expandButton.hidden = Boolean(query) || candidates.length <= previewCount;
  expandButton.replaceChildren();
  const expandLabel = document.createElement("span");
  expandLabel.textContent = expanded ? "Show less" : `Show all ${candidates.length} choices`;
  expandButton.append(expandLabel, paneIcon(document, expanded ? "up" : "down"));
  expandButton.setAttribute("aria-expanded", String(expanded));
  if (!matches.length) {
    const empty = document.createElement("div");
    empty.id = "pane-empty";
    const strong = document.createElement("strong");
    strong.textContent = query ? "No matching tabs" : "No other tabs yet";
    const hint = document.createElement("span");
    hint.textContent = query
      ? "Try a page title, website, or shorter search."
      : "Open another tab in this workspace, then try again.";
    empty.append(strong, hint);
    results.appendChild(empty);
    return;
  }
  const showUrls = boolPref(PREF.urls, true);
  filtered.forEach((tab, index) => {
    if (index === 0 || (tab.kind !== "split" && filtered[index - 1]?.kind === "split")) {
      const label = document.createElement("div");
      label.className = "pane-choice-section";
      label.textContent = tab.kind === "split" ? "Existing splits" : "Open tabs";
      results.append(label);
    }
    if (tab.kind === "split") {
      renderSplitCandidate(tab, index, query, generation);
      return;
    }
    const item = document.createElement("button");
    item.className = "pane-item";
    item.type = "button";
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(index === 0));
    item.setAttribute("aria-label", `${modeLabels[openMode]}: ${tabTitle(tab)}`);
    item.tabIndex = index === 0 ? 0 : -1;

    const iconBox = document.createElement("span");
    iconBox.className = "pane-icon-wrap";
    const icon = document.createElement("img");
    icon.className = "pane-icon";
    icon.alt = "";
    icon.src = tab.getAttribute("image") || "chrome://global/skin/icons/defaultFavicon.svg";
    iconBox.appendChild(icon);

    const copy = document.createElement("span");
    copy.className = "pane-copy";
    const title = document.createElement("span");
    title.className = "pane-title";
    title.appendChild(highlighted(tabTitle(tab), query));
    copy.appendChild(title);
    if (showUrls) {
      const url = document.createElement("span");
      url.className = "pane-url";
      url.appendChild(highlighted(displayUrl(tab), query));
      copy.appendChild(url);
    }
    const action = document.createElement("span");
    action.className = "pane-action";
    action.textContent = modeLabels[openMode];
    item.append(iconBox, copy, action);
    item.addEventListener("click", () => openCandidate(tab));
    results.appendChild(item);
    if (!showAll && !tab.hasAttribute("pending")) {
      const preview = document.createElement("canvas");
      preview.className = "pane-preview"; preview.width = 360; preview.height = 190;
      preview.setAttribute("aria-hidden", "true");
      item.classList.add("pane-item-preview");
      item.prepend(preview);
      capturePreview(tab, preview, generation);
    }
  });
  if (filtered.length) selectResult(0);
}

function renderSplitCandidate(candidate, index, query, generation) {
  const { group } = candidate;
  const full = group.tabs.length >= splitter().MAX_TABS;
  const item = document.createElement("div");
  item.className = "pane-item pane-split-choice";
  item.setAttribute("role", "option");
  item.setAttribute("aria-selected", String(index === 0));
  item.setAttribute("aria-disabled", String(full));
  item.setAttribute("aria-label", `${candidateTitle(candidate)}. ${group.tabs.length} tabs. ${full ? "Split full" : "Enter to add this tab, Shift+Enter to float"}`);
  item.tabIndex = index === 0 ? 0 : -1;
  const preview = document.createElement("div");
  preview.className = "pane-split-preview";
  preview.dataset.layout = group.gridType;
  for (const member of group.tabs) {
    const cell = document.createElement("div");
    cell.className = "pane-split-preview-cell";
    const fallback = document.createElement("span");
    fallback.textContent = tabTitle(member);
    const icon = document.createElement("img");
    icon.alt = "";
    icon.src = member.getAttribute("image") || "chrome://global/skin/icons/defaultFavicon.svg";
    const placeholder = document.createElement("div");
    placeholder.className = "pane-split-placeholder";
    placeholder.append(icon, fallback);
    cell.append(placeholder);
    if (!member.hasAttribute("pending")) {
      const canvas = document.createElement("canvas");
      canvas.width = 180; canvas.height = 100;
      canvas.setAttribute("aria-hidden", "true");
      cell.append(canvas);
      capturePreview(member, canvas, generation);
    }
    preview.append(cell);
  }
  const title = document.createElement("span");
  title.className = "pane-title";
  title.append(highlighted(candidateTitle(candidate), query));
  const detail = document.createElement("span");
  detail.className = "pane-url";
  detail.textContent = `${group.tabs.length} tabs${full ? " · Split full" : " · Add your current tab"}`;
  const copy = document.createElement("span");
  copy.className = "pane-copy"; copy.append(title, detail);
  const actions = document.createElement("span");
  actions.className = "pane-split-actions";
  for (const [mode, label] of [["grid", "Add"], ["float", "Floating"]]) {
    const button = document.createElement("button");
    button.type = "button"; button.disabled = full;
    button.append(paneIcon(document, mode === "grid" ? "grid" : "float"), document.createTextNode(label));
    button.setAttribute("aria-label", `${label} current tab to ${candidateTitle(candidate)}`);
    button.addEventListener("click", event => { event.stopPropagation(); openCandidate(candidate, mode); });
    actions.append(button);
  }
  const unsplit = document.createElement("button");
  unsplit.type = "button";
  unsplit.className = "pane-split-unsplit";
  unsplit.title = "Unsplit this group and keep every tab open";
  unsplit.setAttribute("aria-label", `Unsplit ${candidateTitle(candidate)}. Keep every tab open`);
  unsplit.append(paneIcon(document, "unsplit"), document.createTextNode("Unsplit"));
  unsplit.addEventListener("click", event => {
    event.stopPropagation();
    try {
      multiwindow.unsplit(group);
      candidates = eligibleTabs(targetTab, activeData());
      renderResults();
      search.focus();
      showToast("Split separated. All tabs are still open", "success");
    } catch (error) { showToast(error.message || "The split could not be separated", "warning"); }
  });
  actions.append(unsplit);
  item.append(preview, copy, actions);
  item.addEventListener("click", () => { if (!full) openCandidate(candidate); });
  item.addEventListener("keydown", event => {
    if (event.target !== item) return;
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      openCandidate(candidate, event.shiftKey ? "float" : openMode);
    }
  });
  results.append(item);
}

async function capturePreview(tab, canvas, generation) {
  try {
    const { PageThumbs } = ChromeUtils.importESModule("resource://gre/modules/PageThumbs.sys.mjs");
    await PageThumbs.captureToCanvas(tab.linkedBrowser, canvas, { fullViewport: true }, true);
    if (generation !== renderGeneration || !canvas.isConnected) { canvas.width = canvas.height = 0; }
  } catch { canvas.remove(); }
}

// Change the chip and the verbs on each row. Do not rebuild the list.
function paintMode(mode) {
  mode = normalizeMode(mode);
  openMode = mode;
  modeBar.querySelectorAll("button").forEach(b => {
    const selected = b.dataset.mode === mode;
    b.setAttribute("aria-pressed", String(selected));
    b.querySelector(".pane-mode-check")?.remove();
    if (selected) { const check = paneIcon(document, "check"); check.classList.add("pane-mode-check"); b.append(check); }
  });
  for (const [index, item] of [...results.querySelectorAll(".pane-item")].entries()) {
    const row = filtered[index];
    if (!row || row.kind === "split") continue;
    item.setAttribute("aria-label", `${modeLabels[openMode]}: ${tabTitle(row)}`);
    const action = item.querySelector(".pane-action");
    if (action) action.textContent = modeLabels[openMode];
  }
  if (filtered.length) selectResult(selectedIndex);
}

function setMode(mode, { rebuild = false } = {}) {
  paintMode(mode);
  if (rebuild) renderResults();
}

function openCandidate(tab, requestedMode = null) {
  const kind = tab.kind === "split" ? "split" : "tab";
  const plan = activatePlan({ kind, mode: requestedMode || openMode });
  if (plan.op === "join") {
    try {
      multiwindow.join(tab.group, targetTab, plan.mode);
      closePicker(false);
    } catch (error) { showToast(error.message || "The split could not be changed", "warning"); }
    return;
  }
  if (plan.op === "replace") {
    multiwindow.clearFloat(true, targetTab);
    replacePane(tab); return;
  }
  const target = targetTab;
  closePicker(false);
  try { multiwindow.add(target, tab, plan.mode); }
  catch (error) { showToast(error.message || "The layout could not be changed", "warning"); }
}

function buildPicker() {
  overlay = document.createElement("div");
  overlay.id = "pane-overlay";
  overlay.hidden = true;
  dialog = document.createElement("div");
  dialog.id = "pane-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "pane-heading");

  const header = document.createElement("header");
  header.id = "pane-header";
  const group = document.createElement("div");
  group.id = "pane-heading-group";
  const eyebrow = document.createElement("div");
  eyebrow.id = "pane-eyebrow";
  eyebrow.textContent = "PANE";
  heading = document.createElement("div");
  heading.id = "pane-heading";
  context = document.createElement("div");
  context.id = "pane-context";
  group.append(eyebrow, heading, context);
  const close = document.createElement("button");
  close.id = "pane-close";
  close.type = "button";
  setPaneIcon(close, "close");
  close.setAttribute("aria-label", "Close Pane");
  close.addEventListener("click", () => closePicker());
  const headerActions = document.createElement("div");
  headerActions.id = "pane-header-actions";
  const diagnosticsButton = document.createElement("button");
  diagnosticsButton.id = "pane-diagnostics";
  diagnosticsButton.type = "button";
  setPaneIcon(diagnosticsButton, "info");
  diagnosticsButton.setAttribute("aria-label", "Copy privacy-safe Pane diagnostics");
  diagnosticsButton.setAttribute("title", "Copy Pane diagnostics");
  diagnosticsButton.addEventListener("click", () => {
    const copied = window[DIAGNOSTICS_KEY]?.copy?.();
    showToast(
      copied ? "Diagnostics copied — paste them into the bug report" : "Diagnostics are in the Browser Console",
      copied ? "success" : "warning"
    );
  });
  const appearanceButton = document.createElement("button");
  appearanceButton.id = "pane-appearance";
  appearanceButton.type = "button";
  setPaneIcon(appearanceButton, "settings");
  appearanceButton.setAttribute("aria-label", "Open Pane appearance settings");
  appearanceButton.title = "Appearance";
  appearanceButton.addEventListener("click", () => {
    closePicker();
    window.openTrustedLinkIn("chrome://sine/content/zen-pane-manager/settings.html", "tab");
  });
  headerActions.append(appearanceButton, diagnosticsButton, close);
  header.append(group, headerActions);

  const searchWrap = document.createElement("div");
  searchWrap.id = "pane-search-wrap";
  const searchIcon = document.createElement("span");
  searchIcon.id = "pane-search-icon";
  searchIcon.append(paneIcon(document, "search"));
  search = document.createElement("input");
  search.id = "pane-search";
  search.type = "search";
  search.placeholder = "Find an open tab…";
  search.autocomplete = "off";
  search.spellcheck = false;
  count = document.createElement("span");
  count.id = "pane-count";
  searchWrap.append(searchIcon, search, count);
  const sectionHeader = document.createElement("div");
  sectionHeader.id = "pane-section-header";
  sectionLabel = document.createElement("span");
  sectionLabel.id = "pane-section-label";
  sectionHeader.appendChild(sectionLabel);
  results = document.createElement("div");
  results.id = "pane-results";
  results.setAttribute("role", "listbox");
  results.setAttribute("aria-label", "Tabs available to replace this pane");
  expandButton = document.createElement("button");
  expandButton.id = "pane-expand";
  expandButton.type = "button";
  expandButton.addEventListener("click", () => {
    expanded = !expanded;
    renderResults();
    search.focus();
  });
  const help = document.createElement("footer");
  help.id = "pane-help";
  help.innerHTML = "<span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>Enter</kbd> Replace</span><span><kbd>Esc</kbd> Cancel</span>";
  modeBar = document.createElement("div");
  modeBar.id = "pane-open-modes";
  modeBar.setAttribute("role", "group"); modeBar.setAttribute("aria-label", "Open tab as");
  for (const [mode, label] of Object.entries(modeLabels)) {
    const button = document.createElement("button");
    button.type = "button"; button.dataset.mode = mode; button.append(document.createTextNode(label), paneIcon(document, "check"));
    button.querySelector(".pane-svg").classList.add("pane-mode-check");
    button.addEventListener("click", () => setMode(mode)); modeBar.append(button);
  }
  const arrangeCurrent = document.createElement("button");
  arrangeCurrent.id = "pane-arrange-current";
  arrangeCurrent.type = "button";
  arrangeCurrent.textContent = "Arrange current pane…";
  arrangeCurrent.addEventListener("click", () => {
    const tab = targetTab;
    closePicker(false);
    multiwindow.openMenu(tab);
  });
  modeBar.append(arrangeCurrent);
  dialog.append(header, searchWrap, modeBar, sectionHeader, results, expandButton, help);
  overlay.appendChild(dialog);
  root.appendChild(overlay);

  overlay.addEventListener("mousedown", onBackdropMouseDown);
  dialog.addEventListener("keydown", onPickerDialogKey);
  results.addEventListener("pointermove", onResultsPointerMove);
  results.addEventListener("mousemove", onResultsPointerMove);
  results.addEventListener("focusin", event => {
    const item = event.target?.closest?.(".pane-item");
    if (!item) return;
    const index = [...results.querySelectorAll(".pane-item")].indexOf(item);
    if (index >= 0 && index !== selectedIndex) selectResult(index);
  });
  search.addEventListener("input", renderResults);
}

function applyAppearance() {
  document.documentElement.toggleAttribute('pane-toolbar-always',intPref('mod.pane.toolbar-visibility',0)===1);
  if (!dialog || !overlay) return;
  const preset = choice(intPref(PREF.preset, 0), [0, 1, 2, 3, 4], 0);
  const custom = {
    light: safeColor(stringPref(PREF.tintLight, "rgba(247, 248, 251, 0.78)"), "rgba(247, 248, 251, 0.78)"),
    dark: safeColor(stringPref(PREF.tintDark, "rgba(24, 25, 30, 0.78)"), "rgba(24, 25, 30, 0.78)"),
    blur: numericValue("glass-blur", Services.prefs),
    radius: numericValue("corner-radius", Services.prefs),
  };
  const appearance = preset === 4 ? custom : glassPresets[preset];
  const accent = safeAccent(stringPref(PREF.accent, "AccentColor"), "AccentColor");
  const width = numericValue("picker-width", Services.prefs);
  const requestedColumns = choice(intPref(PREF.columns, 0), [0, 1, 2, 3], 0);
  const autoColumns = width <= 420 ? 1 : width >= 640 ? 3 : 2;
  const columns = requestedColumns === 0
    ? autoColumns
    : width <= 420 && requestedColumns > 2 ? 2 : requestedColumns;
  const position = choice(intPref(PREF.position, 0), [0, 1, 2], 0);
  dialog.style.setProperty("--pane-user-tint-light", appearance.light);
  dialog.style.setProperty("--pane-user-tint-dark", appearance.dark);
  dialog.style.setProperty("--pane-accent", accent);
  dialog.style.setProperty("--pane-blur", `${appearance.blur}px`);
  dialog.style.setProperty("--pane-radius", `${appearance.radius}px`);
  dialog.style.setProperty("--pane-width", `${width}px`);
  dialog.style.setProperty("--pane-columns", String(columns));
  dialog.style.setProperty("--pane-item-spacing", `${numericValue("item-spacing", Services.prefs)}px`);
  dialog.style.setProperty("--pane-accordion-border-width", `${numericValue("accordion-border-width", Services.prefs)}px`);
  const edgeColor = stringPref("mod.pane.accordion-border-color", "rgba(255, 255, 255, 1)");
  dialog.style.setProperty("--pane-accordion-border-color", CSS.supports("color", edgeColor) ? edgeColor : "white");
  dialog.style.setProperty("--pane-accordion-active-border-width", `${numericValue("accordion-active-border-width", Services.prefs)}px`);
  const activeColor = stringPref("mod.pane.accordion-active-border-color", "rgba(255, 255, 255, 1)");
  dialog.style.setProperty("--pane-accordion-active-border-color", CSS.supports("color", activeColor) ? activeColor : "white");
  overlay.dataset.position = ["top", "upper", "center"][position];
  overlay.toggleAttribute("dim", boolPref(PREF.dim, false));
  dialog.toggleAttribute("hide-help", !boolPref(PREF.help, true));
  positionDialog();
}

function positionDialog() {
  if (!dialog || !overlay) return;
  if (!paneAnchorTab) {
    dialog.removeAttribute("pane-anchored");
    dialog.style.removeProperty("left");
    dialog.style.removeProperty("top");
    dialog.style.removeProperty("max-width");
    return;
  }
  const container = paneAnchorTab.linkedBrowser?.closest(".browserSidebarContainer");
  const rect = container?.getBoundingClientRect();
  if (!rect?.width) return;
  const preferred = numericValue("picker-width", Services.prefs);
  const actualWidth = Math.max(300, Math.min(preferred, rect.width - 24, window.innerWidth - 24));
  const left = Math.max(12, Math.min(rect.left + (rect.width - actualWidth) / 2, window.innerWidth - actualWidth - 12));
  const top = Math.max(42, rect.top + 18);
  dialog.setAttribute("pane-anchored", "true");
  dialog.style.left = `${left}px`;
  dialog.style.top = `${top}px`;
  dialog.style.maxWidth = `${actualWidth}px`;
}

function openPicker(tab = gBrowser.selectedTab, anchorToPane = false, requestedMode = null) {
  multiwindow?.closeMenu();
  if (!compatible(splitter())) {
    diagnosticLog("picker blocked", { reason: "incompatible splitter" });
    showToast("This Zen version is not compatible with Pane yet", "error");
    return;
  }
  const data = activeData();
  if (!isSupportedTab(tab)) {
    showToast("Choose a regular tab to open Pane", "warning"); return;
  }
  const inSplit = Boolean(data?.tabs.includes(tab));
  pickerInSplit = inSplit;
  targetTab = tab;
  paneAnchorTab = anchorToPane ? tab : null;
  candidates = eligibleTabs(tab, data);
  openMode = requestedMode || defaultMode({ inSplit });
  modeBar.querySelector('[data-mode="replace"]').hidden = !inSplit;
  document.getElementById("pane-arrange-current").hidden = !inSplit;
  heading.textContent = inSplit ? "Replace or arrange this pane" : "Open a tab alongside this one";
  results.setAttribute("aria-label", "Available open tabs");
  context.textContent = `Currently showing ${tabTitle(tab)}`;
  dialog.toggleAttribute("compact", boolPref(PREF.compact, false));
  applyAppearance();
  expanded = false;
  search.value = "";
  pointer.x = NaN;
  pointer.y = NaN;
  setMode(openMode, { rebuild: true });
  overlay.hidden = false;
  diagnosticLog("picker opened", {
    anchored: anchorToPane,
    paneCount: data?.tabs.length ?? 1,
    candidateCount: candidates.length,
  });
  requestAnimationFrame(() => search.focus());
}

function dispatch(name, item) {
  item?.dispatchEvent(new CustomEvent(name, {
    detail: { item }, bubbles: true, cancelable: false,
  }));
}

function replacePane(incoming) {
  const view = splitter();
  const data = activeData();
  const outgoing = targetTab;
  closePicker(false);
  if (!view || !data || !outgoing || !data.tabs.includes(outgoing)) {
    diagnosticLog("replacement stopped", { reason: "split changed" });
    showToast("The split changed before the swap finished", "warning"); return;
  }
  if (!incoming || incoming.closing || incoming.splitView) {
    diagnosticLog("replacement stopped", { reason: "incoming tab unavailable" });
    showToast("That tab is no longer available", "warning"); return;
  }
  if (workspaceId(incoming) !== workspaceId(outgoing)) {
    diagnosticLog("replacement stopped", { reason: "workspace changed" });
    showToast("Choose a tab from the same workspace", "warning"); return;
  }
  const leaf = view.getSplitNodeFromTab(outgoing);
  const index = data.tabs.indexOf(outgoing);
  const splitGroup = outgoing.group;
  if (!leaf || index < 0 || !splitGroup?.hasAttribute("split-view-group")) {
    diagnosticLog("replacement stopped", { reason: "split leaf unavailable" });
    showToast("Zen’s split layout is not ready yet", "warning"); return;
  }
  diagnosticLog("replacement started", { paneCount: data.tabs.length });
  let changed = false, prepared = false, rollbackFailed = false;
  const previousSelection=gBrowser.selectedTab;
  const savedPresentation=multiwindow.capturePresentation(data);
  const presentation=remapPresentation(savedPresentation,outgoing,incoming);
  try {
    multiwindow.origins.begin([...data.tabs, incoming]); prepared=true;
    changed=true;
    if (incoming.group !== splitGroup) gBrowser.moveTabToExistingGroup(incoming, splitGroup);
    data.tabs[index] = incoming;
    leaf.tab = incoming;
    view._tabToSplitNode?.delete(outgoing);
    view._tabToSplitNode?.set(incoming, leaf);
    view.resetTabState(outgoing, false);
    if (outgoing.group === splitGroup) gBrowser.ungroupTab(outgoing);
    dispatch("ZenTabRemovedFromSplit", outgoing);
    view.activateSplitView(data, true);
    dispatch("ZenSplitViewTabsSplit", splitGroup);
    gBrowser.selectedTab = incoming;
    multiwindow.restorePresentation(data,presentation,incoming);
    if (!boolPref(PREF.keep, true)) gBrowser.removeTab(outgoing, { animate: true });
    diagnosticLog("replacement completed", { keptOutgoingTab: boolPref(PREF.keep, true) });
    showToast(`Now showing ${tabTitle(incoming)}`, "success");
  } catch (error) {
    console.error(TAG, "replacement failed", error);
    diagnosticLog("replacement failed", { error: error?.name });
    if (changed && !outgoing.closing) {
      try {
        data.tabs[index] = outgoing;
        leaf.tab = outgoing;
        view._tabToSplitNode?.delete(incoming);
        view._tabToSplitNode?.set(outgoing, leaf);
        if (incoming.splitView || incoming.hasAttribute("split-view")) {
          view.resetTabState(incoming, false);
        }
        if (incoming.group === splitGroup) gBrowser.ungroupTab(incoming);
        if (outgoing.group !== splitGroup) gBrowser.moveTabToExistingGroup(outgoing, splitGroup);
        view.activateSplitView(data, true);
        dispatch("ZenTabRemovedFromSplit", incoming);
        dispatch("ZenSplitViewTabsSplit", splitGroup);
        gBrowser.selectedTab = previousSelection;
        multiwindow.restorePresentation(data,savedPresentation,previousSelection);
      } catch (rollbackError) { rollbackFailed=true; console.error(TAG, "rollback failed", rollbackError); }
    }
    if (changed && outgoing.closing) rollbackFailed=true;
    showToast(rollbackFailed ? "Pane could not fully restore the split. Check your tabs and copy a diagnostic report." : "The swap failed. Your original split was restored.", "error");
  } finally { if (prepared) multiwindow.origins.end(); }
}

const toolbarReveals = new Map();
let lastToolbarTab = null;
function syncToolbarReveals() {
  for (const [header, state] of toolbarReveals) {
    if (!header.isConnected) { clearTimeout(state.timer); state.abort.abort(); toolbarReveals.delete(header); }
  }
  const selected = gBrowser.selectedTab;
  const switched = selected !== lastToolbarTab;
  lastToolbarTab = selected;
  for (const header of document.querySelectorAll(".zen-view-splitter-header-container,.pane-float-header")) {
    for (let i=0; i<dialog.style.length; i++) {
      const property=dialog.style[i];
      if (property.startsWith('--pane-')) header.style.setProperty(property,dialog.style.getPropertyValue(property));
    }
    let state = toolbarReveals.get(header);
    const fresh = !state;
    if (!state) {
      state = { timer: 0, abort: new AbortController() };
      toolbarReveals.set(header, state);
      const options = { signal: state.abort.signal };
      header.addEventListener("pointerenter", () => {
        clearTimeout(state.timer); header.setAttribute("data-pane-reveal", "true");
      }, options);
      header.addEventListener("pointerleave", () => {
        clearTimeout(state.timer);
        state.timer = setTimeout(() => header.removeAttribute("data-pane-reveal"), 650);
      }, options);
    }
    const container = header.closest(".browserSidebarContainer");
    if ((switched || fresh) && container?.contains(selected?.linkedBrowser)) {
      clearTimeout(state.timer); header.setAttribute("data-pane-reveal", "true");
      state.timer = setTimeout(() => header.removeAttribute("data-pane-reveal"), 1600);
    }
  }
}

function ensurePaneButtons() {
  document.querySelectorAll(".browserSidebarContainer[is-zen-split]").forEach(container => {
    const header = container.querySelector(".zen-view-splitter-header");
    if (!header) return;
    const current = header.querySelector(".pane-button");
    const nativeRearrange = header.querySelector(".zen-tab-rearrange-button");
    const nativeUnsplit = header.querySelector(".zen-tab-unsplit-button");
    if (nativeRearrange && nativeRearrange.getAttribute("data-pane-icon") !== "grip") {
      nativeRearrange.setAttribute("aria-label", "Move this pane");
      setPaneNativeIcon(nativeRearrange, "grip");
    }
    if (nativeUnsplit && nativeUnsplit.getAttribute("data-pane-icon") !== "unsplit") {
      nativeUnsplit.setAttribute("aria-label", "Remove this pane from the split");
      setPaneNativeIcon(nativeUnsplit, "unsplit");
    }
    if (!boolPref(PREF.button, true)) { current?.remove(); header.querySelector(".pane-layout-button")?.remove(); header.querySelectorAll(".pane-history-button").forEach(b => b.remove()); return; }
    if (!header.querySelector(".pane-layout-button")) {
      const arrange = document.createXULElement("toolbarbutton");
      arrange.className = "pane-layout-button";
      arrange.setAttribute("tabindex", "0");
      arrange.setAttribute("label", ""); setPaneIcon(arrange, "more");
      arrange.setAttribute("tooltiptext", "Arrange this pane");
      arrange.setAttribute("aria-label", "Arrange this pane");
      arrange.addEventListener("click", event => {
        event.preventDefault(); event.stopPropagation();
        const tab = gBrowser.getTabForBrowser(container.querySelector("browser"));
        if (tab) multiwindow.openMenu(tab, arrange);
      });
      header.prepend(arrange);
    }
    addHistoryControls(window, header);
    if (current) return;
    const button = document.createXULElement("toolbarbutton");
    button.className = "pane-button";
    button.setAttribute("tabindex", "0");
    button.setAttribute("tooltiptext", "Replace this pane with another open tab");
    button.setAttribute("aria-label", "Replace this split pane");
    button.setAttribute("label", "");
    setPaneIcon(button, "swap");
    button.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation();
      const browser = container.querySelector("browser");
      const tab = browser ? gBrowser.getTabForBrowser(browser) : null;
      if (tab) { gBrowser.selectedTab = tab; openPicker(tab, true); }
    });
    header.prepend(button);
  });
  syncToolbarReveals();
  const summary = `${document.querySelectorAll(".browserSidebarContainer[is-zen-split]").length}:` +
    `${document.querySelectorAll(".zen-view-splitter-header").length}:` +
    `${document.querySelectorAll(".pane-button").length}`;
  if (summary !== lastButtonSummary) {
    lastButtonSummary = summary;
    const [containers, headers, buttons] = summary.split(":").map(Number);
    diagnosticLog("pane buttons synchronized", { containers, headers, buttons });
  }
}

function schedulePaneButtons() {
  if (buttonFrame) return;
  buttonFrame = requestAnimationFrame(() => {
    buttonFrame = 0;
    ensurePaneButtons();
  });
}

function pickerKeyInput(event) {
  return {
    key: event.key,
    code: event.code,
    keyCode: event.keyCode,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
    isComposing: event.isComposing,
  };
}

function currentPickerState() {
  return {
    query: search.value,
    expanded,
    selectedIndex,
    mode: openMode,
    scope: null,
    peek: null,
    pending: null,
    inSplit: pickerInSplit,
    rows: filtered.map(row => ({ kind: row.kind === "split" ? "split" : "tab" })),
  };
}

// Enter on Add / Floating / Unsplit should hit that button, not the row.
function shouldDeferEnterToButton(target) {
  if (target === search) return false;
  const item = target?.closest?.(".pane-item");
  if (item && target === item) return false;
  return Boolean(target?.closest?.("button"));
}

function applyPickerKey(event) {
  if (event.key === "Enter" && shouldDeferEnterToButton(event.target)) return;
  const { state, action } = reduce(currentPickerState(), pickerKeyInput(event));
  if (!action) return;
  if (action.preventDefault) event.preventDefault();
  if (action.type === "cycleMode") paintMode(state.mode);
  else if (action.type === "clearQuery") {
    search.value = "";
    expanded = false;
    renderResults();
    search.focus();
  } else if (action.type === "collapse") {
    expanded = false;
    renderResults();
    search.focus();
  } else if (action.type === "close") closePicker();
  else if (action.type === "move") {
    selectResult(state.selectedIndex, { moveFocus: results.contains(document.activeElement) });
  } else if (action.type === "activate" && filtered[state.selectedIndex]) {
    openCandidate(filtered[state.selectedIndex], action.mode);
  }
}

function onPickerDialogKey(event) {
  if (event.key === "Tab") {
    trapDialogFocus(event);
    return;
  }
  applyPickerKey(event);
}

function onShortcut(event) {
  const binding = pickerBinding(Services.prefs);
  const action = pickerShortcutAction(event, { overlayOpen: Boolean(overlay && !overlay.hidden), binding });
  if (action === "cycle") return;
  if (action === "open" || action === "close") {
    event.preventDefault(); event.stopPropagation();
    diagnosticLog("picker shortcut received", { binding: binding.label });
    action === "open" ? openPicker() : closePicker();
  }
}

function onBackdropMouseDown(event) {
  if (event.target === overlay) closePicker();
}

function trapDialogFocus(event) {
  if (event.key !== "Tab") return;
  const focusable = [
    search,
    ...modeBar.querySelectorAll("button:not([hidden])"),
    document.getElementById("pane-appearance"),
    ...results.querySelectorAll(".pane-item"),
    ...results.querySelectorAll(".pane-split-actions button:not(:disabled)"),
    expandButton.hidden ? null : expandButton,
    document.getElementById("pane-diagnostics"),
    document.getElementById("pane-close"),
  ].filter(Boolean);
  if (!focusable.length) return;
  const current = focusable.indexOf(document.activeElement);
  const step = event.shiftKey ? -1 : 1;
  const next = current < 0
    ? 0
    : ((current + step) % focusable.length + focusable.length) % focusable.length;
  event.preventDefault();
  focusable[next].focus();
}

function onSplitActivated() {
  schedulePaneButtons();
}

function onWindowResize() {
  if (!overlay.hidden) positionDialog();
}

const prefObserver = {
  observe(subject, topic, name) {
    if (name === PREF.button) ensurePaneButtons();
    applyAppearance();
    syncToolbarReveals();
    multiwindow?.sync();
    if (!overlay.hidden) {
      const data = activeData();
      if (targetTab && data && [PREF.recent].includes(name)) candidates = eligibleTabs(targetTab, data);
      dialog.toggleAttribute("compact", boolPref(PREF.compact, false));
      renderResults();
    }
  },
};

const historyProgress = {
  onLocationChange() { updateHistoryControls(window); },
  onStateChange() { updateHistoryControls(window); },
};

function destroy() {
  if (destroyed) return;
  const instance = window[INSTANCE_KEY];
  const ownsInstance = !instance || instance.destroy === destroy;
  destroyed = true;
  diagnosticLog("Pane runtime unloading");
  gBrowser.tabContainer.removeEventListener("TabSelect", schedulePaneButtons);
  for (const [header, state] of toolbarReveals) {
    clearTimeout(state.timer); state.abort.abort();
    if (ownsInstance) {
      header.removeAttribute("data-pane-reveal");
      for (const property of [...header.style]) if (property.startsWith("--pane-")) header.style.removeProperty(property);
    }
  }
  toolbarReveals.clear();
  renderGeneration++;
  multiwindow?.destroy(ownsInstance ? undefined : {detachOnly:true});
  clearTimeout(updateNoticeTimer);
  updateNotice?.remove();
  updateNotice = null;
  gBrowser.removeTabsProgressListener(historyProgress);
  clearTimeout(toastTimer);
  if (buttonFrame) cancelAnimationFrame(buttonFrame);
  buttonFrame = 0;
  buttonObserver?.disconnect();
  buttonObserver = null;
  window.removeEventListener("keydown", onShortcut, true);
  window.removeEventListener("ZenViewSplitter:SplitViewActivated", onSplitActivated);
  window.removeEventListener("resize", onWindowResize);
  try { Services.prefs.removeObserver("mod.pane.", prefObserver); } catch (e) {}
  overlay?.remove();
  if (ownsInstance) {
    document.getElementById("pane-toast")?.remove();
    document.querySelectorAll(".pane-button,.pane-layout-button,.pane-history-button").forEach(button => button.remove());
    root.removeAttribute("pane-ready");
    root.removeAttribute("pane-toolbar-always");
    if (window[INSTANCE_KEY]?.destroy === destroy) delete window[INSTANCE_KEY];
  }
}

function initialize() {
  try {
    diagnosticLog("Pane runtime initializing", { documentReady: document.readyState });
    buildPicker();
    multiwindow = createMultiwindow(window, {
      prefs: Services.prefs,
      notify: showToast,
      chooseTab: (tab, mode) => openPicker(tab, false, mode),
      appearance: node => {
        for (let i = 0; i < dialog.style.length; i++) {
          const property = dialog.style[i];
          if (property.startsWith("--pane-")) node.style.setProperty(property, dialog.style.getPropertyValue(property));
        }
      },
    });
    window.addEventListener("keydown", onShortcut, true);
    window.addEventListener("ZenViewSplitter:SplitViewActivated", onSplitActivated);
    window.addEventListener("resize", onWindowResize);
    Services.prefs.addObserver("mod.pane.", prefObserver);

    // Split headers can be created after Sine loads Pane, rebuilt during session
    // restore, or replaced by another browser-chrome mod. Watching the browser
    // DOM keeps the pane button available without depending on one Zen event.
    buttonObserver = new MutationObserver(schedulePaneButtons);
    buttonObserver.observe(document.getElementById("browser") ?? root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["is-zen-split"],
    });

    gBrowser.tabContainer.addEventListener("TabSelect", schedulePaneButtons);
    gBrowser.addTabsProgressListener(historyProgress);
    ensurePaneButtons();
    applyAppearance();
    root.setAttribute("pane-ready", "true");
    updateNoticeTimer = setTimeout(showUpdateNotice, 3000);
    window[INSTANCE_KEY] = { destroy, openPicker, multiwindow, showUpdates: () => showUpdateNotice(true), version: "0.11.0" };

    // Sine 2.3+ uses this callback for clean live disable/reload. Without it,
    // Sine intentionally keeps an already imported module running.
    window.addUnloadListener?.(destroy);

    const binding = pickerBinding(Services.prefs);
    diagnosticLog("Pane runtime ready", { binding: binding?.label ?? "disabled" });
    console.log(TAG, `0.11.0 ready${binding ? ` — press ${binding.label}` : " — shortcut disabled"}`);
  } catch (error) {
    console.error(TAG, "failed to initialize", error);
    diagnosticLog("Pane initialization failed", { error: error?.name });
    destroy();
  }
}

initialize();
