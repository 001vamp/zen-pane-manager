# Contributing

Thanks for helping improve Pane. Contributions do not have to be code: reproducible bug reports, compatibility results, accessibility feedback, screenshots with private information removed, and clearer documentation all matter.

## Start here

1. Check the open issues and [ROADMAP.md](ROADMAP.md).
2. For a small fix, comment on the issue before investing significant time.
3. For a larger behavior or UI change, open a feature request first so we can agree on the interaction.
4. Keep each pull request focused on one problem.

New contributors are especially welcome. Issues labeled `good first issue` should be narrow enough to complete without already knowing Zen's split-view internals.

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

1. Run `npm test`.
2. Complete the applicable checks in `COMPATIBILITY.md`.
3. Update `CHANGELOG.md` for user-visible changes.
4. Explain what you tested in the pull request template.

Maintainers will review the user experience, rollback safety, privacy, and compatibility—not just whether the happy path works.
