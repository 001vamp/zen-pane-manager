// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/
const KEY = 'pane-split-v1';

// Only JSON values cross SessionStore; native nodes and parent links stay in memory.
export function encodeTree(node, tabs) {
  const saved = {};
  for (const [key, value] of Object.entries(node)) {
    if (['tab', 'children', 'parent'].includes(key)) continue;
    if (value === null || ['string', 'boolean'].includes(typeof value) || Number.isFinite(value)) saved[key] = value;
  }
  if (node.children) saved.children = node.children.map(child => encodeTree(child, tabs));
  else saved.tab = tabs.indexOf(node.tab);
  return saved;
}
export function decodeTree(saved, tabs, parent = null, prototypes = {}) {
  if (!saved || typeof saved !== 'object') return null;
  const node = Object.assign(Object.create((saved.children ? prototypes.branch : prototypes.leaf) ?? Object.prototype), saved, {parent});
  if (Array.isArray(saved.children)) {
    node.children = saved.children.map(child => decodeTree(child, tabs, node, prototypes)).filter(Boolean);
    if (!node.children.length) return null;
    if (node.children.length !== saved.children.length) {
      const total = node.children.reduce((sum, child) => sum + child.sizeInParent, 0);
      if (total > 0) node.children.forEach(child => child.sizeInParent *= 100 / total);
    }
    if (node.children.length === 1) {
      const child = node.children[0]; child.parent = parent;
      if (node.sizeInParent !== undefined) child.sizeInParent = node.sizeInParent;
      return child;
    }
  } else {
    node.tab = Number.isInteger(saved.tab) ? tabs[saved.tab] : null;
    if (!node.tab) return null;
  }
  return node;
}

export function createSplitPersistence(win, origins) {
  const {SessionStore: session, gBrowser: browser, gZenViewSplitter: view} = win;
  const groups = new WeakMap(), restored = new Set();
  const live = tab => tab && tab.isConnected && !tab.closing;
  function save() {
    if (!session || view._sessionRestoring) return;
    const members = new Set();
    for (const data of view._data) {
      const tabs = data.tabs.filter(live);
      if (tabs.length < 2) continue;
      let group = groups.get(data);
      if (!group) {group = win.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; groups.set(data, group);}
      restored.add(group);
      const record = {version:1, group, count:tabs.length, type:data.gridType, tree:encodeTree(data.layoutTree, tabs)};
      tabs.forEach((tab, index) => {
        members.add(tab);
        const value = JSON.stringify({...record, index, focused:tab === browser.selectedTab});
        if (session.getCustomTabValue(tab, KEY) !== value) session.setCustomTabValue(tab, KEY, value);
      });
    }
    for (const tab of browser.tabs) if (live(tab) && !members.has(tab)) session.deleteCustomTabValue(tab, KEY);
  }
  function restore() {
    if (!session || view._sessionRestoring) return;
    const pending = new Map();
    for (const tab of browser.tabs) {
      if (!live(tab)) continue;
      let record;
      try {record = JSON.parse(session.getCustomTabValue(tab, KEY) || 'null');} catch {record = null;}
      if (!record) continue;
      if (record.version !== 1 || typeof record.group !== 'string' || !Number.isInteger(record.count) || record.count < 2 || record.count > view.MAX_TABS || !Number.isInteger(record.index) || record.index < 0 || record.index >= record.count || !['vsep','hsep','grid'].includes(record.type)) {
        session.deleteCustomTabValue(tab, KEY); continue;
      }
      if (restored.has(record.group)) continue;
      const entries = pending.get(record.group) ?? [];
      entries.push({tab, record}); pending.set(record.group, entries);
    }
    for (const [group, entries] of pending) {
      const record = entries[0].record, tabs = Array(record.count).fill(null);
      for (const entry of entries) tabs[entry.record.index] = entry.tab;
      const members = tabs.filter(Boolean);
      const prototypes = {};
      if (members.length >= 2) {
        const inspect = node => {
          prototypes[node.children ? "branch" : "leaf"] = Object.getPrototypeOf(node);
          node.children?.forEach(inspect);
        };
        inspect(view.calculateLayoutTree(members, record.type));
      }
      const tree = decodeTree(record.tree, tabs, null, prototypes);
      restored.add(group);
      if (members.length < 2 || !tree) continue;
      let data = view._data.find(data => members.every(tab => data.tabs.includes(tab)) && data.tabs.length === members.length);
      // Do not steal tabs from a different, already restored native group.
      if (!data && members.some(tab => view._data.some(data => data.tabs.includes(tab)))) continue;
      if (!data) {
        origins.begin(members);
        try {data = view.splitTabs(members, record.type, -1, {activate:false});} finally {origins.end();}
      }
      if (!data) continue;
      data.tabs = members; data.gridType = record.type; data.layoutTree = tree; groups.set(data, group);
      const map = node => node.children ? node.children.forEach(map) : view._tabToSplitNode.set(node.tab, node);
      map(tree);
      const focused = entries.find(entry => entry.record.focused)?.tab ?? (members.includes(browser.selectedTab) ? browser.selectedTab : null);
      if (focused) {view.activateSplitView(data); browser.selectedTab = focused;}
      if (view._data[view.currentView] === data) {view.removeSplitters(); view.applyGridLayout(tree);}
    }
  }
  return {save, restore};
}
