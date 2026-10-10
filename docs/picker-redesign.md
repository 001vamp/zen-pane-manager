# Picker redesign: picker as hub

Design only. No product code in this document’s pull request.

Item 8 (`picker redesign / picker-as-hub`), confirmed against the roadmap: **keyboard-first**; the picker is the **one place** to find a tab, choose a layout, and move between panes. Jasiel picked Direction C. This file is still design-only.

**Ask:** make the picker that home, not a tab-swap dialog with a growing pile of layout buttons.

**Decided:** Direction C — one command hub. Search stays focused. The list is destinations *and* verbs. The layout-menu shortcut opens the same overlay in “arrange this tab” scope. Exact-verb Enter applies immediately (no confirm). Ship it in small PRs.

This document is still design-only. It does not authorize product PRs by itself.

---

## 1. How the picker works today

The picker is a modal overlay (`#pane-overlay` → `#pane-dialog`) built in `pane.uc.mjs`. Layout work after a choice is in `multiwindow.mjs`. Appearance is `chrome.css` plus prefs in `appearance.mjs` / `preferences.json`.

### Open it

| Path | What happens |
| --- | --- |
| Mac `Ctrl+Option+R` / Win+Linux `Alt+Shift+P` (or a recorded shortcut) | Toggles the picker on the selected tab. Position follows `mod.pane.picker-position` (top / upper / center). |
| Swap button on a split header | Opens anchored to that pane (`openPicker(tab, true)`). |
| Layout menu “Add another tab…” | Closes the menu and reopens the picker with mode forced to Split right. |

Shortcut handling is capture-phase on the window. The picker wins if its binding overlaps diagnostics. Repeats and IME composition are ignored.

It refuses to open if Zen’s splitter API is missing, or if the current tab is empty/unsupported. It then snapshots **eligible destinations** and shows the dialog with search focused.

### What you can pick

`eligibleTabs()` builds one mixed list:

1. **Existing splits**, only when the current tab is *not* already in a split. Each card is a group of 2+ same-workspace tabs. Actions: Add, Floating, Unsplit.
2. **Open tabs** in the same workspace that are not the current tab, not already in *this* split, not in any other split (`!tab.splitView`), not closing/hidden/empty.

Recent-first is the default. Compact view shows `mod.pane.recent-count` (default 4) until you search or click **Show all**. Search is a substring match on title + host.

Split cards are skipped entirely when you are already in a split. You cannot join another group from inside a split today.

### What you can do with a pick

The mode bar is every key in `modeLabels`:

```text
Replace | Split right | Split below | Add to grid | Floating |
Horizontal accordion | Snapshot scrolling (prototype) | Scrolling (experimental)
```

plus **Arrange current pane…** when the current tab is already split.

Default mode: **Replace** if you are in a split, **Split right** if you are solo. Replace and Arrange are hidden on a solo tab.

Activation:

- Tab + Enter → `replacePane()` or `multiwindow.add(current, tab, openMode)`.
- Split card + Enter → `join(group, current, openMode)` (Replace on a split card is treated as Add-to-grid).
- Split card + Shift+Enter → join as Floating.
- Split card Unsplit → `multiwindow.unsplit(group)`, picker stays open.

Replace is the one path that keeps Zen’s layout-tree leaf and divider sizes. Add/join create or extend a native split, then optionally wrap it as float / accordion / scrolling.

### Keyboard today

Focus starts in `#pane-search` and is meant to stay there.

| Key | From search | Elsewhere |
| --- | --- | --- |
| ↑ / ↓ | Move the selected result. Focus stays in search. | Split cards only: same, if the card itself is focused. |
| Enter | Run the selected result in the current mode. Shift+Enter floats a split card. | Split card: same. Nested Add/Floating/Unsplit buttons are extra mouse/Tab targets. |
| Escape | 1) clear search 2) collapse Show all 3) close and refocus the page. | Same, because Escape is handled on the whole dialog. |
| Tab | Custom trap: search → visible mode buttons → settings gear → result rows → split-card action buttons → Show all → diagnostics → close. Then wrap. | Same list. |
| Letters | Type in search. | N/A if you Tabbed away. |

There is **no** key to change mode while search is focused. Left/Right, `[`/`]`, `1`–`8`, and `g`/`f`/etc. do nothing. Modes are mouse or Tab.

Arrow keys wrap. They do not skip section headers. Help text at the bottom swaps when the selected row is a split card.

### Mouse, layout, appearance

Click a result to activate it. Hovering a result selects it. Backdrop click closes. Gear opens complete settings in a tab. Info copies diagnostics. Width, columns, compact, dim, help footer, glass, and accent are live prefs. Auto columns: 1 if width ≤ 420, 3 if ≥ 640, else 2. Search/expanded lists force one column and drop thumbnails.

Thumbnails use in-memory `PageThumbs.captureToCanvas` (see `PRIVACY.md`). A generation counter drops stale canvases.

### The other surface: layout menu

`#pane-layout-menu` is a second dialog. On **main** it rearranges the **current** tab: right / below / grid / float / accordion / scrolling / return to normal / restore tiles / **Reset all column widths** (scrolling only) / add another tab. No snapshot row (`normalizeMode` maps leftover `snapshot` to `scrolling`). Arrows and Enter work because every row is a focused button. Arrange-scope must match that list.

Every `openMenu(tab, anchor)` call site today:

| Entry | Anchor |
| --- | --- |
| Mac `Ctrl+Shift+L` / Win+Linux `Alt+Shift+L` (`onAccordionShortcut`) | none (falls back to the tab’s container) |
| Split-header three-dot button | that button |
| Picker **Arrange current pane…** | none (closes the picker first) |
| Floating-tab header arrange | the float header |
| Accordion bar **more** | the accordion bar |
| Accordion handle click on the *already-active* tab | that handle |
| Scrolling header **more** | the scrolling header |

Opening the menu also **cancels a scrolling overview** and tears down the snapshot overlay before the options appear. Any hub that replaces this menu has to do that too, at every entry above, and keep the anchor so the overlay is not stuck at `0,0`.

So Pane already has two “hubs”:

- Picker = pick a *different* tab, then apply a mode that was chosen first.
- Layout menu = pick a mode for the *current* tab, no destination search.

### Tests that already touch this

| Check | What it actually proves |
| --- | --- |
| `scripts/test-replacement.mjs` | Replace rollback; split-card Enter uses the selected mode (not forced grid). Source-string checks, not a live dialog. |
| `scripts/test-multiple-floats.mjs` | `add` / `join` / `unsplit` / arrange for every layout. Does not open `#pane-overlay`. |
| `scripts/test-keybindings.mjs` | Picker shortcut parse, Mac Option matching, conflict with layout bindings. |
| `scripts/validate.mjs` | Package/privacy/version. Does **not** assert picker markup. |
| `.cursor/skills/verify-pane/features/picker.md` | Native recipe: both entry points, search, arrows, Enter, mouse, Escape stages, split-card Add/Float/Unsplit, every mode visible when narrow. |

