# Pane restart memory

Recover Pane-managed presentation state after a full Zen process restart.

## Sub-features

- `restart-memory`: Hidden-workspace split restore; accordion state; scrolling column widths; floating position and pins; disabled-Pane unsplit persistence; lazy tab loading.

## How to get to it (user POV)

Create layouts via picker/menu in the isolated profile; restart only the owned PID as in SKILL.md.

## Driving it with native Zen UI

Preconditions: SKILL.md doctor passes for the owned throwaway profile; seed A/B/C/D. Run the fixture helper first.

Create A/B/C/D with one split visible, one split in a hidden workspace and one split in another workspace. Quit only the owned instance, wait for its PID to exit, relaunch the exact same profile and run doctor. Require hidden and other-workspace splits to restore only when that workspace is shown, and require lazy tabs in non-selected splits to remain unloaded until selected.

Repeat with accordion, scrolling and floating layouts. Capture accordion's expanded pane before quit and require the same expanded pane after relaunch. Resize scrolling columns, relaunch, and require the saved column widths to return. Move a floating tab, change its pin state, relaunch, and require the position and pins to match. Disable Pane in this disposable profile, unsplit a split through Zen, quit, relaunch, enable Pane again, and require the tabs to stay unsplit.

Capture the action transcript and before/after screenshots under the helper's evidence directory. Record Zen version for every run, Sine version when available, profile path, recipe ID, expected state and observed state. Keep native checks in this disposable profile.

## Gotchas

test-multiple-floats.mjs mocks SessionStore for floating/presentation restore, malformed records and cleanup. No fixture proves a full process restart. Zen restores tiled split membership and divider ratios natively; this recipe checks Pane's added presentation state and disabled-Pane cleanup behavior. Unsaved form recovery across process exit depends on Zen; compare layout state separately.
