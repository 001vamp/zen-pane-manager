// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/

// Names people see, plus the ids saved with a split. Nothing here talks to Zen.

export const layoutTypes = { right: "vsep", below: "hsep", grid: "grid" };
export const presentationModes = ["accordion", "scrolling"];
export const modeLabels = { replace: "Replace", right: "Split right", below: "Split below", grid: "Add to grid", float: "Floating", accordion: "Horizontal accordion", scrolling: "Scrolling" };

// Old "snapshot" choices become "scrolling" before anything else runs.
export const normalizeMode = mode => mode === "snapshot" ? "scrolling" : mode;
