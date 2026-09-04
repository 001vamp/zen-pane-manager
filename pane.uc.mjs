import { setPaneIcon, setPaneNativeIcon, paneIcon } from "./icons.mjs?pane=0.10.0-dev-icons2";
import { createMultiwindow, modeLabels, needsTabCopy, tabWorkspace, isSupportedTab, addHistoryControls, updateHistoryControls } from "./multiwindow.mjs?pane=0.10.0-dev-pinned-originals1";
import { numericValue, glassPresets } from "./appearance.mjs";
import { matchesBinding, pickerBinding } from "./keybindings.mjs?pane=0.10.0-dev";
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
let multiwindow, modeBar;
let openMode = "replace", renderGeneration = 0;
let targetTab = null;
let candidates = [];
let filtered = [];
let selectedIndex = 0;
let expanded = false;
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

function eligibleTabs(target, data) {
  const workspace = workspaceId(target);
  const tabs = [...gBrowser.tabs].filter(tab =>
    tab !== target && !data?.tabs.includes(tab) && !tab.closing && !tab.hidden &&
    isSupportedTab(tab) &&
    !tab.splitView && workspaceId(tab) === workspace
  );
  if (boolPref(PREF.recent, true)) tabs.sort((a, b) => lastUsed(b) - lastUsed(a));
  return tabs;
}

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

function closePicker(restoreFocus = true) {
  if (!overlay || overlay.hidden) return;
  const oldTarget = targetTab;
  overlay.hidden = true;
  renderGeneration++;
  results.replaceChildren();
  targetTab = null;
  paneAnchorTab = null;
  positionDialog();
  candidates = [];
  filtered = [];
  if (restoreFocus) oldTarget?.linkedBrowser?.focus();
}

function selectResult(index) {
  if (!filtered.length) return;
  selectedIndex = ((index % filtered.length) + filtered.length) % filtered.length;
  const items = [...results.querySelectorAll(".pane-item")];
  items.forEach((item, i) => {
    item.setAttribute("aria-selected", String(i === selectedIndex));
    item.tabIndex = i === selectedIndex ? 0 : -1;
  });
  items[selectedIndex]?.scrollIntoView({ block: "nearest" });
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
  const matches = candidates.filter(tab =>
    `${tabTitle(tab)} ${displayUrl(tab)}`.toLocaleLowerCase().includes(query)
  );
  const showAll = Boolean(query) || expanded;
  const previewCount = numericValue("recent-count", Services.prefs);
  filtered = showAll ? matches : matches.slice(0, previewCount);
  results.replaceChildren();
  dialog.toggleAttribute("expanded", showAll);
  dialog.toggleAttribute("searching", Boolean(query));
  sectionLabel.textContent = query
    ? "Search results"
    : expanded
      ? "All open tabs"
      : boolPref(PREF.recent, true) ? "Recently used" : "Open tabs";
  count.textContent = query ? `${matches.length} found` : `${candidates.length} open`;
  expandButton.hidden = Boolean(query) || candidates.length <= previewCount;
  expandButton.replaceChildren();
  const expandLabel = document.createElement("span");
  expandLabel.textContent = expanded ? "Show less" : `Show all ${candidates.length} tabs`;
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
    const item = document.createElement("button");
    item.className = "pane-item";
    item.type = "button";
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(index === 0));
    const opensCopy = needsTabCopy(tab);
    item.setAttribute("aria-label", `${modeLabels[openMode]}: ${tabTitle(tab)}${opensCopy ? ". Open a copy in this pane" : ""}`);
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
    if (opensCopy) {
      const note = document.createElement("span");
      note.className = "pane-url pane-copy-notice";
      note.textContent = "Open a copy in this pane";
      copy.appendChild(note);
    }
    const action = document.createElement("span");
    action.className = "pane-action";
    action.textContent = opensCopy ? "Open copy" : modeLabels[openMode];
    item.append(iconBox, copy, action);
    item.addEventListener("mouseenter", () => selectResult(index));
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
  selectedIndex = 0;
}

async function capturePreview(tab, canvas, generation) {
  try {
    const { PageThumbs } = ChromeUtils.importESModule("resource://gre/modules/PageThumbs.sys.mjs");
    await PageThumbs.captureToCanvas(tab.linkedBrowser, canvas, { fullViewport: true }, true);
    if (generation !== renderGeneration || !canvas.isConnected) { canvas.width = canvas.height = 0; }
  } catch { canvas.remove(); }
}

function setMode(mode) {
  openMode = mode;
  modeBar.querySelectorAll("button").forEach(b => {
    const selected = b.dataset.mode === mode;
    b.setAttribute("aria-pressed", String(selected));
    b.querySelector(".pane-mode-check")?.remove();
    if (selected) { const check = paneIcon(document, "check"); check.classList.add("pane-mode-check"); b.append(check); }
  });
  document.getElementById("pane-help").innerHTML = `<span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>Enter</kbd> ${modeLabels[mode]}</span><span><kbd>Esc</kbd> Cancel</span>`;
  renderResults();
}

function openCandidate(tab) {
  if (openMode === "replace") {
    multiwindow.clearFloat();
    replacePane(tab); return;
  }
  const target = targetTab, mode = openMode;
  closePicker(false);
  try { multiwindow.add(target, tab, mode); }
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
  dialog.append(header, searchWrap, modeBar, sectionHeader, results, expandButton, help);
  overlay.appendChild(dialog);
  root.appendChild(overlay);

  overlay.addEventListener("mousedown", onBackdropMouseDown);
  dialog.addEventListener("keydown", trapDialogFocus);
  search.addEventListener("input", renderResults);
  search.addEventListener("keydown", event => {
    if (event.key === "ArrowDown") { event.preventDefault(); selectResult(selectedIndex + 1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); selectResult(selectedIndex - 1); }
    else if (event.key === "Enter" && filtered[selectedIndex]) {
      event.preventDefault(); openCandidate(filtered[selectedIndex]);
    }
  });
}

