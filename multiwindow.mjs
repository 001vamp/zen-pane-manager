import { createSplitPersistence } from "./split-persistence.mjs";
import { createTabOrigins } from "./tab-origins.mjs";
import { setPaneIcon, paneIcon } from "./icons.mjs?pane=0.11.0-icons2";
import { accordionBindings, matchesBinding, shortcutLabel, scrollingModifiers } from "./keybindings.mjs?pane=0.11.0-macos-shortcut";
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/

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
// Pure presentation geometry; native split ratios and browser state stay at the edges.
export function accordionSizes(width, count, requestedWidth) {
  const available = Math.max(0, Number.isFinite(width) ? width : 0);
  const neighbors = Math.max(0, count - 1);
  if (!neighbors) return { expanded: available, strip: 0 };
  const defaultStrip = Math.min(44, available / (count + 2));
  const minimumStrip = Math.min(32, available / (count + 2));
  const minimumExpanded = Math.min(320, available - neighbors * defaultStrip);
  const maximumExpanded = available - neighbors * minimumStrip;
  const desired = Number.isFinite(requestedWidth) ? requestedWidth : available - neighbors * defaultStrip;
  const expanded = Math.min(maximumExpanded, Math.max(minimumExpanded, desired));
  return { expanded, strip: (available - expanded) / neighbors };
}

export const presentationModes = ["accordion", "scrolling"];
export const modeLabels = { replace: "Replace", right: "Split right", below: "Split below", grid: "Add to grid", float: "Floating", accordion: "Horizontal accordion", scrolling: "Scrolling (experimental)" };

// Legacy callers and saved choices converge before validation or side effects.
export const normalizeMode = mode => mode === "snapshot" ? "scrolling" : mode;

export const scrollingColumnWidth = (viewport, value) => Math.min(viewport, Math.max(Math.min(320, viewport), value));

