# Compatibility

## Development target

- Zen Browser: 1.21.16b
- Firefox platform: 154.0.1
- Operating system: Windows
- Mod loader: Sine 2.3+

## Windows support

Pane does not use native executables, architecture-specific binaries, registry edits, or fixed profile paths. It runs inside Zen through Sine, so it supports the Windows versions and x64/ARM64 architectures supported by the installed Zen and Sine releases.

Sine must have **Install JavaScript from unofficial sources** enabled because Pane is currently installed from its public GitHub repository rather than Sine's verified store. After a first install, toggle Pane once and fully restart Zen so Sine's browser-chrome loader starts from a clean state.

The ⇄ control exists only inside an active split pane header. If both the control and keyboard shortcut are absent, verify that the Browser Console contains `[Pane] 0.8.0 ready`; otherwise the privileged script was blocked or was not loaded.

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
- [ ] Restart Zen and confirm the split session restores
- [ ] Simulate an incompatible Zen API and confirm no layout changes occur

## Deliberate exclusions for the public beta

- Pinned tabs
- Essential tabs
- Tabs in another split view
- Tabs from another workspace

These tabs are hidden from the picker instead of being offered with unreliable behavior.
