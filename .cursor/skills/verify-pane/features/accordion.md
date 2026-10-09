# Horizontal accordion

Arrange open tabs so one page expands while neighboring live edges remain.

## Sub-features

- `accordion`: Horizontal accordion from picker and layout menu; solo and existing split; 2 and 4 panes.
- `accordion-drag-resize`: Drag either available boundary of the expanded page; neighbors share the remaining width.

## How to get to it (user POV)

Picker #pane-open-modes [data-mode="accordion"]; existing split toolbar three-dot menu #pane-layout-menu [data-mode="accordion"].

## Driving it with native Zen UI

Preconditions: SKILL.md doctor passes for the owned throwaway profile; seed A/B/C/D. Run the fixture helper first.

From solo A, open picker, choose the mode and B using real input; require one page expands while neighboring live edges remain. Repeat on an existing A/B split adding C, then D. Through the layout menu, arrange the selected split with the same choice. Click each live edge and use focused-edge Left/Right/Home/End; require wrap and selected page. Use Restore tiled layout and require original divider ratios. Keep a typed draft, page scroll and history while changing layouts; require page identity/state retained.

Capture the action transcript and before/after screenshots under the helper's evidence directory. Record each entry point separately.

## Drag-resize recipe (`accordion-drag-resize`)

1. Enter Horizontal accordion through the picker from solo A with B, then through the layout menu on an existing split. Repeat with 2 and 4 panes. Record each entry point separately.
2. Select an interior pane in the four-pane group. Drag its right boundary outward, then inward using the primary mouse button. Require the expanded page to grow, then shrink, while neighboring strips share the remaining width. Repeat at its left boundary; moving left grows the page and moving right shrinks it. The cursor must track the dragged boundary without jumps. Press the default keyboard resize shortcuts (**Ctrl+Shift+Plus/Minus** on Mac, **Alt+Shift+Plus/Minus** on Windows/Linux) and require the expanded page to widen and narrow in bounded steps.
3. Drag beyond both limits, then repeat in a narrow window. Require a readable expanded page where space permits, visible neighboring strips, and no negative widths or overflow. At the first/last pane, require a resize target only on the side with neighbors. Secondary-button dragging must leave widths unchanged.
4. Release outside the boundary and move the pointer again; require resizing to stop. While dragging, press the keyboard resize shortcuts and require them to be ignored until the pointer drag ends. Switch pages by live-edge click and focused-edge Left/Right/Home/End; require the chosen width to remain during this accordion session. Resize the window and require bounded geometry and reachable controls. Repeat with reduced motion enabled.
5. Keep a typed draft, scroll position and back/forward history during dragging and selection. Require the same live pages and state. Restore tiled layout; require the original divider ratios and no remaining resize targets. Re-enter accordion, remove a member, and leave the layout during a drag; require clean controls and no continuing resize.
6. In the owned disposable profile only, run the restart-memory recipe after resizing. Require PR #3's split membership, accordion selection and scrolling-width recovery. Accordion drag width is session-only: restart returns it to the default; this change adds no saved-width field.

Capture real pointer input, before/after screenshots and observed widths in the helper evidence directory. Report PASS, FAIL or NOT RUN for each entry point. Fixtures cover fractional size math and pointer lifecycle; they do not prove native hit targets or rendering.

## Gotchas

test-multiwindow.mjs covers mapping/geometry; test-multiple-floats.mjs covers add/join, presentation state, navigation and cleanup. These mock Zen; native rendering, pointer input, page retention and entry paths remain required.
