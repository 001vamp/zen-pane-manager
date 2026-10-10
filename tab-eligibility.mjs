// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/

// Which tabs Pane may touch, and which workspace they belong to.

export const tabWorkspace = (win, tab) => tab?.hasAttribute("zen-essential")
  ? win.gZenWorkspaces.activeWorkspace : (tab?.getAttribute("zen-workspace-id") ?? "");
export const isSupportedTab = tab => Boolean(tab && !tab.closing && !tab.hidden && !tab.hasAttribute("zen-empty-tab"));
