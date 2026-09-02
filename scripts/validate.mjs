import { readFile } from "node:fs/promises";

const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const fail = message => {
  console.error(`Validation failed: ${message}`);
  process.exitCode = 1;
};

const theme = await readJson("theme.json");
const packageJson = await readJson("package.json");
const preferences = await readJson("preferences.json");
const source = await readFile("pane.uc.mjs", "utf8");

for (const field of ["id", "name", "description", "version", "author", "homepage", "license"]) {
  if (!theme[field]) fail(`theme.json is missing ${field}`);
}

if (theme.id !== "zen-pane-manager") fail("theme id must remain zen-pane-manager");
if (theme.version !== packageJson.version) fail("theme and package versions must match");
if (!source.includes(`version: "${theme.version}"`)) fail("runtime and manifest versions must match");
if (theme.license !== "MPL-2.0") fail("license must remain MPL-2.0");
if (theme.preferences !== "preferences.json") fail("preferences manifest entry is incorrect");
if (!theme.scripts?.["pane.uc.mjs"]) fail("script manifest entry is missing");
if (!Array.isArray(preferences)) fail("preferences.json must contain an array");

const properties = preferences.map(item => item.property).filter(Boolean);
const duplicates = properties.filter((property, index) => properties.indexOf(property) !== index);
if (duplicates.length) fail(`duplicate preference keys: ${[...new Set(duplicates)].join(", ")}`);

for (const forbidden of ["fetch(", "XMLHttpRequest", "WebSocket", "eval(", "nsIProcess", "@mozilla.org/file"]) {
  if (source.includes(forbidden)) fail(`privileged source contains forbidden capability: ${forbidden}`);
}

if (!process.exitCode) console.log(`Pane ${theme.version} validation passed (${properties.length} preferences).`);
