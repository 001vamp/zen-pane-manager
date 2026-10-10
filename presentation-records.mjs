// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/

// Turn saved SessionStore strings into values, and back. No prefs, DOM, or Zen.

const parseRecord = raw => {
  try { return JSON.parse(raw || "null"); } catch { return null; }
};

/** @typedef {{kind:'missing'}|{kind:'invalid'}|{kind:'valid', value:object}} Decoded */

// Missing / empty / JSON null means "nothing saved". Bad JSON is deleted by the caller.
export function decodeFloat(raw) {
  if (!raw) return { kind: "missing" };
  let record;
  try { record = JSON.parse(raw); } catch { return { kind: "invalid" }; }
  if (!record) return { kind: "missing" };
  const valid = record.version === 1 && record.rect && ["x", "y", "width", "height"].every(key => Number.isFinite(record.rect[key])) && record.rect.width > 0 && record.rect.height > 0;
  if (!valid) return { kind: "invalid" };
  return { kind: "valid", value: { rect: record.rect, headerPinned: record.headerPinned === true } };
}

// Keep this key order. SessionStore skips the write when the string did not change.
export function encodeFloat(value) {
  return JSON.stringify({ version: 1, rect: value.rect, headerPinned: Boolean(value.headerPinned) });
}

export function encodeAccordion(group, active) {
  return JSON.stringify({ group, active: Boolean(active) });
}

export function encodeScrolling(group, active, width) {
  return JSON.stringify({ group, active: Boolean(active), mode: "scrolling", width: width ?? null });
}

// Bad or mixed groups skip recovery. First truthy `active` wins; else tab 0.
export function decodeAccordionGroup(raws) {
  const saved = [...raws].map(parseRecord);
  if (!saved.every(record => typeof record?.group === "string" && record.group === saved[0]?.group)) return null;
  const activeIndex = saved.findIndex(record => record.active);
  return { group: saved[0].group, activeIndex: activeIndex >= 0 ? activeIndex : 0 };
}

// Stored `active` is ignored. Old snapshot records still count as scrolling.
export function decodeScrollingGroup(raws) {
  const saved = [...raws].map(parseRecord);
  if (!saved.every(record => typeof record?.group === "string" && record.group === saved[0]?.group)) return null;
  return {
    group: saved[0].group,
    widths: saved.map(record => Number.isFinite(record.width) && record.width > 0 ? record.width : null),
  };
}
