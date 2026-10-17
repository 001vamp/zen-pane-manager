# Real-Zen checks

```sh
npm run zen-checks
```

Runs this checkout inside a real Zen browser and prints PASS or FAIL for each check. It exits nonzero if any check fails or the harness aborts. It needs Zen at `/Applications/Zen.app` and the disposable Sine test profile at `~/.pane-test-profile`. Node >=20 is the only other requirement; nothing is installed. It is not part of `npm test`.

| # | Check | How |
| --- | --- | --- |
| 1 | Split + Scrolling persists across a full restart | Split two tabs, choose Scrolling from the layout menu, quit Zen gracefully, wait for the process to exit, relaunch the same copied profile, then require the same split with Scrolling on both columns. |
| 2 | Floating a tab out of a Scrolling split keeps Scrolling on | Three-tab split in Scrolling, float one tab from the layout menu, then require the two docked tabs to stay in Scrolling. |
| 3 | Enabling Scrolling auto-docks existing floats | Three-tab split with one float, choose Scrolling, then require no floats and all three tabs in Scrolling, in their original order. |
| 4 | Picker opens via its shortcut and is opaque | Press the Auto picker shortcut that Pane's own resolver returns (Control+Option+R on Mac), then require `#pane-overlay` visible and an alpha of 1 for `#pane-dialog`'s computed `background-color`. |
| 5 | No stray character from the shortcut | Below. |

## How it runs

1. Copies `~/.pane-test-profile` to `/tmp/pane-zen-qa.XXXXXX/pane-zen-qa-profile` with rsync. The copy skips locks, caches, crash data and old sessions. The base profile is only read, so another job can use it at the same time.
2. Copies this checkout, minus `.git`, into the copy's `chrome/sine-mods/zen-pane-manager`, then confirms that every root runtime file matches byte for byte.
3. Sets `no-updates` for Pane in the copy's `mods.json`, so Sine cannot replace the branch build. Appends to the copy's `user.js`: a free `marionette.port`, `sine.allow-unsafe-js` (the README install step that lets Sine run Pane's JS), auto-updates off, `browser.startup.page=3` for session restore, and the Auto picker shortcut.
4. Starts `zen -no-remote -profile <copy> --marionette --remote-allow-system-access` with `MOZ_HEADLESS=1`. Headless means the run never opens a window or takes focus. Set `ZEN_CHECKS_HEADED=1` to watch it.
5. Connects with the dependency-free Marionette client in `marionette.mjs` and switches to chrome context. It aborts unless the profile directory reported by Zen (`ProfD`) is the copy.
6. Runs checks 2–5 and the setup for check 1. It then quits Zen gracefully (`Marionette:Quit`, so SessionStore and Pane save), relaunches and runs check 1.
7. Stops the instance, confirms process exit (falling back to SIGTERM and SIGKILL), and deletes the temp profile. If exit cannot be confirmed, it retains the process handle and profile. Logs, `transcript.txt` and `results.json` stay in `/tmp/pane-zen-evidence.XXXXXX`. Set `ZEN_CHECKS_KEEP_PROFILE=1` to keep the copy.

Marionette commands have a 130-second client deadline (allowing the runner's 120-second script timeout); async scripts use their script deadline plus 5 seconds. Quit has a 10-second deadline. A timeout fails clearly, closes the connection, and allows shutdown to kill the owned instance.

Harness regression checks: `node --test scripts/zen-checks/harness.test.mjs`.

## Safety

- The runner only signals the PID it spawned, and only after `ps` shows that the command line contains the copy's `-profile` path. It never uses killall, pkill or AppleScript quit, so a personal Zen instance with the same app name is never touched.
- It refuses to copy a base profile under `~/Library/Application Support/zen` or one without `launch.sh`.
- Keys are sent only through Marionette, never as OS keystrokes (osascript, System Events, cliclick). Marionette cannot type into another browser.

## Check 5 and its limits

All keys go through Marionette, either as WebDriver key actions or as `nsITextInputProcessor` events from chrome context, dispatched at the test window's widget. They reach Pane's chrome capture listener, the URL bar and the focused page the same way real keys do once they leave the OS. macOS keyboard-layout translation is not exercised. Real Option changes `event.key` (Option+R reports `®`, Option+Shift+R `‰`), so the check also sends events shaped that way, with `code=KeyR`.

For each chord and target (a page `<input>`, and the URL bar), the check:

1. types `x` to prove keys arrive;
2. with the shortcut disabled, sends the chord to record what it would type if Pane did not consume it;
3. with the shortcut enabled, sends the chord again and requires the picker open, its search empty, and the target still holding `x`.

Control+Option+R (the Mac default) types nothing, even unconsumed, so on its own it cannot reveal a stray character. The check therefore also binds a custom Option+Shift+R. Unconsumed, that chord types `‰`, the chord fixed in 32057b4. The check fails if no chord would ever type, so it cannot pass without testing anything.

## Proving the checks can fail

The proof script maps each fix to its own check:

- Scrolling recovery skipped (1).
- `clearScrolling` called on float (2).
- Scrolling throwing on floats instead of docking them (3).
- The old translucent picker background (4).
- `preventDefault` removed from the shortcut handler (5).

To repeat it, run `node scripts/zen-checks/prove-fails.mjs`. For each fix, it creates a fresh checkout copy in `/tmp/pane-mutant.*`, reverts exactly that one fix, runs that copy's checks, and deletes the scratch checkout. It exits 0 only if each fix's own check records a normal assertion failure in a completed run. Harness errors, crashes, missing results, and failures from other checks do not prove that fix. If a fix's code changes, it stops and names the check whose revert needs updating.

## Not covered

- Layout changes use Pane's real layout-menu buttons, opened with `multiwindow.openMenu`. The splits themselves are created with `multiwindow.add`. The picker's own add path and pointer input are covered by the manual recipes in `.cursor/skills/verify-pane`.
- Windows/Linux and non-US keyboard layouts are not run.
