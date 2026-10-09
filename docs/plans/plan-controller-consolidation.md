# Controller consolidation plan

Planning only, roadmap item 7, Phase 3. No product implementation is authorized by this document. Working branch is `codex/controller-consolidation`, HEAD `3ad11151b2c3792d3125ebec2a08c82af381b837`. This file is uncommitted.

## Grounding and evidence

- Read `/tmp/pane-roadmap-snapshot.md`, especially its Oct 9 updates and Phase 3. Its current queue supersedes the older suggestion to keep live Scrolling: PR #7 keeps snapshot behavior with Scrolling's appearance.
- Dex session `0a8f8c28-07ab-4c7e-bdc7-490167ddd22e` began before source investigation. This fresh clone had no `.dex`; initialization created local ignored metadata but could not update the global registry under sandbox permissions. Session begin and brief then succeeded. The brief returned no directives, constraints, decisions or handoff. It supplies no historical authority beyond identifying this checkout.
- Requested network fetch was attempted. Checkout Git metadata is read-only, and HTTPS fetch into `/tmp/pane-consolidation-review.git` failed because github.com DNS is unavailable. Fetched the clone's existing remote refs into that temporary repository instead. They match the requested heads exactly: PR #6 `d5f0ebf0eb5803aba95e71ba6bff2c48d0778555`, PR #7 `e0d8098092f709554b24c9af7a60a8ccd348d271`. Read both patches and extracted sources at `/tmp/pane-review-6` and `/tmp/pane-review-7`. This verifies the requested snapshots, not their current remote status.
- `npm test` passes on current main and each requested branch separately. No integrated #6+#7 build has been tested. `git diff --check` passes in this checkout. The verify-pane helper ran fixtures successfully, then failed its `git fetch origin main` step because `.git/FETCH_HEAD` cannot be written. Evidence is in `/var/folders/l_/4mkn9qc13fz4g13tg6jkych00000gn/T/pane-proof.ecdck9`. Report the helper as incomplete, not PASS.
- Read `.cursor/skills/verify-pane/SKILL.md`, its feature map, restart/settings recipes, #6's accordion recipe and #7's scrolling recipe. Native checks are all NOT RUN. No running Zen instance or profile was accessed or modified.
- Architect phase checklist: Ground complete; Sketch complete with two independent candidates; Agree delivered as this planning artifact; Implement deferred by user scope; Scrap deferred unless implementation evidence invalidates the design. The skill's default external model names are unavailable here; candidates used the supported inherited model. No claim of a cross-model comparison.

## Current responsibility map

Ranges below refer to checked-out main `3ad1115`. They are navigation anchors, not promised post-merge line numbers. Recompute them after #6/#7 merge. All modules are root-level ESM; keep that packaging convention.

