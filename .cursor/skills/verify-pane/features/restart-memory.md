# Split and floating restart memory

Recover the active split and floating positions after a full Zen process restart.

## Sub-features

- `restart-memory`: Split membership, active pane, divider ratios; multiple float geometry and pins; smaller bounds; missing tabs.

## How to get to it (user POV)

Create layouts via picker/menu in the isolated profile; restart only the owned PID as in SKILL.md.

## Driving it with native Zen UI

Preconditions: SKILL.md doctor passes for the owned throwaway profile; seed A/B/C/D. Run the fixture helper first.

Create A/B/C split, adjust divider ratios, select B, then switch to solo D and back. Capture membership, active tab and ratios. Quit only the owned instance, wait for its PID to exit, relaunch the exact same profile and run doctor. Require the same split, active B and ratios without manual reconstruction. Repeat with two differently positioned/resized floats and opposite header pins. Capture before/after, require both panels and pins, dock each and verify pages stay open. Repeat at smaller window size and after closing one floating tab before quit; require bounded surviving panel and no ghost tab.

Capture the action transcript and before/after screenshots under the helper's evidence directory. Record each entry point separately.

## Gotchas

test-multiple-floats.mjs mocks SessionStore for floating/presentation restore, malformed records and cleanup. No fixture proves a full process restart. Split-memory PR #2 is absent from baseline f9d43ba; record failure or NOT RUN, never silently waive this future acceptance gate. Unsaved form recovery across process exit depends on Zen; compare layout state separately.