Fixtures never build the overlay. Keyboard, focus, clipping, and wrapping are native-only.

---

## 2. Problems

These are why a redesign is item 8, not a CSS pass.

1. **The mode bar is the dump.** PR #1 put accordion, snapshot, and scrolling into the same chip row as Replace. Eight wrapping chips plus Arrange is not a keyboard UI. The verify skill already has to say “at narrow width, every `[data-mode]` choice must remain reachable.”

2. **Mode-then-tab is backwards for a search dialog.** Power users type a title and press Enter. The mode is whatever was default or last clicked, off-screen, with no chord to change it without leaving search. Easy to float when you meant replace.

3. **Two hubs.** Arrange current vs pick a destination are different jobs, but users meet them as two glass popups with overlapping labels. The picker button named Arrange just bounces you to the other popup.

4. **Tab order fights the “search stays focused” story.** The trap puts the settings gear *before* results. Nested split-card buttons are in the trap too. Mouse users click; keyboard users get a maze.

5. **Split cards are a widget inside a listbox.** They are `role="option"` with inner buttons, their own keydown, Shift+Enter, and different help text. Unsplit is a side effect that keeps the picker open; everything else closes it.

6. **Eligibility is easy to misread.** Tabs already in another split never appear as tabs; they only appear as a group card, and only from a solo tab. From inside a split you cannot join another group or pick a tab that is already split.

7. **List states multiply.** Compact grid with thumbs, expanded one-column, searching one-column, empty, split-section headers. `setMode()` re-renders the whole list and recaptures thumbs.

8. **Help footer lies in edge cases.** `setMode()` rewrites it to Navigate / Enter / Esc and drops the Shift+Enter line until you reselect a split card.

9. **No command for “just rearrange.”** Keyboard users who want accordion on the current split must use a second shortcut or Tab to Arrange. That is the opposite of a hub.

10. **Product screenshot is already stale.** `docs/pane-current-picker.png` shows five modes. The code shows eight. That is the design smell: the bar does not scale.

None of this is “the glass looks old.” The interaction model ran out of room.

---

## 3. Three keyboard-first directions

All three keep:

- Original tabs, same workspace, Zen’s four-tab limit.
- Replace as a leaf-preserving swap.
- Rollback on failed mutations.
- Local-only previews; no new network.
- Reduced motion.
- Existing shortcuts as *entry points* (values can stay; what they open can change).

### A. Mode rail (keep the dialog, make modes keys)

Still: search + tab list. Modes become a compact rail under search.

**Keys (search focused):**

- `Ctrl+Shift+[` / `Ctrl+Shift+]` cycle modes. Match the **physical** keys: `event.code` is `BracketLeft` / `BracketRight`, with `ctrlKey && shiftKey && !altKey && !metaKey`. Do not match `event.key === '['` — with Shift held that is `{` / `}` on US. Works with an empty or non-empty query.
- Printable keys always type. No bare `[` / `]`, no digit chords (`1Password` types).
- ↑↓ and Enter stay “move in the list / do it.”
- Tab moves focus to the next control. Escape stages unchanged.

Arrange current stays a row at the top of the list when you are in a split (`Enter` opens today’s layout menu, or later a verb sheet). Layout-menu shortcut stays.

**Good:** smallest change. Muscle memory for search+Enter survives. Easy PRs.

**Bad:** still two surfaces. Still mode-then-tab. Does not match “picker as hub.” Experimental layouts stay second-class or still crowd the rail.

**Use if:** we only need the current picker to be usable at 320px and with a keyboard, and we do not want to touch the layout menu.

### B. Two-step (tab, then verb)

Step 1: pick a destination (tab or existing split). One list. Search, ↑↓, Enter.
Step 2: pick the verb. One list. Current layout marked. ↑↓, Enter commits. `Shift+Enter` on step 1 skips to the default verb (Replace in a split, Split right solo).

Arrange-current: step 1 is skipped; the layout-menu shortcut *is* step 2 for the current tab.

Split-card inner buttons go away. Unsplit is a verb on step 2 for a group.

**Good:** one focused list at a time. Hard to apply the wrong layout by accident. Layout menu and picker share step 2. Clearer for a first-time user.

**Bad:** extra Enter for the common “swap this pane for Notes.” Feels slower than Spotlight. Two screens to style and test. Not a single hub; it is a wizard.

**Use if:** wrong-layout mistakes matter more than speed, and Jasiel wants the fewest concepts on screen at once.

### C. Command hub (recommended)

One overlay. Search always focused. One list of **rows**, each a thing you can do.

**Empty query, in a split:**

```text
Arrange this split…          (Enter opens arrange-scope. Never applies a layout.)
Recent                       (first destination row is selected on open)
  Pane roadmap
  Zen documentation
Commands
  Restore tiled layout
  Return this tab to the sidebar
  Unsplit this group
```

**Empty query, solo tab:** same idea, default verb is Split right; Existing splits are rows (`Join “A + B”`, `Unsplit “A + B”`).

**Two-tab verbs on a solo tab:** main’s layout menu still lists Split right, Split below, Grid, and Floating when you are not in a split. `arrange()` then calls `chooseTab` (opens the picker) for right/below, and for grid when the group has fewer than three tabs. Floating on a true solo tab **throws today**; the hub instead asks for a destination (CHANGELOG). The hub must not open itself from inside itself.

On Enter (or click) of a two-tab verb while `groupSize < 2` (and Grid while `groupSize < 3`): **stay in the same overlay**. Switch from arrange-scope to destination rows in place, set the default-layout chip to that verb, and do not close or reopen. Then Enter on a tab runs `add`/`join` with that mode.

`arrangeOptions` rows carry `needsDestination`. The **reducer** returns `{ type: 'needDestination', mode }`. `activatePlan` never sees this and never returns it (it has no `groupSize`). `add()` is not called without a target.

Escape from `needDestination` (narrowest first): if the query is non-empty, **clear it and stay on destination rows**. Next Escape leaves `needDestination` (back to arrange-scope verbs) and restores `pending.previousMode` onto the default-layout chip. Does not close the hub.

`arrangeOptions({ groupSize: 1 })`: right, below, grid, float — all `needsDestination: true`. **Hide** Return to a normal tab. No accordion/scrolling/tiles/reset.

`arrangeOptions({ groupSize: 2 })`: right/below/float have `needsDestination: false`; **Grid has `needsDestination: true`** (Zen needs a third tab); accordion/scrolling have `needsDestination: false`. **Reset all column widths** only when `presentation === 'scrolling'` (`needsDestination: false`). No snapshot row.

