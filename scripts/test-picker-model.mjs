import assert from "node:assert/strict";
import { eligibleDestinations, filterDestinations, defaultMode, activatePlan } from "../picker-model.mjs";

const tab = (id, extra = {}) => ({
  id,
  title: extra.title ?? id,
  url: extra.url ?? `${id}.example`,
  lastUsed: extra.lastUsed ?? 0,
  splitView: extra.splitView ?? false,
  closing: extra.closing ?? false,
  hidden: extra.hidden ?? false,
  supported: extra.supported ?? true,
  connected: extra.connected ?? true,
});

const target = tab("here", { lastUsed: 50 });
const notes = tab("notes", { title: "Notes", url: "notes.local", lastUsed: 30 });
const docs = tab("docs", { title: "Docs", url: "docs.local", lastUsed: 10 });
const old = tab("old", { title: "Old tab", lastUsed: 1 });

{
  const listed = eligibleDestinations({
    target,
    currentGroupTabs: [],
    tabs: [target, notes, docs, old],
    groups: [],
    recentFirst: true,
  });
  assert.deepEqual(listed.map(row => row.id), ["notes", "docs", "old"]);
  assert.ok(listed.every(row => row.kind === "tab"));
}

{
  const listed = eligibleDestinations({
    target,
    currentGroupTabs: [],
    tabs: [notes, docs, old],
    groups: [],
    recentFirst: false,
  });
  assert.deepEqual(listed.map(row => row.id), ["notes", "docs", "old"], "recentFirst false keeps caller order");
}

{
  const group = { tabs: [tab("a"), tab("b")] };
  const otherSplitTab = tab("a", { splitView: true });
  const listed = eligibleDestinations({
    target,
    currentGroupTabs: [],
    tabs: [notes, otherSplitTab],
    groups: [group],
    recentFirst: true,
  });
  assert.equal(listed[0].kind, "split");
  assert.equal(listed[0].group, group);
  assert.equal(listed.some(row => row.id === "a"), false, "tabs already in another split are not listed as tabs");
  assert.deepEqual(listed.filter(row => row.kind === "tab").map(row => row.id), ["notes"]);
}

{
  const listed = eligibleDestinations({
    target: tab("here", { splitView: true }),
    currentGroupTabs: [tab("here", { splitView: true }), tab("mate")],
    tabs: [notes, tab("a", { splitView: true })],
    groups: [{ tabs: [tab("a"), tab("b")] }],
    recentFirst: true,
  });
  assert.equal(listed.some(row => row.kind === "split"), false, "in-split hides other group cards");
  assert.deepEqual(listed.map(row => row.id), ["notes"]);
}

{
  const listed = eligibleDestinations({
    target: tab("here"),
    currentGroupTabs: [tab("here"), tab("mate")],
    tabs: [notes],
    groups: [{ tabs: [tab("a"), tab("b")] }],
    recentFirst: true,
  });
  assert.equal(listed.some(row => row.kind === "split"), false, "currentGroupTabs alone means in-split even if splitView is stale");
}

{
  const mate = tab("mate");
  const listed = eligibleDestinations({
    target,
    currentGroupTabs: [target, mate],
    tabs: [notes, mate],
    groups: [],
    recentFirst: true,
  });
  assert.deepEqual(listed.map(row => row.id), ["notes"], "tabs already in this split are excluded");
}

{
  const listed = eligibleDestinations({
    target,
    currentGroupTabs: [],
    tabs: [
      notes,
      tab("gone", { closing: true }),
      tab("hid", { hidden: true }),
      tab("empty", { supported: false }),
    ],
    groups: [
      { tabs: [tab("only")] },
      { tabs: [tab("x", { closing: true }), tab("y")] },
      { tabs: [tab("here"), tab("other")] },
      { tabs: [tab("ok"), tab("also")] },
    ],
    recentFirst: true,
  });
  assert.deepEqual(listed.filter(row => row.kind === "tab").map(row => row.id), ["notes"]);
  assert.deepEqual(
    listed.filter(row => row.kind === "split").map(row => row.tabs.map(member => member.id)),
    [["ok", "also"]],
    "tiny, closing, or self-including groups are dropped"
  );
}

{
  const listed = eligibleDestinations({
    target,
    currentGroupTabs: [],
    tabs: [tab("other-ws")],
    groups: [],
    recentFirst: true,
  });
  assert.equal(listed.length, 1, "workspace filtering is the caller's job; the model keeps handed-in tabs");
}

assert.equal(defaultMode({ inSplit: true }), "replace");
assert.equal(defaultMode({ inSplit: false }), "right");

const hits = filterDestinations([
  { kind: "tab", title: "Notes", url: "notes.local" },
  { kind: "tab", title: "Grid notes", url: "wiki" },
  { kind: "split", tabs: [{ title: "Alpha", url: "a.test" }, { title: "Beta", url: "b.test" }] },
], "notes");
assert.deepEqual(hits.map(row => row.title ?? "split"), ["Notes", "Grid notes"]);

assert.equal(filterDestinations([{ kind: "tab", title: "Notes", url: "" }], "  ").length, 1, "blank query keeps every row");
assert.equal(filterDestinations([{ kind: "split", tabs: [{ title: "Alpha", url: "host" }] }], "HOST").length, 1);
assert.equal(filterDestinations([{ kind: "tab", title: "Notes", url: "" }], "zzz").length, 0);

assert.deepEqual(activatePlan({ kind: "split", mode: "float" }), { op: "join", mode: "float" });
assert.deepEqual(activatePlan({ kind: "split", mode: "grid" }), { op: "join", mode: "grid" });
assert.deepEqual(activatePlan({ kind: "split", mode: "replace" }), { op: "join", mode: "grid" }, "Replace on a split card is add-to-grid");
assert.deepEqual(activatePlan({ kind: "split", mode: "below" }), { op: "join", mode: "below" });
assert.deepEqual(activatePlan({ kind: "split", mode: "snapshot" }), { op: "join", mode: "scrolling" });
assert.deepEqual(activatePlan({ kind: "tab", mode: "replace" }), { op: "replace", mode: "replace" });
assert.deepEqual(activatePlan({ kind: "tab", mode: "right" }), { op: "add", mode: "right" });
assert.deepEqual(activatePlan({ kind: "tab", mode: "snapshot" }), { op: "add", mode: "scrolling" });
assert.ok(!("shiftKey" in activatePlan({ kind: "split", mode: "float" })));

assert.equal(globalThis.gBrowser, undefined, "picker-model fixtures never touch gBrowser");
assert.equal(globalThis.Services, undefined, "picker-model fixtures never touch Services");

console.log("Picker model: eligibility, filter, default mode, and activatePlan passed.");
