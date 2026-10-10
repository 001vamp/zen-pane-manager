// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/

// Copy an in-memory layout snapshot. This is not the SessionStore format.

export function clonePresentation(value) {
  return {
    selected: value.selected,
    floating: (value.floating ?? []).map(record => ({
      tab: record.tab,
      rect: record.rect ? { ...record.rect } : record.rect,
      headerPinned: record.headerPinned,
    })),
    scrolling: value.scrolling && { widths: new Map(value.scrolling.widths) },
    accordion: value.accordion,
  };
}

// A finished swap always selects the incoming tab, even if someone else was selected.
export function remapPresentation(value, outgoing, incoming) {
  const next = clonePresentation(value);
  next.selected = incoming;
  for (const record of next.floating) if (record.tab === outgoing) record.tab = incoming;
  if (next.accordion === outgoing) next.accordion = incoming;
  if (next.scrolling?.widths.has(outgoing)) {
    next.scrolling.widths.set(incoming, next.scrolling.widths.get(outgoing));
    next.scrolling.widths.delete(outgoing);
  }
  return next;
}