**Float on a solo tab is a behavior change.** Today `arrange(tab, 'float')` calls `floatTab`, which throws “Choose another tab to float alongside this one”. The hub instead uses `needsDestination: true` and stays open for a target. Call that out in CHANGELOG; do not describe it as today’s rule. At `groupSize: 2` with one pane already floating, `floatTab` still throws “Keep one tab in the background before floating another”. A verb that throws follows today’s `run()`: **close the hub, then toast**. Do not leave the overlay open on that failure.

**Typing:** filter tabs by title/host (substring). A verb row is listed only when the query is empty **or the trimmed, lower-cased query equals one of that verb’s keywords**. Not a whole-word-in-a-phrase match: `grid notes` does not list Grid. Trailing space is trimmed, so `grid ` does.

Keywords (complete):

| Verb | Keywords | Enter |
| --- | --- | --- |
| Replace | `replace` | `{ type: 'needDestination', mode: 'replace' }`. Split only; hidden when solo. Pick a tab, then `replacePane`. |
| Split right | `right` | `needDestination` when the row says so; else `arrange(current, 'right')`. |
| Split below | `below` | Same with `'below'`. |
| Add to grid / Grid | `grid` | `needDestination` when `groupSize < 3`; else `arrange(current, 'grid')`. |
| Floating | `float`, `floating` | `needDestination` when solo; else `arrange(current, 'float')`. |
| Horizontal accordion | `accordion` | `arrange(current, 'accordion')`. |
| Scrolling | `scrolling` | `arrange(current, 'scrolling')`. |
| Reset all column widths | `reset` | Only when `presentation === 'scrolling'`. Clears `state.widths`, sets `follow`. Not a layout mode. |
| Unsplit | `unsplit` | `unsplit` the current / named group. |
| Restore tiled layout | `restore`, `tiles` | `arrange(current, 'tiles')`. |
| Return to a normal tab | `return`, `normal` | `arrange(current, 'normal')`. Hidden when `groupSize: 1`. |
| Add another tab | `add` | `{ type: 'needDestination', mode: 'right' }` (today’s `chooseTab(tab, 'right')`). |

No **snapshot** verb. Main’s layout menu has none; leftover `snapshot` is `normalizeMode` → `scrolling`.

On a solo tab with several existing splits, `unsplit` lists an Unsplit row per group. Prefixes never promote a verb: `acc` does not list Accordion.

**No undo yet (accepted).** An exact query `grid` or `float` ranks that verb first. Enter rearranges the current split immediately. **Jasiel decided no confirm** (team chat, 9 Oct 2026 — product call, not a technical argument). PR1–6 have no undo. Call the misfire risk out in CHANGELOG.

**Keys:**

| Key | Action |
| --- | --- |
| Type | Filter. Letters, digits, and brackets always type (`1Password`, `[Draft]`). |
| ↑ / ↓ | Move the selected row. While peek is open, move among peek actions instead. |
| Enter | Run that row’s default, or the selected peek action. **Arrange this split…** only opens arrange-scope; it never applies a layout. Destination row → current default layout. Verb row → that verb on the current tab. Group row → join with current default. |
| Shift+Enter | Toggle **peek** on a destination or group row. Peek actions depend on `inSplit`: in a split → Replace, Right, Below, Float, More…; solo → Right, Below, Float, More… (no Replace). No-op on a verb row. This **replaces** today’s Shift+Enter = join as Floating. |
| Tab / Shift+Tab | Next / previous control. Search, default-layout chip, Show all (until PR5), settings, diagnostics, close. **Results are not a tab stop** (`aria-activedescendant`). Never peek. Closes peek first if it was open. |
| ← / → | Move the caret in search. Never peek, never change layout. |
| Ctrl+Shift+[ / Ctrl+Shift+] | Cycle the **default layout** chip. Match `code === 'BracketLeft' \| 'BracketRight'` with Control+Shift and **no** Alt/Meta. Not Option+arrows, not Alt+arrows, not Ctrl+arrows, not `key === '['`. |
| Escape | Close peek if open. Else **clear query** (stay in `needDestination` if that is the current state). Else leave `needDestination` (back to arrange verbs, restore previous chip). Else collapse Show all (until PR5 drops that control). Else close hub. Refocus the page. |
| Layout-menu shortcut | If the hub is closed or not in arrange-scope: open/switch this overlay to arrange-scope. **If already in arrange-scope: no-op.** Open Pane still toggles closed. |

**Physical brackets, not characters.** On a US layout Shift turns `[` into `{`, so the reducer must use `event.code`. AltGr on Windows is Ctrl+Alt; `!altKey` keeps that from cycling. On layouts where `[` / `]` need AltGr (German, Nordic, and others) this chord cannot be typed — **non-US layouts are out of scope for the native gate**; the chip click and chevron menu are the fallback.

**Peek transitions — keys** go through `reduce(state, keyInput)`. Search stays focused. `peek: null | { row, actionIndex }`.

| From | Input | To |
| --- | --- | --- |
| Peek closed, destination or group selected | Shift+Enter | Peek open, first action selected |
| Peek closed, verb selected | Shift+Enter | No-op |
| Peek open | Shift+Enter | Peek closed, same row selected |
| Peek open | Escape | Peek closed. Query and hub unchanged |
| Peek open | Enter on More… | Peek closed; open the layout list in place. Hub stays open |
| Peek open | Enter on any other peek action | Run it, close hub |
| Peek open | ↑ / ↓ | Move among peek actions (wrap). List selection unchanged |
| Peek open | Tab / Shift+Tab | Peek closed, then next/previous control |
| Peek open | Ctrl+Shift+BracketLeft/Right | Peek closed, then cycle default layout |
| Peek open | any other key (Backspace, Delete, Home/End, PageUp/Down, printable, paste, …) | Peek closed, then that key’s normal handling |

↑/↓ stay inside peek. Escape only leaves peek. Any other unlisted key leaves peek and then runs its normal handling.

**Peek transitions — pointer** stay at the **edge** (DOM handler). They do **not** go through `reduce`. `keyInput` stays key fields only. Do not retag the second argument as hover/click.

| From | Input | To |
| --- | --- | --- |
| Peek open | click More… | Same as Enter on More… |
| Peek open | click any other peek action | Run it, close hub |
| Peek open | hover another result row | **No-op.** Selection and peek stay put (today `mouseenter` would steal the row). |
| Peek open | click another result row | Peek closed, that row selected (do not activate) |
| Peek open | click the layout chip / chevron | Peek closed, then chip/menu handles the click |
| Peek open | click backdrop | Close hub (same as today) |

