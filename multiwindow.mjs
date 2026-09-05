import { setPaneIcon, paneIcon } from "./icons.mjs?pane=0.10.0-dev-icons2";
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/

// Preserve saved tabs by using normal copies for layout operations.
export const needsTabCopy = tab => Boolean(tab?.hasAttribute("zen-essential") || tab?.hasAttribute("zen-live-folder-item-id"));
export const tabWorkspace = (win, tab) => tab?.hasAttribute("zen-essential")
  ? win.gZenWorkspaces.activeWorkspace : (tab?.getAttribute("zen-workspace-id") ?? "");
export const isSupportedTab = tab => Boolean(tab && !tab.closing && !tab.hidden && !tab.hasAttribute("zen-empty-tab"));

export function updateHistoryControls(win) {
  for (const control of win.document.querySelectorAll(".pane-history-button")) {
    const page = control.closest(".browserSidebarContainer")?.querySelector("browser");
    control.disabled = !page?.[control.dataset.direction === "back" ? "canGoBack" : "canGoForward"];
  }
}

export function addHistoryControls(win, parent) {
  if (parent.querySelector(".pane-history-button")) { updateHistoryControls(win); return; }
  const controls = ["back", "forward"].map(direction => {
    const control = win.document.createElementNS("http://www.w3.org/1999/xhtml", "button");
    control.type = "button";
    control.className = "pane-history-button";
    control.dataset.direction = direction;
    setPaneIcon(control, direction);
    control.title = direction === "back" ? "Go back in this pane" : "Go forward in this pane";
    control.setAttribute("aria-label", control.title);
    control.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation();
      const page = control.closest(".browserSidebarContainer")?.querySelector("browser");
      if (direction === "back" && page?.canGoBack) page.goBack();
      if (direction === "forward" && page?.canGoForward) page.goForward();
    });
    return control;
  });
  parent.prepend(...controls);
  updateHistoryControls(win);
}

export const layoutTypes = { right: "vsep", below: "hsep", grid: "grid" };
export const modeLabels = { replace: "Replace", right: "Split right", below: "Split below", grid: "Add to grid", float: "Floating" };

export function fitRectangle(rect, width, height) {
  const w = Math.min(Math.max(260, rect.width), width);
  const h = Math.min(Math.max(180, rect.height), height);
  return { width: w, height: h, x: Math.max(0, Math.min(rect.x, width - w)), y: Math.max(0, Math.min(rect.y, height - h)) };
}

