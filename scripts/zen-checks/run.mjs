#!/usr/bin/env node
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Marionette, delay } from "./marionette.mjs";
import { stopProcess } from "./process.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const home = os.homedir();
const zenBin = process.env.ZEN_BIN ?? "/Applications/Zen.app/Contents/MacOS/zen";
const baseProfile = path.resolve(process.env.PANE_TEST_PROFILE ?? path.join(home, ".pane-test-profile"));
const personalProfiles = path.join(home, "Library/Application Support/zen");
const headed = process.env.ZEN_CHECKS_HEADED === "1";
const keepProfile = process.env.ZEN_CHECKS_KEEP_PROFILE === "1";

const results = [];
const evidence = fs.mkdtempSync("/tmp/pane-zen-evidence.");
let qaRoot = null, profile = null, zen = null, client = null, launches = 0;

function log(line) {
  console.log(line);
  fs.appendFileSync(path.join(evidence, "transcript.txt"), `${line}\n`);
}

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `\n      ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
}

function preflight() {
  if (!fs.existsSync(zenBin)) throw new Error(`Zen not found at ${zenBin} (set ZEN_BIN)`);
  if (!fs.existsSync(path.join(baseProfile, "chrome/sine-mods/mods.json"))) throw new Error(`${baseProfile} is not a Sine test profile`);
  const realBase = fs.realpathSync(baseProfile);
  if (realBase.startsWith(fs.realpathSync(personalProfiles) + path.sep) || !fs.existsSync(path.join(realBase, "launch.sh"))) {
    throw new Error(`Refusing to copy ${realBase}: not the disposable Pane test profile`);
  }
}

function makeProfile() {
  qaRoot = fs.realpathSync(fs.mkdtempSync("/tmp/pane-zen-qa."));
  profile = path.join(qaRoot, "pane-zen-qa-profile");
  execFileSync("rsync", ["-a",
    "--exclude=lock", "--exclude=parent.lock", "--exclude=.parentlock", "--exclude=.startup-incomplete",
    "--exclude=cache2", "--exclude=startupCache", "--exclude=crashes", "--exclude=minidumps",
    "--exclude=sessionstore-backups", "--exclude=sessionstore.jsonlz4", "--exclude=sessionCheckpoints.json",
    "--exclude=zen-sessions*", "--exclude=chrome/sine-mods/zen-pane-manager",
    `${baseProfile}/`, `${profile}/`]);
  const modDir = path.join(profile, "chrome/sine-mods/zen-pane-manager");
  execFileSync("rsync", ["-a", "--delete", "--exclude=.git", "--exclude=node_modules", `${repo}/`, `${modDir}/`]);
  for (const file of fs.readdirSync(repo).filter(f => /\.(mjs|css|json|html)$/.test(f))) {
    const hash = f => createHash("sha256").update(fs.readFileSync(f)).digest("hex");
    if (hash(path.join(repo, file)) !== hash(path.join(modDir, file))) throw new Error(`staged ${file} differs from checkout`);
  }
  const modsPath = path.join(profile, "chrome/sine-mods/mods.json");
  const mods = JSON.parse(fs.readFileSync(modsPath, "utf8"));
  if (!mods["zen-pane-manager"]) throw new Error("Pane is not registered in the test profile's mods.json");
  Object.assign(mods["zen-pane-manager"], { enabled: true, "no-updates": true });
  fs.writeFileSync(modsPath, JSON.stringify(mods, null, 2));
  return modDir;
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolve(port)); });
    server.on("error", reject);
  });
}

function writePrefs(port) {
  const prefs = {
    "marionette.port": port,
    "sine.allow-unsafe-js": true,
    "sine.auto-updates": false,
    "sine.engine.auto-update": false,
    "browser.startup.page": 3,
    "browser.sessionstore.resume_from_crash": true,
    "browser.shell.checkDefaultBrowser": false,
    "app.update.auto": false,
    "app.update.enabled": false,
    "datareporting.policy.dataSubmissionEnabled": false,
    "toolkit.telemetry.enabled": false,
    "mod.pane.shortcut": 0,
  };
  const lines = Object.entries(prefs).map(([k, v]) => `user_pref(${JSON.stringify(k)}, ${JSON.stringify(v)});`);
  fs.appendFileSync(path.join(profile, "user.js"), `\n// pane zen-checks\n${lines.join("\n")}\n`);
}

