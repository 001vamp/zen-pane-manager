# Floating

Arrange open tabs so B appears in a movable panel over the split.

## Sub-features

- `floating`: Floating from picker and layout menu; solo and existing split; 2 and 4 panes.

## How to get to it (user POV)

Picker #pane-open-modes [data-mode="float"]; existing split toolbar three-dot menu #pane-layout-menu [data-mode="float"].

## Driving it with native Zen UI

Preconditions: SKILL.md doctor passes for the owned throwaway profile; seed A/B/C/D. Run the fixture helper first.

From solo A, open picker, choose the mode and B using real input; require B appears in a movable panel over A. Repeat from an existing A/B split by floating C, then D. Through the layout menu, arrange the selected split with the same choice. Move and resize each floating panel, toggle its pin state, replace one floating tab via picker, then dock it back; require pages and sidebar origins retained. Keep a typed draft, page scroll and history while moving, pinning and docking floats; require page identity/state retained.

Capture the action transcript and before/after screenshots under the helper's evidence directory. Record each entry point separately.

## Gotchas

test-multiwindow.mjs covers mapping/geometry; test-multiple-floats.mjs covers add/join, presentation state, navigation and cleanup. These mock Zen; native rendering, pointer input, page retention and entry paths remain required.
