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
    control.textContent = direction === "back" ? "‹" : "›";
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
  let floating = null, menu = null, menuTab = null, frame = 0, disposed = false;
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
  function clearFloat(restore = true) {
    if (!floating) return;
    const old = floating; floating = null;
    old.abort.abort();
    old.container.removeAttribute("pane-floating");
    old.container.querySelectorAll(".pane-float-header,.pane-float-resize").forEach(n => n.remove());
    for (const prop of ["x", "y", "width", "height"]) old.container.style.removeProperty(`--pane-float-${prop}`);
    old.tab.removeAttribute("pane-floating-tab");
    if (restore && view._data.includes(old.data) && view.currentView === view._data.indexOf(old.data)) {
      view.removeSplitters(); view.applyGridLayout(old.data.layoutTree);
    }
  }
  function positionFloat() {
    if (!floating) return;
    const bounds = view.tabBrowserPanel.getBoundingClientRect();
    floating.rect = fitRectangle(floating.rect, bounds.width, bounds.height);
    for (const [prop, value] of Object.entries(floating.rect)) floating.container.style.setProperty(`--pane-float-${prop}`, `${value}px`);
  }
  function bindPointer(handle, resizing) {
    const { signal } = floating.abort;
    let drag = null;
    handle.addEventListener("pointerdown", event => {
      if (event.button !== 0 || event.target.closest("button") && !resizing) return;
      event.preventDefault(); event.stopPropagation();
      drag = { x: event.clientX, y: event.clientY, rect: { ...floating.rect } };
      handle.setAttribute("data-dragging", "true");
      handle.setPointerCapture(event.pointerId);
    }, { signal });
    handle.addEventListener("pointermove", event => {
      if (!drag || !floating) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      const bounds = view.tabBrowserPanel.getBoundingClientRect();
      floating.rect = resizing
        ? resizeRectangle(drag.rect, resizing, dx, dy, bounds.width, bounds.height)
        : { ...drag.rect, x: drag.rect.x + dx, y: drag.rect.y + dy };
      positionFloat();
    }, { signal });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) handle.addEventListener(name, () => { drag = null; handle.removeAttribute("data-dragging"); }, { signal });
    handle.addEventListener("keydown", event => {
      const moves = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
      if (!moves[event.key] || event.target !== handle || !floating) return;
      event.preventDefault(); event.stopPropagation();
      const [dx, dy] = moves[event.key];
      if (resizing) {
        const bounds = view.tabBrowserPanel.getBoundingClientRect();
        floating.rect = resizeRectangle(floating.rect, resizing, dx, dy, bounds.width, bounds.height);
      } else {
        floating.rect.x += dx; floating.rect.y += dy;
      }
      positionFloat();
    }, { signal });
  }
  function applyFloat() {
    if (!floating) return;
    const f = floating;
    if (f.tab.closing || !f.tab.isConnected || !view._data.includes(f.data) || !f.data.tabs.includes(f.tab) || f.data.tabs.length < 2) {
      clearFloat(); return;
    }
    // Let Zen hide the entire group when changing tabs or workspaces.
    if (view._data[view.currentView] !== f.data) return;
    const remaining = f.data.tabs.filter(t => t !== f.tab);
    if (!f.remaining || remaining.some((t, i) => f.remaining[i] !== t) || remaining.length !== f.remaining.length) {
      f.remaining = remaining;
      f.backgroundTree = view.calculateLayoutTree(remaining, f.data.gridType);
    }
    view.removeSplitters();
    view.applyGridLayout(f.backgroundTree);
    // Native close/replacement operations must still find the real layout leaves.
    const restoreMap = node => node.children ? node.children.forEach(restoreMap) : view._tabToSplitNode.set(node.tab, node);
    restoreMap(f.data.layoutTree);
    f.container.setAttribute("pane-floating", "true");
    if (!f.container.querySelector(".pane-float-header")) {
      const header = el("div", "pane-float-header");
      header.tabIndex = 0; header.setAttribute("aria-label", "Move floating tab with arrow keys or drag");
      const copy = el("div", "pane-float-copy");
      copy.append(el("div", "pane-float-title", f.tab.label));
      const actions = el("div", "pane-float-actions");
      const arrange = button("⋯", () => openMenu(f.tab, header)); arrange.setAttribute("aria-label", "Arrange floating tab");
      const close = button("×", () => run(() => detach(f.tab, false))); close.setAttribute("aria-label", "Return floating tab to sidebar");
      const pin = button("⌖", () => {
        const pinned = header.toggleAttribute("data-pinned");
        pin.setAttribute("aria-pressed", String(pinned));
        pin.title = pinned ? "Auto-hide header" : "Keep header visible";
      });
      pin.setAttribute("aria-label", "Keep floating header visible");
      pin.setAttribute("aria-pressed", "false"); pin.title = "Keep header visible";
      actions.append(pin, arrange, close); header.append(copy, actions);
      f.container.prepend(header);
      addHistoryControls(win, actions);
      bindPointer(header, false);
      for (const edge of ["se", "n", "s", "e", "w", "ne", "nw", "sw"]) {
        const resize = button(edge === "se" ? "◢" : "", () => {}, "pane-float-resize");
        resize.dataset.edge = edge;
        resize.setAttribute("aria-label", "Resize floating tab with arrow keys or drag");
        resize.title = "Drag to resize";
        // One visible keyboard handle; the remaining handles are pointer targets.
        if (edge !== "se") { resize.tabIndex = -1; resize.setAttribute("aria-hidden", "true"); }
        f.container.append(resize); bindPointer(resize, edge);
      }
    }
    f.container.querySelector(".pane-float-title").textContent = f.tab.label;
    appearance(f.container);
    positionFloat();
  }
  function floatTab(tab) {
    checkTab(tab);
    const data = groupFor(tab);
    if (!data || data.tabs.length < 2) throw new Error("Choose another tab to float alongside this one");
    clearFloat();
    const bounds = view.tabBrowserPanel.getBoundingClientRect();
    floating = { tab, data, container: containerFor(tab), abort: new win.AbortController(), rect: {
      width: Math.min(480, bounds.width * .6), height: Math.min(420, bounds.height * .7),
      x: Math.max(0, bounds.width - 500), y: Math.max(0, bounds.height - 440),
    } };
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
    clearFloat();
    const oldTree = data.layoutTree, oldType = data.gridType;
    try {
      data.gridType = layoutTypes[mode];
      data.layoutTree = view.calculateLayoutTree(data.tabs, data.gridType);
      view.activateSplitView(data, true);
      browser.selectedTab = tab;
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
    clearFloat();
    view.removeTabFromGroup(tab, undefined, { forUnsplit: true });
    if (select) browser.selectedTab = tab;
    else if (other && !other.closing) browser.selectedTab = other;
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
    clearFloat();
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
      incoming.linkedBrowser.focus();
    } catch (error) {
      clearFloat(false);
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
    const close = button("×", () => closeMenu(true), "pane-layout-close");
    close.setAttribute("aria-label", "Close layout menu");
    header.append(heading, close); menu.append(header);
    const group = groupFor(tab);
    const currentMode = floating?.tab === tab ? "float" : !group ? "normal" :
      Object.keys(layoutTypes).find(mode => layoutTypes[mode] === group.gridType);
    const options = [
      ["right", "▥", "Split right", "Place beside the other tabs"],
      ["below", "▤", "Split below", "Place below the other tabs"],
      ["grid", "⊞", "Grid", "Arrange with other split tabs"],
      ["float", "▣", "Floating", "Move and resize this tab"],
      ["normal", "↗", "Return to a normal tab", "Show this tab in the main view"],
    ];
    for (const [mode, symbol, label, description] of options) {
      const current = mode === currentMode;
      const b = button("", () => run(() => arrange(tab, mode)), "pane-layout-option");
      b.dataset.mode = mode;
      b.setAttribute("aria-pressed", String(current));
      const icon = el("span", "pane-layout-icon", symbol);
      icon.setAttribute("aria-hidden", "true");
      const copy = el("span", "pane-layout-copy");
      copy.append(el("span", "pane-layout-label", label), el("span", "pane-layout-description", current ? "Current layout" : description));
      b.append(icon, copy);
      if (current) b.append(el("span", "pane-layout-badge", "Current"));
      menu.append(b);
    }
    menu.append(button("+ Add another tab…", () => { closeMenu(); chooseTab(tab, "right"); }, "pane-layout-add"));
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
    get floatingTab() { return floating?.tab ?? null; },
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
