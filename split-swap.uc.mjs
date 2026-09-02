// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Pane for Zen Browser — replace a pane, preserve its layout leaf.
const TAG = "[Pane]";
const root = document.documentElement;
const INSTANCE_KEY = "__splitSwapInstance";

// Sine can reload a user script without restarting the browser. Tear down a
// previous v0.3+ instance and remove any orphaned UI from older releases.
window[INSTANCE_KEY]?.destroy?.();
document.getElementById("split-swap-overlay")?.remove();
document.getElementById("split-swap-toast")?.remove();
document.querySelectorAll(".split-swap-pane-button").forEach(button => button.remove());
const PREF = {
  shortcut: "mod.split-swap.shortcut",
  urls: "mod.split-swap.show-urls",
  recent: "mod.split-swap.recent-first",
  button: "mod.split-swap.pane-button",
  keep: "mod.split-swap.keep-old-tab",
  compact: "mod.split-swap.compact-picker",
  preset: "mod.split-swap.style-preset",
  tintLight: "mod.split-swap.tint-light",
  tintDark: "mod.split-swap.tint-dark",
  accent: "mod.split-swap.accent-color",
  blur: "mod.split-swap.glass-blur",
  radius: "mod.split-swap.corner-radius",
  width: "mod.split-swap.picker-width",
  position: "mod.split-swap.picker-position",
  recentCount: "mod.split-swap.recent-count",
  columns: "mod.split-swap.grid-columns",
  dim: "mod.split-swap.dim-background",
  help: "mod.split-swap.show-help",
};
const SHORTCUTS = [
  { key: "r", label: "Ctrl+Alt+R" },
  { key: "s", label: "Ctrl+Alt+S" },
];

let overlay, dialog, heading, context, search, results, count, sectionLabel, expandButton;
let targetTab = null;
let candidates = [];
let filtered = [];
let selectedIndex = 0;
let expanded = false;
let paneAnchorTab = null;
let toastTimer;

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
  typeof view.activateSplitView === "function";
const workspaceId = tab => tab?.getAttribute("zen-workspace-id") ?? "";
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
    tab !== target && !data.tabs.includes(tab) && !tab.closing && !tab.hidden &&
    !tab.pinned && !tab.hasAttribute("zen-empty-tab") && !tab.hasAttribute("zen-essential") &&
    !tab.splitView && workspaceId(tab) === workspace
  );
  if (boolPref(PREF.recent, true)) tabs.sort((a, b) => lastUsed(b) - lastUsed(a));
  return tabs;
}

function showToast(message, kind = "info") {
  let toast = document.getElementById("split-swap-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "split-swap-toast";
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
  const items = [...results.querySelectorAll(".split-swap-item")];
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
  const query = search.value.trim().toLocaleLowerCase();
  const matches = candidates.filter(tab =>
    `${tabTitle(tab)} ${displayUrl(tab)}`.toLocaleLowerCase().includes(query)
  );
  const showAll = Boolean(query) || expanded;
  const previewCount = choice(intPref(PREF.recentCount, 4), [2, 4, 6, 8], 4);
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
  expandButton.textContent = expanded ? "Show less  ↑" : `Show all ${candidates.length} tabs  ↓`;
  expandButton.setAttribute("aria-expanded", String(expanded));
  if (!matches.length) {
    const empty = document.createElement("div");
    empty.id = "split-swap-empty";
    const strong = document.createElement("strong");
    strong.textContent = query ? "No matching tabs" : "Nothing to swap in yet";
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
    item.className = "split-swap-item";
    item.type = "button";
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(index === 0));
    item.setAttribute("aria-label", `Replace with ${tabTitle(tab)}`);
    item.tabIndex = index === 0 ? 0 : -1;

    const iconBox = document.createElement("span");
    iconBox.className = "split-swap-icon-wrap";
    const icon = document.createElement("img");
    icon.className = "split-swap-icon";
    icon.alt = "";
    icon.src = tab.getAttribute("image") || "chrome://global/skin/icons/defaultFavicon.svg";
    iconBox.appendChild(icon);

    const copy = document.createElement("span");
    copy.className = "split-swap-copy";
    const title = document.createElement("span");
    title.className = "split-swap-title";
    title.appendChild(highlighted(tabTitle(tab), query));
    copy.appendChild(title);
    if (showUrls) {
      const url = document.createElement("span");
      url.className = "split-swap-url";
      url.appendChild(highlighted(displayUrl(tab), query));
      copy.appendChild(url);
    }
    const action = document.createElement("span");
    action.className = "split-swap-action";
    action.textContent = "Replace";
    item.append(iconBox, copy, action);
    item.addEventListener("mouseenter", () => selectResult(index));
    item.addEventListener("click", () => replacePane(tab));
    results.appendChild(item);
  });
  selectedIndex = 0;
}

