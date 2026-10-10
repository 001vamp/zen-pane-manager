// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/

import { modeLabels } from "./layout-modes.mjs?pane=0.11.0-picker";

// These are the same rows the layout menu shows. The picker hub will reuse
// this list later so both surfaces stay in sync.

const DESCRIPTIONS = {
  right: "Place beside the other tabs",
  below: "Place below the other tabs",
  grid: "Arrange with other split tabs",
  float: "Move and resize this tab",
  accordion: "Expand one tab and switch from the side strips",
  scrolling: "Hold the modifier to reveal and scroll through tabs",
  tiles: "Bring back your previous divider sizes",
  normal: "Keep this tab open and stay on the remaining split",
  reset: "Clear custom scrolling column widths",
  add: "Pick another open tab to add beside this one",
};

function row(mode, label, extra) {
  return {
    mode,
    label,
    description: DESCRIPTIONS[mode],
    current: extra.currentMode === mode,
    needsDestination: extra.needsDestination,
  };
}

// groupSize is how many tabs are already in this split. 1 means a solo tab.
// presentation is "accordion" or "scrolling" when that wrapper is on, else null.
export function arrangeOptions({ groupSize = 1, currentMode = null, presentation = null } = {}) {
  const size = Number(groupSize) || 1;
  const extra = { currentMode };
  // A true solo tab still needs a second page before any split can exist.
  const needsPartner = size < 2;
  // Zen's grid wants three tabs. Two panes still have to pick a third.
  const needsGridPartner = size < 3;

  const options = [
    row("right", "Split right", { ...extra, needsDestination: needsPartner }),
    row("below", "Split below", { ...extra, needsDestination: needsPartner }),
    row("grid", "Grid", { ...extra, needsDestination: needsGridPartner }),
  ];

  if (size >= 2) {
    options.push(
      row("scrolling", modeLabels.scrolling, { ...extra, needsDestination: false }),
      row("accordion", modeLabels.accordion, { ...extra, needsDestination: false }),
    );
    if (presentation === "accordion" || presentation === "scrolling") {
      options.push(row("tiles", "Restore tiled layout", { ...extra, needsDestination: false }));
    }
  }

  options.push(row("float", "Floating", { ...extra, needsDestination: needsPartner }));

  // Returning to a normal tab only makes sense when there is a split to leave.
  if (size >= 2) {
    options.push(row("normal", "Return to a normal tab", { ...extra, needsDestination: false }));
  }

  if (presentation === "scrolling") {
    options.push(row("reset", "Reset all column widths", { ...extra, needsDestination: false }));
  }

  options.push(row("add", "Add another tab…", { ...extra, needsDestination: true }));
  return options;
}
