# Picker redesign: picker as hub

Design only. No product code in this document’s pull request.

Item 8 in the local vibe-wise plan (`picker redesign / picker-as-hub`). That file is not in this git checkout; this note is from the item title, the current picker, and the numbered vibe-wise PRs already on GitHub (1–7). `ROADMAP.md` in the repo is an older product plan and does not list this item.

**Ask:** make the picker the keyboard-first home for Pane, not a tab-swap dialog with a growing pile of layout buttons.

**Recommendation:** Direction C — one command hub. Search stays focused. The list is destinations *and* verbs. The layout-menu shortcut opens the same overlay in “arrange this tab” scope. Ship it in small PRs.

**No implementation starts until Jasiel picks a direction (A, B, or C).** This document does not authorize product PRs.

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

`#pane-layout-menu` is a second dialog. Shortcut: Mac `Ctrl+Shift+L`, Win+Linux `Alt+Shift+L`. Also the three-dot header button, and the picker’s Arrange button (which **closes the picker** and opens the menu).

The menu rearranges the **current** tab: right / below / grid / float / accordion / scrolling / snapshot / return to normal / restore tiles / add another tab. Arrows and Enter work because every row is a focused button.

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

**Keys (search focused, query empty or with a modifier):**

- `[` / `]` or `Alt+←/→` cycle modes.
- `1`–`4` on an empty query: Replace, Right, Below, Float. Extra layouts live under **More** (`5` or `m`).
- ↑↓ and Enter stay “move in the list / do it.”
- Escape stages unchanged.

Arrange current stays a row at the top of the list when you are in a split (`Enter` opens today’s layout menu, or later a verb sheet). Layout-menu shortcut stays.

**Good:** smallest change. Muscle memory for search+Enter survives. Easy PRs.

**Bad:** still two surfaces. Still mode-then-tab. Number keys vs typing is a footgun unless they only work on empty query. Does not match “picker as hub.” Experimental layouts stay second-class or still crowd the rail.

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
Arrange this split…          (verbs for the current group; Enter opens the verb list or applies last layout)
Replace with…                (hint: type a tab)
Recent
  Pane roadmap
  Zen documentation
Commands
  Restore tiled layout
  Return this tab to the sidebar
  Unsplit this group
```

**Empty query, solo tab:** same idea, default verb is Split right; Existing splits are rows (`Join “A + B”`, `Unsplit “A + B”`).

**Typing:** filter tabs by title/host *and* verbs by name (`grid`, `float`, `accordion`, `unsplit`). Ranking: exact verb names first if the query is short and matches a layout, then recent tabs, then the rest.

**Keys:**

| Key | Action |
| --- | --- |
| Type | Filter. Letters never become chords while the query is non-empty. |
| ↑ / ↓ | Move the selected row. |
| Enter | Run that row’s default. Tab row → current default layout. Verb row → that verb on the current tab. Group row → join with current default. |
| Tab or → | Peek actions on the selected tab row (Replace, Right, Below, Float, More). Another Enter runs it. |
| ← | Leave the peek. |
| Alt+← / Alt+→ | Cycle the **default** layout used by Enter on tab rows. Shown as a chip next to search, not a wrapping bar. |
| Escape | Clear query → close peek → close hub. Refocus the page. |
| Layout-menu shortcut | Open this same overlay with query empty and the list scoped to **verbs for the current tab**. No destination rows. |

The swap-header button still opens the hub anchored, default = Replace.

**Good:** one glass, one shortcut family, one focus rule. Matches “picker as hub.” Layout menu stops being a second product. Search can find “accordion” without a ninth chip. Scales when a later layout appears: it is a row, not a chip.

**Bad:** ranking can surprise people (`grid` matching a tab titled “Grid notes”). Peek-on-Tab must not fight the current focus trap. Bigger behavior change; needs careful empty states. Power users who liked clicking a fat Replace chip need a visible default-layout chip so the mode is never invisible.

**Use if:** Pane’s main keyboard object should be this overlay, and the layout menu should become a view of it.

---

## 4. Recommendation

**Ship Direction C.** Item 8 is named picker-as-hub, not picker-polish. A and B each fix one pain (keys for modes, or wrong-mode mistakes) and leave two surfaces. C makes the picker the place you go to change panes, whether or not you need another tab.

Do **not** build a freeform Spotlight that runs arbitrary commands. Rows are a closed set: destinations we already allow, plus the arrange verbs the layout menu already has. Same eligibility, same limits, same rollback.

Default-layout chip (Alt+arrows) keeps the fast path: type `notes`, Enter, done. Peek (Tab/→) is the safe path when you are not sure. Layout-menu shortcut is the arrange-only view of the same widget, so Mac `Ctrl+Shift+L` does not disappear.

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

`ROADMAP.md` lists these after the reliability gates. They do **not** change PR1–6. They only show that Direction C has a slot for each one so we do not grow a fourth popup later. Build them only after the hub exists and Jasiel has picked C.

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

Do not rewrite `pane.uc.mjs` in one shot. Each PR should leave the previous keyboard path working. Native Zen stays Jasiel’s gate; agents run fixtures only. **No implementation PR starts until Jasiel picks A, B, or C.** PR1–6 below assume C; they still do not include undo, named layouts, or settings files.

### PR 0 — this document

Design only. What you are reading.

### PR 1 — Extract a picker model, no UI change

Pull pure helpers out of `pane.uc.mjs` into something like `picker-model.mjs` (name TBD):

- `eligibleDestinations(target, data, tabs)` — today’s `eligibleTabs` rules, as data.
- `filterDestinations(list, query)`
- `defaultMode({ inSplit })`
- `activatePlan(kind, mode, shiftKey)` — returns `{ op: 'replace'|'add'|'join'|'unsplit'|'arrange', mode }` without touching Zen.

Wire `openCandidate` to the plan. **No visual change.**

**Tests:** table-driven Node fixtures for eligibility (solo vs in-split, other-split tabs excluded, workspace, empty tabs), substring filter, default mode, split-card Enter vs Shift+Enter vs Replace-means-grid. Move the source-slicing checks in `test-replacement.mjs` onto the plan object.

**Why first:** every later UI needs this, and it locks the rules we must not break.

### PR 2 — Keyboard controller for the current dialog

A small `picker-keys.mjs`: given `{ query, expanded, selectedIndex, mode, rowKind, key, altKey, shiftKey }`, return the next state or an action.

Map it onto today’s DOM: Alt+arrows cycle `openMode`; `[`/`]` optional aliases when query is empty; number keys **only** when query is empty. Do not yet remove the chip bar — the chip just follows the controller so we can see it work.

**Tests:** empty query `Alt+ArrowRight` walks modes including hidden Replace on solo tabs (Replace stays skipped). Non-empty query: letters do not change mode. Escape still three-stage. Enter payload matches PR 1.

**Native (Jasiel):** picker.md plus Alt+arrows while search focused.

### PR 3 — Collapse the chip bar to one default-layout chip

UI: one chip next to the count (`Replace ▸` / `Split right ▸`). Click or Alt+arrows to cycle. Long-press or click-chevron opens a short menu of layouts (the old chips, as a list). Arrange current becomes the first list row when `inSplit`. Help footer always shows `↑↓` `Enter` `Alt+←→ layout` `Esc`.

Keep `#pane-open-modes` as an implementation detail or replace with a `[data-mode]` chip so the verify recipe can be updated in the same PR.