function buildPicker() {
  overlay = document.createElement("div");
  overlay.id = "split-swap-overlay";
  overlay.hidden = true;
  dialog = document.createElement("div");
  dialog.id = "split-swap-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "split-swap-heading");

  const header = document.createElement("header");
  header.id = "split-swap-header";
  const group = document.createElement("div");
  group.id = "split-swap-heading-group";
  const eyebrow = document.createElement("div");
  eyebrow.id = "split-swap-eyebrow";
  eyebrow.textContent = "PANE";
  heading = document.createElement("div");
  heading.id = "split-swap-heading";
  context = document.createElement("div");
  context.id = "split-swap-context";
  group.append(eyebrow, heading, context);
  const close = document.createElement("button");
  close.id = "split-swap-close";
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", "Close Pane");
  close.addEventListener("click", () => closePicker());
  header.append(group, close);

  const searchWrap = document.createElement("div");
  searchWrap.id = "split-swap-search-wrap";
  const searchIcon = document.createElement("span");
  searchIcon.id = "split-swap-search-icon";
  searchIcon.textContent = "⌕";
  search = document.createElement("input");
  search.id = "split-swap-search";
  search.type = "search";
  search.placeholder = "Find an open tab…";
  search.autocomplete = "off";
  search.spellcheck = false;
  count = document.createElement("span");
  count.id = "split-swap-count";
  searchWrap.append(searchIcon, search, count);
  const sectionHeader = document.createElement("div");
  sectionHeader.id = "split-swap-section-header";
  sectionLabel = document.createElement("span");
  sectionLabel.id = "split-swap-section-label";
  sectionHeader.appendChild(sectionLabel);
  results = document.createElement("div");
  results.id = "split-swap-results";
  results.setAttribute("role", "listbox");
  results.setAttribute("aria-label", "Tabs available to replace this pane");
  expandButton = document.createElement("button");
  expandButton.id = "split-swap-expand";
  expandButton.type = "button";
  expandButton.addEventListener("click", () => {
    expanded = !expanded;
    renderResults();
    search.focus();
  });
  const help = document.createElement("footer");
  help.id = "split-swap-help";
  help.innerHTML = "<span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>Enter</kbd> Replace</span><span><kbd>Esc</kbd> Cancel</span>";
  dialog.append(header, searchWrap, sectionHeader, results, expandButton, help);
  overlay.appendChild(dialog);
  root.appendChild(overlay);

  overlay.addEventListener("mousedown", onBackdropMouseDown);
  dialog.addEventListener("keydown", trapDialogFocus);
  search.addEventListener("input", renderResults);
  search.addEventListener("keydown", event => {
    if (event.key === "ArrowDown") { event.preventDefault(); selectResult(selectedIndex + 1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); selectResult(selectedIndex - 1); }
    else if (event.key === "Enter" && filtered[selectedIndex]) {
      event.preventDefault(); replacePane(filtered[selectedIndex]);
    }
  });
}

function applyAppearance() {
  if (!dialog || !overlay) return;
  const preset = choice(intPref(PREF.preset, 0), [0, 1, 2, 3, 4], 0);
  const presets = [
    { light: "rgba(247, 248, 251, 0.78)", dark: "rgba(24, 25, 30, 0.78)", blur: 38, radius: 24 },
    { light: "rgba(255, 255, 255, 0.46)", dark: "rgba(18, 20, 26, 0.52)", blur: 18, radius: 18 },
    { light: "rgba(247, 248, 251, 0.9)", dark: "rgba(24, 25, 30, 0.9)", blur: 52, radius: 24 },
    { light: "rgba(224, 232, 255, 0.8)", dark: "rgba(40, 34, 62, 0.84)", blur: 38, radius: 30 },
  ];
  const custom = {
    light: safeColor(stringPref(PREF.tintLight, "rgba(247, 248, 251, 0.78)"), "rgba(247, 248, 251, 0.78)"),
    dark: safeColor(stringPref(PREF.tintDark, "rgba(24, 25, 30, 0.78)"), "rgba(24, 25, 30, 0.78)"),
    blur: choice(intPref(PREF.blur, 38), [0, 18, 28, 38, 52], 38),
    radius: choice(intPref(PREF.radius, 24), [14, 18, 24, 30, 36], 24),
  };
  const appearance = preset === 4 ? custom : presets[preset];
  const accent = safeAccent(stringPref(PREF.accent, "AccentColor"), "AccentColor");
  const width = choice(intPref(PREF.width, 520), [420, 520, 640, 760], 520);
  const requestedColumns = choice(intPref(PREF.columns, 0), [0, 1, 2, 3], 0);
  const autoColumns = width <= 420 ? 1 : width >= 640 ? 3 : 2;
  const columns = requestedColumns === 0
    ? autoColumns
    : width <= 420 && requestedColumns > 2 ? 2 : requestedColumns;
  const position = choice(intPref(PREF.position, 0), [0, 1, 2], 0);
  dialog.style.setProperty("--ss-user-tint-light", appearance.light);
  dialog.style.setProperty("--ss-user-tint-dark", appearance.dark);
  dialog.style.setProperty("--ss-accent", accent);
  dialog.style.setProperty("--ss-blur", `${appearance.blur}px`);
  dialog.style.setProperty("--ss-radius", `${appearance.radius}px`);
  dialog.style.setProperty("--ss-width", `${width}px`);
  dialog.style.setProperty("--ss-columns", String(columns));
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
  const preferred = choice(intPref(PREF.width, 520), [420, 520, 640, 760], 520);
  const actualWidth = Math.max(300, Math.min(preferred, rect.width - 24, window.innerWidth - 24));
  const left = Math.max(12, Math.min(rect.left + (rect.width - actualWidth) / 2, window.innerWidth - actualWidth - 12));
  const top = Math.max(42, rect.top + 18);
  dialog.setAttribute("pane-anchored", "true");
  dialog.style.left = `${left}px`;
  dialog.style.top = `${top}px`;
  dialog.style.maxWidth = `${actualWidth}px`;
}