function commandOf(pid) {
  try { return execFileSync("ps", ["-p", String(pid), "-o", "command="]).toString().trim(); } catch { return ""; }
}

function owned(pid) {
  const command = commandOf(pid);
  return Boolean(profile) && command.includes(zenBin) && command.includes(`-profile ${profile}`);
}

function launch() {
  launches++;
  const out = fs.openSync(path.join(evidence, `zen-${launches}.log`), "a");
  const env = { ...process.env, MOZ_CRASHREPORTER_DISABLE: "1" };
  if (!headed) env.MOZ_HEADLESS = "1";
  const child = spawn(zenBin, ["-no-remote", "-profile", profile, "--marionette", "--remote-allow-system-access"],
    { env, stdio: ["ignore", out, out], detached: false });
  const exited = new Promise(resolve => child.once("exit", code => resolve(code)));
  zen = { pid: child.pid, exited };
  log(`launched Zen pid ${child.pid}${headed ? "" : " (headless)"}`);
  return zen;
}

async function stopZen({ graceful = true } = {}) {
  if (!zen) return;
  const proc = zen;
  let quitError = null;
  try {
    if (graceful && client) await client.quit();
  } catch (error) {
    quitError = error;
    log(`graceful quit failed: ${error.message}`);
  } finally {
    client?.close(); client = null;
  }
  await stopProcess(proc, { owned, log });
  zen = null;
  if (quitError) throw quitError;
}

const CHROME_PRELUDE = `
const pane = window.__paneInstance, mw = pane?.multiwindow, view = gZenViewSplitter;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms = 10000) {
  const end = Date.now() + ms;
  for (;;) { let v; try { v = await fn(); } catch {} if (v) return v; if (Date.now() > end) return v; await sleep(100); }
}
const groupOf = tab => view._data.find(d => d.tabs.includes(tab));
const containerOf = tab => tab.linkedBrowser?.closest('.browserSidebarContainer');
const scrollingOn = tab => containerOf(tab)?.getAttribute('pane-scrolling') === 'true';
const byLabel = label => [...gBrowser.tabs].find(t => t.label === label);
async function makeTab(title, body = '') {
  const html = '<title>' + title + '</title><body style="font:16px system-ui">' + title + body;
  const tab = gBrowser.addTrustedTab('data:text/html,' + encodeURIComponent(html));
  await waitFor(() => tab.label === title);
  return tab;
}
async function pick(tab, mode) {
  gBrowser.selectedTab = tab;
  await sleep(150);
  mw.openMenu(tab, containerOf(tab) ?? tab);
  const option = document.querySelector('#pane-layout-menu [data-mode="' + mode + '"]');
  if (!option) { mw.closeMenu(); throw new Error('layout menu has no ' + mode + ' option for ' + tab.label); }
  option.click();
  await sleep(300);
}
function state(tabs) {
  return tabs.map(t => ({ label: t.label, inGroup: groupOf(t)?.tabs.length ?? 0, scrolling: scrollingOn(t),
    floating: mw.floatingTabs.includes(t), selected: gBrowser.selectedTab === t }));
}
`;

const chrome = (body, args = []) => client.execute(`${CHROME_PRELUDE}\nreturn (async () => { ${body} })();`, args);

