---
name: verify-pane
description: Verify Pane's picker, layouts, settings and restart memory in Zen before handing a change to Jasiel. Reuse Node fixtures and isolate native checks in a throwaway Zen profile.
---

# Verify Pane

Read [the feature map](features/README.md). Run the fixture routine for every change, then the affected native recipes and their listed entry points. Never infer native success from fixtures. Report PASS, FAIL or NOT RUN per feature and entry point before handing a change to Jasiel.

## Launch

Node >=20 and npm are sufficient for fixtures; no dependency install is needed:

```sh
.cursor/skills/verify-pane/scripts/verify.sh
```

The helper prints a unique evidence directory and runs existing `npm test` fixtures and `git diff --check`. No Zen connection or process is created. This is the default safe routine.

Native verification requires a separately provisioned disposable Zen profile with Sine >=2.3. Never copy Jasiel's profile, prefs, sessions, cookies or credentials. Never use a running personal browser, its remote port, or a global restart/quit action. If isolated launch cannot be confirmed, stop native work and report NOT RUN.

On macOS, in a future run authorized to launch the test instance:

```sh
QA_ROOT=$(mktemp -d /tmp/pane-zen-qa.XXXXXX)
QA_PROFILE="$QA_ROOT/pane-zen-qa-profile"
mkdir "$QA_PROFILE"
ZEN_BIN=/Applications/Zen.app/Contents/MacOS/zen
"$ZEN_BIN" -no-remote -profile "$QA_PROFILE" > "$QA_ROOT/zen.log" 2>&1 &
QA_PID=$!
printf '%s\n' "$QA_PID" > "$QA_ROOT/zen.pid"
```

Keep these variables and the PID for this run. In this window, verify `about:support`'s Profile Directory equals `$QA_PROFILE` before any setup. Install Sine using its supported installer into this profile only. Follow README's Sine JavaScript permission instructions. Install Pane, then stage the checkout's mod files into this profile's Sine Pane directory, identified from this instance's Sine installation. Do not assume a personal profile path. Compare staged files with the checkout, including `pane.uc.mjs`, `multiwindow.mjs`, `keybindings.mjs`, `preferences.json` and settings files. A repository install from main alone does not test the branch. Record the installed revision, Zen/Sine versions and profile path. Restart only this PID after installation.

Ready means the test window's Pane toolbar/picker works and the complete settings page opens. Seed four disposable tabs A, B, C and D with distinct titles, a long page, an editable input, and a page with back/forward history. Add pinned, Essential and folder variants for tab-origin changes. Use local/test content only.

## Doctor

Fixtures: `node --version` must be >=20; `git status --short` and `git rev-parse HEAD` identify the tested checkout.

Native: run `ps -p "$QA_PID" -o pid=,command=` and inspect `about:support` in that exact window. Require the explicit disposable profile argument and matching Profile Directory; confirm the loaded checkout files and Pane controls. If launch handed off to another process, establish its exact PID and profile before continuing. Never select a window solely by its title. Repeat this check after every restart or unexpected behavior.

## Drive

Use real UI input in the doctor-confirmed window. Computer-use accessibility controls or Marionette pointer/key actions can drive the recipes; use visible labels first and the mapped DOM handles when inspecting chrome. Do not call `__paneInstance` setters as user-path proof. A native shortcut must receive real OS key input; synthetic DOM keyboard events do not prove macOS routing.

Run picker, menu and every layout recipe from both a solo tab and an existing split where supported; test 2 and 4 panes and a narrow window. Run settings and restart recipes after layout changes. Use the ordered action/result pairs in each feature file. Current scripts `test-zen-browser.py` and `test-tab-origins-browser.py` are supplemental, not this gate: they use internal calls, mutate tabs, and the first destroys Pane. Do not run them against an arbitrary port/profile. This skill intentionally does not auto-connect to native Zen.

## Evidence

The helper saves command output, exit results and revision in `/tmp/pane-proof.*`; evidence survives cleanup. Add native evidence there: action transcript, before/after screenshots, profile/build identity, recipe ID, expected and observed state, and failures/skips. Capture real input plus resulting state. For restart proof, capture pre-quit geometry/tab group/pins and the same state after the owned process exits and a fresh PID starts. Reopen settings to prove saved values. Fixtures use mocked Zen APIs and prove logic only. Do not mark split memory passed on this baseline: PR #2 is separate and not present at f9d43ba. Its recipe is an acceptance gate for that implementation.

## Cleanup

The fixture helper creates no process or disposable app state; keep its evidence directory. For native runs, close only the doctor-confirmed test instance or send `kill -TERM "$QA_PID"` after rechecking its command/profile. Wait for that PID to exit. Never use killall, pkill by app name, macOS Quit Zen, or Sine's global restart if it can affect another instance. Delete only the recorded `$QA_ROOT` once the owned instance exits and logs/screenshots have been copied to the proof directory. Retain evidence even on failures. Full restart means process exit and relaunch with the same disposable profile, not reload or disabling the mod.

## Helpers

`scripts/verify.sh` is executable; invoke it from the repository root as shown above. It returns nonzero for failed fixtures or whitespace checks and explicitly reports native checks NOT RUN. Update this map when behavior changes; `/maintain-verification-skill` provides the maintenance workflow.
