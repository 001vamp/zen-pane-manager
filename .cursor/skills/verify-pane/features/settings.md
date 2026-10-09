# Settings

Change appearance, shortcuts and tab behavior, then confirm saved controls.

## Sub-features

- `settings`: Both settings entry points, immediate save, section reset, shortcut cancel/default/disable/conflicts.

## How to get to it (user POV)

Picker gear #pane-appearance; Settings > Sine Mods > Pane gear, then complete settings page.

## Driving it with native Zen UI

Preconditions: SKILL.md doctor passes for the owned throwaway profile; seed A/B/C/D. Run the fixture helper first.

Open each entry point. Change picker width and toolbar visibility, reopen picker and require their visible effect. Reopen settings and require saved values. Reset this section and require unrelated section values unchanged. Record a shortcut, cancel with Escape, use default, disable, and try a duplicate Pane shortcut. Require unchanged canceled value and conflict warning with inactive duplicate. Restore defaults in the test profile.

Capture the action transcript and before/after screenshots under the helper's evidence directory. Record each entry point separately.

## Gotchas

test-appearance.mjs covers bounds/schema conditions; test-keybindings.mjs covers parser/defaults/conflicts; validate.mjs checks schema. Rendering, recorder focus, saving and section reset need native Zen.