async function connect(port) {
  client = await Marionette.connect(port, { timeoutMs: 60000 });
  await client.startSession();
  await client.setContext("chrome");
  const where = await client.execute(`return Services.dirsvc.get("ProfD", Ci.nsIFile).path;`);
  if (fs.realpathSync(where) !== profile) throw new Error(`Connected browser uses ${where}, not the disposable copy; aborting`);
  log(`runtime profile check: ${where}`);
  await client.send("WebDriver:SetTimeouts", { script: 120000 });
  const ready = await chrome(`
    await waitFor(() => window.__paneInstance && window.gZenViewSplitter && document.documentElement.hasAttribute('pane-ready'), 45000);
    await SessionStore.promiseAllWindowsRestored;
    return { pane: window.__paneInstance?.version ?? null, platform: navigator.platform,
      zen: Services.appinfo.version, gecko: Services.appinfo.platformVersion,
      sine: { loader: typeof window.UC_API !== 'undefined' || typeof window.addUnloadListener === 'function',
        disabled: Services.prefs.getBoolPref('sine.mods.disable-all', false),
        unsafeJs: Services.prefs.getBoolPref('sine.allow-unsafe-js', false), url: location.href } };`);
  if (!ready.pane) throw new Error(`Pane did not load in the test profile: ${JSON.stringify(ready)}`);
  log(`Pane ${ready.pane} on Zen ${ready.zen} (Gecko ${ready.gecko}, ${ready.platform})`);
}

const MOD = { Control: "\uE009", Alt: "\uE00A", Shift: "\uE008", Meta: "\uE03D" };
const KEY = { Escape: "\uE00C" };

async function press(modifiers, key) {
  const actions = [];
  for (const m of modifiers) actions.push({ type: "keyDown", value: MOD[m] });
  actions.push({ type: "keyDown", value: key }, { type: "keyUp", value: key });
  for (const m of [...modifiers].reverse()) actions.push({ type: "keyUp", value: MOD[m] });
  await client.performActions([{ type: "key", id: "kbd", actions }]);
  await client.releaseActions();
}

async function typeText(text) {
  const actions = [...text].flatMap(c => [{ type: "keyDown", value: c }, { type: "keyUp", value: c }]);
  await client.performActions([{ type: "key", id: "kbd", actions }]);
  await client.releaseActions();
}

// Real macOS Option changes event.key (Option+R reports "®", Option+Shift+R "‰")
// while code stays KeyR. WebDriver cannot express that, so dispatch it through
// a TextInputProcessor on the test window, the same path WebDriver uses.
async function pressShaped(modifiers, key, code, keyCode) {
  await chrome(`
    const [modifiers, key, code, keyCode] = arguments;
    const codes = { Control: ['ControlLeft', 17], Alt: ['AltLeft', 18], Shift: ['ShiftLeft', 16], Meta: ['MetaLeft', 91] };
    const tip = Cc['@mozilla.org/text-input-processor;1'].createInstance(Ci.nsITextInputProcessor);
    tip.beginInputTransactionForTests(window);
    const event = (type, key, [code, keyCode]) => new KeyboardEvent(type, { key, code, keyCode });
    for (const m of modifiers) tip.keydown(event('keydown', m, codes[m]));
    tip.keydown(event('keydown', key, [code, keyCode])); tip.keyup(event('keyup', key, [code, keyCode]));
    for (const m of [...modifiers].reverse()) tip.keyup(event('keyup', m, codes[m]));`, [modifiers, key, code, keyCode]);
}

const setShortcut = (selection, custom = "") => chrome(`
  Services.prefs.setIntPref('mod.pane.shortcut', arguments[0]);
  if (arguments[1]) Services.prefs.setStringPref('mod.pane.custom-shortcut', arguments[1]);
  else Services.prefs.clearUserPref('mod.pane.custom-shortcut');`, [selection, custom]);

async function pickerBinding() {
  return chrome(`
    const { pickerBinding, shortcutLabel } = ChromeUtils.importESModule('chrome://sine/content/zen-pane-manager/keybindings.mjs');
    const b = pickerBinding(Services.prefs, navigator.platform);
    return b && { ...b, text: shortcutLabel(b, navigator.platform) };`);
}

