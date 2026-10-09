# Compatibility

## Development target

- Zen Browser: 1.21.16b
- Firefox platform: 154.0.1
- Runtime tested: macOS and Windows
- Windows testing: maintainer reports successful everyday use
- Mod loader: Sine 2.3+

## Windows support

Pane does not use native executables, architecture-specific binaries, registry edits, or fixed profile paths. It runs inside Zen through Sine, so it supports the Windows versions and x64/ARM64 architectures supported by the installed Zen and Sine releases.

Sine must have **Install JavaScript from unofficial sources** enabled because Pane is currently installed from its public GitHub repository rather than Sine's verified store. After a first install, toggle Pane once and fully restart Zen so Sine's browser-chrome loader starts from a clean state.

The ⇄ control exists only inside an active split pane header. If both the control and keyboard shortcut are absent, press **Alt+Shift+D** on Windows or Linux. A copied report proves Pane's independent diagnostic bootstrap loaded; no response means Sine blocked or did not load the privileged scripts. The Browser Console should contain `[Pane] 0.11.0 ready` when the main runtime succeeds.

Pane relies on Zen's private `gZenViewSplitter` object. The mod checks for the exact methods it needs before offering a replacement, but a future Zen release may still change their behavior.

## Release test matrix

Run this matrix before tagging a stable release:

- [ ] Two panes, vertical split, unequal divider
- [ ] Two panes, horizontal split, unequal divider
- [ ] Three panes with a nested layout
- [ ] Four panes in grid layout
- [ ] Replace the left, right, top, and bottom pane
- [ ] Replace with a loaded tab
- [ ] Replace with a discarded/unloaded tab
- [ ] Replace with an audio-playing tab
- [ ] Keep the outgoing tab open
- [ ] Automatically close the outgoing tab
- [ ] Cancel with Escape, backdrop click, and close button
- [ ] Navigate entirely by keyboard
- [ ] Toggle every Sine preference while the picker is open
- [ ] Reload the mod twice without restarting Zen
- [ ] Install from a clean Sine profile with unofficial JavaScript initially disabled
- [ ] Enable unofficial JavaScript, toggle Pane, and confirm live loading
- [ ] Run beside Advanced Tab Groups and confirm both remain active after reload
- [ ] Copy diagnostics before creating a split, during a split, and after a failed compatibility check
- [ ] Restart Zen and confirm the split session restores
- [ ] Split Essentials, pinned tabs, standard tabs, and folder tabs together, then confirm each returns to its original section and position
- [ ] Simulate an incompatible Zen API and confirm no layout changes occur

## Tabs outside the picker

- Individual tabs in another split view (solo tabs can select the whole split as a destination)
- Tabs from another workspace

Standard tabs, pinned tabs, folder tabs, and Essentials use their original browser instance. Pane records their original workspace, section, folder, and position in local SessionStore data, then restores that placement when they leave the split. If a recorded folder has been deleted, the tab returns to its workspace's normal pinned or unpinned section.

## Multi-window development verification

Pane 0.10.0-dev was loaded through Sine 2.3.4.1c in a disposable macOS Zen profile. Live tests passed for normal-tab entry, right/below/grid layouts, floating browser identity, unsaved form content, scroll position, keyboard move/resize, tab switching, close-to-sidebar, native tab closure, four-tab limit, injected-failure rollback, and unload cleanup. Replacement retained the same layout leaf and custom divider size.

The local installed build was also enabled alongside Advanced Tab Groups and Safari-like Zen. Control+Option+R was verified with real Mac key events. Firefox reports Option as AltGraph on macOS, which Pane now handles separately from Windows/Linux AltGr text entry.

Floating placement is a temporary presentation of a native Zen split. Multiple tabs can float within a split, with one tab left in the background. Zen’s four-tab split limit allows up to three floating tabs per group. Disabling Pane restores the native split; restarting Zen restores saved floating panels after native split recovery. It is not an OS-level always-on-top window. The maintainer has also tested Pane on Windows in everyday use. The checklist above gives contributors scenarios to reproduce on their own setups; it is not a record of which Windows tests were completed.

## Current reliability changes

The latest working tree has automated regression coverage for layout-menu/scrolling arbitration, Escape cancellation, width preservation, pane removal, and replacement failure recovery. Those checks pass in fixtures. The complete settings page has previously loaded in native macOS Zen; that does not verify all current controls.

The development target above remains the recorded target, not a claim of compatibility with every newer release. Current-build native macOS/Windows results must be recorded before a stable release. Scrolling, accordion, and floating recovery use their regular names; this is a label change, not recorded native proof. Accordion and scrolling metadata are retained at browser shutdown; disabling Pane clears that presentation metadata and restores tracked tabs. Floating geometry/pins now have versioned local persistence. Fixture tests cover multiple panels, smaller bounds, pins, docking, invalid data, and disable cleanup; native restart verification remains required.

### October 2 local verification

The current complete settings page loaded in native macOS Zen after a restart. The plain-key warning appeared; Escape preserved the layout shortcut; recording F8 and selecting Use default restored the platform default. The Mac layout-menu default is now Ctrl+Shift+L because Option modifies letter keys before Pane can read them on real macOS. Those temporary test changes were reverted. The latest automated suite also covers detach presentation preservation, replacement failures after membership mutation, and unsuccessful rollback messaging. Windows and the full current-build gesture/restart matrix remain unchecked.