| File and lines | Responsibility today |
| --- | --- |
| `pane.uc.mjs:1-95` | Imports, prior-instance ownership, preference keys/readers, picker runtime state, native splitter compatibility and active-group lookup |
| `pane.uc.mjs:97-126` | Candidate eligibility, workspace filtering, tab/group labels and recency |
| `pane.uc.mjs:128-218` | Toasts, update notices, quick-start state and preference writes |
| `pane.uc.mjs:220-481` | Picker close/selection/search/results, split cards, preview capture, mode selection and action dispatch |
| `pane.uc.mjs:482-605` | Picker DOM and local UI listeners |
| `pane.uc.mjs:607-666` | Appearance preference reads/CSS and dialog position |
| `pane.uc.mjs:668-701` | Picker opening, compatibility guard, target/candidates and focus |
| `pane.uc.mjs:703-787` | Native events and replacement transaction, origin preparation, presentation transfer and rollback/error reporting |
| `pane.uc.mjs:789-889` | Header reveal timers/listeners, native split toolbar augmentation and scheduled rebuild |
| `pane.uc.mjs:891-968` | Global shortcut, backdrop/focus trap, resize, prefs observer and history progress listener |
| `pane.uc.mjs:970-1063` | Owner-aware destruction, initialization, controller construction, observers/listener registration and exposed runtime API |
| `multiwindow.mjs:8-43` | Workspace/tab eligibility, shared history controls, layout identifiers and labels |
| `multiwindow.mjs:45-62` | Pure float fit and eight-edge resize geometry |
| `multiwindow.mjs:64-153` | Runtime maps, presentation SessionStore keys/codecs/recovery, split persistence and shared lifecycle state |
| `multiwindow.mjs:154-212` | DOM helpers, layout-menu close, delayed edge hint and tab availability guards |
| `multiwindow.mjs:214-353` | Accordion teardown, selection, live-page shielding, geometry, toolbar construction and animation |
| `multiwindow.mjs:354-544` | Scrolling teardown, geometry/landing/navigation, live container updates, toolbar/resize/shield listeners |
| `multiwindow.mjs:545-571` | In-memory presentation capture/restore and start-scrolling orchestration |
| `multiwindow.mjs:572-691` | PageThumbs capture, snapshot cards, paint wait/recovery, handoff layers and animations |
| `multiwindow.mjs:692-775` | Scrolling modifier/wheel interactions and accordion startup |
| `multiwindow.mjs:776-937` | Float removal/docking/focus/z-order, positioning, pointer/key input, tile projection, toolbar rendering and creation |
| `multiwindow.mjs:938-996` | Arrange and detach orchestration with presentation retention |
| `multiwindow.mjs:997-1032` | Native-prototype-preserving tree copy, parent repair, leaf insertion |
| `multiwindow.mjs:1033-1104` | Add/join/unsplit native transactions, rollback and origin lifecycle |
| `multiwindow.mjs:1105-1189` | Layout-menu DOM, active mode, actions, focus and keyboard navigation |
| `multiwindow.mjs:1190-1296` | Sync ordering, native/tab/session events, shortcuts, shutdown detection and owner-aware teardown |
| `preferences.json:1-707` | Ordered Sine rows, 33 registered preference properties, defaults, dropdown options, conditions and section markers |
| `appearance.mjs:4-19,30-45` | Extra numeric/color metadata, bounds/defaults/units, glass presets, conditions and section names |
| `appearance.mjs:21-28` | Pure integer setting normalization plus preference-reading adapter and compact-spacing fallback |
| `keybindings.mjs:5-46` | Parsing, event normalization and matching |
| `keybindings.mjs:48-75,78-131` | Platform defaults, layout/shortcut metadata, preference reads, conflict resolution, scrolling modifier and compatibility aliases |
| `settings-page.mjs:3-51` | JSON fetch, base row rendering/pref IO, additional control placeholders, observer and enhancer loading |
| `pane-settings.uc.mjs:4-15,67-263` | Metadata imports, preference IO, numeric/color/shortcut controls and recorder lifecycle |
| `pane-settings.uc.mjs:264-469` | Preview/render/update, section/reset ownership, row enhancement, observers and cleanup |
| `split-persistence.mjs:8-36,38-189` | Separate native-tree encode/decode and split membership/deferred restore/hidden-group cleanup service; keep it separate |
| `tab-origins.mjs:8-153` | Original pinned/Essential/folder placement, transaction nesting, proxies and recovery; retain this owner |

## Runtime trace and reasons to preserve the shape

The picker selects a target and candidate. Add/join uses `multiwindow`; replacement currently stays in `pane.uc.mjs`. Replacement captures presentation before changing native group membership, prepares origins, mutates the native leaf/tab index, dispatches Zen events, transfers presentation and selects the incoming tab. Failure restores the original leaf/group/selection and presentation; failed rollback reports incomplete restoration. Do not combine this transaction with a general layout rewrite.

`sync()` runs split persistence, then recovers scrolling, accordion and floats in that order, then applies float, accordion and scrolling. Recovery waits while Zen is session-restoring and skips unavailable containers. That ordering and the guards protect native state and lazy tab loading. Closing preserves session records; disable clears applicable presentation records; stale-instance `detachOnly` removes callbacks without clearing the live owner's layouts. PR #5 preserves fully hidden pending groups while clearing records for whole groups intersecting visible state. These are constraints, not refactor opportunities.

History supports this rationale: `f59cd52` added presentation retention/settings consistency; `b4976ed` added float recovery; `e45c541` narrowed split persistence around Zen restore; `3ad1115` repaired whole-group cleanup and stale-owner teardown. The source and fixtures confirm behavior. There is no accessible issue/chat/analytics evidence here establishing a broader original architecture intent.

## Pending branches and merge gate

Land #6 first. Rebase #7 on it, resolve their overlapping `multiwindow.mjs`, `scripts/test-multiple-floats.mjs` and CSS changes, then re-run the union of fixtures and native recipes. Preserve #6's `test-css.mjs` package entry. Inspect the final rebased code instead of assuming the two diffs compose mechanically.

#6 adds `accordionSizes`, fractional expanded width/ratio, pointer capture, frame coalescing and cancellation on membership/selection/workspace/layout changes. Its width is transient. It is NOT serialized and NOT included in `capturePresentation`; reconstruction/replacement must not quietly gain width retention in this refactor.