**A11y:** search is a `combobox`; results are a `listbox`; the selected row is `aria-activedescendant` on the input. Peek is a **second listbox** (not buttons inside an `option` — that was problem #5). While peek is open, `aria-activedescendant` points at the selected peek action.

**Removed in C (call out in CHANGELOG and `picker.md`):**

- Split-card **Shift+Enter → Floating**. Replacement: Shift+Enter opens peek, then choose Floating (or set the default-layout chip to Floating and press Enter).
- Nested Add / Floating / Unsplit buttons on split cards. Replacement: group rows + peek / default chip / Unsplit as its own verb row.
- **Unsplit keeps the picker open.** Replacement: Unsplit closes the hub, same as every other activating row. Reopen to unsplit another group.

**Close the hub:** every activating row closes it, including Unsplit. Copy diagnostics is the exception: toast, hub stays. Open settings closes because it navigates away.

The swap-header button still opens the hub anchored, default = Replace.

**Good:** one glass, one shortcut family, one focus rule. Matches “picker as hub.” Layout menu stops being a second product. Search can find “accordion” without a ninth chip. Scales when a later layout appears: it is a row, not a chip.

**Bad:** an exact query `grid` ranks the Grid verb above a tab titled “Grid notes” — that is intentional; prefixes like `gr` must not. Bigger behavior change; needs careful empty states. Power users who liked clicking a fat Replace chip need a visible default-layout chip so the mode is never invisible.

**Use if:** Pane’s main keyboard object should be this overlay, and the layout menu should become a view of it.

---

## 4. Recommendation

**Ship Direction C (Jasiel, 2026-10-09).** Item 8 is named picker-as-hub, not picker-polish. A and B each fix one pain (keys for modes, or wrong-mode mistakes) and leave two surfaces. C makes the picker the place you go to change panes, whether or not you need another tab. Exact-verb Enter applies immediately; no confirm.

Do **not** build a freeform Spotlight that runs arbitrary commands. Rows are a closed set: destinations we already allow, plus the arrange verbs the layout menu already has. Same eligibility, same limits, same rollback.

Default-layout chip (`Ctrl+Shift+[` / `Ctrl+Shift+]`, physical `BracketLeft`/`BracketRight`) keeps the fast path: type `notes`, Enter, done. Peek (`Shift+Enter`) is the safe path when you are not sure. Tab still reaches close and settings. Layout-menu shortcut is the arrange-only view of the same widget, so Mac `Ctrl+Shift+L` does not disappear.

**Out of scope for this item**

- Cross-workspace moves, extra native windows, breaking Zen’s four-tab cap (`ROADMAP.md` boundaries).
- Undo, named layouts, and settings export/import (later on the product roadmap; they plug into this hub — see §5 — they are not in PR1–6).
- New layouts.
- Visual redesign for its own sake. Reuse glass tokens, icons, width pref. Drop the wrapping chip bar; do not restyle the browser.
- Changing replace/add/join internals except where the hub has to call them.

**What success looks like**

A keyboard-only user can, without a mouse and without Tab-ing through a mode bar:

1. Swap the current pane for a named tab.
2. Split a named tab right / below / float.
3. Turn the current split into accordion or scrolling.
4. Unsplit or restore tiles.
5. Cancel with Escape without losing the page.

Mouse still works: click a row, click the default-layout chip, click peek actions.

---

## 5. Later features on this hub (not in the plan)

`ROADMAP.md` lists these after the reliability gates. They do **not** change PR1–6. They only show that Direction C has a slot for each one so we do not grow a fourth popup later. Build them only after the hub exists.

This section is vocabulary for the later items, **not a code framework**. PR1–6 only need destination rows, verb rows, and one `scope: 'arrange'`. Do not introduce a general row-type plugin layer until a second scope actually exists.

Hub rows are one of three things:

- **Verb** — a command (`Unsplit`, `Restore tiled layout`). Enter runs it.
- **Scope** — the same overlay, filtered (`scope: 'arrange'` from the layout-menu shortcut).
- **Entry type** — a kind of destination row (open tab, existing split). Peek still applies.

| Later item | Fits as | How it shows up |
| --- | --- | --- |
| Undo the last layout/replacement | **Verb** | Empty-query row `Undo last layout`, searchable as `undo`. Disabled with an honest reason if the tabs are gone (same rule as today’s toasts: closed outgoing tab is explicit, not silent). No new scope. |
| Named layouts | **Entry type** + one **verb** | Verb: `Save current layout as…`. Rows: saved names in a “Saved layouts” section; type the name to filter; Enter applies to the current split. Peek: Apply / Update from current / Rename / Delete. Optional later `scope: 'layouts'` (same trick as arrange-scope), not a second dialog. |
| Versioned settings export/import | **Verbs** | `Export Pane settings…` and `Import Pane settings…` next to the settings/diagnostics verbs. File format and versioning stay a settings problem. Import is still a verb (pick a file, confirm); do not add a settings-files entry type unless presets become first-class later. |

Closed set still applies: these are named rows, not a plugin API. Same local-only / rollback / eligibility rules when those features are actually designed.

---

## 6. Implementation plan (small PRs)

Do not rewrite `pane.uc.mjs` in one shot. Each PR should leave the previous keyboard path working. Native Zen stays Jasiel’s gate; agents run fixtures only. Direction C is decided. PR1–6 implement C; they still do not include undo, named layouts, or settings files. This design PR remains docs-only.

**Packaging (every new module).** `validate.mjs` has a hard-coded Sine file list, and the forbidden-capability scan (`fetch(`, `eval(`, `nsIProcess`, …) only reads `pane.uc.mjs` today. `npm test` is the explicit `node --check` / `node scripts/test-*.mjs` chain in `package.json` — a fixture that is not appended there never runs, and CI stays green. For each of `picker-model.mjs`, `layout-options.mjs`, and `picker-keys.mjs`: add it to the `validate.mjs` package list; include its source in the capability scan; add `node --check <file>`; add `node scripts/test-<name>.mjs` to `check`. Same rule if a later PR adds another file.

### PR 0 — this document

Design only. What you are reading.

### PR 1 — Extract a picker model, no UI change

Pull pure helpers out of `pane.uc.mjs` into something like `picker-model.mjs` (name TBD). **No browser globals.** The function does not read `gBrowser`, `splitter()`, `Services.prefs`, `boolPref`, or `window`. Callers assemble plain data at the edge:

```text
eligibleDestinations({
  target,            // current tab record
  currentGroupTabs,  // tabs already in this split, or []
  tabs,              // same-workspace tab records (id, title, url, lastUsed, splitView, closing, hidden, supported)
  groups,            // other split groups as { tabs: [...] }
  recentFirst,       // boolean
})
```

Also:

- `filterDestinations(list, query)`
- `defaultMode({ inSplit })`
- `activatePlan({ kind, mode })` — returns `{ op: 'replace'|'add'|'join'|'unsplit'|'arrange', mode }` without touching Zen. **No `shiftKey`.** Float is just `mode: 'float'`. Key meaning lives only in the reducer. **Today’s split-card rule lives here:** `activatePlan({ kind: 'split', mode: 'replace' })` returns `{ op: 'join', mode: 'grid' }` (`openCandidate` currently does `requestedMode || (openMode === "replace" ? "grid" : openMode)`). `normalizeMode` only maps `snapshot` → `scrolling`; `replace` passes through. What rejects it is `join`’s “Unknown layout” guard (`layoutTypes` is right/below/grid only). The plan absorbs that.

Wire `openCandidate` to the plan. **No visual change.** Callers pass an explicit `mode`. Until PR2, the DOM handler may still branch on Shift at the edge, **only for split cards:** `mode: (rowKind === 'split' && event.shiftKey) ? 'float' : openMode`. On a tab row, Shift+Enter is plain Enter (Replace still replaces). After PR2 the handler only executes the reducer’s `{ type, mode }` and never reads Shift. The model never sees Shift.

Put a pure `arrangeOptions({ groupSize, currentMode, presentation })` in a tiny **`layout-options.mjs`**. `multiwindow.mjs` and `picker-model.mjs` both import it. Do **not** export it from `multiwindow.mjs` — Node fixtures should not load the browser-facing controller. It returns the layout-menu rows that **main** shows: accordion/scrolling only when `groupSize >= 2`, `tiles` only when presentation is accordion/scrolling, **Reset all column widths** only when `presentation === 'scrolling'`, current-mode flag. **No snapshot row.** `openMenu` renders that list; it does not build it inline. The hub will reuse it in PR4 so the “arrange-scope equals the layout menu” test compares one source.

**Tests:** table-driven Node fixtures for eligibility (solo vs in-split, other-split tabs excluded, workspace, empty tabs), substring filter, default mode. `activatePlan({ kind: 'split', mode: 'float' })` vs `mode: 'grid'` vs **`mode: 'replace'` → `{ op: 'join', mode: 'grid' }`**. `arrangeOptions` tables: `groupSize: 1` (right/below/grid/float only, **Normal hidden**, all four `needsDestination: true`); `groupSize: 2` (Grid `needsDestination: true`, Accordion/Scrolling `false`); `presentation: 'scrolling'` includes **Reset all column widths**, other presentations do not; 4 panes; each presentation. **No snapshot row in any table.** **No reducer tests in this PR** (`picker-keys.mjs` does not exist yet; `needDestination` lives in PR4). Move the source-slicing checks in `test-replacement.mjs` onto the plan object. A fixture that imports the model in Node must not touch `globalThis.gBrowser` or `Services`. Add `picker-model.mjs` and `layout-options.mjs` to `validate.mjs` (package list + capability scan) and to `package.json` `check` (`node --check` + their test scripts).

**Why first:** every later UI needs this, and it locks the rules we must not break.

### PR 2 — Keyboard controller for the current dialog

A small `picker-keys.mjs`. One reducer for every later PR:

```text
reduce(state, keyInput)
```

`state` is `{ query, expanded, selectedIndex, mode, scope, peek, pending, inSplit, rows }`. Fields that do not exist yet are `null` (`scope`, `peek`, `pending`). `pending` is `null | { needDestination: mode, previousMode }` — `previousMode` is the default-layout chip before the verb, so Escape can restore it without reading the DOM. `rows` is the current list (each row may carry `kind` / `needsDestination`). `keyInput` is `{ key, code, keyCode, ctrlKey, shiftKey, altKey, metaKey, isComposing }` — **keys only**. Pointer (hover/click) stays at the edge; do not widen this signature. Plain data. No DOM, no `gBrowser`. PR4 fills the nulls; it does not invent a second signature.

If `isComposing` or `keyCode === 229` (IME), **no-op** for Enter, Escape, arrows, Shift+Enter, and the bracket chord — composition commit/cancel must not activate a row or close the hub. Cycle-layout is:

```text
ctrlKey && shiftKey && !altKey && !metaKey &&
  (code === 'BracketLeft' || code === 'BracketRight')
```

Map it onto today’s DOM:

- That chord cycles `openMode` even while the query is non-empty. Match `code`, not `key`.
- **No** bare `[` / `]`, even on an empty query. Printable keys always type (`[Draft]`, `[WIP]`).
- **No** `1`–`8` mode shortcuts. The first keystroke of `1Password`, `2048`, or `9to5Mac` must go into search.
- **No** Alt/Option+arrows (Mac word-jump; Windows/Linux browser Back/Forward).
- **No** Tab or Left/Right as mode/peek keys. Tab stays in the existing focus trap; arrows stay caret movement.
- Do not yet remove the chip bar — selected mode just follows the controller so we can see it work.
- Shift+Enter: **only a split-card row** returns `{ type: 'activate', mode: 'float' }` in this PR. On a tab row it is the same as Enter (`{ type: 'activate', mode }` uses the current default, so Replace still replaces). That is today’s `openCandidate` behavior. Peek mapping lands in PR4; `activatePlan` does not change.

**Do not let a recorded shortcut steal the chord.** `bindingFromEvent` stores `event.key`, so on a US layout Ctrl+Shift+] records as `Ctrl+Shift+}`. `layoutBindings()` compares `binding.label`, and it never checks a custom Open Pane shortcut (`mod.pane.custom-shortcut` / `pickerBinding()`) against anything.