async function setupRestartCheck() {
  return chrome(`
    const a = await makeTab('PaneQA restart A'), b = await makeTab('PaneQA restart B');
    mw.add(a, b, 'right');
    await waitFor(() => groupOf(a)?.tabs.includes(b));
    await pick(a, 'scrolling');
    await waitFor(() => scrollingOn(a) && scrollingOn(b), 5000);
    return { state: state([a, b]), saved: [a, b].map(t => SessionStore.getCustomTabValue(t, 'pane-scrolling-v1')) };`);
}

async function verifyRestartCheck(before) {
  const after = await chrome(`
    await waitFor(() => byLabel('PaneQA restart A') && byLabel('PaneQA restart B'), 20000);
    const a = byLabel('PaneQA restart A'), b = byLabel('PaneQA restart B');
    if (!a || !b) return { missing: true, labels: [...gBrowser.tabs].map(t => t.label) };
    gBrowser.selectedTab = a;
    const ok = await waitFor(() => groupOf(a)?.tabs.includes(b) && scrollingOn(a) && scrollingOn(b), 15000);
    return { ok: !!ok, state: state([a, b]), saved: [a, b].map(t => SessionStore.getCustomTabValue(t, 'pane-scrolling-v1')) };`);
  const ok = Boolean(after.ok);
  record("1. split + Scrolling persists across a full restart", ok, ok ? `restored ${JSON.stringify(after.state)}` : { before, after });
}

async function checkFloatKeepsScrolling() {
  const r = await chrome(`
    const c = await makeTab('PaneQA float C'), d = await makeTab('PaneQA float D'), e = await makeTab('PaneQA float E');
    mw.add(c, d, 'right'); mw.add(d, e, 'right');
    await waitFor(() => groupOf(c)?.tabs.length === 3);
    await pick(c, 'scrolling');
    const scrollingBefore = await waitFor(() => [c, d, e].every(scrollingOn), 5000);
    await pick(e, 'float');
    const floated = await waitFor(() => mw.floatingTabs.includes(e), 5000);
    gBrowser.selectedTab = c; await sleep(300);
    const after = state([c, d, e]);
    const ok = !!scrollingBefore && !!floated && groupOf(c)?.tabs.length === 3 && scrollingOn(c) && scrollingOn(d) && !scrollingOn(e);
    for (const t of [c, d, e]) gBrowser.removeTab(t, { animate: false });
    return { ok, scrollingBefore: !!scrollingBefore, floated: !!floated, after };`);
  record("2. floating a tab out of a Scrolling split keeps Scrolling on", r.ok, r.ok ? null : r);
}

async function checkScrollingDocksFloats() {
  const r = await chrome(`
    const f = await makeTab('PaneQA dock F'), g = await makeTab('PaneQA dock G'), h = await makeTab('PaneQA dock H');
    mw.add(f, g, 'right'); mw.add(g, h, 'right');
    await waitFor(() => groupOf(f)?.tabs.length === 3);
    await pick(h, 'float');
    const floated = await waitFor(() => mw.floatingTabs.includes(h), 5000);
    await pick(f, 'scrolling');
    const ok = !!(await waitFor(() => !mw.floatingTabs.includes(h) && [f, g, h].every(scrollingOn), 5000));
    const after = state([f, g, h]);
    const order = groupOf(f)?.tabs.map(t => t.label);
    for (const t of [f, g, h]) gBrowser.removeTab(t, { animate: false });
    return { ok: ok && !!floated, floated: !!floated, after, order };`);
  record("3. enabling Scrolling auto-docks existing floats", r.ok, r.ok ? `docked, order ${JSON.stringify(r.order)}` : r);
}

const pickerState = () => chrome(`
  const overlay = document.getElementById('pane-overlay'), dialog = document.getElementById('pane-dialog');
  const style = dialog && getComputedStyle(dialog);
  return { open: !!overlay && !overlay.hidden, background: style?.backgroundColor ?? null,
    image: style?.backgroundImage ?? null, focused: document.activeElement?.id || document.activeElement?.localName,
    search: document.getElementById('pane-search')?.value ?? null };`);