#7 leaves one `scrolling` mode, accepts legacy `snapshot` action IDs through `normalizeMode`, writes `{group,active,mode:'scrolling',width}` under the existing `pane-scrolling-v1` key, accepts prior snapshot/scrolling records and preserves fractional widths. It uses snapshot overview with full-width live browsers. PageThumbs, paint waits and late callbacks remain native/DOM concerns. The final design has no live/snapshot runtime flag.

Before both merges, only this document, independent notes and baseline planning may proceed. Do not open extraction PRs against pre-merge controller/test bodies, including an apparently isolated geometry or settings PR. After both merges, record the actual integrated commit and native baseline before PR 1. This also respects the roadmap's item 6 release-label/blast-radius gate; consolidation does not remove experimental labels itself.

## Usage first

Illustrative JavaScript contracts, not code to paste into the runtime yet:

```js
// Controller still owns live maps, recovery ordering and rendering.
const decoded = decodeFloat(sessionValue);
if (decoded.kind === 'valid') recoverFloatFromRecord(tab, decoded.value);
// Missing/invalid deletion follows today's policy at the edge.

const saved = multiwindow.capturePresentation(data);
const transferred = remapPresentation(saved, outgoing, incoming);
// Existing native transaction and rollback still surround this call.
multiwindow.restorePresentation(data, transferred, incoming);

const native = createZenAccess(window);
const group = native.groupFor(target);
native.activate(group); // same native call, flags and ordering as before

const headers = createPaneToolbars(window, {openPicker, openMenu, notify});
headers.sync(); // idempotently repairs rebuilt headers without duplicate controls

const numbers = numericSettings; // existing consumer import can remain stable
// appearance/keybindings derive metadata from settings-schema, without prefs IO
```

## Proposed module map and contracts

Use JSDoc typedefs in `.mjs`, not a TypeScript conversion or dependency. Every new entry point gets `node --check` coverage in the existing npm routine. Keep imports one-directional: controllers import domain helpers and edge modules; those modules never import controllers. Pass action callbacks, never `window.__paneInstance` lookups inside helpers.

### Presentation modules

```ts
// Structural sketches only. Tab and SplitGroup are opaque in pure modules.
type Tab = object;
type SplitGroup = object;
type Rect = {x:number; y:number; width:number; height:number};
type FloatRecord = {rect:Rect; headerPinned:boolean};
type Decoded<T> = {kind:'missing'} | {kind:'invalid'} |
                  {kind:'valid'; value:T};
type PresentationSnapshot = {
  selected: Tab;
  floating: Array<{tab:Tab; rect:Rect; headerPinned:boolean}>;
  scrolling?: {widths:Map<Tab,number>};
  accordion?: Tab;
};
```

`presentation-records.mjs` owns wire formats privately. Pure functions parse and encode only existing records. No prefs, DOM, clocks, randomness or native globals.

```ts
encodeFloat(value:FloatRecord):string; // version:1, same property order
decodeFloat(raw:string):Decoded<FloatRecord>;
encodeAccordion(group:string, active:boolean):string;
decodeAccordionGroup(raws:readonly string[]):
  {group:string; activeIndex:number} | null;
encodeScrolling(group:string, active:boolean, width:number|null):string;
decodeScrollingGroup(raws:readonly string[]):
  {group:string; widths:Array<number|null>} | null;
```

Decoders preserve today's distinctions and permissiveness. Missing/falsy float JSON values are no recovery; malformed JSON and truthy invalid float records get today's deletion behavior. Accordion/scrolling malformed or mismatched groups currently skip recovery rather than deleting records. Accordion uses the first truthy `active`, falling back to first tab. Current scrolling recovery ignores stored `active`; do not start selecting that tab. Width validation is finite and positive. Do not require a new version/mode or stricter active boolean. Legacy snapshot records still decode into the single scrolling domain.

`presentation-session.mjs` owns presentation SessionStore keys and changed-value IO. It does not own the runtime maps or native-tree records. Inject SessionStore and pass tab objects only at this edge.

```ts
type PresentationKind = 'float'|'accordion'|'scrolling';
type SessionValues = {
  getCustomTabValue(tab:Tab,key:string):string;
  setCustomTabValue(tab:Tab,key:string,value:string):void;
  deleteCustomTabValue(tab:Tab,key:string):void;
};
createPresentationSession(session:SessionValues|null): {
  readFloat(tab:Tab):Decoded<FloatRecord>;
  readAccordion(tabs:readonly Tab[]):ReturnType<typeof decodeAccordionGroup>;
  readScrolling(tabs:readonly Tab[]):ReturnType<typeof decodeScrollingGroup>;
  saveFloat(tab:Tab,value:FloatRecord):void;
  saveAccordion(tabs:readonly Tab[],group:string,active:Tab):void;
  saveScrolling(tabs:readonly Tab[],group:string,active:Tab,
                widths:ReadonlyMap<Tab,number>):void;
  clear(tab:Tab,kind:PresentationKind):void;
};
```

