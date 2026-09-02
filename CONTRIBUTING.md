# Contributing

Thanks for helping improve Pane.

## Bug reports

Please include:

- Zen Browser version
- Sine version
- Operating system
- Number and orientation of split panes
- Whether the divider had been resized
- Whether the incoming tab was loaded, discarded, playing audio, pinned, or in a container
- Steps to reproduce and what happened instead

Do not include private URLs, page titles, profile files, or browser-session data.

## Code guidelines

- Preserve the existing layout-tree object; never rebuild it for a replacement.
- Validate all Zen-internal objects before changing tab state.
- Any new mutation must have a rollback path.
- Keep UI text direct and describe the result rather than the implementation.
- Support keyboard-only use and `prefers-reduced-motion`.
- Keep all behavior local. Pane must not collect or transmit browser data.

## Before a pull request

1. Run `node --check split-swap.uc.mjs`.
2. Validate `theme.json` and `preferences.json` as JSON.
3. Complete the applicable checks in `COMPATIBILITY.md`.
4. Update `CHANGELOG.md` for user-visible changes.
