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

// A harness error is not evidence that a product regression was detected.
export function caughtFix(run, report, check) {
  return !run.error && run.signal === null && run.status === 1 &&
    report?.fatal === null && report.results?.length === mutations.length &&
    mutations.every(m => report.results.filter(r =>
      r.name.startsWith(`${m.check}.`) && !r.name.includes("(harness error)") &&
      typeof r.ok === "boolean").length === 1) &&
    report.results.some(r => r.name.startsWith(`${check}.`) && r.ok === false);
}

function proveFails() {
  let allCaught = true;
  for (const m of mutations) {
    const mutant = fs.realpathSync(fs.mkdtempSync("/tmp/pane-mutant."));
    try {
      execFileSync("rsync", ["-a", "--exclude=.git", "--exclude=node_modules", `${repo}/`, `${mutant}/`]);
      const file = path.join(mutant, m.file);
      const source = fs.readFileSync(file, "utf8");
      if (source.split(m.from).length !== 2) throw new Error(`fix for check ${m.check} must match exactly once in ${m.file}; update prove-fails.mjs`);
      fs.writeFileSync(file, source.replace(m.from, m.to));
      console.log(`reverted only fix ${m.check} in ${mutant}`);
      const run = spawnSync(process.execPath, [path.join(mutant, "scripts/zen-checks/run.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
      process.stdout.write(run.stdout ?? "");
      const evidence = /^evidence: (.+)$/m.exec(run.stdout ?? "")?.[1];
      let report = null;
      try { report = JSON.parse(fs.readFileSync(path.join(evidence, "results.json"), "utf8")); } catch {}
      const caught = caughtFix(run, report, m.check);
      allCaught &&= caught;
      console.log(`${caught ? "CAUGHT" : "NOT PROVEN"} check ${m.check} with only its own fix reverted`);
    } finally {
      fs.rmSync(mutant, { recursive: true, force: true });
    }
  }
  console.log(allCaught ? "every check fails when only its own fix is reverted" : "some fixes were not proven (missing failures or harness errors)");
  process.exitCode = allCaught ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) proveFails();