Caller retains closing/connected guards, old `savedTabs` membership cleanup, generated `sessionId`, recovery precedence and teardown mode. Pass existing group ID rather than hiding randomness in codecs. Preserve absent SessionStore as no-op, exception behavior and exact write order. Later lifecycle extraction requires separate evidence, not a new global state store.

`presentation-snapshot.mjs` owns pure in-memory snapshot copy/remapping. No durable schema and no DOM inspection.

```ts
clonePresentation(value:PresentationSnapshot):PresentationSnapshot;
remapPresentation(value:PresentationSnapshot,outgoing:Tab,
                  incoming:Tab):PresentationSnapshot;
```

Clone rect objects and width Maps so rollback snapshots stay unchanged. `remapPresentation` always sets `selected = incoming`, even if the saved selection was a different tab. This is the existing successful replacement policy, not a conditional reference substitution. Remap floating tab refs, accordion active tab and width key only when they refer to outgoing. Characterize initially selected third-tab replacement as well as selected-outgoing replacement. Capture/restore facade and the original restore/apply order remain in multiwindow. Do not introduce expandedRatio, transient offset or previews into this snapshot.

### Native Zen access

`zen-access.mjs` is the native edge. Start with reads and migrate mutation families separately. It owns private splitter fields, native prototypes, flags and event details; it does not own presentation maps, DOM headers, pref values or error toasts.

```ts
createZenAccess(win:Window): {
  compatible():boolean;
  currentGroup():SplitGroup|null;
  groupFor(tab:Tab):SplitGroup|null;
  groups():readonly SplitGroup[];
  workspaceOf(tab:Tab):string|null;
  supported(tab:Tab):boolean;
  selected():Tab;
  select(tab:Tab):void;
  focus(tab:Tab):void;
  viewport():{left:number;top:number;width:number;height:number};
  split(target:Tab,incoming:Tab,type:'vsep'|'hsep'|'grid'):SplitGroup;
  activate(group:SplitGroup):void;
  detach(tab:Tab):void;
  rebuildTiles(group:SplitGroup,excluded:ReadonlySet<Tab>):void;
  prepareReplacement(group:SplitGroup,outgoing:Tab,incoming:Tab):
    {commit():void; rollback():void};
};
```

Group/tab identity is intentional for incremental interoperability. Do not copy native objects into new IDs or leak native layout-tree nodes through the final public contract. `prepareReplacement` hides native leaf/group bookkeeping; controller keeps origin begin/end, saved presentation, keep-old-tab preference, diagnostics and recovery-failure reporting. Its migration must preserve which operations can mutate before throwing and keep rollback available for partial commit. Do not move transaction failure handling into a boolean-return wrapper. Initially only implemented method families exist; no empty speculative adapter methods. `split-persistence` and `tab-origins` retain their existing native edges in this sequence; a later dedicated PR can adopt proven adapter capabilities without inflating this task.

### Geometry and gestures

`presentation-geometry.mjs` owns the existing pure geometry, with the same arithmetic/order and thresholds.

```ts
fitRectangle(rect:Rect,width:number,height:number):Rect;
resizeRectangle(rect:Rect,edge:'n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw',
                dx:number,dy:number,width:number,height:number):Rect;
accordionSizes(width:number,count:number,requestedWidth?:number):
  {expanded:number;strip:number};
scrollingColumnWidth(viewport:number,value:number):number;
scrollingSizes(viewport:number,percent:number,
               savedWidths:readonly (number|null|undefined)[]):
  {viewport:number;width:number;widths:number[];positions:number[];max:number};
landingIndex(geometry:ReturnType<typeof scrollingSizes>,offset:number):number;
```

Keep landing tie behavior, gap 10, fit minimums and small-window clamps. Use full JavaScript number precision for dimensions, positions, offsets, ratios, deltas, saved widths and tree ratios. No `Math.round`, integer conversion or `toFixed` in geometry, snapshots or SessionStore. Emit fractional CSS pixel strings unchanged. Canvas backing dimensions may be integer at their final output boundary; settings declared integer can retain `boundedNumber` rounding. Those are different from geometry. Compare arithmetic invariants with epsilon where floating operations require it, not by rounding production results.

Gesture modules are separate by interaction family, avoiding a universal pointer engine that changes #6/#7 behavior. DOM input/capture/timers are edges; coordinate calculation and landing remain pure. Existing keyboard parser stays in keybindings.

