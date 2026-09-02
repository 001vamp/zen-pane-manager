# Compatibility

## Development target

- Zen Browser: 1.21.16b
- Firefox platform: 154.0.1
- Operating system: Windows
- Mod loader: Sine

Split Swap relies on Zen's private `gZenViewSplitter` object. The mod checks for the exact methods it needs before offering a replacement, but a future Zen release may still change their behavior.

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
- [ ] Restart Zen and confirm the split session restores
- [ ] Simulate an incompatible Zen API and confirm no layout changes occur

## Deliberate exclusions for the public beta

- Pinned tabs
- Essential tabs
- Tabs in another split view
- Tabs from another workspace

These tabs are hidden from the picker instead of being offered with unreliable behavior.