function openPicker(tab = gBrowser.selectedTab, anchorToPane = false) {
  if (!compatible(splitter())) {
    showToast("This Zen version is not compatible with Pane yet", "error");
    return;
  }
  const data = activeData();
  if (!data || !tab || !data.tabs.includes(tab)) {
    showToast("Choose a pane in an active split first", "warning");
    return;
  }
  targetTab = tab;
  paneAnchorTab = anchorToPane ? tab : null;
  candidates = eligibleTabs(tab, data);
  heading.textContent = "Replace this pane";
  context.textContent = `Currently showing ${tabTitle(tab)}`;
  dialog.toggleAttribute("compact", boolPref(PREF.compact, false));
  applyAppearance();
  expanded = false;
  search.value = "";
  renderResults();
  overlay.hidden = false;
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
    showToast("The split changed before the swap finished", "warning"); return;
  }
  if (!incoming || incoming.closing || incoming.splitView) {
    showToast("That tab is no longer available", "warning"); return;
  }
  if (workspaceId(incoming) !== workspaceId(outgoing)) {
    showToast("Choose a tab from the same workspace", "warning"); return;
  }
  const leaf = view.getSplitNodeFromTab(outgoing);
  const index = data.tabs.indexOf(outgoing);
  const splitGroup = outgoing.group;
  if (!leaf || index < 0 || !splitGroup?.hasAttribute("split-view-group")) {
    showToast("Zen’s split layout is not ready yet", "warning"); return;
  }
  let changed = false;
  try {
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
    showToast(`Now showing ${tabTitle(incoming)}`, "success");
  } catch (error) {
    console.error(TAG, "replacement failed", error);
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
    showToast("The pane was not changed", "error");
  }
}

function ensurePaneButtons() {
  document.querySelectorAll(".browserSidebarContainer[is-zen-split]").forEach(container => {
    const header = container.querySelector(".zen-view-splitter-header");
    if (!header) return;
    const current = header.querySelector(".split-swap-pane-button");
    if (!boolPref(PREF.button, true)) { current?.remove(); return; }
    if (current) return;
    const button = document.createXULElement("toolbarbutton");
    button.className = "split-swap-pane-button";
    button.setAttribute("tooltiptext", "Replace this pane with another open tab");
    button.setAttribute("aria-label", "Replace this split pane");
    button.setAttribute("label", "⇄");
    button.textContent = "⇄";
    button.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation();
      const browser = container.querySelector("browser");
      const tab = browser ? gBrowser.getTabForBrowser(browser) : null;
      if (tab) { gBrowser.selectedTab = tab; openPicker(tab, true); }
    });
    header.prepend(button);
  });
}

function onShortcut(event) {
  const binding = SHORTCUTS[intPref(PREF.shortcut, 0)] ?? null;
  if (binding && event.ctrlKey && event.altKey && !event.shiftKey && !event.metaKey &&
      event.key.toLocaleLowerCase() === binding.key) {
    event.preventDefault(); event.stopPropagation();
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
    ...results.querySelectorAll(".split-swap-item"),
    expandButton.hidden ? null : expandButton,
    document.getElementById("split-swap-close"),
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
  requestAnimationFrame(ensurePaneButtons);
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

function destroy() {
  clearTimeout(toastTimer);
  window.removeEventListener("keydown", onShortcut, true);
  window.removeEventListener("ZenViewSplitter:SplitViewActivated", onSplitActivated);
  window.removeEventListener("resize", onWindowResize);
  try { Services.prefs.removeObserver("mod.split-swap.", prefObserver); } catch (e) {}
  overlay?.remove();
  document.getElementById("split-swap-toast")?.remove();
  document.querySelectorAll(".split-swap-pane-button").forEach(button => button.remove());
  if (window[INSTANCE_KEY]?.destroy === destroy) delete window[INSTANCE_KEY];
}

buildPicker();
window.addEventListener("keydown", onShortcut, true);
window.addEventListener("ZenViewSplitter:SplitViewActivated", onSplitActivated);
window.addEventListener("resize", onWindowResize);
Services.prefs.addObserver("mod.split-swap.", prefObserver);
ensurePaneButtons();
applyAppearance();
window[INSTANCE_KEY] = { destroy, version: "0.6.0" };
const binding = SHORTCUTS[intPref(PREF.shortcut, 0)] ?? null;
console.log(TAG, `ready${binding ? ` — press ${binding.label}` : " — shortcut disabled"}`);