const closePicker = async () => {
  await press([], KEY.Escape);
  await chrome(`await waitFor(() => document.getElementById('pane-overlay')?.hidden, 3000);`);
};

function alphaOf(color) {
  const m = /rgba?\(([^)]+)\)/.exec(color ?? "");
  if (!m) return color === "transparent" ? 0 : null;
  const parts = m[1].split(/[ ,/]+/).filter(Boolean);
  return parts.length > 3 ? Number(parts[3]) : 1;
}

async function checkPickerShortcut(binding) {
  await chrome(`const t = await makeTab('PaneQA picker'); gBrowser.selectedTab = t; t.linkedBrowser.focus(); await sleep(300);`);
  const mods = ["ctrlKey", "altKey", "shiftKey", "metaKey"].filter(k => binding[k]).map(k => ({ ctrlKey: "Control", altKey: "Alt", shiftKey: "Shift", metaKey: "Meta" })[k]);
  await press(mods, binding.key);
  await chrome(`await waitFor(() => !document.getElementById('pane-overlay')?.hidden, 3000); await sleep(400);`);
  const s = await pickerState();
  const alpha = alphaOf(s.background);
  const ok = s.open && alpha === 1;
  record(`4. picker opens via ${binding.text} and is opaque`, ok, `open=${s.open} background-color=${s.background} (alpha ${alpha})`);
  if (s.open) await closePicker();
  await chrome(`gBrowser.removeTab(byLabel('PaneQA picker'), { animate: false });`);
  return mods;
}

const KEYPRESS_ECHO_PAGE = `<input id=q style="font-size:20px"><script>
let n = 0; const q = document.getElementById('q');
const show = () => document.title = 'PaneQA keys v=' + q.value + ' k=' + n;
addEventListener('keypress', () => { n++; show(); }, true); q.addEventListener('input', show);
addEventListener('focus', () => q.focus()); q.focus(); show();
</script>`;

async function sendChordAndReadBack(target, send) {
  if (target === "page") {
    await chrome(`const t = gBrowser.addTrustedTab('data:text/html,' + encodeURIComponent(arguments[0]));
      await waitFor(() => t.label.startsWith('PaneQA keys'));
      gBrowser.selectedTab = t; t.linkedBrowser.focus(); await sleep(400);`, [KEYPRESS_ECHO_PAGE]);
  } else {
    await chrome(`const t = await makeTab('PaneQA urlbar'); gBrowser.selectedTab = t; await sleep(200);
      gURLBar.focus(); gURLBar.value = ''; await sleep(200);`);
  }
  const read = () => chrome(target === "page"
    ? `await sleep(150); return /v=(.*) k=/.exec(gBrowser.selectedTab.label)?.[1] ?? gBrowser.selectedTab.label;`
    : `return gURLBar.value;`);
  await typeText("x");
  const control = await read();
  await send();
  await delay(400);
  const picker = await pickerState();
  if (picker.open) await closePicker();
  await delay(300);
  const after = await read();
  await chrome(`gURLBar.handleRevert?.(); gBrowser.removeTab(gBrowser.selectedTab, { animate: false });`);
  return { control, picker: picker.open, search: picker.search, after };
}

