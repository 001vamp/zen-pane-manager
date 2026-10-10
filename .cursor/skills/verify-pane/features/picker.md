# Picker

Find, replace, join or add an open tab without losing pages.

## Sub-features

- `picker`: Search, keyboard selection, cancellation, all layout choices, existing split Add/Floating/Unsplit.

## How to get to it (user POV)

Control+Option+R on Mac; Alt+Shift+P on Windows/Linux; Pane toolbar picker button.

## Driving it with native Zen UI

Preconditions: SKILL.md doctor passes for the owned throwaway profile; seed A/B/C/D. Run the fixture helper first.

Open each entry point; require #pane-overlay and focused #pane-search. Search a title and website, use arrows and Enter, then repeat with mouse .pane-item. Require the selected page in the chosen destination. Test Escape clearing search, collapsing Show all, then closing. From solo D, join an Existing splits card with Add and Shift+Enter/Floating; Unsplit must keep all pages and sidebar origins. At narrow width, every #pane-open-modes [data-mode] choice must remain reachable.

With search focused, real OS Control+Shift+physical `]` / `[` must cycle the pressed `#pane-open-modes` chip (solo skips Replace) and leave the caret in search. The list must not rebuild; thumbnails and the highlighted row stay. Tab to a row, then arrows: highlight and focus move together; Enter activates that highlighted row. Hover must not steal search focus. If a row already has focus, a real pointer move moves focus with the highlight so Enter and Space open the same row. Hover must not steal focus from that card's Add / Floating / Unsplit, and must not move the highlight while those buttons have focus. A mouse resting over the list while you hold ↓ must not yank focus back to the row under the pointer. Wheel-scrolling the list without moving the mouse is intended to leave the highlight (and Enter) on the old row until the pointer moves. Type `1Password` and `[Draft]` — those must filter, not change mode. Option+arrows still word-jump on Mac; Alt+Left is still Back on Windows. Shift+Enter on a split card still floats; on a tab row it is still Enter. Non-US AltGr-bracket layouts and IME composition Enter/Escape: NOT RUN unless that layout is available. The wrapping chip bar, Arrange current, and layout-menu popup are unchanged in this slice.

Capture the action transcript and before/after screenshots under the helper's evidence directory. Record each entry point separately.

## Gotchas

validate.mjs checks picker markup; test-replacement.mjs covers replacement/rollback and layout preservation; test-multiple-floats.mjs covers every add/join layout. Native focus, clipping, search and keyboard still require Zen.
