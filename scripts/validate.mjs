import { access, readFile } from "node:fs/promises";

const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const fail = message => {
  console.error(`Validation failed: ${message}`);
  process.exitCode = 1;
};

const theme = await readJson("theme.json");
const packageJson = await readJson("package.json");
const preferences = await readJson("preferences.json");
const source = await readFile("pane.uc.mjs", "utf8");
const diagnostics = await readFile("pane-diagnostics.uc.mjs", "utf8");
const readme = await readFile("README.md", "utf8");
const changelog = await readFile("CHANGELOG.md", "utf8");

for (const path of ["keybindings.mjs", "theme.json", "pane-diagnostics.uc.mjs", "pane.uc.mjs", "chrome.css", "preferences.json"]) {
  try { await access(path); } catch { fail(`Sine package is missing ${path}`); }
}

for (const field of ["id", "name", "description", "version", "author", "homepage", "license"]) {
  if (!theme[field]) fail(`theme.json is missing ${field}`);
}

if (theme.id !== "zen-pane-manager") fail("theme id must remain zen-pane-manager");
if (theme.version !== packageJson.version) fail("theme and package versions must match");
if (!source.includes(`version: "${theme.version}"`)) fail("runtime and manifest versions must match");
if (theme.license !== "MPL-2.0") fail("license must remain MPL-2.0");
if (theme.preferences !== "preferences.json") fail("preferences manifest entry is incorrect");
if (!theme.scripts?.["pane.uc.mjs"]) fail("script manifest entry is missing");
if (theme.scripts?.["pane-diagnostics.uc.mjs"]?.loadOrder !== 40) fail("diagnostics load order must remain 40");
if (theme.scripts?.["pane.uc.mjs"]?.loadOrder !== 50) fail("Pane script load order must remain 50");
if (theme.supportsUnload !== true) fail("Sine live-unload support must remain enabled");
if (!Array.isArray(preferences)) fail("preferences.json must contain an array");
if (!source.includes("window.addUnloadListener?.(destroy)")) fail("runtime must register its Sine unload callback");
if (!diagnostics.includes("window.addUnloadListener?.(destroy)")) fail("diagnostics must register its Sine unload callback");
if (!diagnostics.includes("Privacy: excludes tab titles, URLs, searches, file paths, and browsing history.")) fail("diagnostic report must state its privacy boundary");
if (!diagnostics.includes(`const VERSION = "${theme.version}"`)) fail("diagnostics and manifest versions must match");
if (!source.includes("new MutationObserver(schedulePaneButtons)")) fail("runtime must watch for rebuilt split headers");
if (!readme.includes("Install JavaScript from unofficial sources")) fail("README must document Sine's external JavaScript permission");
if (!readme.includes("Sine **2.3 or newer**")) fail("README must document the minimum Sine version");
if (!changelog.includes(`## ${theme.version}`)) fail("CHANGELOG is missing the current release");

const properties = preferences.map(item => item.property).filter(Boolean);
const duplicates = properties.filter((property, index) => properties.indexOf(property) !== index);
if (duplicates.length) fail(`duplicate preference keys: ${[...new Set(duplicates)].join(", ")}`);

for (const forbidden of ["fetch(", "XMLHttpRequest", "WebSocket", "eval(", "nsIProcess", "@mozilla.org/file"]) {
  if (source.includes(forbidden)) fail(`privileged source contains forbidden capability: ${forbidden}`);
}

if (!process.exitCode) console.log(`Pane ${theme.version} validation passed (${properties.length} preferences).`);