```ts
type Dispose = () => void;
bindFloatGesture(win:Window,handle:HTMLElement,options:{
  edge?:string; signal:AbortSignal; available():boolean;
  readRect():Rect; bounds():{width:number;height:number};
  commit(rect:Rect):void;
}):Dispose; // float-gestures.mjs

bindAccordionResize(win:Window,handle:HTMLElement,options:{
  side:'left'|'right'; read():{
    active:Tab;index:number;count:number;width:number;expandedRatio?:number
  }; valid():boolean; commitRatio(value:number):void; render():void;
}):{finish():void;destroy():void}; // accordion-gestures.mjs

bindScrollingResize(win:Window,handle:HTMLElement,options:{
  signal:AbortSignal; readWidth():number; viewport():number;
  setWidth(value:number):void; reset():void;
}):Dispose; // scrolling-gestures.mjs

bindScrollingNavigation(win:Window,options:{
  signal:AbortSignal; binding():object|null;
  context():object|null; enter():void; release():void; cancel():void;
  pan(dx:number):void;
}):Dispose;

createPaneInput(win:Window,actions:{openPicker():void;
  openMenu():void;step(direction:number):void},prefs:object):Dispose;
// pane-input.mjs: global routing only, recorder/IME/repeat guards preserved
```

The final `context` sketch must become a concrete read-only scrolling view of overview, startTab, selected tab and geometry during that PR, not an untyped permanent escape hatch. No generic dispatcher or command bus. Accordion's controller invokes `finish` on active/member/workspace/layout changes. Each module owns its listeners and gesture-local drag state; live layout maps remain controller-owned. Preserve capture/passive options, immediate versus animation-frame updates, pointer IDs, blur/Escape behavior and cancellation semantics exactly. Float and scrolling do not automatically inherit accordion's stricter pointer-ID policy.

### Toolbar rendering

`pane-toolbars.mjs` owns native header augmentation/reveal and history-control DOM. `layout-toolbars.mjs` owns accordion, float and scrolling header/control DOM. Controllers retain layout state and user action decisions. No DOM in pure model/geometry helpers.

```ts
createPaneToolbars(win:Window,actions:{
  openPicker(tab:Tab,anchor:boolean):void;
  openMenu(tab:Tab,anchor:HTMLElement):void;
  unsplit(group:SplitGroup):void;
},readVisibility:()=>number):{
  sync():void; updateHistory():void; destroy(options:{detachOnly:boolean}):void;
};

type ToolbarView = {
  kind:'accordion'|'float'|'scrolling'|'scrolling-preview';
  title:string;active:boolean;pinned?:boolean;
};
createLayoutToolbars(win:Window):{
  render(host:HTMLElement,view:ToolbarView,actions:{
    select():void;step(direction:number):void;arrange(anchor:HTMLElement):void;
    dock?():void;close?():void;pin?():void;resetWidth?():void;
  }):{handle:HTMLElement;update(view:ToolbarView):void;destroy():void};
};
```

Use kind-specific JSDoc action unions when implementing so a float requires dock/close/pin and scrolling requires resetWidth. Preserve all DOM classes, ARIA names, focus targets, button order and pointer-blocking attributes; CSS remains unchanged. Toolbar owner must detect disconnected handles and repair once, cancel hide timers/listeners, and distinguish stale `detachOnly` from active teardown. Resize handles remain gesture-module/controller concerns rather than moving them again into toolbar constructors.

### Settings metadata

`settings-schema.mjs` is the sole authored list of settings and section metadata. It is pure and contains no global platform lookup or preference reads. `preferences.json` remains the committed Sine artifact, deterministically generated by `scripts/generate-preferences.mjs`. Runtime ESM imports schema directly, so no runtime generator or JSON import assertion is needed.

```ts
type Setting = {
  key:string; property:string; section:string;
  storage:'boolean'|'integer'|'string'; defaultValue:boolean|number|string;
  sineRow?:object; // preserve exact row labels, options, conditions and row order
  control?:{kind:'number'|'color'|'shortcut';label:string;
            min?:number;max?:number;unit?:string;minAlpha?:number;custom?:boolean};
  shortcut?:{action:string;defaultBinding:string;macDefaultBinding?:string;
             customKey?:string;disabledValue?:number;hold?:boolean};
};
settings:readonly Setting[];
sections:readonly {id:string;label:string}[];
numericSettings:readonly object[];
colorSettings:readonly object[];
shortcutSettings:readonly object[];
layoutShortcuts:readonly object[];
toSinePreferences():readonly object[];
```

