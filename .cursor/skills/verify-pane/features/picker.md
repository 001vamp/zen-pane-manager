# Picker

Find, replace, join or add an open tab without losing pages.

## Sub-features

- `picker`: Search, keyboard selection, cancellation, all layout choices, existing split Add/Floating/Unsplit.

## How to get to it (user POV)

Control+Option+R on Mac; Alt+Shift+P on Windows/Linux; Pane toolbar picker button.

## Driving it with native Zen UI

Preconditions: SKILL.md doctor passes for the owned throwaway profile; seed A/B/C/D. Run the fixture helper first.

Open each entry point; require #pane-overlay and focused #pane-search. Search a title and website, use arrows and Enter, then repeat with mouse .pane-item. Require the selected page in the chosen destination. Test Escape clearing search, collapsing Show all, then closing. From solo D, join an Existing splits card with Add and Shift+Enter/Floating; Unsplit must keep all pages and sidebar origins. At narrow width, every #pane-open-modes [data-mode] choice must remain reachable.

Capture the action transcript and before/after screenshots under the helper's evidence directory. Record each entry point separately.

## Gotchas

validate.mjs checks picker markup; test-replacement.mjs covers replacement/rollback and layout preservation; test-multiple-floats.mjs covers every add/join layout. Native focus, clipping, search and keyboard still require Zen.
