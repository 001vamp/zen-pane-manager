# macOS layout menu

Open the selected split layout menu with a native shortcut.

## Sub-features

- `layout-menu`: Default Ctrl+Shift+L; mouse entry; keyboard navigation; cancellation.

## How to get to it (user POV)

Select a split tab; Ctrl+Shift+L on macOS; toolbar three-dot button; picker Arrange this tab (#pane-arrange-current).

## Driving it with native Zen UI

Preconditions: SKILL.md doctor passes for the owned throwaway profile; seed A/B/C/D. Run the fixture helper first.

Send real Ctrl+Shift+L while page content has focus. Require #pane-layout-menu on the selected pane. Repeat through both mouse paths. Navigate its choices with arrows/Home/End and Enter, then reopen and Escape. Require applied layout and closed menu; canceled selection must leave layout unchanged.

Capture the action transcript and before/after screenshots under the helper's evidence directory. Record each entry point separately.

## Gotchas

test-keybindings.mjs covers Mac default/parser/conflicts; test-multiple-floats.mjs covers menu navigation. Real OS routing is native-only. Option+Shift+L is obsolete as the Mac default.