Refine object sketches into discriminated row/control shapes in the metadata PR without converting the repository. Preserve distinct existing Sine labels and enhanced-control labels as explicit fields; they are different UI contracts. Preserve registered keys, option numeric values, bounds, default values, special compact-picker spacing, conditional visibility, Auto/Disabled parsing, Windows/macOS defaults and legacy accordion key names. Include enhanced-only controls such as `scrolling-custom-modifier` and runtime-only keys, with explicit registration/UI ownership, so they do not accidentally become new Sine rows. Internal update/quick-start keys must not appear as user settings. Keep glass presets in appearance unless they duplicate actual metadata.

Generation must reproduce existing JSON byte-for-byte first, including non-preference heading/separator rows and formatting. `--check` compares generated bytes with committed output and fails npm test on drift. Never regenerate silently during tests. Existing appearance/keybindings exports become derived views, not parallel authored arrays. Preference getter/setter adapters stay in current controllers/settings modules; parsing, validation and default selection stay pure. Section metadata must initially encode current row placement, including unusual trailing rows, rather than assigning a more logical section and changing reset behavior. Migrate reset ownership only with a characterization fixture proving exactly the same cleared keys; if that cannot be shown, retain current DOM-based reset for this consolidation.

## Synthesis decision

Candidate A uses domain codecs/session IO plus pure snapshot transformations while preserving controller runtime ownership. Candidate B uses feature-owned accordion/scrolling/float services, each hiding durable and transient state behind a facade. Both were independently reviewed against architect red flags: split ownership, pass-through layers, leaked wire/native details, duplicated lists and deep call chains.

Choose A. It removes a complete serialization responsibility through a small contract while leaving native ordering observable in one controller. B hides more feature mechanics eventually, but moving maps, DOM and restore scheduling into three owners now creates coordinated teardown and precedence changes. Adopt B's strict separation of durable records from gesture/DOM state and feature-specific input boundaries. Reject a central reducer/store, generic event bus, one universal pointer abstraction and wholesale native transaction rewrite. Do not maintain two writers or implementations after each extraction. Temporary public compatibility exports may point to the one new implementation only, then migrate known imports without duplicated logic.

An independent cross-judge reviewed the synthesis for PR size, #6/#7 invariants, interface depth, evidence limits, precision and settings parity. It preferred A and identified the unconditional successful-replacement selection policy as needing an explicit contract; that correction is included above. The review used the inherited model, so it adds independent scrutiny rather than model-family diversity.

## Ordered small PRs

Every PR below is based on the merged and natively baselined #6+#7 result, then on the previous extraction. Run full `npm test`, verify-pane's fixture helper and `git diff --check` against the current branch base. The focused tests supplement, never replace, those checks. Add syntax/package-file validation for introduced modules. Do not weaken source-slice or static tests merely to make moves pass: retain the controller facades initially, then inject imported helpers into the VM fixture or import the extracted operation and preserve every failure assertion. Update verify-pane selectors/import maps only when extraction makes that necessary; user recipes remain the same.

