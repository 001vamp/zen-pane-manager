// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/
const KEY = 'pane-split-v1';
const MAX_RETRIES = 3;
const INVALID = Symbol('invalid-split-record');

// Only JSON values cross SessionStore; native nodes and parent links stay in memory.
export function encodeTree(node, tabs) {
  const saved = {};
  if (Number.isFinite(node.sizeInParent)) saved.sizeInParent = node.sizeInParent;
  if (typeof node.direction === 'string') saved.direction = node.direction;
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
  const groups = new WeakMap(), restored = new Set(), deferred = new Map();
  let needsRestoreScan = true, lastLayoutState = "";
  const live = tab => tab && tab.isConnected && !tab.closing;
  const parseRecord = raw => {
    try { return JSON.parse(raw); } catch { return INVALID; }
  };
  const validRecord = record => record?.version === 1 && typeof record.group === 'string' && Number.isInteger(record.count) && record.count >= 2 && record.count <= view.MAX_TABS && Number.isInteger(record.index) && record.index >= 0 && record.index < record.count && ['vsep','hsep','grid'].includes(record.type);
  function scanRecords() {
    const records = [];
    if (!session) return records;
    for (const tab of browser.tabs) {
      if (!live(tab)) continue;
      const raw = session.getCustomTabValue(tab, KEY);
      if (raw) records.push({tab, raw, record:parseRecord(raw)});
    }
    return records;
  }
  function pendingProtectedGroups(records) {
    const pending = new Map();
    for (const {tab, record} of records) {
      if (record === INVALID || !validRecord(record) || restored.has(record.group)) continue;
      const entries = pending.get(record.group) ?? [];
      entries.push({tab, record}); pending.set(record.group, entries);
    }
    const protectedGroups = new Set();
    for (const [group, entries] of pending) {
      const count = entries[0].record.count;
      const slots = new Set(entries.map(entry => entry.record.index));
      if (entries.some(entry => entry.tab.hidden) || deferred.has(group) || (entries.length === count && slots.size === count && entries.every(entry => entry.record.count === count))) protectedGroups.add(group);
    }
    return protectedGroups;
  }
  function layoutState() {
    try {
      return JSON.stringify(view._data.map(data => {
        const tabs = data.tabs.filter(live);
        return {tabs:tabs.map(tab => browser.tabs.indexOf(tab)), type:data.gridType, tree:encodeTree(data.layoutTree, tabs)};
      }));
    } catch {
      return "";
    }
  }
  function save(records = scanRecords(), state = layoutState()) {
    if (!session || view._sessionRestoring) return;
    const members = new Set(), pending = pendingProtectedGroups(records), raw = new Map(records.map(entry => [entry.tab, entry.raw]));
    for (const data of view._data) {
      const tabs = data.tabs.filter(live);
      if (tabs.length < 2) continue;
      let group = groups.get(data);
      if (!group) {group = win.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; groups.set(data, group);}
      restored.add(group);
      const record = {version:1, group, count:tabs.length, type:data.gridType, tree:encodeTree(data.layoutTree, tabs)};
      tabs.forEach((tab, index) => {
        members.add(tab);
        const value = JSON.stringify({...record, index});
        if (raw.get(tab) !== value) session.setCustomTabValue(tab, KEY, value);
      });
    }
    for (const {tab, record} of records) {
      if (members.has(tab)) continue;
      if (record === INVALID) {session.deleteCustomTabValue(tab, KEY); continue;}
      if (validRecord(record) && pending.has(record.group)) continue;
      session.deleteCustomTabValue(tab, KEY);
    }
    lastLayoutState = state;
  }
  function restore({retryDeferred = false, records = scanRecords()} = {}) {
    if (!session || view._sessionRestoring) return;
    const pending = new Map();
    for (const {tab, record} of records) {
      if (record === INVALID) {session.deleteCustomTabValue(tab, KEY); continue;}
      if (!validRecord(record)) {
        session.deleteCustomTabValue(tab, KEY); continue;
      }
      if (restored.has(record.group)) continue;
      const entries = pending.get(record.group) ?? [];
      entries.push({tab, record}); pending.set(record.group, entries);
    }
    for (const [group, entries] of pending) {
      const attempts = deferred.get(group) ?? 0;
      if (attempts && (!retryDeferred || attempts >= MAX_RETRIES)) continue;
      const record = entries[0].record, tabs = Array(record.count).fill(null);
      for (const entry of entries) tabs[entry.record.index] = entry.tab;
      const members = tabs.filter(Boolean);
      if (members.length < 2) continue;
      let data = view._data.find(data => members.every(tab => data.tabs.includes(tab)) && data.tabs.length === members.length);
      if (data) {
        groups.set(data, group); restored.add(group); deferred.delete(group);
        if (data.tabs.includes(browser.selectedTab) && view._data[view.currentView] !== data) view.activateSplitView(data, true);
        continue;
      }
      // Do not steal tabs from a different native group.
      if (members.some(tab => view._data.some(data => data.tabs.includes(tab))) || members.some(tab => tab.hidden)) {
        deferred.set(group, attempts); continue;
      }
      const prototypes = {};
      const inspect = node => {
        prototypes[node.children ? "branch" : "leaf"] = Object.getPrototypeOf(node);
        node.children?.forEach(inspect);
      };
      inspect(view.calculateLayoutTree(members, record.type));
      const tree = decodeTree(record.tree, tabs, null, prototypes);
      if (!tree) continue;
      if (!data) {
        origins.begin(members);
        try {data = view.splitTabs(members, record.type, -1, {activate:false});} catch (error) {data = null;} finally {origins.end();}
      }
      if (!data) {deferred.set(group, attempts + 1); continue;}
      data.tabs = members; data.gridType = record.type; data.layoutTree = tree; groups.set(data, group);
      const map = node => node.children ? node.children.forEach(map) : view._tabToSplitNode.set(node.tab, node);
      map(tree);
      if (data.tabs.includes(browser.selectedTab)) view.activateSplitView(data, true);
      if (view._data[view.currentView] === data) {view.removeSplitters(); view.applyGridLayout(tree);}
      restored.add(group); deferred.delete(group);
    }
    needsRestoreScan = false;
  }
  function sync({retryDeferred = false} = {}) {
    const state = layoutState();
    const shouldRestore = needsRestoreScan || (retryDeferred && deferred.size);
    if (!shouldRestore && state === lastLayoutState) return;
    const records = scanRecords();
    if (shouldRestore) restore({retryDeferred, records});
    save(records, layoutState());
  }
  function saveIfChanged() {
    const state = layoutState();
    if (state !== lastLayoutState) save(scanRecords(), state);
  }
  function clear() {
    if (!session) return;
    for (const {tab} of scanRecords()) session.deleteCustomTabValue(tab, KEY);
    lastLayoutState = layoutState();
  }
  return {save, saveIfChanged, restore, sync, clear};
}