export function scrollingSizes(viewport, percent, savedWidths) {
  const width = Math.min(viewport, Math.max(320, viewport * Math.max(30, Math.min(100, percent)) / 100));
  const widths = savedWidths.map(value => scrollingColumnWidth(viewport, value ?? width));
  let total = 0;
  const positions = widths.map(value => { const left = total; total += value + 10; return left; });
  return {viewport, width, widths, positions, max:Math.max(0, total - 10 - viewport)};
}

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
export function createMultiwindow(win, { notify, chooseTab, appearance, prefs = win.Services?.prefs, origins = createTabOrigins(win) }) {
  const doc = win.document, browser = win.gBrowser, view = win.gZenViewSplitter;
  const floats = new Map();
  const accordions = new Map();
  const scrollings = new Map();
  const accordionKey = 'pane-accordion-v1';
  const scrollingKey = 'pane-scrolling-v1';
  const floatingKey = 'pane-floating-v1';
  const session = win.SessionStore;
  const persistence = createSplitPersistence(win, origins);
  function saveFloat(f) {
    if (!session || f.tab.closing) return;
    const value=JSON.stringify({version:1,rect:f.rect,headerPinned:Boolean(f.headerPinned)});
    if (session.getCustomTabValue(f.tab,floatingKey)!==value) session.setCustomTabValue(f.tab,floatingKey,value);
  }
  function recoverFloats() {
    if (!session || view._sessionRestoring) return;
    for (const data of view._data) {
      if (data.tabs.length<2 || accordions.has(data) || scrollings.has(data)) continue;
      for (const tab of data.tabs) {
        if (floats.has(tab) || tab.closing || !tab.isConnected) continue;
        let record;
        try {record=JSON.parse(session.getCustomTabValue(tab,floatingKey)||'null');} catch {session.deleteCustomTabValue(tab,floatingKey);record=null;}
        if (!record) continue;
        const valid=record.version===1 && record.rect && ['x','y','width','height'].every(key=>Number.isFinite(record.rect[key])) && record.rect.width>0 && record.rect.height>0;
        if (!valid || data.tabs.filter(member=>!floats.has(member)).length<=1) {
          session.deleteCustomTabValue(tab,floatingKey);continue;
        }
        const container=containerFor(tab);
        if (!container) continue;
        const f={tab,data,container,rect:{...record.rect},headerPinned:record.headerPinned===true,abort:new win.AbortController()};
        floats.set(tab,f);
        bindFloatFocus(f);
        tab.setAttribute('pane-floating-tab','true');
      }
    }
  }
  function saveAccordion(data, state) {
    if (!session) return;
    state.sessionId ??= win.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    for (const tab of state.savedTabs ?? []) {
      if (!data.tabs.includes(tab) && tab.isConnected && !tab.closing) session.deleteCustomTabValue(tab, accordionKey);
    }
    state.savedTabs = [...data.tabs];
    for (const tab of data.tabs) if (!tab.closing) {
      const value = JSON.stringify({ group:state.sessionId, active:tab === state.active });
      if (session.getCustomTabValue(tab, accordionKey) !== value) session.setCustomTabValue(tab, accordionKey, value);
    }
  }
  function recoverAccordions() {
    if (!session || view._sessionRestoring) return;
    for (const data of view._data) {
      if (accordions.has(data) || scrollings.has(data) || data.tabs.length < 2 || data.tabs.some(tab => floats.has(tab))) continue;
      const saved = data.tabs.map(tab => {
        try { return JSON.parse(session.getCustomTabValue(tab, accordionKey) || 'null'); } catch { return null; }
      });
      if (!saved.every(record => typeof record?.group === 'string' && record.group === saved[0]?.group)) continue;
      const active = data.tabs[saved.findIndex(record => record.active)] ?? data.tabs[0];
      accordions.set(data, { active, sessionId:saved[0].group, savedTabs:[...data.tabs], handles:new Map(), pages:new Map() });
    }
  }
  function saveScrolling(data,state) {
    if (!session) return;
    state.sessionId ??= win.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    for (const tab of state.savedTabs ?? []) if (!data.tabs.includes(tab) && tab.isConnected && !tab.closing) session.deleteCustomTabValue(tab,scrollingKey);
    state.savedTabs = [...data.tabs];
    if (data.tabs.includes(browser.selectedTab)) state.active = browser.selectedTab;
    for (const tab of data.tabs) if (!tab.closing) {
      const value = JSON.stringify({group:state.sessionId,active:tab===state.active,mode:"scrolling",width:state.widths.get(tab) ?? null});
      if (session.getCustomTabValue(tab,scrollingKey)!==value) session.setCustomTabValue(tab,scrollingKey,value);
    }
  }
  function recoverScrollings() {
    if (!session || view._sessionRestoring) return;
    for (const data of view._data) {
      if (scrollings.has(data) || accordions.has(data) || data.tabs.length<2 || data.tabs.some(tab=>floats.has(tab))) continue;
      const saved=data.tabs.map(tab=>{try{return JSON.parse(session.getCustomTabValue(tab,scrollingKey)||'null');}catch{return null;}});
      if (!saved.every(record=>typeof record?.group==='string' && record.group===saved[0].group)) continue;
      const widths=new Map();
      saved.forEach((record,i)=>{if (Number.isFinite(record.width) && record.width>0) widths.set(data.tabs[i],record.width);});
      scrollings.set(data,{offset:0,follow:true,overview:false,widths,containers:new Set(),abort:new win.AbortController(),sessionId:saved[0].group,savedTabs:[...data.tabs]});
    }
  }
  const backgrounds = new WeakMap();
  let topLayer = 20;
  let menu = null, menuTab = null, frame = 0, disposed = false, retryDeferredFrame = false, windowClosing = false;
  let edgeHint = null;
  let hintTimer = null, hintTab = null;
  const reducedMotion = win.matchMedia?.('(prefers-reduced-motion: reduce)');
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
      event.preventDefault(); event.stopPropagation(); callback(event);
    });
    return b;
  }
  function closeMenu(restore = false) {
    menu?.remove(); menu = null;
    if (restore) menuTab?.linkedBrowser?.focus();
    menuTab = null;
  }
  function hideEdgeHint() {
    if (hintTimer !== null) win.clearTimeout(hintTimer);
    hintTimer = null; hintTab = null;
    edgeHint?.remove(); edgeHint = null;
  }
  function scheduleEdgeHint(tab, event) {
    hideEdgeHint(); hintTab = tab;
    const point = { clientX: event.clientX, clientY: event.clientY };
    hintTimer = win.setTimeout(() => { hintTimer = null; showEdgeHint(tab, point); }, 200);
  }
  function showEdgeHint(tab, event) {
    const data = groupFor(tab);
    if (disposed || hintTab !== tab || !accordions.has(data) || accordions.get(data).active === tab || view._data[view.currentView] !== data) return;
    if (!edgeHint || edgeHint.dataset.tab !== String(data.tabs.indexOf(tab))) {
      edgeHint?.remove();
      edgeHint = el("div", "pane-accordion-edge-hint");
      edgeHint.dataset.tab = String(data.tabs.indexOf(tab));
      edgeHint.setAttribute("role", "tooltip");
      edgeHint.setAttribute("aria-hidden", "true");
      const icon = el("span", "pane-accordion-hint-icon");
      const fallback = () => icon.replaceChildren(paneIcon(doc, "right"));
      const favicon = tab.getAttribute("image") || tab.image;
      if (favicon) {
        const image = el("img", ""); image.setAttribute("src", favicon); image.setAttribute("alt", "");
        image.addEventListener("error", fallback, { once: true }); icon.append(image);
      } else fallback();
      edgeHint.append(icon, el("span", "pane-accordion-hint-title", tab.label));
      appearance(edgeHint);
      (doc.documentElement ?? doc).append(edgeHint);
    }
    const size = edgeHint.getBoundingClientRect?.() ?? { width: 280, height: 36 };
    const width = win.innerWidth ?? view.tabBrowserPanel.getBoundingClientRect().width;
    const height = win.innerHeight ?? view.tabBrowserPanel.getBoundingClientRect().height;
    edgeHint.style.setProperty("left", `${Math.max(8, Math.min(event.clientX + 14, width - size.width - 8))}px`);
    edgeHint.style.setProperty("top", `${Math.max(8, Math.min(event.clientY + 14, height - size.height - 8))}px`);
  }
  function checkTab(tab) {
    if (!isSupportedTab(tab) || !tab.isConnected) {
      throw new Error("That tab is no longer available for this layout");
    }
  }
  function clearAccordion(data, restore = true, preserveSession = false) {
    clearScrolling(data, restore, preserveSession);
    const state = accordions.get(data);
    if (!state) return;
    hideEdgeHint();
    finishAccordionResize(state);
    state.animation?.cancel();
    for (const [container, handle] of state.handles) {
      handle.remove();
      container.querySelector(".pane-accordion-bar")?.remove();
      container.querySelectorAll(".pane-accordion-resize").forEach(node => node.remove());
      container.removeAttribute("pane-accordion");
      container.removeAttribute("pane-accordion-active");
      for (const name of ["left", "right", "z", "strip", "line-left", "line-right"]) container.style.removeProperty(`--pane-accordion-${name}`);
      container.removeAttribute("pane-accordion-edge");
      const page = state.pages.get(container);
      if (page) page.node.toggleAttribute("inert", page.inert);
    }
    if (!preserveSession && session) for (const tab of state.savedTabs ?? data.tabs) {
      if (tab.isConnected && !tab.closing) session.deleteCustomTabValue(tab, accordionKey);
    }
    accordions.delete(data);
    if (restore && view._data[view.currentView] === data) {
      view.removeSplitters(); view.applyGridLayout(data.layoutTree);
    }
  }
  function accordionStep(data, step, focusHandle = false) {
    const state = accordions.get(data);
    if (!state) return;
    const index = data.tabs.indexOf(state.active);
    const nextIndex = Math.abs(step) >= data.tabs.length ? (step < 0 ? 0 : data.tabs.length - 1)
      : (index + step + data.tabs.length) % data.tabs.length;
    const next = data.tabs[nextIndex];
    if (!next || next === state.active) return;
    hideEdgeHint();
    state.direction = Math.sign(step);
    browser.selectedTab = next;
    state.active = next;
    applyAccordion();
    if (focusHandle) state.handles.get(containerFor(next))?.focus();
    else next.linkedBrowser.focus();
  }
  function finishAccordionResize(state) {
    if (state.resizeFrame) win.cancelAnimationFrame(state.resizeFrame);
    state.resizeFrame = 0;
    const drag = state.resizeDrag;
    state.resizeDrag = null;
    drag?.target.removeAttribute("data-dragging");
    if (drag?.target.hasPointerCapture?.(drag.pointerId)) drag.target.releasePointerCapture(drag.pointerId);
  }
  function consumeAccordionResizePress(event) {
    event.preventDefault();
    event.stopPropagation();
  }
  function resizeAccordionByShortcut(data, state, direction) {
    const width = view.tabBrowserPanel.getBoundingClientRect().width;
    if (!(width > 0)) return false;
    const current = accordionSizes(width, data.tabs.length, state.expandedRatio * width).expanded;
    state.expandedRatio = accordionSizes(width, data.tabs.length, current + direction * width * 0.05).expanded / width;
    applyAccordion();
    return true;
  }
  function accordionResizeHandle(data, state, side) {
    const target = el("div", `pane-accordion-resize pane-accordion-resize-${side}`);
    target.setAttribute("title", "Drag to resize the expanded tab");
    for (const name of ["pointerdown", "mousedown", "click"]) target.addEventListener(name, consumeAccordionResizePress, { capture:true });
    target.addEventListener("pointerdown", event => {
      const tab = state.active;
      if (event.button !== 0 || !target.isConnected) return;
      const index = data.tabs.indexOf(tab);
      if (index < 0 || accordions.get(data) !== state) return;
      const neighbors = side === "left" ? index : data.tabs.length - index - 1;
      if (!neighbors) return;
      event.preventDefault(); event.stopPropagation(); hideEdgeHint();
      finishAccordionResize(state);
      const width = view.tabBrowserPanel.getBoundingClientRect().width;
      if (!(width > 0)) return;
      state.resizeDrag = { target, tab, pointerId:event.pointerId, x:event.clientX,
        expanded:accordionSizes(width, data.tabs.length, state.expandedRatio * width).expanded,
        // A handle beside one neighbor moves the expanded width across every strip on that side.
        scale:(side === "left" ? -1 : 1) * (data.tabs.length - 1) / neighbors,
        memberCount:data.tabs.length };
      target.setAttribute("data-dragging", "");
      target.setPointerCapture?.(event.pointerId);
    }, { capture:true });
    target.addEventListener("pointermove", event => {
      const drag = state.resizeDrag;
      if (!drag || drag.target !== target || drag.pointerId !== event.pointerId) return;
      if (state.active !== drag.tab || data.tabs.length !== drag.memberCount) { finishAccordionResize(state); return; }
      const width = view.tabBrowserPanel.getBoundingClientRect().width;
      if (!(width > 0)) { finishAccordionResize(state); return; }
      state.expandedRatio = accordionSizes(width, data.tabs.length,
        drag.expanded + (event.clientX - drag.x) * drag.scale).expanded / width;
      if (!state.resizeFrame) state.resizeFrame = win.requestAnimationFrame(() => {
        state.resizeFrame = 0;
        if (accordions.get(data) === state) applyAccordion();
      });
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) target.addEventListener(name, event => {
      if (state.resizeDrag?.target !== target || state.resizeDrag.pointerId !== event.pointerId) return;
      finishAccordionResize(state); applyAccordion();
    });
    return target;
  }
  function applyAccordion() {
    for (const [data, state] of [...accordions]) {
      if (!view._data.includes(data) || data.tabs.length < 2) { clearAccordion(data); continue; }
      if (state.resizeDrag && (!state.resizeDrag.target.isConnected || data.tabs.length !== state.resizeDrag.memberCount)) finishAccordionResize(state);
      const containers = data.tabs.map(containerFor);
      for (const [container, handle] of [...state.handles]) {
        if (!containers.includes(container)) {
          if (state.resizeDrag && container.contains(state.resizeDrag.target)) finishAccordionResize(state);
          handle.remove(); state.handles.delete(container);
          container.querySelector(".pane-accordion-bar")?.remove();
          container.querySelectorAll(".pane-accordion-resize").forEach(node => node.remove());
          container.removeAttribute("pane-accordion"); container.removeAttribute("pane-accordion-active");
          for (const name of ["left", "right", "z", "strip", "line-left", "line-right"]) container.style.removeProperty(`--pane-accordion-${name}`);
          container.removeAttribute("pane-accordion-edge");
          const page = state.pages.get(container);
          if (page) page.node.toggleAttribute("inert", page.inert);
          state.pages.delete(container);
        }
      }
      if (view._data[view.currentView] !== data) { finishAccordionResize(state); continue; }
      if (!data.tabs.includes(state.active) && browser.selectedTab === state.active) {
        browser.selectedTab = data.tabs[0];
      }
      if (data.tabs.includes(browser.selectedTab)) state.active = browser.selectedTab;
      if (!data.tabs.includes(state.active)) state.active = data.tabs[0];
      if (state.resizeDrag && state.resizeDrag.tab !== state.active) finishAccordionResize(state);
      saveAccordion(data, state);
      const activeIndex = data.tabs.indexOf(state.active);
      const previousIndex = data.tabs.indexOf(state.presented);
      const changed = state.presented && state.presented !== state.active;
      // Presentation only: leave Zen's tree and divider sizes untouched.
      view.removeSplitters();
      const width = view.tabBrowserPanel.getBoundingClientRect().width;
      const { strip } = accordionSizes(width, data.tabs.length, state.expandedRatio * width);
      for (let i = 0; i < data.tabs.length; i++) {
        const tab = data.tabs[i], container = containers[i];
        if (!container) continue;
        const active = tab === state.active;
        container.setAttribute("pane-accordion", "horizontal");
        container.toggleAttribute("pane-accordion-active", active);
        if (!state.pages.has(container)) state.pages.set(container, { node: tab.linkedBrowser, inert: tab.linkedBrowser.hasAttribute("inert") });
        tab.linkedBrowser.toggleAttribute("inert", !active || state.pages.get(container).inert);
        // Every page keeps the same readable width. Layer them to expose live edges.
        const left = i * strip;
        const right = (data.tabs.length - i - 1) * strip;
        container.style.setProperty("--pane-accordion-left", `${left}px`);
        container.style.setProperty("--pane-accordion-right", `${right}px`);
        container.style.setProperty("--pane-accordion-strip", `${strip}px`);
        container.style.setProperty("--pane-accordion-z", String(data.tabs.length - Math.abs(i - activeIndex)));
        container.setAttribute("pane-accordion-edge", i < activeIndex ? "left" : "right");
        container.style.setProperty("--pane-accordion-line-left", i < activeIndex || (active && i > 0) ? "var(--pane-accordion-border-width)" : "0px");
        container.style.setProperty("--pane-accordion-line-right", i > activeIndex || (active && i < data.tabs.length - 1) ? "var(--pane-accordion-border-width)" : "0px");
        let handle = state.handles.get(container);
        if (!handle || !container.querySelector(".pane-accordion-bar")?.contains(handle) || !container.querySelector(".pane-accordion-controls")
          || !container.querySelector(".pane-accordion-resize-left") || !container.querySelector(".pane-accordion-resize-right")) {
          if (state.resizeDrag) finishAccordionResize(state);
          container.querySelector(".pane-accordion-bar")?.remove();
          container.querySelectorAll(".pane-accordion-resize").forEach(node => node.remove());
          handle = button("", () => {
            hideEdgeHint();
            if (tab === state.active) { openMenu(tab, handle); return; }
            browser.selectedTab = tab; state.active = tab; applyAccordion(); tab.linkedBrowser.focus();
          }, "pane-accordion-handle");
          handle.addEventListener("pointerenter", event => scheduleEdgeHint(tab, event));
          handle.addEventListener("pointerleave", hideEdgeHint);
          handle.addEventListener("keydown", event => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation();
            const step = event.key === "Home" ? -data.tabs.length : event.key === "End" ? data.tabs.length : event.key === "ArrowLeft" ? -1 : 1;
            accordionStep(data, step, true);
          });
          const bar = el("div", "pane-accordion-bar");
          const controls = el("span", "pane-accordion-controls");
          for (const [name, label, callback] of [
            ["back", "Previous accordion tab", () => accordionStep(data, -1, true)],
            ["forward", "Next accordion tab", () => accordionStep(data, 1, true)],
            ["more", "Arrange accordion tabs", () => openMenu(state.active, bar)],
            ["grid", "Restore tiled layout", () => arrange(state.active, "tiles")],
          ]) {
            const control = button("", callback);
            setPaneIcon(control, name); control.title = label; control.setAttribute("aria-label", label);
            controls.append(control);
          }
          bar.append(handle, controls);
          container.append(bar, accordionResizeHandle(data, state, "left"), accordionResizeHandle(data, state, "right"));
          state.handles.set(container, handle);
        }
        container.querySelector(".pane-accordion-resize-left").hidden = i !== activeIndex - 1;
        container.querySelector(".pane-accordion-resize-right").hidden = i !== activeIndex + 1;
        handle.textContent = tab.label;
        handle.removeAttribute("title");
        handle.setAttribute("aria-label", `${tab.label}. ${active ? "Click to arrange. " : ""}Use Left and Right to switch tabs`);
        handle.setAttribute("aria-pressed", String(active));
        const controls = container.querySelector(".pane-accordion-controls");
        const navigation = controls.querySelectorAll("button");
        navigation[0].disabled = navigation[1].disabled = false;
        appearance(container);
      }
      if (changed) {
        state.animation?.cancel(); state.animation = null;
        if (!reducedMotion?.matches) {
          const direction = state.direction || Math.sign(activeIndex - previousIndex) || 1;
          // Animate the incoming page's position, never its dimensions or browsing context.
          state.animation = containerFor(state.active)?.animate?.([
            { transform: `translateX(${direction * 12}px)` }, { transform: 'translateX(0)' },
          ], { duration: 160, easing: 'cubic-bezier(.2,.8,.2,1)' });
        }
      }
      state.presented = state.active; state.direction = 0;
    }
  }
  function clearScrolling(data, restore = true, preserveSession = false) {
    const state = scrollings.get(data);
    if (!state) return;
    state.abort.abort();
    stopScrollingPaint(state);
    state.snapshotOverlay?.remove();
    for (const container of state.containers) {
      container.querySelector('.pane-scrolling-header')?.remove();
      container.querySelector('.pane-scrolling-reveal')?.remove();
      container.removeAttribute('pane-scrolling-hidden');
      container.removeAttribute('pane-scrolling-landing');
      container.removeAttribute('pane-scrolling-toolbar-active');
      container.removeAttribute('pane-scrolling');
      container.style.removeProperty('--pane-scrolling-width');
    }
    if (!preserveSession && session) for (const tab of state.savedTabs ?? data.tabs) if (tab.isConnected && !tab.closing) session.deleteCustomTabValue(tab,scrollingKey);
    scrollings.delete(data);
    if (restore && view._data[view.currentView] === data) { view.removeSplitters(); view.applyGridLayout(data.layoutTree); }
  }
  function scrollingGeometry(data, state) {
    const viewport = view.tabBrowserPanel.getBoundingClientRect().width;
    return scrollingSizes(viewport, prefs?.getIntPref('mod.pane.scrolling-width', 65) ?? 65,
      data.tabs.map(tab => state.widths.get(tab)));
  }
  // The same candidate drives the preview highlight and release selection.
  function scrollingLanding(data, state, geometry = scrollingGeometry(data,state)) {
    const center = state.offset + geometry.viewport / 2;
    let nearest = 0, distance = Infinity;
    geometry.positions.forEach((left,index) => {
      const d = Math.abs(left + geometry.widths[index]/2 - center);
      if (d < distance) { nearest = index; distance = d; }
    });
    return data.tabs[nearest];
  }
  function scrollStep(data, direction) {
    const state = scrollings.get(data);
    if (!state) return;
    const current = state.overview ? scrollingLanding(data,state) : browser.selectedTab;
    const index = Math.max(0, data.tabs.indexOf(current));
    const nextIndex = Math.max(0, Math.min(data.tabs.length - 1, index + direction));
    const next = data.tabs[nextIndex];
    if (state.overview) {
      const geometry=scrollingGeometry(data,state);
      state.offset=geometry.positions[nextIndex]+geometry.widths[nextIndex]/2-geometry.viewport/2;
      state.follow=false;
      state.selected=browser.selectedTab;
      applyScrolling();
      return;
    }
    browser.selectedTab = next;
    state.follow = true;
    applyScrolling();
    next.linkedBrowser.focus();
  }
  function applyScrolling() {
    for (const [data, state] of [...scrollings]) {
      if (!view._data.includes(data) || data.tabs.length < 2) { clearScrolling(data); continue; }
      saveScrolling(data,state);
      if (view._data[view.currentView] !== data || !data.tabs.includes(browser.selectedTab)) {
        state.overview=false;
        stopScrollingPaint(state);
        state.snapshotOverlay?.remove(); state.snapshotOverlay=null; state.snapshotCards=null;
        for (const container of state.containers) {
          container.removeAttribute('pane-scrolling-landing');
          container.removeAttribute('pane-scrolling-toolbar-active');
        }
        continue;
      }
      for (const container of [...state.containers]) if (!data.tabs.some(tab => containerFor(tab) === container)) {
        container.querySelector('.pane-scrolling-header')?.remove();
        container.querySelector('.pane-scrolling-reveal')?.remove();
        container.removeAttribute('pane-scrolling-hidden');
        container.removeAttribute('pane-scrolling-landing');
        container.removeAttribute('pane-scrolling-toolbar-active');
        container.removeAttribute('pane-scrolling');
        container.style.removeProperty('--pane-scrolling-width');
        state.containers.delete(container);
      }
      const geometry = scrollingGeometry(data, state);
      if (state.follow || state.selected !== browser.selectedTab) {
        const index = data.tabs.indexOf(browser.selectedTab);
        if (index >= 0) {
          const left = geometry.positions[index];
          if (left < state.offset) state.offset = left;
          else if (left + geometry.widths[index] > state.offset + geometry.viewport) state.offset = left + geometry.widths[index] - geometry.viewport;
        }
        state.selected = browser.selectedTab; state.follow = false;
      }
      state.offset = Math.max(0, Math.min(geometry.max, state.offset));
      const landing = scrollingLanding(data,state,geometry);
      view.removeSplitters();
      for (let index = 0; index < data.tabs.length; index++) {
        const tab = data.tabs[index], container = containerFor(tab);
        if (!container) continue;
        state.containers.add(container);
        container.setAttribute('pane-scrolling', 'true');
        container.toggleAttribute('pane-scrolling-landing', !!state.overview && tab === landing);
        container.toggleAttribute('pane-scrolling-toolbar-active', tab === (state.overview ? landing : browser.selectedTab));
        container.toggleAttribute('pane-scrolling-hidden', tab !== browser.selectedTab);
        container.style.setProperty('--pane-scrolling-width', `${geometry.viewport}px`);
        if (!container.querySelector('.pane-scrolling-header')) {
          const header = scrollingHeader(data, state, tab);
          const reveal = el('div', 'pane-scrolling-reveal');
          reveal.setAttribute('aria-hidden','true');
          let hideTimer=null;
          const showHeader=()=>{
            win.clearTimeout(hideTimer);
            header.setAttribute('data-visible','');
          };
          const hideHeader=()=>{
            win.clearTimeout(hideTimer);
            hideTimer=win.setTimeout(()=>header.removeAttribute('data-visible'),650);
          };
          for (const surface of [reveal,header]) {
            surface.addEventListener('pointerenter',showHeader,{signal:state.abort.signal});
            surface.addEventListener('pointerleave',hideHeader,{signal:state.abort.signal});
          }
          header.addEventListener('focusin',showHeader,{signal:state.abort.signal});
          header.addEventListener('focusout',hideHeader,{signal:state.abort.signal});
          state.abort.signal.addEventListener('abort',()=>win.clearTimeout(hideTimer),{once:true});
          container.prepend(reveal,header);
        }
        const title = container.querySelector('.pane-scrolling-title');
        if (title.textContent !== tab.label) title.textContent = tab.label;
        title.removeAttribute('title');
        appearance(container);
      }
      if (state.overview) renderSnapshotOverview(data,state,geometry,landing);
    }
  }
  function capturePresentation(data) {
    const scrolling=scrollings.get(data), accordion=accordions.get(data);
    return {selected:browser.selectedTab, floating:[...floats.values()].filter(f=>f.data===data).map(f=>({tab:f.tab,rect:{...f.rect},headerPinned:f.headerPinned})), scrolling:scrolling && {widths:new Map(scrolling.widths)}, accordion:accordion?.active};
  }
  function restorePresentation(data,saved,tab=saved.selected) {
    if (saved.scrolling) {
      startScrolling(tab,saved.scrolling.widths);
    } else if (saved.accordion) startAccordion(saved.accordion);
    for (const record of saved.floating ?? []) {
      if (!data.tabs.includes(record.tab)) continue;
      if (!floats.has(record.tab)) floatTab(record.tab);
      const f=floats.get(record.tab);f.rect={...record.rect};f.headerPinned=record.headerPinned;
    }
    browser.selectedTab=saved.selected;
    applyFloat(); applyScrolling(); applyAccordion();
  }
  function startScrolling(tab, preservedWidths = null) {
    const data = groupFor(tab);
    if (!data || data.tabs.length < 2) throw new Error('Create a split before using scrolling');
    if (data.tabs.some(t => floats.has(t))) throw new Error('Dock floating tabs before using scrolling');
    if (!data.tabs.every(t => containerFor(t))) throw new Error('Wait for the split panes to finish loading');
    const widths=new Map(preservedWidths ?? scrollings.get(data)?.widths ?? []);
    clearAccordion(data);
    view.activateSplitView(data, true); browser.selectedTab = tab;
    scrollings.set(data, {offset:0, follow:true, overview:false, widths, containers:new Set(), abort:new win.AbortController()});
    try { applyScrolling(); } catch (error) { clearScrolling(data); throw error; }
  }
  function scrollingHeader(data, state, tab, titleClass = 'pane-scrolling-title') {
    const header = el('div', 'pane-scrolling-header');
    for (const [icon, title, action] of [
      ['back', 'Previous scrolling tab', () => scrollStep(data, -1)],
      ['forward', 'Next scrolling tab', () => scrollStep(data, 1)],
      ['grid', 'Reset column to default width', () => { state.widths.delete(tab); applyScrolling(); }], // keep the current pan; do not jump back to the selected tab
    ]) {
      const control = button('', action, 'pane-scrolling-control');
      control.setAttribute('aria-label', title); control.title = title;
      setPaneIcon(control, icon); header.append(control);
    }
    const more = button('', () => openMenu(tab, more), 'pane-scrolling-control');
    more.setAttribute('aria-label', 'Arrange scrolling tabs'); more.title = 'Arrange scrolling tabs';
    setPaneIcon(more, 'more'); header.append(more);
    header.prepend(el('span', titleClass, tab.label));
    header.append(el('span', 'pane-scrolling-landing-label', 'Release to open'));
    return header;
  }
  function scrollingResize(data,state,tab) {
    const resize = el('div', 'pane-scrolling-resize');
    resize.tabIndex = 0;
    resize.setAttribute('role', 'separator');
    resize.setAttribute('aria-orientation', 'vertical');
    resize.setAttribute('aria-label', 'Resize column. Double-click to reset width');
    let drag = null;
    const finishDrag = () => {
      const pointerId = drag?.pointerId;
      drag = null;
      resize.removeAttribute('data-dragging');
      if (pointerId != null && resize.hasPointerCapture?.(pointerId)) resize.releasePointerCapture(pointerId);
    };
    const setWidth = value => {
      // Drop the drag if the overview closed or this card was removed mid-drag.
      if (!state.overview || !resize.isConnected) { finishDrag(); return; }
      const viewport = scrollingGeometry(data,state).viewport;
      state.widths.set(tab, scrollingColumnWidth(viewport,value)); state.follow = false; state.selected = browser.selectedTab; applyScrolling();
    };
    resize.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      drag = {x:event.clientX, width:scrollingGeometry(data,state).widths[data.tabs.indexOf(tab)], pointerId:event.pointerId};
      resize.setAttribute('data-dragging', '');
      resize.setPointerCapture(event.pointerId);
    }, {signal:state.abort.signal});
    resize.addEventListener('pointermove', event => {
      if (drag) setWidth(drag.width + event.clientX - drag.x);
    }, {signal:state.abort.signal});
    for (const name of ['pointerup','pointercancel','lostpointercapture']) resize.addEventListener(name, finishDrag, {signal:state.abort.signal});
    resize.addEventListener('dblclick', () => { state.widths.delete(tab); applyScrolling(); }, {signal:state.abort.signal});
    resize.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      if (event.key === 'Home') state.widths.delete(tab);
      else setWidth(scrollingGeometry(data,state).widths[data.tabs.indexOf(tab)] + (event.key === 'ArrowRight' ? 20 : -20));
      applyScrolling();
    }, {signal:state.abort.signal});
    return resize;
  }
  async function snapshotCanvas(tab,canvas) {
    try {
      const {PageThumbs}=win.ChromeUtils.importESModule('resource://gre/modules/PageThumbs.sys.mjs');
      await PageThumbs.captureToCanvas(tab.linkedBrowser,canvas,{fullViewport:true},true);
      return true;
    } catch { return false; }
  }
  function renderSnapshotOverview(data,state,geometry,landing) {
    if (!state.snapshotOverlay) {
      const overlay=el('div','pane-snapshot-overview');
      const bounds=view.tabBrowserPanel.getBoundingClientRect();
      for (const [key,value] of Object.entries({left:bounds.left??0,top:bounds.top??0,width:bounds.width,height:bounds.height})) overlay.style.setProperty(key,`${value}px`);
      const strip=el('div','pane-snapshot-strip'); overlay.append(strip);
      overlay.addEventListener('wheel',event=>{
        event.preventDefault(); event.stopPropagation();
        if (!state.overview) return;
        const delta=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
        if (!Number.isFinite(delta)) return;
        state.follow=false; state.selected=browser.selectedTab;
        state.offset+=delta*(event.deltaMode===1?24:event.deltaMode===2?scrollingGeometry(data,state).viewport:1);
        applyScrolling();
      },{passive:false,signal:state.abort.signal});
      state.snapshotOverlay=overlay;
      state.snapshotCards=new Map();
      (doc.documentElement??doc).append(overlay);
    }
    const bounds=view.tabBrowserPanel.getBoundingClientRect();
    for (const [key,value] of Object.entries({left:bounds.left??0,top:bounds.top??0,width:bounds.width,height:bounds.height})) state.snapshotOverlay.style.setProperty(key,`${value}px`);
    for (const [tab,card] of state.snapshotCards) if (!data.tabs.includes(tab)) {
      card.remove(); state.snapshotCards.delete(tab);
    }
    appearance(state.snapshotOverlay);
    const strip=state.snapshotOverlay.querySelector('.pane-snapshot-strip');
    strip.style.setProperty('transform',`translateX(${-state.offset}px)`);
    for (let index=0;index<data.tabs.length;index++) {
      const tab=data.tabs[index];
      let card=state.snapshotCards.get(tab);
      if (!card) {
        card=el('div','pane-snapshot-card');
        const canvas=el('canvas','pane-snapshot-image'); canvas.width=1000;canvas.height=700;
        card.append(scrollingHeader(data,state,tab,'pane-snapshot-title pane-scrolling-title'),canvas,scrollingResize(data,state,tab));
        strip.append(card);state.snapshotCards.set(tab,card);
        snapshotCanvas(tab,canvas);
      }
      card.style.setProperty('width',`${geometry.widths[index]}px`);
      card.toggleAttribute('data-landing',tab===landing);
      card.querySelector('.pane-snapshot-title').textContent=tab.label;
    }
  }
  function waitForScrollingPaint(state,landing,reveal) {
    state.cancelPaintWait?.();
    const target=landing.linkedBrowser;
    let armed=false;
    let frame=win.requestAnimationFrame(()=>{armed=true;});
    const transaction=win.windowUtils?.lastTransactionId ?? 0;
    const cleanup=()=>{
      win.removeEventListener('MozAfterPaint',onPaint);
      win.cancelAnimationFrame(frame);
      win.clearTimeout(timeout);
      state.cancelPaintWait=null;
    };
    const finish=()=>{
      cleanup();
      if (!disposed && !state.overview) reveal();
    };
    const ready=()=>browser.selectedTab===landing && (!target.isRemoteBrowser || target.hasLayers)
      && (!browser._switcher || browser._switcher.visibleTab===landing);
    const onPaint=event=>{
      if (!armed || event.transactionId<=transaction || !ready()) return;
      finish();
    };
    let slow=false;
    const check=()=>{
      if (ready()) {finish(); return;}
      if (!slow) {
        slow=true;
        const surface=state.snapshotOverlay;
        if (surface) {
          surface.removeAttribute('aria-hidden');
          const status=el('div','pane-scrolling-wait');
          status.setAttribute('role','status');
          status.append(el('span','','Waiting for this page to become visible.'),
            button('Restore tiled layout',()=>{clearScrolling(groupFor(landing));landing.linkedBrowser.focus();}));
          surface.append(status);
        }
      }
      timeout=win.setTimeout(check,250);
    };
    win.addEventListener('MozAfterPaint',onPaint);
    let timeout=win.setTimeout(check,1000);
    state.cancelPaintWait=cleanup;
  }
  function finishSnapshotOverview(state,landing) {
    waitForScrollingPaint(state,landing,()=>{
      state.snapshotOverlay?.remove();state.snapshotOverlay=null;state.snapshotCards=null;
    });
  }
  function stopScrollingPaint(state) {
    state.cancelPaintWait?.();
  }
  function scrollingModifier(event) {
    const binding = scrollingModifiers(prefs);
    return binding && ['ctrlKey','altKey','shiftKey','metaKey'].every(key=>Boolean(event[key]) === binding[key]);
  }
  function onScrollingModifier(event) {
    const data = view._data[view.currentView], state = scrollings.get(data);
    if (!state || (event.target?.closest?.('[data-pane-recording]') || event.target?.ownerDocument?.documentElement?.hasAttribute('data-pane-recording'))) return;
    if (event.type === 'blur' && event.target !== win) return;
    if (event.type==='keydown' && event.key==='Escape' && state.overview) {
      event.preventDefault(); event.stopPropagation();
      state.cancelled=true;
      if (data.tabs.includes(state.startTab)) browser.selectedTab=state.startTab;
      state.overview=false; state.follow=true;
      stopScrollingPaint(state);
      state.snapshotOverlay?.remove(); state.snapshotOverlay=null; state.snapshotCards=null;
      applyScrolling(); browser.selectedTab.linkedBrowser.focus();
      return;
    }
    if (menu) return;
    if (state.cancelled) {
      if (!scrollingModifier(event)) state.cancelled=false;
      return;
    }
    const overview = event.type !== 'blur' && scrollingModifier(event);
    if (state.overview === overview) return;
    const landing = overview ? browser.selectedTab : scrollingLanding(data,state);
    if (overview) stopScrollingPaint(state);
    state.overview = overview;
    if (overview) { state.startTab=browser.selectedTab; state.follow = true; }
    else {
      browser.selectedTab = landing;
      state.selected = landing;
    }
    applyScrolling();
    if (!overview && event.type !== 'blur') landing.linkedBrowser.focus();
    if (!overview) finishSnapshotOverview(state,landing);
  }

  function onScrollingWheel(event) {
    const data = view._data[view.currentView], state = scrollings.get(data);
    if (!state || event.isComposing) return;
    // Key events own the gesture lifetime; trackpad wheel flags can vary
    // during the same held gesture, especially with momentum scrolling.
    if (!state.overview) return;
    // Only consume gestures over this split, never over settings or the sidebar.
    if (!data.tabs.some(tab => containerFor(tab)?.contains(event.target))) return;
    // Reserve the entire modified gesture, including events at either boundary.
    event.preventDefault(); event.stopPropagation();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta || !Number.isFinite(delta)) return;
    const {viewport} = scrollingGeometry(data, state);
    state.follow = false; state.selected = browser.selectedTab;
    state.offset += delta * (event.deltaMode === 1 ? 24 : event.deltaMode === 2 ? viewport : 1);
    applyScrolling();
  }

  function startAccordion(tab) {
    const data = groupFor(tab);
    if (!data || data.tabs.length < 2) throw new Error("Create a split before using accordion");
    if (data.tabs.some(t => floats.has(t))) throw new Error("Dock the floating tabs before using accordion");
    if (!data.tabs.every(t => containerFor(t))) throw new Error("Wait for the split panes to finish loading");
    clearScrolling(data);
    view.activateSplitView(data, true);
    browser.selectedTab = tab;
    if (!accordions.has(data)) accordions.set(data, { active: tab, handles: new Map(), pages: new Map() });
    try { saveAccordion(data, accordions.get(data)); applyAccordion(); } catch (error) { clearAccordion(data); throw error; }
    tab.linkedBrowser.focus();
  }
  function removeFloat(f, preserveSession = false) {
    if (!preserveSession && session && !f.tab.closing) session.deleteCustomTabValue(f.tab,floatingKey);
    floats.delete(f.tab);
    f.abort.abort();
    f.container.removeAttribute("pane-floating");
    f.container.querySelectorAll(".pane-float-header,.pane-float-resize").forEach(n => n.remove());
    for (const prop of ["x", "y", "width", "height", "z"]) f.container.style.removeProperty(`--pane-float-${prop}`);
    f.tab.removeAttribute("pane-floating-tab");
  }
  function clearFloat(restore = true, tab = null, preserveSession = false) {
    const removed = tab ? [floats.get(tab)].filter(Boolean) : [...floats.values()];
    for (const f of removed) removeFloat(f,preserveSession);
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
  function bindFloatFocus(f) {
    f.container.addEventListener('pointerdown',()=>raiseFloat(f),{capture:true,signal:f.abort.signal});
    f.container.addEventListener('focusin',()=>raiseFloat(f),{signal:f.abort.signal});
    raiseFloat(f);
  }
  function positionFloat(f) {
    const bounds = view.tabBrowserPanel.getBoundingClientRect();
    f.rect = fitRectangle(f.rect, bounds.width, bounds.height);
    for (const [prop, value] of Object.entries(f.rect)) f.container.style.setProperty(`--pane-float-${prop}`, `${value}px`);
    saveFloat(f);
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
      const close = button("", () => run(() => detach(f.tab))); close.setAttribute("aria-label", "Return floating tab to sidebar");
      const pin = button("", () => {
        const pinned = f.headerPinned = !f.headerPinned;
        header.toggleAttribute("data-pinned", pinned);
        pin.setAttribute("aria-pressed", String(pinned));
        pin.title = pinned ? "Auto-hide header" : "Keep header visible";
        pin.setAttribute("aria-label", pin.title);
        saveFloat(f);
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
        f.container.append(resize);
 bindPointer(resize, edge, f);
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
    clearScrolling(data);
    clearAccordion(data);
    const bounds = view.tabBrowserPanel.getBoundingClientRect();
    const offset = [...floats.values()].filter(f => f.data === data).length * 32;
    const f = { tab, data, container: containerFor(tab), abort: new win.AbortController(), headerPinned: false, rect: {
      width: Math.min(480, bounds.width * .6), height: Math.min(420, bounds.height * .7),
      x: Math.max(0, bounds.width - 500 - offset), y: Math.max(0, bounds.height - 440 - offset),
    } };
    floats.set(tab, f);
    bindFloatFocus(f);
    tab.setAttribute("pane-floating-tab", "true");
    applyFloat();
  }
  function arrange(tab, mode) {
    mode = normalizeMode(mode);
    checkTab(tab);
    if (mode === "accordion") return startAccordion(tab);
    if (mode === "scrolling") return startScrolling(tab);
    if (mode === "tiles") { clearAccordion(groupFor(tab)); tab.linkedBrowser.focus(); return; }
    if (mode === "float") return floatTab(tab);
    if (mode === "normal") return detach(tab);
    const data = groupFor(tab);
    if (!data) { chooseTab(tab, mode); return; }
    if (mode === "grid" && data.tabs.length < 3) { chooseTab(tab, "grid"); return; }
    if (!layoutTypes[mode]) throw new Error("Unknown layout");
    const presentation=capturePresentation(data);
    const previousFloat=floats.get(tab);
    clearAccordion(data);
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
      if (previousFloat) {floatTab(tab); const restored=floats.get(tab); restored.rect={...previousFloat.rect}; restored.headerPinned=previousFloat.headerPinned; applyFloat();}
      restorePresentation(data,presentation);
      throw error;
    }
  }
  function detach(tab) {
    checkTab(tab);
    const data = groupFor(tab);
    if (!data) return;
    const remaining = data.tabs.filter(t => t !== tab && !t.closing);
    const other = remaining.includes(browser.selectedTab) ? browser.selectedTab : remaining[0];
    const presentation=capturePresentation(data);
    clearAccordion(data);
    clearFloat(false, tab);
    try { view.removeTabFromGroup(tab, undefined, { forUnsplit: true }); }
    catch (error) {
      if (view._data.includes(data) && data.tabs.length>=2) {
        if (!data.tabs.includes(presentation.selected)) presentation.selected=data.tabs[0];
        if (presentation.accordion && !data.tabs.includes(presentation.accordion)) presentation.accordion=presentation.selected;
        restorePresentation(data,presentation,presentation.selected);
      }
      throw error;
    }
    if (other && !other.closing) browser.selectedTab = other;
    if (data.tabs.length >= 2 && view._data.includes(data)) {
      presentation.selected=other;
      if (presentation.accordion===tab) presentation.accordion=other;
      presentation.scrolling?.widths.delete(tab);
      restorePresentation(data,presentation,other);
    }
    applyFloat();
    browser.selectedBrowser?.focus();
  }
  function copyTree(node) {
    const copy = Object.assign(Object.create(Object.getPrototypeOf(node)), node);
    copy.parent = null;
    if (node.children) copy.children = node.children.map(child => {
      const copyChild = copyTree(child);
      copyChild.parent = copy;
      return copyChild;
    });
    return copy;
  }
  function setTreeParent(node, parent = null) {
    node.parent = parent;
    if (node.children) for (const child of node.children) setTreeParent(child, node);
    return node;
  }
  function replaceLeaf(node, tab, replacement) {
    if (!node.children) {
      if (node.tab !== tab) return null;
      for (const [key, value] of Object.entries(node)) {
        if (!["tab", "children", "parent"].includes(key) && (key === "sizeInParent" || !(key in replacement))) replacement[key] = value;
      }
      return setTreeParent(replacement, node.parent ?? null);
    }
    for (let i = 0; i < node.children.length; i++) {
      const next = replaceLeaf(node.children[i], tab, replacement);
      if (next) { node.children[i] = next; next.parent = node; return node; }
    }
    return null;
  }
  function addToExistingTree(snapshot, target, incoming, layout) {
    const branch = view.calculateLayoutTree([target, incoming], layout);
    const tree = copyTree(snapshot.tree);
    const replaced = replaceLeaf(tree, target, branch);
    if (!replaced) throw new Error("Zen could not find the target pane");
    return setTreeParent(replaced === tree ? tree : replaced);
  }
  function add(target, incoming, mode) {
    mode = normalizeMode(mode);
    checkTab(target); checkTab(incoming);
    if (target === incoming || incoming.splitView || tabWorkspace(win, target) !== tabWorkspace(win, incoming)) throw new Error("Choose an available tab in the same workspace");
    const current = groupFor(target);
    if ((current?.tabs.length ?? 1) >= view.MAX_TABS) throw new Error("This split has reached Zen’s tab limit");
    const presentationMode = presentationModes.includes(mode);
    const layout = layoutTypes[mode] || "vsep";
    if (!layoutTypes[mode] && mode !== "float" && !presentationMode) throw new Error("Unknown layout");
    const presentation=capturePresentation(current);
    clearAccordion(current);
    const snapshot = current ? { tree: copyTree(current.layoutTree), type: current.gridType } : null;
    const originalTarget = target;
    origins.begin([...new Set([...(current?.tabs ?? []), target, incoming])]);
    try {
      const data = view.splitTabs([target, incoming], layout);
      if (!data?.tabs.includes(incoming)) throw new Error("Zen could not create this layout");
      // Zen adds to an existing tree without applying the requested direction.
      if (mode !== "float") {
        data.gridType = current && layout !== "grid" ? snapshot.type : layout;
        data.layoutTree = current && layout !== "grid" ? addToExistingTree(snapshot, target, incoming, layout)
          : view.calculateLayoutTree(data.tabs, data.gridType);
        view.activateSplitView(data, true);
      }
      browser.selectedTab = incoming;
      if (mode === "float") floatTab(incoming);
      else if (mode === "scrolling") startScrolling(incoming, presentation.scrolling?.widths);
      else if (presentationMode) arrange(incoming, mode);
      else if (presentation.scrolling) startScrolling(incoming,presentation.scrolling.widths);

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
        if (current && view._data.includes(current)) restorePresentation(current,presentation);
        else browser.selectedTab = originalTarget;
      } catch (rollbackError) { console.error("[Pane] Layout rollback failed", rollbackError); }
      applyFloat();
      throw error;
    } finally { origins.end(); }
  }
  function run(action) {
    closeMenu();
    try { action(); } catch (error) { notify(error.message || "The layout could not be changed", "warning"); }
  }
  function join(data, incoming, mode = "grid") {
    mode = normalizeMode(mode);
    if (!view._data.includes(data) || data.tabs.length < 2) throw new Error("That split is no longer available");
    if (!layoutTypes[mode] && !["float", ...presentationModes].includes(mode)) throw new Error("Unknown layout");
    const selected = data.tabs.includes(browser.selectedTab) && !floats.has(browser.selectedTab) ? browser.selectedTab : null;
    const target = selected || data.tabs.find(tab => !floats.has(tab)) || data.tabs[0];
    add(target, incoming, mode);
  }
  function unsplit(data) {
    if (!view._data.includes(data) || data.tabs.length < 2) throw new Error("That split is no longer available");
    const selected = browser.selectedTab;
    clearAccordion(data);
    const members = [...data.tabs];
    for (const tab of members) clearFloat(false, tab);
    try {
      for (const tab of members) if (groupFor(tab) === data) view.removeTabFromGroup(tab, undefined, { forUnsplit: true });
    } finally {
      origins.reconcile?.();
      if (selected?.isConnected && !selected.closing) browser.selectedTab = selected;
      sync();
    }
  }
  function openMenu(tab, anchor) {
    hideEdgeHint();
    closeMenu();
    const anchorRect = anchor?.getBoundingClientRect();
    const scrolling=scrollings.get(groupFor(tab));
    if (scrolling?.overview) {
      scrolling.overview=false; scrolling.cancelled=true; scrolling.follow=true;
      stopScrollingPaint(scrolling);
      scrolling.snapshotOverlay?.remove(); scrolling.snapshotOverlay=null; scrolling.snapshotCards=null;
      applyScrolling();
    }
    menuTab = tab;
    menu = el("div", "pane-layout-menu"); menu.id = "pane-layout-menu";
    menu.setAttribute("role", "dialog"); menu.setAttribute("aria-label", "Arrange this tab");
    const header = el("div", "pane-layout-header");
    const heading = el("div", "pane-layout-title");
    heading.append(el("div", "pane-layout-heading", "Arrange this tab"), el("div", "pane-layout-context", tab.label));
    const close = button("", () => closeMenu(true), "pane-layout-close");
    close.setAttribute("aria-label", "Close layout menu");
    header.append(heading, close); menu.append(header);
    const group = groupFor(tab);
    const currentMode = scrollings.has(group) ? "scrolling" : accordions.has(group) ? "accordion" : floats.has(tab) ? "float" : !group ? "normal" :
      Object.keys(layoutTypes).find(mode => layoutTypes[mode] === group.gridType);
    const options = [
      ["right", "Split right", "Place beside the other tabs"],
      ["below", "Split below", "Place below the other tabs"],
      ["grid", "Grid", "Arrange with other split tabs"],
      ["float", "Floating", "Move and resize this tab"],
      ["normal", "Return to a normal tab", "Keep this tab open and stay on the remaining split"],
    ];
    if (group?.tabs.length >= 2) options.splice(3, 0,
      ["scrolling", "Scrolling (experimental)", "Hold the modifier to reveal and scroll through tabs"],
      ["accordion", "Horizontal accordion", "Expand one tab and switch from the side strips"],
      ...((accordions.has(group) || scrollings.has(group)) ? [["tiles", "Restore tiled layout", "Bring back your previous divider sizes"]] : []));
    for (const [mode, label, description] of options) {
      const current = mode === currentMode;
      const b = button("", () => run(() => arrange(tab, mode)), "pane-layout-option");
      b.dataset.mode = mode;
      b.setAttribute("aria-pressed", String(current));
      const icon = el("span", "pane-layout-icon");
      icon.append(paneIcon(doc, mode === "accordion" || mode === "scrolling" ? "right" : mode === "tiles" ? "grid" : mode));
      icon.setAttribute("aria-hidden", "true");
      const copy = el("span", "pane-layout-copy");
      copy.append(el("span", "pane-layout-label", label), el("span", "pane-layout-description", current ? "Current layout" : description));
      b.append(icon, copy);
      if (current) b.append(el("span", "pane-layout-badge", "Current"));
      menu.append(b);
    }
    if (scrollings.has(group)) {
      const reset=button('Reset all column widths',()=>run(()=>{const state=scrollings.get(group);state.widths.clear();applyScrolling();}), 'pane-layout-add'); // keep the current pan; do not jump back to the selected tab
      menu.append(reset);
    }
    const add = button("", () => { closeMenu(); chooseTab(tab, "right"); }, "pane-layout-add");
    add.append(paneIcon(doc, "plus"), doc.createTextNode("Add another tab…"));
    menu.append(add);
    if (accordions.has(group)) {
      const hints = el("div", "pane-accordion-shortcuts");
      for (const record of accordionBindings(prefs, win.navigator?.platform)) {
        const hint = el("span", "pane-layout-hint");
        hint.append(el("kbd", "", shortcutLabel(record.binding, win.navigator?.platform)), el("span", "", record.label));
        hints.append(hint);
      }
      menu.append(hints);
    }
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
    const fallback = containerFor(tab)?.getBoundingClientRect();
    const usable = anchorRect && (anchorRect.width || anchorRect.height || anchorRect.left || anchorRect.top);
    const rect = usable ? anchorRect : fallback;
    menu.style.left = `${Math.max(8, Math.min(rect.right - menu.offsetWidth, win.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(rect.top + 32, win.innerHeight - menu.offsetHeight - 8))}px`;
    (menu.querySelector('[data-mode][aria-pressed="true"]') || menu.querySelector("[data-mode]")).focus();
  }
  function sync(retryDeferred = false) {
    if (hintTab && (hintTab.closing || !hintTab.isConnected || groupFor(hintTab) !== view._data[view.currentView]
      || browser.selectedTab === hintTab)) hideEdgeHint();
    retryDeferredFrame ||= retryDeferred;
    if (frame || disposed) return;
    frame = win.requestAnimationFrame(() => { const retry = retryDeferredFrame; frame = 0; retryDeferredFrame = false; persistence.sync({retryDeferred:retry}); recoverScrollings(); recoverAccordions(); recoverFloats(); applyFloat(); applyAccordion(); applyScrolling(); });
  }
  function outside(event) { if (menu && !menu.contains(event.target)) closeMenu(); }
  function tabChanged() { closeMenu(); sync(); }
  function eventSync() { sync(); }
  function boundarySync() { persistence.armRestoreScan(); sync(true); }
  function saveSplitLayoutIfChanged() { persistence.saveIfChanged(); }
  function markWindowClosing() { windowClosing = true; win.setTimeout?.(() => { if (!win.closed) windowClosing = false; }, 0); }
  function onAccordionShortcut(event) {
    const picker = doc.getElementById?.('pane-overlay');
    if (menu || (picker && !picker.hidden) || event.repeat || event.target?.ownerDocument?.documentElement?.hasAttribute('data-pane-recording')) return;
    const data = view._data[view.currentView];
    if (!data?.tabs.includes(browser.selectedTab) || data.tabs.length < 2) return;
    const bindings = accordionBindings(prefs, win.navigator?.platform);
    const index = bindings.findIndex(record => matchesBinding(event, record.binding, win.navigator?.platform));
    if (index < 0) return;
    if (bindings[index].key === 'layout-menu') {
      event.preventDefault(); event.stopPropagation();
      openMenu(browser.selectedTab);
      return;
    }
    const accordion = accordions.get(data), scrolling = scrollings.get(data);
    if (!accordion && !scrolling) return;
    if (bindings[index].resize) {
      if (!accordion) return;
      if (accordion.resizeDrag) return;
      event.preventDefault(); event.stopPropagation();
      if (resizeAccordionByShortcut(data, accordion, bindings[index].resize)) browser.selectedTab.linkedBrowser.focus();
      return;
    }
    event.preventDefault(); event.stopPropagation();
    if (scrollings.get(data)?.cancelled) return;
    if (scrolling) scrollStep(data, bindings[index].direction);
    else accordionStep(data, bindings[index].direction);
  }
  win.addEventListener("keydown", onScrollingModifier, true);
  win.addEventListener("keyup", onScrollingModifier, true);
  win.addEventListener("blur", onScrollingModifier);
  win.addEventListener("wheel", onScrollingWheel, {capture:true, passive:false});
  win.addEventListener("keydown", onAccordionShortcut, true);
  win.addEventListener("blur", hideEdgeHint);
  function onResize() { hideEdgeHint(); sync(); }
  function motionChanged() {
    if (reducedMotion.matches) for (const state of accordions.values()) { state.animation?.cancel(); state.animation = null; }
  }
  reducedMotion?.addEventListener('change', motionChanged);
  win.addEventListener("ZenViewSplitter:SplitViewActivated", eventSync);
  win.addEventListener("ZenWorkspacesUIUpdate", boundarySync);
  win.addEventListener("ZenWorkspaceDataChanged", boundarySync);
  win.addEventListener("resize", onResize);
  win.addEventListener("close", markWindowClosing);
  win.addEventListener("SSWindowClosing", markWindowClosing);
  doc.addEventListener("mousedown", outside, true);
  for (const name of ["TabSelect", "TabClose", "TabAttrModified", "ZenTabRemovedFromSplit", "ZenSplitViewTabsSplit"]) browser.tabContainer.addEventListener(name, tabChanged);
  win.addEventListener('SSWindowStateReady', boundarySync);
  browser.tabContainer.addEventListener('SSTabRestored', boundarySync);
  browser.tabContainer.addEventListener('TabShow', boundarySync);
  const shutdownObserver = {observe() {persistence.save();}};
  win.Services?.obs?.addObserver(shutdownObserver, "quit-application-granted");
  win.addEventListener("mouseup", saveSplitLayoutIfChanged);
  sync();
  return {
    add, join, unsplit, arrange, openMenu, closeMenu, clearFloat, sync, origins, accordionStep, scrollStep,
    capturePresentation, restorePresentation,
    get floatingTabs() { return [...floats.keys()]; },
    destroy(options = {}) {
      if (disposed) return;
      const {detachOnly = false} = options ?? {};
      const preserveSession = Boolean(origins.shuttingDown || win.closed || windowClosing);
      if (!detachOnly) {
        if (preserveSession) persistence.save();
        else persistence.clear({preserveHidden:true});
      }
      win.Services?.obs?.removeObserver(shutdownObserver, "quit-application-granted");
      win.removeEventListener("mouseup", saveSplitLayoutIfChanged);
      disposed = true; if (frame) win.cancelAnimationFrame(frame);
      closeMenu();
      hideEdgeHint();
      if (!detachOnly) {
        for (const data of [...accordions.keys()]) clearAccordion(data, true, preserveSession);
        for (const data of [...scrollings.keys()]) clearScrolling(data, true, preserveSession);
        clearFloat(true,null,preserveSession);
      }
      // A stale runtime must only unplug callbacks. Its old presentation DOM is
      // safer left alone because the live owner may be using the same split data.
      origins.destroy({detachOnly});
      if (session && !preserveSession && !detachOnly) {
        for (const tab of browser.tabs) if (!tab.closing) session.deleteCustomTabValue(tab,floatingKey);
      }
      win.removeEventListener("keydown", onScrollingModifier, true);
      win.removeEventListener("keyup", onScrollingModifier, true);
      win.removeEventListener("blur", onScrollingModifier);
      win.removeEventListener("wheel", onScrollingWheel, true);
      win.removeEventListener('SSWindowStateReady', boundarySync);
      browser.tabContainer.removeEventListener('SSTabRestored', boundarySync);
      browser.tabContainer.removeEventListener('TabShow', boundarySync);
      win.removeEventListener("ZenViewSplitter:SplitViewActivated", eventSync);
      win.removeEventListener("ZenWorkspacesUIUpdate", boundarySync);
      win.removeEventListener("ZenWorkspaceDataChanged", boundarySync);
      win.removeEventListener("resize", onResize);
      win.removeEventListener("close", markWindowClosing);
      win.removeEventListener("SSWindowClosing", markWindowClosing);
      win.removeEventListener("keydown", onAccordionShortcut, true);
      win.removeEventListener("blur", hideEdgeHint);
      reducedMotion?.removeEventListener('change', motionChanged);
      doc.removeEventListener("mousedown", outside, true);
      for (const name of ["TabSelect", "TabClose", "TabAttrModified", "ZenTabRemovedFromSplit", "ZenSplitViewTabsSplit"]) browser.tabContainer.removeEventListener(name, tabChanged);
    },
  };
}