**Tests:** markup contains one default-mode control; every `modeLabels` key still reachable from the chevron list; Arrange row present iff in split; `validate.mjs` asserts those ids if we keep them as contracts.

**CSS:** chip + menu must wrap at 320px width. Reduced motion: no pop animation.

**Native:** narrow window, every layout still choosable, screenshot refresh for README.

### PR 4 — Verb rows (hub v1)

Add command rows to the same list:

- From a split: Restore tiled (if accordion/scrolling), Return to a normal tab, Unsplit group, and the presentation layouts as verbs that call `arrange(current, mode)` **without** picking another tab.
- From solo: Existing split rows become `Join …` / `Unsplit …` as sibling rows, not nested widgets. Inner Add/Floating/Unsplit buttons go away; peek or default-layout chip supplies Add vs Float.

Layout-menu shortcut and three-dot button open the overlay with `scope: 'arrange'`: verb rows only, search placeholder “Arrange this tab…”. `#pane-layout-menu` can stay for one release as a fallback behind a pref, default off once fixtures pass — or delete in this PR if Jasiel prefers one surface immediately (open question).

**Tests:** arrange-scope list equals what the layout menu offers for that tab (right/below/grid/float/accordion/scrolling/snapshot/normal/tiles/add). Choosing a verb does not call `add()`. Join/unsplit still hit the existing controller methods (extend `test-multiple-floats.mjs`). Peek Tab/→ on a tab row exposes modes without activating.

**Do not** change replace/add rollback in this PR.

### PR 5 — Search verbs and ranking

Query filters destinations and verbs. Short exact layout names (`grid`, `float`, `accordion`) rank above tabs. Update empty-state copy. Drop “Show all” if the list is one scrolling column with a reasonable recent cap (keep the pref as “rows before the fold” or retire it — open question).

**Tests:** `filterHub(query)` ranking tables. Query `grid` with a tab titled “Grid notes” still shows the tab, below the Grid verb. Escape clears query before close.

**Privacy:** still no titles in diagnostics. Previews: only for visible destination rows, still in-memory, still dropped on close (generation counter stays).

### PR 6 — Docs, skill, screenshots

README, CHANGELOG, picker.md + layout-menu.md (layout-menu entry point now “opens the hub in arrange scope”). Stale `pane-current-picker.png` / arrange screenshot. `COMPATIBILITY.md` narrow-picker line.

No user-visible behavior in this PR if PR 4–5 already landed.

### Order and risk

```text
PR1 model  →  PR2 keys  →  PR3 chip  →  PR4 verbs+scope  →  PR5 ranking  →  PR6 docs
```

If C feels too far after PR2, stop and re-evaluate with Jasiel. PR1–2 are useful even if we fall back to A. PR3 is the last chance to ship A and stop. PR4 is the point of no return for deleting the layout popup.

