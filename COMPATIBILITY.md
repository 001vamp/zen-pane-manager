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

The ⇄ control exists only inside an active split pane header. If both the control and keyboard shortcut are absent, press **Ctrl+Alt+D**. A copied report proves Pane's independent diagnostic bootstrap loaded; no response means Sine blocked or did not load the privileged scripts. The Browser Console should contain `[Pane] 0.10.0-dev ready` when the main runtime succeeds.

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
- [ ] Simulate an incompatible Zen API and confirm no layout changes occur

## Tabs outside the picker

- Tabs in another split view
- Tabs from another workspace

Pinned and ordinary folder tabs are supported using the original tab. Essentials and live-folder items open as copies, labeled in the picker.

## Multi-window development verification

Pane 0.10.0-dev was loaded through Sine 2.3.4.1c in a disposable macOS Zen profile. Live tests passed for normal-tab entry, right/below/grid layouts, floating browser identity, unsaved form content, scroll position, keyboard move/resize, tab switching, close-to-sidebar, native tab closure, four-tab limit, injected-failure rollback, and unload cleanup. Replacement retained the same layout leaf and custom divider size.

The local installed build was also enabled alongside Advanced Tab Groups and Safari-like Zen. Control+Option+R was verified with real Mac key events. Firefox reports Option as AltGraph on macOS, which Pane now handles separately from Windows/Linux AltGr text entry.

Floating placement is a temporary presentation of a native Zen split. One floating tab is supported per window. Disabling Pane or restarting Zen restores the native split. It is not an OS-level always-on-top window. The maintainer has also tested Pane on Windows in everyday use. The checklist above gives contributors scenarios to reproduce on their own setups; it is not a record of which Windows tests were completed.
