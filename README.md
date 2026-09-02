# Pane for Zen Browser

[![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)](LICENSE)
[![Validate](https://github.com/001vamp/zen-pane-manager/actions/workflows/validate.yml/badge.svg)](https://github.com/001vamp/zen-pane-manager/actions/workflows/validate.yml)

Replace the focused pane in a Zen Browser split view with another open tab—without unsplitting, rebuilding the layout, or losing your divider sizes.

An open-source Sine mod by **[jasi (@001vamp)](https://github.com/001vamp)**.

![Pane compact picker showing recently used tabs](docs/pane-ui-compact.png)

See the [complete UI state sheet](docs/pane-ui-showcase.html) for compact, search, expanded, empty, and notification states.

> **Early contributors wanted.** Pane is young, useful, and intentionally open to new ideas. Try it, report rough edges, propose workflows, or pick up a small issue. See the [roadmap](ROADMAP.md) and [contribution guide](CONTRIBUTING.md).

## Use

1. Click the split pane you want to replace.
2. Press **Ctrl+Alt+R**.
3. Search for another open tab in the current workspace.
4. Press **Enter**.

The old pane's tab stays open. The new tab takes its exact position and size.

You can also click the **⇄** button in a split pane's header—no shortcut required. When opened this way, the picker appears over that pane so the replacement target stays visually obvious. Keyboard openings continue to use your chosen screen position.

The compact glass picker initially shows only your four most recently used eligible tabs. Start typing to search every open tab, or choose **Show all** to expand the list manually. Pressing Escape clears a search or collapses the full list before closing the picker.

## Thoughtful by default

- The picker says exactly which pane will be replaced.
- Search matches page titles and website names, with matching text highlighted.
- Recently used tabs appear first.
- Four recent tabs stay visible in a compact two-column layout.
- Searching automatically expands into the complete filtered list.
- Arrow keys wrap naturally from the last result to the first.
- Clear status messages confirm the result without interrupting your work.
- Reduced-motion preferences are respected.
- A failed internal Zen operation rolls back to the original tab and layout.

## Settings

Open Sine's settings for Pane to:

- Choose `Ctrl+Alt+R`, `Ctrl+Alt+S`, or disable the keyboard shortcut.
- Show or hide the **⇄** pane button.
- Start with System, Clear, Frosted, Tinted, or Custom glass.
- Choose the accent color, picker size and position, spacing, and optional page dimming.
- Set how many tabs appear in compact view, their ordering, website-name visibility, and whether the replaced tab stays open.
- Fine-tune light and dark glass tints, blur, corners, columns, and the keyboard footer in Advanced customization.

Appearance changes preview live. Choose **System glass** to reset the tint, blur, and corner shape to Pane's designed defaults. Advanced tint, blur, and corner controls take effect only with the **Custom** preset.

CSS colors can be written as hex (`#7c5cff`), RGB/RGBA (`rgba(124, 92, 255, 0.72)`), HSL, or a system color such as `AccentColor`. Invalid colors safely fall back to the defaults. Fully transparent accents are also rejected because they would make keyboard focus impossible to see. **Auto** columns is recommended: it adapts the compact layout to narrow and wide picker sizes.

## Install with Sine

Pane's picker, shortcut, and ⇄ button are powered by a browser-chrome script. Before installing, use:

- Zen Browser **1.21.16b** (current stable) or a Pane-tested newer stable release.
- Sine **2.3 or newer**. The latest Sine release is recommended.
- A Windows version and processor architecture supported by Zen and Sine (x64 and ARM64 are supported by Sine's Windows installer).

In Sine's general settings, enable **Install JavaScript from unofficial sources**. Sine intentionally blocks scripts from repositories outside its verified store until you allow them.

Then install this repository:

```text
001vamp/zen-pane-manager
```

Disable and re-enable Pane once, then fully exit and reopen Zen. Create a split view; the **⇄** button appears in each split pane header. `Ctrl+Alt+R` opens the same picker from the keyboard.

### If Pane appears installed but nothing happens

The missing button and inactive shortcuts both mean Pane's script did not load. They are not two separate failures.

1. Confirm **Install JavaScript from unofficial sources** is enabled in Sine.
2. Confirm Pane is enabled, then toggle it off and back on to make Sine rebuild its scripts.
3. Fully close every Zen window and end any remaining Zen process before reopening it.
4. Create an active split view; the pane button is intentionally hidden outside split view.
5. If another Sine mod was toggled during testing, leave it enabled and toggle Pane itself. Toggling another mod can incidentally refresh Pane and make a load-order problem look like a compatibility conflict.

For a useful bug report, open Zen's Browser Console and look for either `[Pane] 0.8.0 ready` or `[Pane] failed to initialize`. Include that line, plus the Zen and Sine versions, without including private URLs or tab titles.

For local development, copy this folder into your Zen profile's `chrome/sine-mods` directory, register it in Sine's `mods.json`, and restart Zen Browser.

## Safeguards

- Only replaces a pane in the currently active split view.
- Only offers ordinary open tabs from the same workspace.
- Excludes pinned and Essential tabs until those cases are verified across Zen releases.
- Never offers a tab already participating in another split.
- Leaves the outgoing tab open and available in the sidebar.
- Preserves horizontal, vertical, grid, and nested split-tree ratios.

## Compatibility

Pane v0.8.0 targets Zen **1.21.16b** on Windows and uses its internal `gZenViewSplitter` API. Zen can change that API between releases, so the mod validates the required methods before changing anything and shows a compatibility message if they are unavailable. Pane also watches for split headers created or rebuilt after startup, which keeps its button available during session restoration and alongside mods that reorganize tab groups.

See [COMPATIBILITY.md](COMPATIBILITY.md) for the release test matrix and known limitations.

## Contributing

Bug reports, design feedback, compatibility testing, documentation, and focused pull requests are all welcome. You do not need to understand Zen's internals to help. See [CONTRIBUTING.md](CONTRIBUTING.md) and the public [ROADMAP.md](ROADMAP.md).

Good first contributions include testing another Zen version, improving copy or accessibility, documenting an edge case, and turning a confirmed issue into a focused fix. Bug reports should include the Zen version, Sine version, split orientation, number of panes, and the exact point where behavior differed from the description.

Release history is recorded in [CHANGELOG.md](CHANGELOG.md).

Before publishing a release, follow [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

## License

Pane is licensed under the **Mozilla Public License 2.0 (MPL-2.0)**, matching Zen Browser and Sine.

You may use, inspect, modify, and redistribute it. If you distribute modified MPL-covered files, those files must remain available under MPL-2.0 with their source code. MPL-2.0 permits commercial distribution—as every OSI-approved open-source license must—but recipients remain free to redistribute the covered source themselves. Official Pane releases from `001vamp` are intended to remain freely available.

See [LICENSE](LICENSE) and [LICENSE-NOTES.md](LICENSE-NOTES.md). Pane is an independent community project and is not affiliated with or endorsed by Zen Browser or Sine.

## Privacy and security

Pane has no telemetry, network requests, accounts, or data collection. It operates locally in Zen's browser chrome and only reads the tab information needed to display the picker. See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).
