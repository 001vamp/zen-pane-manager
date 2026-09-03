import { parseBinding, matchesBinding, pickerBinding } from "./keybindings.mjs";
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Pane's small, independent diagnostics bootstrap. It intentionally avoids
// page titles, URLs, search text, file paths, and tab names.
const VERSION = "0.9.0";
const TAG = "[Pane diagnostics]";
const KEY = "__paneDiagnostics";
const SHORTCUT_PREF = "mod.pane.diagnostics-shortcut";
const MAX_EVENTS = 80;

window[KEY]?.destroy?.();

const startedAt = Date.now();
const events = [];
let sineVersion = "unknown";

const safeText = value => String(value ?? "")
  .replace(/https?:\/\/\S+/giu, "[url]")
  .replace(/file:\/\/\/\S+/giu, "[path]")
  .replace(/\b[A-Z]:\\[^\r\n]*/giu, "[path]")
  .replace(/[\r\n\t]+/gu, " ")
  .slice(0, 180);

function log(event, details = {}) {
  const safeDetails = {};
  for (const [key, value] of Object.entries(details)) {
    if (["title", "url", "query", "path", "stack"].includes(key.toLocaleLowerCase())) continue;
    safeDetails[key] = typeof value === "number" || typeof value === "boolean"
      ? value
      : safeText(value);
  }
  events.push({ at: Date.now() - startedAt, event: safeText(event), details: safeDetails });
  if (events.length > MAX_EVENTS) events.shift();
  console.log(TAG, event, safeDetails);
}

function pref(name, fallback = null) {
  try {
    const type = Services.prefs.getPrefType(name);
    if (type === 128) return Services.prefs.getBoolPref(name);
    if (type === 64) return Services.prefs.getIntPref(name);
    if (type === 32) return Services.prefs.getStringPref(name);
  } catch (error) {
    log("preference read failed", { name, error: error?.name });
  }
  return fallback;
}

function snapshot() {
  const splitter = window.gZenViewSplitter;
  const containers = document.querySelectorAll(".browserSidebarContainer[is-zen-split]");
  const headers = document.querySelectorAll(".browserSidebarContainer[is-zen-split] .zen-view-splitter-header");
  const active = splitter?.currentView >= 0 ? splitter?._data?.[splitter.currentView] : null;
  return {
    paneVersion: VERSION,
    browserVersion: safeText(Services.appinfo.version),
    platformVersion: safeText(Services.appinfo.platformVersion),
    buildId: safeText(Services.appinfo.appBuildID),
    operatingSystem: safeText(Services.appinfo.OS),
    architecture: safeText(Services.appinfo.XPCOMABI),
    documentReady: document.readyState,
    sineInterfacePresent: Boolean(window.SineAPI || window.addUnloadListener),
    sineVersion,
    sineBranch: pref("sine.is-cosine", false) ? "cosine" : "sine",
    unofficialJavaScriptAllowed: pref("sine.allow-unsafe-js", false),
    sineRestartPending: pref("sine.engine.pending-restart", false),
    paneReady: document.documentElement.hasAttribute("pane-ready"),
    splitterPresent: Boolean(splitter),
    splitterCompatible: Boolean(
      splitter &&
      Array.isArray(splitter._data) &&
      typeof splitter.getSplitNodeFromTab === "function" &&
      typeof splitter.resetTabState === "function" &&
      typeof splitter.activateSplitView === "function"
    ),
    activeSplitPresent: Boolean(active),
    activePaneCount: Array.isArray(active?.tabs) ? active.tabs.length : 0,
    splitContainerCount: containers.length,
    splitHeaderCount: headers.length,
    paneButtonCount: document.querySelectorAll(".pane-button").length,
  };
}

async function detectSineVersion() {
  try {
    if (typeof IOUtils === "undefined" || typeof PathUtils === "undefined") return;
    const chromeDirectory = Services.dirsvc.get("UChrm", Ci.nsIFile).path;
    const engine = await IOUtils.readJSON(PathUtils.join(chromeDirectory, "JS", "engine.json"));
    sineVersion = safeText(engine?.version || "unknown");
    log("Sine version detected", { version: sineVersion });
  } catch (error) {
    log("Sine version unavailable", { error: error?.name });
  }
}

function report() {
  const lines = [
    "Pane diagnostics",
    "Privacy: excludes tab titles, URLs, searches, file paths, and browsing history.",
    "",
    "Environment",
    ...Object.entries(snapshot()).map(([key, value]) => `${key}: ${value}`),
    "",
    "Recent events",
    ...(events.length
      ? events.map(item => {
        const details = Object.keys(item.details).length ? ` ${JSON.stringify(item.details)}` : "";
        return `+${item.at}ms ${item.event}${details}`;
      })
      : ["No events recorded."]),
  ];
  return lines.join("\n");
}

function copy() {
  const text = report();
  try {
    Cc["@mozilla.org/widget/clipboardhelper;1"]
      .getService(Ci.nsIClipboardHelper)
      .copyString(text);
    log("diagnostic report copied", { characters: text.length });
    console.info(TAG, "Report copied. Paste it into the GitHub bug report.");
    return true;
  } catch (error) {
    log("diagnostic copy failed", { error: error?.name });
    console.info(TAG, "Copy this report manually:\n" + text);
    return false;
  }
}

function onShortcut(event) {
  if (!pref(SHORTCUT_PREF, true)) return;
  const binding = parseBinding(pref("mod.pane.diagnostics-keybinding", "Ctrl+Alt+D"));
  // The picker wins if users assign both actions the same shortcut.
  if (matchesBinding(event, pickerBinding(Services.prefs))) return;
  if (matchesBinding(event, binding)) {
    event.preventDefault();
    event.stopPropagation();
    const copied = copy();
    Services.prompt.alert(
      window,
      "Pane diagnostics",
      copied
        ? "A privacy-safe Pane report was copied. Paste it into the GitHub bug report."
        : "Pane printed the report in the Browser Console because clipboard access failed."
    );
  }
}

function destroy() {
  window.removeEventListener("keydown", onShortcut, true);
  if (window[KEY]?.destroy === destroy) delete window[KEY];
  if (window.PaneDiagnostics?.report === report) delete window.PaneDiagnostics;
}

window.addEventListener("keydown", onShortcut, true);
window[KEY] = { VERSION, events, log, snapshot, report, copy, destroy };
window.PaneDiagnostics = { report, copy, snapshot };
window.addUnloadListener?.(destroy);
log("diagnostics bootstrap loaded", { shortcut: parseBinding(pref("mod.pane.diagnostics-keybinding", "Ctrl+Alt+D"))?.label ?? "disabled" });
detectSineVersion();