- Treat `[`/`{` and `]`/`}` as the same reserved chord (Ctrl+Shift, no Alt/Meta). Conflict check by that normalized pair **or** by `event.code` `BracketLeft`/`BracketRight`. A saved label `Ctrl+Shift+}` must match.
- Run that check on layout shortcuts **and** on the Open Pane recorder. Reject a custom picker binding of `Ctrl+Shift+}` at record time (`Already used by the layout cycle`). An already-saved pref can still hold it, so the runtime guard is the real protection.
- **Runtime, narrow:** entry handlers step aside **only when the event is the hub cycle chord** (`code` BracketLeft/Right + Ctrl+Shift, no Alt/Meta). Open Pane still **toggles closed**. Layout-menu still switches an open hub into arrange-scope. Accordion prev/next still run unless they are that chord.

Q8 still says do not *record* in-hub keys as prefs. This is the other direction: do not let users record *over* them.

**Tests:** event `{ code: 'BracketRight', key: '}', ctrlKey: true, shiftKey: true }` on a solo tab **skips Replace** and walks the visible modes. Same chord with `altKey: true` (AltGr) does **not** cycle. `{ key: '[' }` with no modifiers types. `{ isComposing: true }` or `{ keyCode: 229 }` on Enter / Escape / arrows / Shift+Enter / the bracket chord is a no-op. Non-empty query: letters and digits do not change mode. Escape still three-stage on the current dialog (peek / `needDestination` stages land in PR4; Show-all collapse stays until PR5). Enter payload is `{ kind, mode }` matching PR 1. Shift+Enter on a **split card** activates float; Shift+Enter on a **tab row** with default Replace still `{ type: 'activate', mode: 'replace' }`. `test-keybindings.mjs`: layout-menu recorded as `Ctrl+Shift+}` errors; custom Open Pane `Ctrl+Shift+}` is rejected at record time; with that pref already saved, the hub chord cycles and does not toggle; default Open Pane with the hub open still closes it. Add `picker-keys.mjs` to `validate.mjs` (package list + capability scan) and to `package.json` `check`.