**Conflict watch:** `pane.uc.mjs` / `multiwindow.mjs` are hot. Rebase onto scrolling-merge (PR #7) and accordion-resize (landed as #6) before each picker PR.

---

## 7. Test plan (what “done” means per layer)

### Fixtures (every PR)

`npm test` plus new Node files. No Zen.

- Eligibility and filter (PR 1, 5).
- Key state machine (PR 2–4): arrows, Enter, Shift+Enter, Alt+arrows, Tab peek, Escape stages, empty vs non-empty query.
- Activation plans hit `replace` / `add` / `join` / `unsplit` / `arrange` only — mock those five. Keep existing rollback tests.
- Markup contracts for the chip and row roles (`listbox` + `option`, or `list` + `row` — pick one and test it). Nested buttons on split cards should be gone by PR 4.
- Reduced-motion class/attribute still set from prefs/CSS.

### Native (Jasiel, throwaway profile only)

Do not treat fixtures as native proof. Follow `.cursor/skills/verify-pane/SKILL.md`.

Update `features/picker.md` and `features/layout-menu.md`:

- Both old entry points plus layout-menu shortcut.
- Solo and existing split; 2 and 4 panes; narrow width.
- Search title and host; arrows; Enter; mouse click.
- Default-layout cycle with **real** OS Alt/Option, not synthetic keydown.
- Peek actions on a tab row.
- Arrange-scope: accordion / scrolling / restore tiles / unsplit / return to normal.
- Escape stages; focus returns to the page.
- Replacement still keeps divider sizes; unsplit keeps origins.
- Seed pinned / Essential / folder tabs as in the skill.

Record PASS / FAIL / NOT RUN per entry point.

---

## 8. Open questions for Jasiel

1. **Layout menu popup:** delete in PR 4, or keep one release behind a hidden pref? Recommendation: delete once arrange-scope fixtures pass, keep the shortcut.

2. **Default Enter in a split:** keep Replace, or last-used layout? Recommendation: keep Replace. Last-used surprises people who just want to swap a page.

3. **Letter chords (`g` for grid):** never, or only when the query is empty? Recommendation: never. Alt+arrows + peek is enough; letters belong to search. Empty-query `g` will still bite IME and people who start typing without looking.

4. **Join from inside a split:** today you cannot. Should a hub row “Join another split” appear when you are already split (Zen limit allowing)? Recommendation: yes, as an explicit row, not mixed into Recent. Needs a product yes/no.

5. **Show all vs one list:** retire compact thumbs, or keep thumbs for the first N destination rows? Recommendation: keep thumbs only in the empty-query recent section; searching and verb rows are text. Privacy and speed get better; the current screenshot look stays for the common case.

6. **Snapshot vs scrolling:** PR #7 wants one Scrolling layout. Hub verbs should follow whatever main has when PR 4 lands (one row vs two). Do not invent a third name here.

7. **Settings/diagnostics:** stay as header icons, or also verb rows (`Open Pane settings`, `Copy diagnostics`)? Recommendation: keep icons; add verb rows so they are searchable. Same actions.

8. **Anchored vs centered:** keep header-button anchored, shortcut centered? Recommendation: yes. Hub should not change placement prefs.

9. **Windows Alt+arrows:** Alt+←/→ may be reserved by the OS or Zen. If native checks show they never arrive, fallback is `[` / `]` on empty query, and the chevron menu. Confirm on a real Windows box before we document Alt+arrows as the default.

10. **Name in the UI:** keep the heading “Replace or arrange this pane” / “Open a tab alongside this one”, or one heading “Pane”? Recommendation: one heading **Pane**, context line still “Currently showing …”. Two headings were covering for two jobs; the hub is one job.

---

## 9. Files that will change later (not in this PR)

| File | Role |
| --- | --- |
| `pane.uc.mjs` | Overlay DOM, open/close, replace transaction, shortcut toggle. |
| `multiwindow.mjs` | `add` / `join` / `unsplit` / `arrange` / `openMenu`. |
| `chrome.css` | Overlay, chips, results, layout menu. |
| `keybindings.mjs` | Entry shortcuts only; in-hub keys should not become recorded prefs unless we decide they should (question 9). |
| `appearance.mjs` / `preferences.json` | Width, recent-count, compact, position, dim, help. |
| `scripts/test-replacement.mjs` | Replace + split activation. |
| `scripts/test-multiple-floats.mjs` | Layout ops. |
| `.cursor/skills/verify-pane/features/picker.md` | Native recipe. |
| `README.md`, `docs/pane-current-picker.png` | User-facing. |

This PR adds only `docs/picker-redesign.md`.

---

## 10. Decision log

| Date | Decision |
| --- | --- |
| 2026-10-09 | Design-only. Recommend Direction C (command hub), staged as PR1–6. A is the fallback after PR2. B is rejected as a wizard that still isn’t a hub. |
| 2026-10-09 | Later roadmap items (undo, named layouts, settings export/import) map onto hub verbs / scopes / entry types. They do not change PR1–6. No implementation until Jasiel picks a direction. |