function applyAppearance() {
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
  targetTab = tab;
  paneAnchorTab = anchorToPane ? tab : null;
  candidates = eligibleTabs(tab, data);
  openMode = requestedMode || (inSplit ? "replace" : "right");
  modeBar.querySelector('[data-mode="replace"]').hidden = !inSplit;
  heading.textContent = inSplit ? "Replace or arrange this pane" : "Open a tab alongside this one";
  results.setAttribute("aria-label", "Available open tabs");
  context.textContent = needsTabCopy(tab)
    ? `A copy of ${tabTitle(tab)} will open alongside your selection`
    : `Currently showing ${tabTitle(tab)}`;
  dialog.toggleAttribute("compact", boolPref(PREF.compact, false));
  applyAppearance();
  expanded = false;
  search.value = "";
  setMode(openMode);
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
  const originalIncomingGroup = incoming.group;
  const originalPinState = [...data.tabs, incoming].map(tab => ({ tab, pinned: tab.pinned }));
  let changed = false, savedTabCopy = null;
  try {
    if (needsTabCopy(incoming)) {
      incoming = savedTabCopy = gBrowser.duplicateTab(incoming, true);
    }
    if (incoming.pinned || outgoing.pinned) {
      for (const tab of [...data.tabs, incoming]) if (!tab.pinned) gBrowser.pinTab(tab);
    }
    if (incoming.group !== splitGroup) gBrowser.moveTabToExistingGroup(incoming, splitGroup);
    data.tabs[index] = incoming;
    leaf.tab = incoming;
    changed = true;
    view._tabToSplitNode?.delete(outgoing);
    view._tabToSplitNode?.set(incoming, leaf);
    view.resetTabState(outgoing, false);
    if (outgoing.group === splitGroup) gBrowser.ungroupTab(outgoing);
    dispatch("ZenTabRemovedFromSplit", outgoing);
    view.activateSplitView(data, true);
    dispatch("ZenSplitViewTabsSplit", splitGroup);
    gBrowser.selectedTab = incoming;
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
        gBrowser.selectedTab = outgoing;
      } catch (rollbackError) { console.error(TAG, "rollback failed", rollbackError); }
    }
    if (!savedTabCopy && originalIncomingGroup?.isConnected && incoming.group !== originalIncomingGroup) {
      gBrowser.moveTabToExistingGroup(incoming, originalIncomingGroup);
    }
    for (const { tab, pinned } of originalPinState) {
      if (tab.isConnected && tab.pinned !== pinned) pinned ? gBrowser.pinTab(tab) : gBrowser.unpinTab(tab);
    }
    if (savedTabCopy?.isConnected && !savedTabCopy.closing) gBrowser.removeTab(savedTabCopy, { animate: false });
    showToast("The pane was not changed", "error");
  }
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
        state.timer = setTimeout(() => header.removeAttribute("data-pane-reveal"), 450);
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

function onShortcut(event) {
  const binding = pickerBinding(Services.prefs);
  if (matchesBinding(event, binding)) {
    event.preventDefault(); event.stopPropagation();
    diagnosticLog("picker shortcut received", { binding: binding.label });
    overlay.hidden ? openPicker() : closePicker();
  }
}

function onBackdropMouseDown(event) {
  if (event.target === overlay) closePicker();
}

function trapDialogFocus(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    if (search.value) {
      search.value = "";
      expanded = false;
      renderResults();
      search.focus();
    } else if (expanded) {
      expanded = false;
      renderResults();
      search.focus();
    } else {
      closePicker();
    }
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [
    search,
    ...modeBar.querySelectorAll("button:not([hidden])"),
    document.getElementById("pane-appearance"),
    ...results.querySelectorAll(".pane-item"),
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
  diagnosticLog("Pane runtime unloading");
  gBrowser.tabContainer.removeEventListener("TabSelect", schedulePaneButtons);
  for (const [header, state] of toolbarReveals) {
    clearTimeout(state.timer); state.abort.abort(); header.removeAttribute("data-pane-reveal");
  }
  toolbarReveals.clear();
  renderGeneration++;
  multiwindow?.destroy();
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
  document.getElementById("pane-toast")?.remove();
  document.querySelectorAll(".pane-button,.pane-layout-button,.pane-history-button").forEach(button => button.remove());
  root.removeAttribute("pane-ready");
  if (window[INSTANCE_KEY]?.destroy === destroy) delete window[INSTANCE_KEY];
}

function initialize() {
  try {
    diagnosticLog("Pane runtime initializing", { documentReady: document.readyState });
    buildPicker();
    multiwindow = createMultiwindow(window, {
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
    window[INSTANCE_KEY] = { destroy, openPicker, multiwindow, version: "0.10.0-dev" };

    // Sine 2.3+ uses this callback for clean live disable/reload. Without it,
    // Sine intentionally keeps an already imported module running.
    window.addUnloadListener?.(destroy);

    const binding = pickerBinding(Services.prefs);
    diagnosticLog("Pane runtime ready", { binding: binding?.label ?? "disabled" });
    console.log(TAG, `0.10.0-dev ready${binding ? ` — press ${binding.label}` : " — shortcut disabled"}`);
  } catch (error) {
    console.error(TAG, "failed to initialize", error);
    diagnosticLog("Pane initialization failed", { error: error?.name });
    destroy();
  }
}

initialize();
