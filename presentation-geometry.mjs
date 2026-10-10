// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/

// Pure size math. No rounding. Native split ratios stay in the controller.

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

export const scrollingColumnWidth = (viewport, value) => Math.min(viewport, Math.max(Math.min(320, viewport), value));

export function scrollingSizes(viewport, percent, savedWidths) {
  const width = Math.min(viewport, Math.max(320, viewport * Math.max(30, Math.min(100, percent)) / 100));
  const widths = savedWidths.map(value => scrollingColumnWidth(viewport, value ?? width));
  let total = 0;
  const positions = widths.map(value => { const left = total; total += value + 10; return left; });
  return {viewport, width, widths, positions, max:Math.max(0, total - 10 - viewport)};
}

// Same card the preview highlights and the one that opens on release.
export function landingIndex(geometry, offset) {
  const center = offset + geometry.viewport / 2;
  let nearest = 0, distance = Infinity;
  geometry.positions.forEach((left, index) => {
    const d = Math.abs(left + geometry.widths[index] / 2 - center);
    if (d < distance) { nearest = index; distance = d; }
  });
  return nearest;
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