| PR | Scope and files touched | Behavior evidence beyond full routine | Native checks required |
| --- | --- | --- | --- |
| 1 | Extract float wire codec only. New `presentation-records.mjs`; `multiwindow.mjs`; focused codec fixture and package syntax entry. No recovery scheduler move. | Existing multiple-floats/session fixtures; characterize missing, JSON null/falsy/scalar, malformed/version/finite/positive-size cases and exact fractional encode/decode. Same record bytes and deletion outcomes. | Floating and restart-memory: multiple floats, position/pins, small-window fit, missing/closed tabs and disable cleanup. |
| 2 | Add accordion/scrolling codecs to records module; change only save/recover record transformation call sites in `multiwindow.mjs`; extend codec fixture. | Group mismatch, malformed skip, first-active fallback, scrolling ignored active, old snapshot/scrolling inputs and fractional widths. Exact new #7 writer bytes; no accordion ratio field. | Accordion and Scrolling via both entrances, legacy scrolling sessions, expanded tab recovery, saved widths, restore tiles and #6 width resetting after restart. |
| 3 | Move presentation SessionStore IO/key ownership into `presentation-session.mjs`; multiwindow uses it. Keep live maps/recovery creation/lifecycle predicates in place. | Changed-value writes only, same call order, membership-removal cleanup, session absent, disable/shutdown/detachOnly and hidden-workspace behavior. Existing split-persistence suite unchanged. | Full restart-memory and floating recipes, hidden-workspace disable/unsplit/re-enable, two disable/enable cycles, stale owner reload without touching current layouts. |
| 4 | Extract snapshot clone/remap to `presentation-snapshot.mjs`; `pane.uc.mjs` and capture facade in `multiwindow.mjs`; replacement and presentation fixtures. Restore orchestration remains. | Snapshot cannot mutate rollback rects/Map; success remaps each reference; move/activation/preparation/rollback failures retain all existing assertions. Characterize omission of accordion width. | Picker replacement for tiled/accordion/scrolling/floating, keep-old-tab on/off, same browser draft/scroll/history, pinned/Essential/folder placement and a failed operation without false restoration claim. |
| 5 | Native read/compatibility/selection boundary in `zen-access.mjs`; migrate reads in both controllers only. No mutation transaction changes. | Workspace/Essential eligibility, hidden/closing tabs, unavailable group/containers and incompatible splitter warning; call-order/selection tests. | Picker and layout-menu, every layout from solo and split, workspace switch, special tabs, lazy tabs and keyboard focus. |
| 6a | Move native split/add/tile activation operation family into zen-access; `multiwindow.mjs`, multiwindow/floats fixtures. Keep origins and rollback orchestration. | Direction/limit/tree prototype/parent/ratio preservation, failures after split or activation, float exclusions and browser identity. | Split right/below/grid from picker/menu, hand-arranged divider ratios, add/join existing layouts, floats dock/restore and special-tab origin restoration. |
| 6b | Move replacement native bookkeeping behind `prepareReplacement`; `zen-access.mjs`, `pane.uc.mjs`, replacement fixture harness. | All current injected-failure stages plus partial commit and rollback failure; native events/order and selection unchanged. | Repeat PR 4 replacement matrix, including stale/unavailable target and live state retention. |
| 7 | Move pure geometry only to `presentation-geometry.mjs`; multiwindow callers and geometry tests. No event/DOM rewrite. | Existing #6 accordion and #7 scrolling fractional tests, all eight float edges, small-window limits, landing tie choice and untouched tree ratios. | Narrow/wide windows, 2/4 panes, both accordion boundaries, scrolling landing/resize and float edges; check no pixel jumps. |
| 8a | Extract float pointer/key bindings to `float-gestures.mjs`; `multiwindow.mjs`, event fixtures. | Move/resize anchor, button exclusion, pointer release/cancel/lost capture, per-float isolation, keyboard deltas, cleanup. Preserve current timing/pointer policy. | Mouse drag/all resize edges, keyboard move/resize, pin controls, release outside, close/dock during input, two disable cycles. |
| 8b | Extract #6 accordion resize to `accordion-gestures.mjs`; multiwindow, event fixture. | Exact scaling for uneven neighbors, fractional movement, coalesced frame, pointer ID, cancel/selection/member/workspace changes, disconnected target and clear cleanup. | Full #6 accordion-drag-resize recipe, rounded corners, boundary hit targets and left-page obstruction; reduced motion and native selection. |
| 8c | Extract #7 scrolling resize and modifier/wheel routing to `scrolling-gestures.mjs`; multiwindow, event fixtures. Keep PageThumbs and paint wait lifecycle in multiwindow. Split resize/navigation into separate PRs if diff is not mechanical. | Preview/live resize/reset, fractional widths, wheel units, landing highlight/release match, Escape/blur/menu cancellation, late paint guards and no leaked listeners. | Full #7 Scrolling recipe: mouse and trackpad, modifier/release/Escape, narrow/2/4 panes, slow/heavy pages, drafts/history and restart widths. |
| 8d | Global action-key routing to `pane-input.mjs`; both controllers and keybinding fixtures. Picker focus trap remains local until separately justified. | Platform defaults/custom/disabled/conflict/IME/repeat/AltGraph/recorder exclusion; event handling priority unchanged. | Real OS shortcuts on Mac and Windows, menu and navigation, picker recording/cancel, page typing unaffected and focus returns. |
| 9a | Native header/history/reveal rendering to `pane-toolbars.mjs`; pane and multiwindow shared history imports; toolbar fixture and validator adjustment preserving rebuild check. | Header rebuild idempotence, one button set, back/forward enabled state, focus/reveal timer cleanup, active-tab switch, detachOnly protection. | Rebuild headers via layout/workspace changes, auto-hide/always-visible, back/forward, refresh, keyboard buttons and floating/native headers. |
| 9b | Accordion headers into `layout-toolbars.mjs`; multiwindow and toolbar/event fixtures. Geometry/gesture attachment stays with controller. | Disconnected handle repair, labels/buttons/focus/order, no duplicate controls/listeners, resize targets retained. | Both accordion entry paths, mouse/key selection, refresh, arrange/dock/close, #6 handles and native clipping. |
| 9c | Float headers into layout-toolbars; multiwindow and toolbar/float fixtures. | Pin/title/close/dock controls, keyboard handles, original browser identity and cleanup. | Multiple floats with independent headers, pin/unpin, drag/key moves, close/dock and two enable cycles. |
| 9d | Scrolling live/preview headers into layout-toolbars; multiwindow and toolbar/scrolling fixtures. Do not move canvas/paint pipeline. | Shared action wiring without duplicate state, title/landing label, reset-one/reset-all, focus/reveal and asynchronous removal. | Both scrolling entrances, modifier overview, release, slow paint, header controls, resize/reset and history. |
| 10a | Introduce pure `settings-schema.mjs` and `scripts/generate-preferences.mjs`; generated preferences.json remains byte-identical. Replace authored appearance/keybindings metadata with derived exports in the same PR; metadata fixture, package and validate entries. | Byte equality, unique properties, 33 current registered keys, options/defaults/conditions/order, derived numeric/color/shortcut arrays and section names match current baseline. Runtime internal keys don't become rows. | Settings both entrances, unchanged values/labels/conditions, appearance and current platform shortcut defaults. |
| 10b | Migrate settings-page/pane-settings metadata consumption and any controller pref-key constants to schema-derived values. Keep preference IO and recorder/rendering at edges. | Enhanced-only rows, custom picker/modifier indirection, compact-spacing fallback, reset key ownership, cancel/default/disabled/conflicts and observers. No changed preferences without explicit user input. | Full settings recipe, both entrances, section reset isolation, reload/reopen saved values, shortcuts/recorder, preview appearance and toolbar visibility. |

