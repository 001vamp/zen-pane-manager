// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/
const KEY = 'pane-original-tab-v1';
const attributes = ['zen-essential', 'zen-workspace-id', 'zenDefaultUserContextId', 'zen-pinned-id', 'zen-pinned-url', 'zen-live-folder-item-id'];

// Save only placement metadata, never page contents. SessionStore keeps this
// alongside the tab so restoration also works after a browser restart.
export function createTabOrigins(win) {
  const { gBrowser: browser, gZenViewSplitter: view, document: doc } = win;
  const records = new Map();
  const proxies = new Map();
  let timer = 0, busy = 0, disposed = false, shuttingDown = false;
  const inSplit = tab => view._data.some(data => data.tabs.includes(tab));
  function remember(tab) {
    if (records.has(tab)) return records.get(tab);
    const parent = tab.parentElement;
    const state = { version: 1, pinned: tab.pinned, attributes: Object.fromEntries(attributes.map(k => [k, tab.getAttribute(k)])),
      parentId: parent?.hasAttribute("split-view-group") ? null : parent?.id || null,
      groupId: tab.group?.hasAttribute("split-view-group") ? null : tab.group?.id || null,
      index: parent ? [...parent.children].indexOf(tab) : 0, elementIndex: tab.elementIndex };
    win.SessionStore.setCustomTabValue(tab, KEY, JSON.stringify(state));
    records.set(tab, state);
    return state;
  }
  function proxy(tab, state) {
    if (!state.attributes['zen-essential'] || proxies.has(tab)) return;
    const section = win.gZenWorkspaces.getEssentialsSection(tab);
    const button = doc.createElementNS('http://www.w3.org/1999/xhtml', 'button');
    button.className = 'pane-essential-link';
    button.title = tab.label; button.setAttribute('aria-label', `Show split: ${tab.label}`);
    const img = doc.createElementNS(button.namespaceURI, 'img');
    img.alt = ''; img.src = tab.getAttribute('image') || 'chrome://global/skin/icons/defaultFavicon.svg';
    button.append(img);
    button.addEventListener('click', async () => {
      try {
      const workspace = tab.getAttribute('zen-workspace-id');
      if (workspace && workspace !== win.gZenWorkspaces.activeWorkspace) await win.gZenWorkspaces.changeWorkspaceWithID(workspace);
      if (!tab.isConnected || tab.closing) return;
      browser.selectedTab = tab;
      tab.linkedBrowser.focus();
      } catch (error) { console.error("[Pane] Could not focus Essential split", error); }
    });
    section.insertBefore(button, section.children[state.index] || null);
    proxies.set(tab, button);
  }
  function prepare(tabs) {
    // Snapshot the entire set before any pin operation moves its neighbors.
    tabs.forEach(remember);
    const pinned = tabs.some(tab => tab.pinned);
    for (const tab of tabs) {
      const state = records.get(tab);
      if (tab.hasAttribute('zen-essential')) {
        win.gZenPinnedTabManager.removeEssentials(tab, false);
        proxy(tab, state);
      }
      // Live-folder membership is restored on exit, without cloning the page.
      tab.removeAttribute('zen-live-folder-item-id');
      if (pinned && !tab.pinned) browser.pinTab(tab);
    }
  }
  function restore(tab, state) {
    if (tab.closing || !tab.isConnected) { forget(tab); return; }
    if (tab.group?.hasAttribute('split-view-group')) browser.ungroupTab(tab);
    if (tab.pinned !== state.pinned) state.pinned ? browser.pinTab(tab) : browser.unpinTab(tab);
    for (const [key, value] of Object.entries(state.attributes)) {
      if (value === null) tab.removeAttribute(key); else tab.setAttribute(key, value);
    }
    proxies.get(tab)?.remove(); proxies.delete(tab);
    let parent = state.parentId && doc.getElementById(state.parentId);
    const group = state.groupId && doc.getElementById(state.groupId);
    if (state.attributes['zen-essential']) parent = win.gZenWorkspaces.getEssentialsSection(tab);
    else if (group?.isConnected) {
      browser.moveTabToExistingGroup(tab, group);
      parent = tab.parentElement;
    }
    if (!parent?.isConnected) {
      const section = state.pinned ? '.zen-workspace-pinned-tabs-section' : '.zen-workspace-normal-tabs-section';
      parent = [...doc.querySelectorAll(section)].find(n => n.getAttribute('zen-workspace-id') === state.attributes['zen-workspace-id']) || tab.parentElement;
    }
    if (parent?.isConnected) {
      browser.zenHandleTabMove(tab, () => {
        const siblings = [...parent.children].filter(n => n !== tab);
        parent.insertBefore(tab, siblings[state.index] || null);
      });
    }
    if (state.attributes['zen-essential']) win.gZenPinnedTabManager.onTabIconChanged(tab);
    forget(tab);
  }
  function forget(tab) {
    proxies.get(tab)?.remove(); proxies.delete(tab); records.delete(tab);
    if (tab.isConnected && !tab.closing) win.SessionStore.deleteCustomTabValue(tab, KEY);
  }
  function reconcile() {
    if (disposed || busy) return;
    if (view._sessionRestoring) { schedule(); return; }
    for (const [tab, state] of [...records].sort((a, b) => a[1].index - b[1].index)) {
      if (!inSplit(tab) || tab.closing || !tab.isConnected) restore(tab, state);
      else {
        proxy(tab, state);
        const link = proxies.get(tab);
        if (link) { link.title = tab.label; link.setAttribute('aria-label', `Show split: ${tab.label}`); }
      }
    }
  }
  function schedule() {
    win.clearTimeout(timer);
    timer = win.setTimeout(reconcile, 100);
  }
  function begin(tabs) { busy++; try { prepare(tabs); } catch (e) { busy--; reconcile(); throw e; } }
  function end() { busy = Math.max(0, busy - 1); reconcile(); }
  function recover() {
    for (const tab of browser.tabs) {
      if (records.has(tab)) continue;
      const raw = win.SessionStore.getCustomTabValue(tab, KEY);
      if (!raw) continue;
      try {
        const state = JSON.parse(raw);
        if (state.version === 1 && state.attributes && typeof state.pinned === 'boolean') records.set(tab, state);
      } catch (e) { console.error('[Pane] Invalid saved tab placement', e.name); }
    }
    schedule();
  }
  const shutdownObserver = { observe() { shuttingDown = true; } };
  const events = ['TabClose', 'TabAttrModified', 'ZenTabRemovedFromSplit', 'ZenSplitViewTabsSplit'];
  for (const name of events) browser.tabContainer.addEventListener(name, schedule);
  win.addEventListener('SSWindowStateReady', recover);
  browser.tabContainer.addEventListener('SSTabRestored', recover);
  win.Services.obs.addObserver(shutdownObserver, 'quit-application-granted');
  recover();
  return { begin, end, reconcile, get shuttingDown() {return shuttingDown || win.closed;},
    destroy() {
      win.clearTimeout(timer);
      for (const name of events) browser.tabContainer.removeEventListener(name, schedule);
      win.removeEventListener('SSWindowStateReady', recover);
      browser.tabContainer.removeEventListener('SSTabRestored', recover);
      win.Services.obs.removeObserver(shutdownObserver, 'quit-application-granted');
      // A real browser shutdown keeps records for SessionStore recovery.
      // Disabling or reloading Pane restores every tracked tab immediately.
      if (!shuttingDown && !win.closed) {
        for (const data of [...view._data]) {
          if (data.tabs.some(tab => records.has(tab))) {
            while (view._data.includes(data) && data.tabs.length) view.removeTabFromGroup(data.tabs[0], undefined, { forUnsplit: true });
          }
        }
        reconcile();
      }
      disposed = true;
      for (const link of proxies.values()) link.remove();
      proxies.clear();
    },
  };
}