// Keep the opposite edge fixed, including when reaching minimum size or window bounds.
export function resizeRectangle(rect, edge, dx, dy, width, height) {
  const minWidth = Math.min(260, width), minHeight = Math.min(180, height);
  let left = rect.x, top = rect.y, right = left + rect.width, bottom = top + rect.height;
  if (edge.includes("w")) left = Math.max(0, Math.min(left + dx, right - minWidth));
  if (edge.includes("e")) right = Math.min(width, Math.max(right + dx, left + minWidth));
  if (edge.includes("n")) top = Math.max(0, Math.min(top + dy, bottom - minHeight));
  if (edge.includes("s")) bottom = Math.min(height, Math.max(bottom + dy, top + minHeight));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

// Floating is a presentation of a native split, not a second browser or iframe.
// The original browser node and browsing context never leave their container.
export function createMultiwindow(win, { notify, chooseTab, appearance }) {
  const doc = win.document, browser = win.gBrowser, view = win.gZenViewSplitter;
  const floats = new Map();
  const backgrounds = new WeakMap();
  let topLayer = 20;
  let menu = null, menuTab = null, frame = 0, disposed = false;
  const groupFor = tab => view._data.find(data => data.tabs.includes(tab));
  const containerFor = tab => tab?.linkedBrowser?.closest(".browserSidebarContainer");
  const el = (tag, className, text) => {
    const node = doc.createElementNS("http://www.w3.org/1999/xhtml", tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  function button(label, callback, className = "") {
    const b = el("button", className, label);
    b.type = "button"; b.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation(); callback();
    });
    return b;
  }
  function closeMenu(restore = false) {
    menu?.remove(); menu = null;
    if (restore) menuTab?.linkedBrowser?.focus();
    menuTab = null;
  }
  function checkTab(tab) {
    if (!isSupportedTab(tab) || !tab.isConnected) {
      throw new Error("That tab is no longer available for this layout");
    }
  }
  function removeFloat(f) {
    floats.delete(f.tab);
    f.abort.abort();
    f.container.removeAttribute("pane-floating");
    f.container.querySelectorAll(".pane-float-header,.pane-float-resize").forEach(n => n.remove());
    for (const prop of ["x", "y", "width", "height", "z"]) f.container.style.removeProperty(`--pane-float-${prop}`);
    f.tab.removeAttribute("pane-floating-tab");
  }
  function clearFloat(restore = true, tab = null) {
    const removed = tab ? [floats.get(tab)].filter(Boolean) : [...floats.values()];
    for (const f of removed) removeFloat(f);
    if (restore && removed.length) {
      const data = view._data[view.currentView];
      if (data && removed.some(f => f.data === data)) {
        view.removeSplitters(); view.applyGridLayout(data.layoutTree);
      }
      applyFloat();
    }
  }
  function raiseFloat(f) {
    f.container.style.setProperty("--pane-float-z", String(++topLayer));
  }
  function positionFloat(f) {
    const bounds = view.tabBrowserPanel.getBoundingClientRect();
    f.rect = fitRectangle(f.rect, bounds.width, bounds.height);
    for (const [prop, value] of Object.entries(f.rect)) f.container.style.setProperty(`--pane-float-${prop}`, `${value}px`);
  }
  function bindPointer(handle, resizing, f) {
    const { signal } = f.abort;
    let drag = null;
    handle.addEventListener("pointerdown", event => {
      if (event.button !== 0 || event.target.closest("button") && !resizing) return;
      event.preventDefault(); event.stopPropagation();
      drag = { x: event.clientX, y: event.clientY, rect: { ...f.rect } };
      handle.setAttribute("data-dragging", "true");
      handle.setPointerCapture(event.pointerId);
    }, { signal });
    handle.addEventListener("pointermove", event => {
      if (!drag || !floats.has(f.tab)) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      const bounds = view.tabBrowserPanel.getBoundingClientRect();
      f.rect = resizing
        ? resizeRectangle(drag.rect, resizing, dx, dy, bounds.width, bounds.height)
        : { ...drag.rect, x: drag.rect.x + dx, y: drag.rect.y + dy };
      positionFloat(f);
    }, { signal });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) handle.addEventListener(name, () => { drag = null; handle.removeAttribute("data-dragging"); }, { signal });
    handle.addEventListener("keydown", event => {
      const moves = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
      if (!moves[event.key] || event.target !== handle || !floats.has(f.tab)) return;
      event.preventDefault(); event.stopPropagation();
      const [dx, dy] = moves[event.key];
      if (resizing) {
        const bounds = view.tabBrowserPanel.getBoundingClientRect();
        f.rect = resizeRectangle(f.rect, resizing, dx, dy, bounds.width, bounds.height);
      } else {
        f.rect.x += dx; f.rect.y += dy;
      }
      positionFloat(f);
    }, { signal });
  }
  function applyFloat() {
    for (const f of [...floats.values()]) {
      const data = groupFor(f.tab);
      if (f.tab.closing || !f.tab.isConnected || !data || data.tabs.length < 2) removeFloat(f);
      else f.data = data;
    }
    const data = view._data[view.currentView];
    if (!data) return;
    let active = [...floats.values()].filter(f => f.data === data);
    if (!active.length) return;
    // Always leave a native background leaf for Zen to lay out.
    if (data.tabs.every(tab => floats.has(tab))) {
      removeFloat(active[0]);
      active = active.slice(1);
    }
    const remaining = data.tabs.filter(tab => !floats.has(tab));
    let background = backgrounds.get(data);
    if (!background || background.source !== data.layoutTree || background.type !== data.gridType ||
        remaining.length !== background.tabs.length || remaining.some((tab, i) => tab !== background.tabs[i])) {
      background = { source: data.layoutTree, type: data.gridType, tabs: remaining,
        tree: view.calculateLayoutTree(remaining, data.gridType) };
      backgrounds.set(data, background);
    }
    view.removeSplitters();
    view.applyGridLayout(background.tree);
    const restoreMap = node => node.children ? node.children.forEach(restoreMap) : view._tabToSplitNode.set(node.tab, node);
    restoreMap(data.layoutTree);
    for (const f of active) renderFloat(f);
  }
  function renderFloat(f) {
    f.container.setAttribute("pane-floating", "true");
    if (!f.container.querySelector(".pane-float-header")) {
      const header = el("div", "pane-float-header");
      header.tabIndex = 0; header.setAttribute("aria-label", "Move floating tab with arrow keys or drag");
      const copy = el("div", "pane-float-copy");
      copy.append(el("div", "pane-float-title", f.tab.label));
      const actions = el("div", "pane-float-actions");
      const arrange = button("", () => openMenu(f.tab, header)); arrange.setAttribute("aria-label", "Arrange floating tab");
      const close = button("", () => run(() => detach(f.tab, false))); close.setAttribute("aria-label", "Return floating tab to sidebar");
      const pin = button("", () => {
        const pinned = f.headerPinned = !f.headerPinned;
        header.toggleAttribute("data-pinned", pinned);
        pin.setAttribute("aria-pressed", String(pinned));
        pin.title = pinned ? "Auto-hide header" : "Keep header visible";
        pin.setAttribute("aria-label", pin.title);
      });
      pin.setAttribute("aria-label", "Keep floating header visible");
      header.toggleAttribute("data-pinned", Boolean(f.headerPinned));
      pin.setAttribute("aria-pressed", String(Boolean(f.headerPinned)));
      pin.title = f.headerPinned ? "Auto-hide header" : "Keep header visible";
      pin.setAttribute("aria-label", pin.title);
      setPaneIcon(pin, "pin"); setPaneIcon(arrange, "more"); setPaneIcon(close, "close");
      actions.append(pin, arrange, close); header.append(copy, actions);
      f.container.prepend(header);
      addHistoryControls(win, actions);
      bindPointer(header, false, f);
      for (const edge of ["se", "n", "s", "e", "w", "ne", "nw", "sw"]) {
        const resize = button(edge === "se" ? "◢" : "", () => {}, "pane-float-resize");
        resize.dataset.edge = edge;
        resize.setAttribute("aria-label", "Resize floating tab with arrow keys or drag");
        resize.title = "Drag to resize";
        // One visible keyboard handle; the remaining handles are pointer targets.
        if (edge !== "se") { resize.tabIndex = -1; resize.setAttribute("aria-hidden", "true"); }
        f.container.append(resize); bindPointer(resize, edge, f);
      }
    }
    f.container.querySelector(".pane-float-title").textContent = f.tab.label;
    appearance(f.container);
    positionFloat(f);
  }
  function floatTab(tab) {
    checkTab(tab);
    const data = groupFor(tab);
    if (!data || data.tabs.length < 2) throw new Error("Choose another tab to float alongside this one");
    if (floats.has(tab)) { raiseFloat(floats.get(tab)); return; }
    if (data.tabs.filter(t => !floats.has(t)).length <= 1) {
      throw new Error("Keep one tab in the background before floating another");
    }
    const bounds = view.tabBrowserPanel.getBoundingClientRect();
    const offset = [...floats.values()].filter(f => f.data === data).length * 32;
    const f = { tab, data, container: containerFor(tab), abort: new win.AbortController(), headerPinned: false, rect: {
      width: Math.min(480, bounds.width * .6), height: Math.min(420, bounds.height * .7),
      x: Math.max(0, bounds.width - 500 - offset), y: Math.max(0, bounds.height - 440 - offset),
    } };
    floats.set(tab, f);
    f.container.addEventListener("pointerdown", () => raiseFloat(f), { capture: true, signal: f.abort.signal });
    f.container.addEventListener("focusin", () => raiseFloat(f), { signal: f.abort.signal });
    raiseFloat(f);
    tab.setAttribute("pane-floating-tab", "true");
    applyFloat();
  }
  function arrange(tab, mode) {
    checkTab(tab);
    if (mode === "float") return floatTab(tab);
    if (mode === "normal") return detach(tab, true);
    const data = groupFor(tab);
    if (!data) { chooseTab(tab, mode); return; }
    if (mode === "grid" && data.tabs.length < 3) { chooseTab(tab, "grid"); return; }
    if (!layoutTypes[mode]) throw new Error("Unknown layout");
    clearFloat(false, tab);
    const oldTree = data.layoutTree, oldType = data.gridType;
    try {
      data.gridType = layoutTypes[mode];
      data.layoutTree = view.calculateLayoutTree(data.tabs, data.gridType);
      view.activateSplitView(data, true);
      browser.selectedTab = tab;
      applyFloat();
    } catch (error) {
      data.layoutTree = oldTree; data.gridType = oldType;
      view.activateSplitView(data, true);
      throw error;
    }
  }
  function detach(tab, select) {
    checkTab(tab);
    const data = groupFor(tab);
    if (!data) return;
    const other = data.tabs.find(t => t !== tab);
    clearFloat(false, tab);
    view.removeTabFromGroup(tab, undefined, { forUnsplit: true });
    if (select) browser.selectedTab = tab;
    else if (other && !other.closing) browser.selectedTab = other;
    applyFloat();
    browser.selectedBrowser?.focus();
  }
  function copyTree(node) {
    const copy = Object.assign(Object.create(Object.getPrototypeOf(node)), node);
    copy.parent = null;
    if (node.children) copy.children = node.children.map(copyTree);
    return copy;
  }
  function add(target, incoming, mode) {
    checkTab(target); checkTab(incoming);
    if (target === incoming || incoming.splitView || tabWorkspace(win, target) !== tabWorkspace(win, incoming)) throw new Error("Choose an available tab in the same workspace");
    const current = groupFor(target);
    if ((current?.tabs.length ?? 1) >= view.MAX_TABS) throw new Error("This split has reached Zen’s tab limit");
    if (!layoutTypes[mode] && mode !== "float") throw new Error("Unknown layout");
    const snapshot = current ? { tree: copyTree(current.layoutTree), type: current.gridType } : null;
    const originalTarget = target, copies = [];
    const originalTabs = [...new Set([...(current?.tabs ?? []), target, incoming])];
    const originalState = originalTabs.map(tab => ({ tab, pinned: tab.pinned, group: tab.group }));
    const prepare = tab => {
      if (!needsTabCopy(tab) || tab.splitView) return tab;
      const copy = browser.duplicateTab(tab, true);
      copies.push(copy);
      return copy;
    };
    try {
      target = prepare(target); incoming = prepare(incoming);
      // Zen duplicates mixed pinned/unpinned inputs. Keep one pinned split instead.
      if (target.pinned || incoming.pinned) {
        for (const tab of [...(current?.tabs ?? []), target, incoming]) {
          if (!tab.pinned) browser.pinTab(tab);
        }
      }
      const data = view.splitTabs([target, incoming], layoutTypes[mode] || "vsep");
      if (!data?.tabs.includes(incoming)) throw new Error("Zen could not create this layout");
      // Zen adds to an existing tree without applying the requested direction.
      if (mode !== "float") {
        data.gridType = layoutTypes[mode];
        data.layoutTree = view.calculateLayoutTree(data.tabs, data.gridType);
        view.activateSplitView(data, true);
      }
      browser.selectedTab = incoming;
      if (mode === "float") floatTab(incoming);
      else applyFloat();
      incoming.linkedBrowser.focus();
    } catch (error) {
      clearFloat(false, incoming);
      try {
        if (groupFor(incoming)) view.removeTabFromGroup(incoming, undefined, { forUnsplit: true });
        if (snapshot && view._data.includes(current)) {
          current.layoutTree = snapshot.tree; current.gridType = snapshot.type;
          view.activateSplitView(current, true);
        }
        for (const { tab, pinned, group } of originalState) {
          if (tab.pinned !== pinned) pinned ? browser.pinTab(tab) : browser.unpinTab(tab);
          if (group?.isConnected && tab.group !== group) browser.moveTabToExistingGroup(tab, group);
        }
        browser.selectedTab = originalTarget;
      } catch (rollbackError) { console.error("[Pane] Layout rollback failed", rollbackError); }
      for (const copy of copies) if (copy?.isConnected && !copy.closing) browser.removeTab(copy, { animate: false });
      applyFloat();
      throw error;
    }
  }
  function run(action) {
    closeMenu();
    try { action(); } catch (error) { notify(error.message || "The layout could not be changed", "warning"); }
  }
  function openMenu(tab, anchor) {
    closeMenu(); menuTab = tab;
    menu = el("div", "pane-layout-menu"); menu.id = "pane-layout-menu";
    menu.setAttribute("role", "dialog"); menu.setAttribute("aria-label", "Arrange this tab");
    const header = el("div", "pane-layout-header");
    const heading = el("div", "pane-layout-title");
    heading.append(el("div", "pane-layout-heading", "Arrange this tab"), el("div", "pane-layout-context", tab.label));
    const close = button("", () => closeMenu(true), "pane-layout-close");
    close.setAttribute("aria-label", "Close layout menu");
    header.append(heading, close); menu.append(header);
    const group = groupFor(tab);
    const currentMode = floats.has(tab) ? "float" : !group ? "normal" :
      Object.keys(layoutTypes).find(mode => layoutTypes[mode] === group.gridType);
    const options = [
      ["right", "Split right", "Place beside the other tabs"],
      ["below", "Split below", "Place below the other tabs"],
      ["grid", "Grid", "Arrange with other split tabs"],
      ["float", "Floating", "Move and resize this tab"],
      ["normal", "Return to a normal tab", "Show this tab in the main view"],
    ];
    for (const [mode, label, description] of options) {
      const current = mode === currentMode;
      const b = button("", () => run(() => arrange(tab, mode)), "pane-layout-option");
      b.dataset.mode = mode;
      b.setAttribute("aria-pressed", String(current));
      const icon = el("span", "pane-layout-icon");
      icon.append(paneIcon(doc, mode === "normal" ? "normal" : mode));
      icon.setAttribute("aria-hidden", "true");
      const copy = el("span", "pane-layout-copy");
      copy.append(el("span", "pane-layout-label", label), el("span", "pane-layout-description", current ? "Current layout" : description));
      b.append(icon, copy);
      if (current) b.append(el("span", "pane-layout-badge", "Current"));
      menu.append(b);
    }
    const add = button("", () => { closeMenu(); chooseTab(tab, "right"); }, "pane-layout-add");
    add.append(paneIcon(doc, "plus"), doc.createTextNode("Add another tab…"));
    menu.append(add);
    const footer = el("div", "pane-layout-footer");
    for (const [key, label] of [["↑ ↓", "Navigate"], ["Enter", "Apply"], ["Esc", "Cancel"]]) {
      const hint = el("span", "pane-layout-hint");
      hint.append(el("kbd", "", key), el("span", "", label)); footer.append(hint);
    }
    menu.append(footer);
    menu.addEventListener("keydown", event => {
      const buttons = [...menu.querySelectorAll("button")];
      if (event.key === "Escape") { event.preventDefault(); closeMenu(true); }
      else if (["ArrowDown", "ArrowUp", "Tab"].includes(event.key)) {
        event.preventDefault();
        const step = event.key === "ArrowUp" || event.shiftKey ? -1 : 1;
        buttons[(buttons.indexOf(doc.activeElement) + step + buttons.length) % buttons.length].focus();
      }
    });
    appearance(menu); doc.documentElement.append(menu);
    const rect = anchor?.getBoundingClientRect() || containerFor(tab).getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(rect.right - menu.offsetWidth, win.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(rect.top + 32, win.innerHeight - menu.offsetHeight - 8))}px`;
    (menu.querySelector('[data-mode][aria-pressed="true"]') || menu.querySelector("[data-mode]")).focus();
  }
  function sync() {
    if (frame || disposed) return;
    frame = win.requestAnimationFrame(() => { frame = 0; applyFloat(); });
  }
  function outside(event) { if (menu && !menu.contains(event.target)) closeMenu(); }
  function tabChanged() { closeMenu(); sync(); }
  win.addEventListener("ZenViewSplitter:SplitViewActivated", sync);
  win.addEventListener("resize", sync);
  doc.addEventListener("mousedown", outside, true);
  for (const name of ["TabSelect", "TabClose", "TabAttrModified", "ZenTabRemovedFromSplit"]) browser.tabContainer.addEventListener(name, tabChanged);
  return {
    add, arrange, openMenu, closeMenu, clearFloat, sync,
    get floatingTabs() { return [...floats.keys()]; },
    destroy() {
      disposed = true; if (frame) win.cancelAnimationFrame(frame);
      closeMenu(); clearFloat();
      win.removeEventListener("ZenViewSplitter:SplitViewActivated", sync);
      win.removeEventListener("resize", sync);
      doc.removeEventListener("mousedown", outside, true);
      for (const name of ["TabSelect", "TabClose", "TabAttrModified", "ZenTabRemovedFromSplit"]) browser.tabContainer.removeEventListener(name, tabChanged);
    },
  };
}
