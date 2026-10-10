// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/

import { normalizeMode } from "./layout-modes.mjs?pane=0.11.0-picker";
export { arrangeOptions } from "./layout-options.mjs?pane=0.11.0-picker";

// Pure picker rules. Callers hand in plain records. Nothing here reads Zen.

const sameTab = (a, b) => Boolean(a && b && (a.id === b.id || (a.ref != null && a.ref === b.ref)));

const idSet = tabs => new Set((tabs ?? []).map(tab => tab?.id).filter(id => id != null));

const usableTab = tab => Boolean(tab)
  && !tab.closing
  && !tab.hidden
  && tab.supported !== false
  && tab.splitView !== true;

const usableGroupMember = tab => Boolean(tab) && !tab.closing && tab.connected !== false;

function destinationSearchText(item) {
  if (item?.kind === "split") {
    return (item.tabs ?? []).map(tab => `${tab.title ?? ""} ${tab.url ?? ""}`).join(" ");
  }
  return `${item?.title ?? ""} ${item?.url ?? ""}`;
}

// Build the mixed list: other splits first (solo tab only), then open tabs.
export function eligibleDestinations({
  target,
  currentGroupTabs = [],
  tabs = [],
  groups = [],
  recentFirst = true,
} = {}) {
  const inSplit = Boolean(target?.splitView) || currentGroupTabs.length > 0;
  const currentIds = idSet(currentGroupTabs);
  const listed = (tabs ?? []).filter(tab =>
    usableTab(tab)
    && !sameTab(tab, target)
    && !currentIds.has(tab.id)
  );
  if (recentFirst) listed.sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0));

  const splitRows = inSplit ? [] : (groups ?? []).filter(group => {
    const members = group?.tabs ?? [];
    return members.length >= 2
      && !members.some(tab => sameTab(tab, target))
      && members.every(usableGroupMember);
  }).map(group => ({ kind: "split", group, tabs: group.tabs }));

  return [...splitRows, ...listed.map(tab => ({ kind: "tab", ...tab }))];
}

// Substring match on title + host. Empty / blank queries keep every row.
export function filterDestinations(list, query) {
  const needle = String(query ?? "").trim().toLocaleLowerCase();
  if (!needle) return [...(list ?? [])];
  return (list ?? []).filter(item => destinationSearchText(item).toLocaleLowerCase().includes(needle));
}

export function defaultMode({ inSplit } = {}) {
  return inSplit ? "replace" : "right";
}

// Decide the controller call without touching Zen. No shiftKey here.
// Today's split-card Replace is Add-to-grid because join() has no replace op.
export function activatePlan({ kind, mode } = {}) {
  mode = normalizeMode(mode);
  if (kind === "split") {
    return { op: "join", mode: mode === "replace" ? "grid" : mode };
  }
  if (mode === "replace") return { op: "replace", mode: "replace" };
  return { op: "add", mode };
}