async function checkNoStrayCharacter(binding, mods) {
  const mac = /Mac/i.test(binding.platform);
  const variants = [
    { name: `Auto ${binding.text} (WebDriver)`, prefs: [0], send: () => press(mods, binding.key) },
    ...(mac ? [
      { name: "Auto Control+Option+R, macOS-shaped (key ®)", prefs: [0], send: () => pressShaped(["Control", "Alt"], "®", "KeyR", 82) },
      { name: "custom Option+Shift+R, macOS-shaped (key ‰)", prefs: [3, "Alt+Shift+R"], send: () => pressShaped(["Alt", "Shift"], "‰", "KeyR", 82) },
    ] : []),
  ];
  const details = [];
  let clean = true, sensitive = 0;
  try {
    for (const variant of variants) for (const target of ["page", "urlbar"]) {
      await setShortcut(2);
      const baselineWithShortcutOff = await sendChordAndReadBack(target, variant.send);
      const wouldType = baselineWithShortcutOff.control === "x" && baselineWithShortcutOff.after !== "x";
      if (wouldType) sensitive++;
      await setShortcut(...variant.prefs);
      const r = await sendChordAndReadBack(target, variant.send);
      const ok = r.control === "x" && r.picker && r.search === "" && r.after === "x";
      clean &&= ok;
      details.push(`${ok ? "ok " : "BAD"} ${target.padEnd(6)} ${variant.name}: picker=${r.picker} search=${JSON.stringify(r.search)} after=${JSON.stringify(r.after)} | unconsumed types ${JSON.stringify(baselineWithShortcutOff.after.slice(1))}`);
    }
  } finally { await setShortcut(0); }
  if (!sensitive) details.push("no chord typed anything even with the shortcut disabled, so this check could not detect a stray character");
  record("5. shortcut types no stray character into the page or URL bar", clean && sensitive > 0, details.join("\n      "));
}

async function main() {
  log(`evidence: ${evidence}`);
  try {
    const dirty = execFileSync("git", ["-C", repo, "status", "--porcelain"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    log(`checkout: ${repo} @ ${execFileSync("git", ["-C", repo, "rev-parse", "--short", "HEAD"]).toString().trim()}${dirty ? " (dirty)" : ""}`);
  } catch { log(`checkout: ${repo} (not a git checkout)`); }
  preflight();
  const modDir = makeProfile();
  log(`disposable profile: ${profile}`);
  log(`staged checkout into ${modDir}`);
  const port = await freePort();
  writePrefs(port);
  launch();
  await connect(port);

  const binding = { ...(await pickerBinding()), platform: await client.execute("return navigator.platform;") };
  let restartSetup = null;
  for (const [name, run] of [
    ["setup for check 1", async () => { restartSetup = await setupRestartCheck(); }],
    ["2", checkFloatKeepsScrolling],
    ["3", checkScrollingDocksFloats],
  ]) {
    try { await run(); } catch (error) { record(`${name} (harness error)`, false, error.message); }
  }
  let mods = [];
  try { mods = await checkPickerShortcut(binding); } catch (error) { record("4. picker shortcut (harness error)", false, error.message); }
  try { await checkNoStrayCharacter(binding, mods); } catch (error) { record("5. stray character (harness error)", false, error.message); }

  log(`restart: quitting pid ${zen.pid} gracefully`);
  await stopZen();
  launch();
  await connect(port);
  try { await verifyRestartCheck(restartSetup); } catch (error) { record("1. restart (harness error)", false, error.message); }
}

async function cleanup() {
  let stopError = null;
  try { await stopZen(); } catch (error) { stopError = error; log(`stop failed: ${error.message}`); }
  if (zen) { log(`WARNING: test Zen pid ${zen.pid} exit unconfirmed; leaving ${qaRoot}`); return stopError; }
  if (qaRoot && !keepProfile) {
    fs.rmSync(qaRoot, { recursive: true, force: true });
    log(`removed ${qaRoot}`);
  } else if (qaRoot) log(`kept ${qaRoot} (ZEN_CHECKS_KEEP_PROFILE=1)`);
  return stopError;
}

process.once("SIGINT", async () => { await cleanup(); process.exit(130); });

let fatal = null;
try { await main(); } catch (error) { fatal = error; log(`HARNESS ERROR: ${error.stack ?? error.message}`); }
const cleanupError = await cleanup();
fatal ??= cleanupError;
const failed = results.filter(r => !r.ok).length;
log(`\n${results.length - failed}/${results.length} checks passed${fatal ? " (harness aborted)" : ""}. Evidence: ${evidence}`);
fs.writeFileSync(path.join(evidence, "results.json"), JSON.stringify({ results, fatal: fatal?.message ?? null }, null, 2));
process.exit(failed || fatal || results.length < 5 ? 1 : 0);