**Native (Jasiel):** picker.md plus real OS Control+Shift+physical-`]` while search is focused; confirm Option+arrows still move by word on Mac and Alt+Left still is Back on Windows (those keys must not be `preventDefault`ed). **Non-US layouts (AltGr brackets) are out of scope** for this gate; chip/chevron remain. IME composition Enter/Escape: **NOT RUN** unless a CJK layout is available.

### PR 3 — Collapse the chip bar to one default-layout chip

UI: one chip next to the count (`Replace ▸` / `Split right ▸`). Click or Control+Shift+physical-`[`/`]` to cycle. Click-chevron opens a short menu of layouts (the old chips, as a list). Arrange current becomes the first list row when `inSplit`. Help footer: `↑↓` `Enter` plus the chord — on macOS render `⌃⇧[` / `⌃⇧]` so nobody reaches for Command; elsewhere `Ctrl+Shift+[` / `Ctrl+Shift+]`. Then `Esc`.

Keep `#pane-open-modes` as an implementation detail or replace with a `[data-mode]` chip so the verify recipe can be updated in the same PR.

**Tests:** markup contains one default-mode control; every `modeLabels` key still reachable from the chevron list; Arrange row present iff in split; `validate.mjs` asserts those ids if we keep them as contracts.

**CSS:** chip + menu must wrap at 320px width. Reduced motion: no pop animation.

**Native:** narrow window, every layout still choosable, screenshot refresh for README.

### PR 4 — Verb rows (hub v1)

Add command rows to the same list:

- From a split: Restore tiled (if accordion/scrolling), Return to a normal tab, Unsplit group, **Reset all column widths** (scrolling only), and the presentation layouts as verbs that call `arrange(current, mode)` **without** picking another tab. No snapshot verb.
- From solo: Existing split rows become `Join …` / `Unsplit …` as sibling rows, not nested widgets. Inner Add/Floating/Unsplit buttons go away; peek (`Shift+Enter`) or the default-layout chip supplies Add vs Float.

**Module boundary:** `multiwindow.mjs` must **not** import `pane.uc.mjs`. Inject `openHub(tab, { scope, anchor })` into `createMultiwindow` (same pattern as today’s `chooseTab`). Layout-menu shortcut dispatch can stay in `onAccordionShortcut`; it calls `openHub` instead of building `#pane-layout-menu`. Every current `openMenu(tab, anchor)` site uses that callback and keeps its anchor:

- layout-menu shortcut
- split-header three-dot
- picker Arrange current (already in pane.uc)
- floating-tab header
- accordion bar **more**
- accordion handle on the active tab
- scrolling header **more**

Opening arrange-scope must run the same **side effects as `openMenu` today**: cancel scrolling overview, drop the snapshot overlay, then show the hub. Read the anchor rect **before** teardown so the dialog is not placed at `0,0` (the scrolling-card menu bug). Keep `getBoundingClientRect()` **floats unrounded until the final style write**, same as divider sizes.

**Reducer:** still `reduce(state, keyInput)` from PR2. PR4 fills `scope`, `peek`, `pending` (`{ needDestination, previousMode }`), `inSplit`, and per-row `needsDestination`. Peek actions are derived from `inSplit` in state, not from the DOM. Hover/click in peek are **edge tests**, not reducer cases.

When the hub opens **in a split** (empty query, not arrange-scope), **the first destination row is selected** (Q2’s Replace default). Arrange this split… is listed but not selected.

Layout-menu shortcut with the hub **already in arrange-scope: no-op**. With the hub open in the default (destination) view: switch to arrange-scope. Open Pane still toggles closed.

Arrange-scope rows come from `layout-options.mjs` `arrangeOptions(...)`, not a second copy. Search placeholder: “Arrange this tab…”. `#pane-layout-menu` can stay for one release as a fallback behind a pref, default off once fixtures pass — or delete in this PR if Jasiel prefers one surface immediately (open question).

**Shift+Enter:** from this PR on, the reducer maps it to peek (see the transition table in §3C). It no longer activates Floating. `activatePlan` is unchanged. Document in CHANGELOG and `picker.md`.

**Tests:** arrange-scope list **is** `arrangeOptions` for that tab (right/below/grid/float/accordion/scrolling/normal/tiles/add, plus **reset** iff scrolling). **No snapshot row.** Choosing a verb does not call `add()`. On a solo tab (`groupSize: 1`), Enter on Split right/below/grid/float is the reducer’s `{ type: 'needDestination', mode }` — overlay stays open, chip set, destination rows shown; `add()` is not called; `activatePlan` is not invoked. Enter on **Add another tab** is `{ type: 'needDestination', mode: 'right' }`. Enter on **Replace** (split only) is `{ type: 'needDestination', mode: 'replace' }`. Same for **Grid on a 2-pane split** (`groupSize: 2`): Enter goes to destination rows, does not call `add()`. Accordion/Scrolling on 2 panes apply immediately (`needsDestination: false`). Enter on Reset (scrolling) clears widths; a throw from `floatTab` (last background pane already floating) **closes the hub then toasts**, matching `run()`. Escape: query `not` while picking a destination → first Escape clears `not` and stays in destination picking; second Escape returns to arrange verbs and restores `pending.previousMode`. Peek **key** transitions: reducer cases for every key row in §3C, including the catch-all. Peek **pointer** (hover no-op, click another row, click More…): edge tests only. Join/unsplit still hit the existing controller methods (extend `test-multiple-floats.mjs`). Unsplit **closes** the hub. `createMultiwindow` is constructed with `openHub`; `multiwindow.mjs` source does not import `pane.uc.mjs`. **Ordering fixture (not pixel position):** injected mocks, `getBoundingClientRect` on the anchor is called **before** `cancelOverview` / snapshot teardown. Fixtures still do not build the overlay. Placement (`not 0,0`) is native-only. If this PR adds a test file, append it to `package.json` `check` and `validate.mjs`.

**Do not** change replace/add rollback in this PR. Keep calling `arrange()` rather than re-deriving divider sizes.

### PR 5 — Search verbs and ranking

Query filters destination rows by substring. Verb rows appear only when the **trimmed, lower-cased query equals a keyword** from the §3C table, then rank above tabs. Prefixes never promote a verb. Update empty-state copy. Drop “Show all” if the list is one scrolling column with a reasonable recent cap (keep the pref as “rows before the fold” or retire it — open question). After Show all is gone, drop the Escape “collapse Show all” stage.

