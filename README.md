# Pane for Zen Browser

Replace a tab in a Zen split without rebuilding the split or losing your divider sizes. You can also split tabs side by side, stack them, make a grid, or float a tab over the page.

A [Sine](https://github.com/CosmoCreeper/Sine) mod by [jasi (@001vamp)](https://github.com/001vamp).

![Pane picker showing recently used tabs](docs/pane-ui-compact.png)

## Install

You need Zen Browser and Sine **2.3 or newer**. Pane targets Zen **1.21.16b**. See [compatibility notes](COMPATIBILITY.md) for tested versions.

1. Open Zen **Settings → Sine Mods**.
2. Click the **gear beside the repository install field**, not the gear on Pane’s card.
3. Under **General**, enable **Install JavaScript from unofficial sources**. Some versions call it **Enable installing JS from unofficial sources**. Pane needs this because it is not in Sine’s verified store. Only enable it for mods you trust: these scripts have browser-level access.
4. Close that panel and paste this into the repository install field:

   ```text
   001vamp/zen-pane-manager
   ```

5. Install Pane, then fully quit and reopen Zen. If Sine shows **Restart to apply changes**, use that button.

## Use Pane

Press **Control+Option+R** on Mac or **Ctrl+Alt+R** on Windows. Choose what you want to do, then pick an open tab:

- **Replace** swaps the tab in the current split pane. The outgoing tab stays open by default.
- **Split right** or **Split below** puts the chosen tab beside or below it.
- **Add to grid** adds another tab to the split.
- **Floating** opens the tab in a movable, resizable panel inside Zen.

Search by title or website, or click **Show all** for the full list. Use the arrow keys to select a tab and **Enter** to apply. **Escape** clears the search, collapses the list, then closes the picker.

### Pane toolbar

The toolbar appears briefly when you switch panes. Move your pointer to the **top center of the pane** to bring it back. It hides when you move away and stays visible while you use its controls with the keyboard.

Use it to open the picker, go back or forward, rearrange the pane, or remove it from the split. The **three-dot menu** lets you change layouts or add another tab.

### Floating tabs

Drag the header to move a floating tab. Drag any edge or corner to resize it. The header hides automatically; hover over the top edge to reveal it, or use **Keep header visible** to leave it open.

The close button returns the tab to the sidebar. It does not close the page. Use the layout menu to dock it back into a split or return it to the main view.

### Pinned tabs, folders, and Essentials

Pinned tabs and ordinary folder tabs use the original tab. A split started in a folder stays there. Adding a normal tab to a pinned split pins that tab too.

**Essentials and live-folder items open as copies** to preserve their special behavior. Pane labels these choices **Open a copy in this pane**.

The picker shows tabs from the active workspace and leaves out tabs already in another split.

## Settings

Click the **gear in the picker** to open Pane’s appearance settings. You can change colors, opacity, blur, size, spacing, and how many recent tabs appear. Sliders also accept typed values. Changes save immediately, and each control has a reset button.

For shortcuts and tab behavior, open **Settings → Sine Mods → Pane’s gear**. To choose your own keybind, set **Keyboard shortcut** to **Custom** and enter a combination such as `Command+Shift+P`, `Ctrl+Space`, or `F8`. Shortcuts reserved by Zen or your operating system may not reach Pane.

## If nothing happens

If the shortcut does nothing and the split toolbar has no Pane button:

1. Check the unofficial JavaScript permission in Sine’s general settings. You can also check `sine.allow-unsafe-js` in `about:config`; it should be `true`.
2. Toggle Pane off and back on.
3. Fully quit Zen and reopen it.

Still stuck? Press **Control+Option+D** on Mac or **Ctrl+Alt+D** on Windows to copy a diagnostic report. The picker’s **info button** copies the same report. Paste it into a [bug report](https://github.com/001vamp/zen-pane-manager/issues/new?template=bug_report.yml) and describe what you were doing.

Reports include versions and loading information, but no tab titles, URLs, searches, browsing history, or file paths. If the diagnostic shortcut also does nothing, include your Zen and Sine versions in the issue.

## Current limitations

Pane has been tested on **macOS and Windows**, including everyday use by the maintainer.

- Zen allows up to four tabs per split, including a floating tab.
- Pane supports one floating tab per window. It stays inside that Zen window.
- Floating placement is temporary. Restarting Zen or disabling Pane returns the group to a native split.
- Pane uses Zen’s internal split API, which can change between releases.

See [COMPATIBILITY.md](COMPATIBILITY.md) for more detail.

## About

Pane runs locally, with no telemetry or accounts. Tab previews are captured in memory and are not saved or uploaded. Sleeping tabs stay asleep until opened. See [Privacy](PRIVACY.md) and [Security](SECURITY.md).

Try Pane with your own tabs, layouts, and mods. If something breaks, try to reproduce it and [open an issue](https://github.com/001vamp/zen-pane-manager/issues/new?template=bug_report.yml) with the steps and a diagnostic report. Testing, debugging, and fixes are welcome.

See [Contributing](CONTRIBUTING.md), the [roadmap](ROADMAP.md), and the [changelog](CHANGELOG.md).

Licensed under [MPL-2.0](LICENSE). Third-party notices are in [LICENSE-NOTES.md](LICENSE-NOTES.md). Pane is a community project, independent of Zen Browser and Sine.