This order removes session concerns before native access, gestures and rendering. Geometry is a small pure prerequisite to gestures, after native edges. Settings stays last to avoid mixing generated metadata and controller lifecycle edits. PRs 6a/6b and 8/9 substeps are distinct review units, not one large numbered PR.

## Native baseline and acceptance discipline

Obtain a post-merge baseline on recorded Zen/Sine versions, exact installed integrated revision, and an isolated disposable profile or owner-provided manual evidence. This run does not launch that profile. Compare each extraction with the same baseline recipe, input sequence and version. Rebaseline if Zen/Sine changes. Use actual picker/menu/OS input, not controller setters.

For layout-affecting steps, test both picker and layout-menu entrances, solo and existing split, 2 and 4 panes, narrow window, drafted input/page scroll/history and restored original tiled ratios. Baseline includes #6 boundary hit areas/rounding and #7 modifier panning/release/Escape/slow-paint recovery. Run Mac mouse/trackpad and current Windows shortcut/input checks rather than relying on historical Windows success. Include pinned, Essential and folder tabs where native placement changes.

Persistence steps require full exit/relaunch of only the owned disposable process, same profile, hidden-workspace/lazy loading, missing tabs, float geometry/pins, scrolling widths, accordion active pane and disabled-Pane unsplit. Never infer a restart from reload or enable/disable. Accordion drag width remains session-only. Record PASS/FAIL/NOT RUN per recipe and entry point with screenshots/action transcript and before/after revision. Any missing native gate means fixture-verified but not accepted as behavior-preserving. No fixture-only consolidation release.

## Risks and limits

- #6/#7 rebase can drop one side's new tests or leave old snapshot call signatures. Review the union first; current separate passing tests are insufficient.
- Overstrict decoders can erase recoverable legacy records or change malformed cleanup. Characterize current branches before copying logic. Keep wire field order if changed-value comparison depends on it.
- Runtime maps use native object identity. Moving them or holding stale handles across reload can break stale-instance safety. Keep one writer per state, no global store and no duplicate mirror caches.
- Extracting read helpers alone is a temporary small migration, not the final abstraction. Native mutation families must hide private field bookkeeping without moving error policy/origin transactions. Preserve native prototypes/parent links and partial-mutation rollback semantics.
- PageThumbs capture, compositor paint events, timers and AbortController ownership cannot be proven by the DOM-like fixture. They stay in the controller until a separate evidence-backed extraction is justified.
- Source-sliced VM tests and validator string checks couple to controller text. Adapt dependency injection/imports while keeping behavior assertions, not deleting checks. New runtime modules must be present in the Sine package and use consistent cache-busting import revisions; a syntax pass does not prove privileged module resolution.
- Settings schema conversion may accidentally change row placement, reset membership, conditional defaults, Auto indirection or enhanced-only registration. Require exact generated output and consumer parity before cleanup. No rename/migration of installed pref keys.
- Geometry rounding would make #6 cursor tracking or #7 centering drift. Retain full float precision through serialization and calculation, with rounding only where a final output API requires it.
- No native baseline was produced here. All planned native work is pending; the running personal Zen/profile remains untouched.

First implementation action after prerequisites: open PR 1 extracting only the float wire codec, with characterization cases and unchanged recovery call sites. It is the smallest complete session responsibility and establishes the pure/edge boundary without touching Zen transaction order.
