# Layout menu

Open the selected split layout menu with a native shortcut.

## Sub-features

- `layout-menu`: Default Ctrl+Shift+L on macOS; default Alt+Shift+L on Windows/Linux; mouse entry; keyboard navigation; cancellation.

## How to get to it (user POV)

Select a split tab; Ctrl+Shift+L on macOS or Alt+Shift+L on Windows/Linux; toolbar three-dot button; picker Arrange this tab (#pane-arrange-current).

## Driving it with native Zen UI

Preconditions: SKILL.md doctor passes for the owned throwaway profile; seed A/B/C/D. Run the fixture helper first.

Send the platform shortcut with real OS input while page content has focus: Ctrl+Shift+L on macOS, Alt+Shift+L on Windows/Linux. Require #pane-layout-menu on the selected pane. Repeat through both mouse paths. Navigate its choices with arrows/Home/End and Enter, then reopen and Escape. Require applied layout and closed menu; canceled selection must leave layout unchanged. A pre-existing custom Ctrl+Shift+* layout-menu shortcut (non-US bracket key) must still open the menu while the picker is closed.

Capture the action transcript and before/after screenshots under the helper's evidence directory. Record each entry point separately.

## Gotchas

test-keybindings.mjs covers defaults, parser and conflicts; test-multiple-floats.mjs covers menu navigation. Real OS routing is native-only.
