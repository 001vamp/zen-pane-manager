#!/usr/bin/env node
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const mutations = [
  { check: 1, file: "multiwindow.mjs", from: "      if (!decoded) continue;\n      const widths=new Map();", to: "      if (true) continue;\n      const widths=new Map();" },
  { check: 2, file: "multiwindow.mjs", from: "    if (accordions.has(data)) clearAccordion(data);\n    const bounds", to: "    if (accordions.has(data)) clearAccordion(data);\n    clearScrolling(data);\n    const bounds" },
  { check: 3, file: "multiwindow.mjs", from: "    for (const member of data.tabs) clearFloat(false, member);\n    const widths=", to: "    if (data.tabs.some(t => floats.has(t))) throw new Error('Dock floating tabs first');\n    const widths=" },
  { check: 4, file: "chrome.css", from: "  background: linear-gradient(light-dark(var(--pane-user-tint-light), var(--pane-user-tint-dark)), light-dark(var(--pane-user-tint-light), var(--pane-user-tint-dark))), light-dark(#f7f8fb, #18191e);", to: "  background: light-dark(var(--pane-user-tint-light), var(--pane-user-tint-dark));" },
  { check: 5, file: "pane.uc.mjs", from: "    event.preventDefault(); event.stopPropagation();\n    event.stopImmediatePropagation?.();\n", to: "" },
];

const mutant = fs.realpathSync(fs.mkdtempSync("/tmp/pane-mutant."));
try {
  execFileSync("rsync", ["-a", "--exclude=.git", "--exclude=node_modules", `${repo}/`, `${mutant}/`]);
  for (const m of mutations) {
    const file = path.join(mutant, m.file);
    const source = fs.readFileSync(file, "utf8");
    if (!source.includes(m.from)) throw new Error(`fix for check ${m.check} no longer matches ${m.file}; update prove-fails.mjs`);
    fs.writeFileSync(file, source.replace(m.from, m.to));
  }
  console.log(`reverted ${mutations.length} fixes in ${mutant}`);
  const run = spawnSync(process.execPath, [path.join(mutant, "scripts/zen-checks/run.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  process.stdout.write(run.stdout);
  const verdicts = mutations.map(m => ({ check: m.check, failed: new RegExp(`^FAIL  ${m.check}\\.`, "m").test(run.stdout) }));
  for (const v of verdicts) console.log(`${v.failed ? "CAUGHT " : "MISSED "} check ${v.check} with its fix reverted`);
  const ok = run.status !== 0 && verdicts.every(v => v.failed);
  console.log(ok ? "every check fails when its fix is reverted" : "some check did not fail when its fix was reverted");
  process.exitCode = ok ? 0 : 1;
} finally {
  fs.rmSync(mutant, { recursive: true, force: true });
}