Exact-keyword Enter rearranges the current split immediately. **Jasiel decided no confirm.** No undo in PR1–6. Note it in CHANGELOG.

**Tests:** `filterHub(query)` ranking tables. Query `grid` with a tab titled “Grid notes”: Grid verb first, then the tab. Query `grid notes`: **no Grid verb**, tab stays. Query `grid ` (trailing space): Grid verb after trim. Queries `acc`, `gr`, and `flo` with tabs “Accounts” / “Grid notes” / “Float plan”: the matching **tab stays first**; no Accordion/Grid/Floating verb is listed. Every keyword in the §3C table has a row (`reset` only when presentation is scrolling; **no `snapshot`**). Query `unsplit` on a solo tab with two other groups: two Unsplit rows. Query `restore` or `tiles` lists Restore tiled layout; `return` or `normal` lists Return this tab to the sidebar. Query `add` lists Add another tab; Enter is `needDestination` with mode `right`. Query `replace` in a split lists Replace; Enter is `needDestination` with mode `replace`. Escape clears query before close. Enter on the Grid verb with query `grid` calls `arrange` with no confirm step.

**Privacy:** still no titles in diagnostics. Previews: only for visible destination rows, still in-memory, still dropped on close (generation counter stays).

### PR 6 — Docs, skill, screenshots

README, CHANGELOG ( **Shift+Enter no longer floats**; peek instead; **Unsplit now closes the hub**; **Floating a solo tab now asks for a destination** instead of throwing ). picker.md + layout-menu.md (every arrange entry point now “opens the hub in arrange scope”). Stale `pane-current-picker.png` / arrange screenshot. `COMPATIBILITY.md` narrow-picker line. Mac help footer uses `⌃⇧[` / `⌃⇧]`.

No user-visible behavior in this PR if PR 4–5 already landed.

### Order and risk

```text
PR1 model  →  PR2 keys  →  PR3 chip  →  PR4 verbs+scope  →  PR5 ranking  →  PR6 docs
```

C is decided. PR4 is the point of no return for deleting the layout popup.

**Conflict watch:** `pane.uc.mjs` / `multiwindow.mjs` are hot. Rebase onto scrolling-merge (PR #7) and accordion-resize (landed as #6) before each picker PR.

---

## 7. Test plan (what “done” means per layer)

### Fixtures (every PR)

`npm test` plus new Node files. No Zen.

- Eligibility and filter (PR 1, 5). Model fixtures pass `{ tabs, groups, recentFirst }` — no `gBrowser` / `Services`.
- `arrangeOptions` tables from `layout-options.mjs` (PR 1, 4).
- Key state machine (PR 2–4): `reduce(state, keyInput)` with the PR2 shape (`pending` holds `previousMode`); `code: 'BracketRight'` with `key: '}'` + Ctrl+Shift cycles; AltGr does not; `isComposing` / `keyCode === 229` no-ops Enter/Escape/arrows/Shift+Enter/brackets; bare `[` types; digits type; Tab = next control; Shift+Enter on a split card = `{ type: 'activate', mode: 'float' }` until PR4 then peek; Shift+Enter on a tab row = same as Enter; Escape stages (clear query before leave-`needDestination`). Peek hover/click are edge tests, not reducer cases.
- New modules listed in `validate.mjs` (package + capability scan) and in `package.json` `check`, or CI is lying.
- `activatePlan({ kind, mode })` only — no `shiftKey`. Keep existing rollback tests.
- Markup: combobox + listbox + `aria-activedescendant`; peek is a nested listbox, not controls inside an option. Nested buttons on split cards should be gone by PR 4.
- Reduced-motion class/attribute still set from prefs/CSS.

### Native (Jasiel, throwaway profile only)

Do not treat fixtures as native proof. Follow `.cursor/skills/verify-pane/SKILL.md`.

Update `features/picker.md` and `features/layout-menu.md`:

- Both old picker entry points plus **every** arrange entry: shortcut, split three-dot, picker Arrange, floating header, accordion more + active handle, scrolling header.
- Solo and existing split; 2 and 4 panes; narrow width.
- Search title and host; arrows; Enter; mouse click.
- Default-layout cycle with **real** OS Control+Shift+physical `[` / `]`, not synthetic keydown. Footer shows `⌃⇧[` / `⌃⇧]` on Mac.
- Confirm Option+←/→ still word-jumps in search on Mac; Alt+← is still Back on Windows when a query is present.
- Type `1Password` and `[Draft]` — must filter, not change mode.
- Tab order is search, chip, Show all (until PR5), settings, diagnostics, close — not the result rows. Shift+Enter peeks (after PR4); it does not float. **Until PR4**, Shift+Enter on a split card still floats; on a tab row it is still Enter. Peek on a solo tab has no Replace. More… opens the layout list in place. Escape from peek returns to the list. Hover another result while peek is open does nothing (pointer at the edge, not the reducer).
- Arrange-scope: accordion / scrolling / restore tiles / unsplit / return to normal / **Reset all column widths** (scrolling only). **No snapshot row.** Opening it from a scrolling overview cancels the overview first; from a scrolling-card **more** button the hub is **not** at `0,0`. Layout-menu shortcut while already in arrange-scope is a **no-op**.
- Escape stages; focus returns to the page.
- Replacement still keeps divider sizes; unsplit keeps origins and **closes** the hub.
- Non-US AltGr-bracket layouts: NOT RUN unless Jasiel opts in; chip/chevron is the fallback.
- IME composition Enter/Escape must not activate or close. **NOT RUN** unless a CJK layout is available.
- Solo tab, arrange-scope, Enter on Split right or Floating: hub stays open, chip set, destination list shown; `add` is not called until a tab is chosen (Floating no longer throws). Type a query then Escape: query clears first; a second Escape returns to arrange verbs and restores `pending.previousMode`.
- 2-pane split, arrange-scope, Enter on Grid: destination rows, `add` not called. Enter on Accordion applies immediately. Enter on Reset (scrolling) clears column widths. Floating the last background pane closes the hub and toasts.
- Default Open Pane shortcut with the hub open still closes it. Layout-menu shortcut with the hub open in the destination view switches to arrange-scope; if already in arrange-scope, no-op.
- Exact query `grid` + Enter applies Grid immediately (no confirm).
- Seed pinned / Essential / folder tabs as in the skill.

Record PASS / FAIL / NOT RUN per entry point.

---

## 8. Open questions for Jasiel

Closed: direction **C**; exact-verb Enter **applies immediately, no confirm**; letter/digit/bare-bracket chords **never**. See §10.

1. **Layout menu popup:** delete in PR 4, or keep one release behind a hidden pref? Recommendation: delete once arrange-scope fixtures pass, keep the shortcut.

2. **Default Enter in a split:** keep Replace, or last-used layout? Recommendation: keep Replace. Last-used surprises people who just want to swap a page.

3. **Join from inside a split:** today you cannot. Should a hub row “Join another split” appear when you are already split (Zen limit allowing)? Recommendation: yes, as an explicit row, not mixed into Recent. Needs a product yes/no.

4. **Show all vs one list:** retire compact thumbs, or keep thumbs for the first N destination rows? Recommendation: keep thumbs only in the empty-query recent section; searching and verb rows are text. Privacy and speed get better; the current screenshot look stays for the common case.

5. **Snapshot vs scrolling:** **Closed.** Main already has one Scrolling row. Arrange-scope matches that list: no snapshot verb; leftover `snapshot` is `normalizeMode` → `scrolling`.

6. **Settings/diagnostics:** stay as header icons, or also verb rows (`Open Pane settings`, `Copy diagnostics`)? Recommendation: keep icons; add verb rows so they are searchable. Same actions.

7. **Anchored vs centered:** keep header-button anchored, shortcut centered? Recommendation: yes. Hub should not change placement prefs.

8. **Record in-hub keys as prefs?** Control+Shift+brackets and Shift+Enter-as-peek vs leaving them hard-coded like ↑↓ Enter Esc. Recommendation: **do not record them**. They are overlay keys, not Pane app shortcuts. Recording *over* them is blocked in PR2 (normalized `[`/`{` `]`/`}` plus runtime step-aside **only** on the hub chord, so Open Pane still closes).

9. **Name in the UI:** keep the heading “Replace or arrange this pane” / “Open a tab alongside this one”, or one heading “Pane”? Recommendation: one heading **Pane**, context line still “Currently showing …”. Two headings were covering for two jobs; the hub is one job.

---

## 9. Files that will change later (not in this PR)

| File | Role |
| --- | --- |
| `pane.uc.mjs` | Overlay DOM, open/close, replace transaction, shortcut toggle. Owns the hub; passes `openHub` into `createMultiwindow`. |
| `picker-model.mjs` | Pure eligibility, filter, `defaultMode`, `activatePlan({ kind, mode })`. |
| `picker-keys.mjs` | Pure `reduce(state, keyInput)`. `state` is `{ query, expanded, selectedIndex, mode, scope, peek, pending, inSplit, rows }`. `pending` is `{ needDestination, previousMode }`. `keyInput` is keys only; pointer stays at the edge. |
| `layout-options.mjs` | Pure `arrangeOptions`. Imported by `multiwindow.mjs` and the hub. |
| `multiwindow.mjs` | `add` / `join` / `unsplit` / `arrange` / `openMenu`. Does **not** import `pane.uc.mjs`. |
| `chrome.css` | Overlay, chips, results, layout menu. |
| `keybindings.mjs` | Entry shortcuts only (open picker, layout menu, accordion, diagnostics). Reserve Ctrl+Shift `[`/`{` and `]`/`}` (physical BracketLeft/Right) against layout shortcuts **and** custom Open Pane. In-hub keys stay hard-coded; see question 8. |
| `appearance.mjs` / `preferences.json` | Width, recent-count, compact, position, dim, help. |
| `package.json` | `check` / `test` chain. New modules get `node --check` and a `scripts/test-*.mjs` entry or they never run. |
| `scripts/validate.mjs` | Sine package file list and forbidden-capability scan. New modules must be on both (scan is `pane.uc.mjs` only today). |
| `scripts/test-replacement.mjs` | Replace + split activation. |
| `scripts/test-multiple-floats.mjs` | Layout ops. |
| `scripts/test-keybindings.mjs` | Conflict: recording `Ctrl+Shift+}` as layout-menu or custom Open Pane is rejected; default Open Pane still closes the hub. |
| `.cursor/skills/verify-pane/features/picker.md` | Native recipe. |
| `README.md`, `docs/pane-current-picker.png` | User-facing. |

This PR adds only `docs/picker-redesign.md`.

---

## 10. Decision log

| Date | Decision |
| --- | --- |
| 2026-10-09 | Design-only. Direction C recommended, staged as PR1–6. **Superseded:** Jasiel picked C the same day (row below). |
| 2026-10-09 | Later roadmap items (undo, named layouts, settings export/import) map onto hub verbs / scopes / entry types. They do not change PR1–6. |
| 2026-10-09 | Item 8 confirmed: keyboard-first; picker is the one place to find a tab, choose a layout, and move between panes. |
| 2026-10-09 | Review of PR #8: default-layout cycle is `Ctrl+Shift+[`/`]` **and empty-query `[`/`]`** — **superseded** (bare brackets dropped). Peek is `Shift+Enter`; Tab stays next-control; no digit chords; `openHub` + `arrangeOptions`; PR1 plain data; Shift+Enter-as-Float named as a removal; Unsplit closes the hub. |
| 2026-10-09 | Re-review: match `event.code` BracketLeft/Right; drop bare `[`/`]`; verbs rank on exact name only; peek transition table; PR4 position check is native, fixture only asserts rect-before-teardown order; `activatePlan` has no `shiftKey`; `arrangeOptions` lives in `layout-options.mjs`; Unsplit-closes is a CHANGELOG removal; combobox+listbox+`aria-activedescendant`; Mac footer `⌃⇧[`. |
| 2026-10-09 | Packaging: new modules go in `validate.mjs` + `package.json` `check`. IME: reducer no-ops `isComposing` / `keyCode === 229`. Two-tab verbs: `needDestination` from the reducer; `arrangeOptions` rows carry `needsDestination`. |
| 2026-10-09 | **Jasiel (team chat, not on this PR):** Direction **C**. Exact-verb Enter rearranges immediately — **no confirm** (Q11 closed; layout menu stays one Enter). Letter/digit/bare-bracket chords never (old Q3). This row is the record of that call. |
| 2026-10-09 | Reservation matches physical brackets: saved `Ctrl+Shift+}` / `{` conflict. Custom Open Pane is conflict-checked. Runtime step-aside is **only** the hub cycle chord; Open Pane still closes. Peek: no Replace on solo; More… stays open. Escape from `needDestination` returns to arrange verbs. Verb keywords: `restore`/`tiles`, `return`/`normal`. Tab list has no result rows. Peek catch-all: any other key. |
| 2026-10-09 | Reducer is `reduce(state, keyInput)` from PR2 on (`state` holds `scope` / `peek` / `pending` / `inSplit` / `rows`; null until those PRs). Shift+Enter floats **split cards only** until PR4; a tab row stays Enter. `activatePlan({ kind: 'split', mode: 'replace' })` → `{ op: 'join', mode: 'grid' }`. Grid at `groupSize: 2` needs a destination. Hide Normal on solo. Hover-in-peek is a no-op. Layout-menu in arrange-scope is a no-op. Escape clears query before leaving `needDestination`. Keywords are the complete §3C table; match is trim + lower-case equality. Anchor `getBoundingClientRect()` floats stay unrounded until the style write. |
