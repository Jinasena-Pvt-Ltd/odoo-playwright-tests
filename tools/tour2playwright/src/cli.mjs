#!/usr/bin/env node
// tour2playwright CLI
//
//   node src/cli.mjs generate <domain> <export.json>   → write specs into
//                                                          src/modules/<domain>/tests/02-business/
//   node src/cli.mjs manual   <domain> <export.json>   → write HTML manuals into
//                                                          src/modules/<domain>/documentation/
//   node src/cli.mjs build    <domain> <export.json>   → generate → run via the
//                                                          main suite → manuals
//
// (Prefer the npm scripts: `npm run gen -- <domain> <f>`, `npm run manual -- <domain> <f>`,
//  `npm run build -- <domain> <f>`.)
//
// <domain> must already exist as a scaffolded module (see /add-module).
// `build` executes the generated spec via the MAIN suite's own runner
// (`npx playwright test <path> --project=admin`, run from the repo root) —
// there is no separate login/config for this tool; it reuses the same
// auth-storage/admin.json every other test in the framework already uses.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import "./env.mjs";
import { loadTours } from "./loadTours.mjs";
import { genSpec } from "./genSpec.mjs";
import { genManuals } from "./genManual.mjs";
import { REPO_ROOT, GENERATED_DIR, assertModuleExists, specsDirFor, docsDirFor } from "./names.mjs";

function usage(msg) {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error(
    [
      "Usage:",
      "  node src/cli.mjs generate <domain> <export.json>   Write specs into src/modules/<domain>/tests/02-business/",
      "  node src/cli.mjs manual   <domain> <export.json>   Write HTML manuals into src/modules/<domain>/documentation/",
      "  node src/cli.mjs build    <domain> <export.json>   generate → run (via main suite) → manuals",
      "",
      "<domain> must already exist as a scaffolded module — see /add-module.",
    ].join("\n")
  );
  process.exit(msg ? 1 : 0);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function doGenerate(domain, exportFile) {
  assertModuleExists(domain);
  const { tours } = loadTours(exportFile);
  const specsDir = specsDirFor(domain);
  ensureDir(specsDir);
  const report = [];
  const specPaths = [];
  for (const tour of tours) {
    const { filename, source, todos } = genSpec(tour, domain);
    const outPath = path.join(specsDir, filename);
    fs.writeFileSync(outPath, source, "utf8");
    specPaths.push(outPath);
    console.log(`  spec  ${path.relative(REPO_ROOT, outPath)}  (${tour.steps.length} steps)`);
    if (todos.length) {
      report.push(`## ${tour.name}  (${filename})`);
      for (const t of todos) report.push(`- step ${t.step}: ${t.msg}`);
      report.push("");
    }
  }
  // Surface everything that needs a human in one place — a scratch checklist,
  // not a durable artifact; fix flagged steps directly in the committed spec.
  const reportPath = path.join(GENERATED_DIR, "REVIEW.md");
  if (report.length) {
    ensureDir(GENERATED_DIR);
    fs.writeFileSync(
      reportPath,
      "# tour2playwright — items needing review\n\n" + report.join("\n"),
      "utf8"
    );
    console.log(`\n  ${report.filter((l) => l.startsWith("- ")).length} item(s) need review → ${reportPath}`);
  } else {
    // Clear a stale report from a previous run.
    if (fs.existsSync(reportPath)) fs.rmSync(reportPath);
  }
  return { tours, specPaths };
}

function doManual(domain, exportFile) {
  assertModuleExists(domain);
  const { tours } = loadTours(exportFile);
  const docsDir = docsDirFor(domain);
  ensureDir(docsDir);
  for (const tour of tours) {
    const files = genManuals(tour);
    for (const { filename, content } of files) {
      const outPath = path.join(docsDir, filename);
      fs.writeFileSync(outPath, content, "utf8");
      console.log(`  manual  ${path.relative(REPO_ROOT, outPath)}`);
    }
  }
}

/** Run one generated spec via the MAIN suite's own runner/auth (admin role). */
function runViaMainSuite(specAbsPath) {
  const relPath = path.relative(REPO_ROOT, specAbsPath).replace(/\\/g, "/");
  console.log(`\nRunning ${relPath} via the main suite (admin project)…\n`);
  const res = spawnSync("npx", ["playwright", "test", relPath, "--project=admin"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (res.status !== 0) {
    console.error(
      "\nPlaywright run did not fully pass. Screenshots for passing steps were still captured; " +
        "the manual will use whatever exists. Check the Playwright HTML report for details."
    );
  }
  return res.status;
}

function main() {
  const [, , cmd, domain, exportFile] = process.argv;
  if (!cmd || cmd === "-h" || cmd === "--help") return usage();

  if (cmd === "generate" || cmd === "gen") {
    if (!domain) return usage("missing <domain>");
    if (!exportFile) return usage("missing <export.json>");
    console.log(`Generating specs for module "${domain}" from ${exportFile}`);
    doGenerate(domain, exportFile);
    console.log("\nNext: `npm run build -- " + domain + " <export.json>` to run it and capture screenshots.");
  } else if (cmd === "manual") {
    if (!domain) return usage("missing <domain>");
    if (!exportFile) return usage("missing <export.json>");
    console.log(`Generating manuals for module "${domain}" from ${exportFile}`);
    doManual(domain, exportFile);
  } else if (cmd === "build") {
    if (!domain) return usage("missing <domain>");
    if (!exportFile) return usage("missing <export.json>");
    console.log(`Building specs for module "${domain}" from ${exportFile}`);
    const { specPaths } = doGenerate(domain, exportFile);
    for (const specPath of specPaths) runViaMainSuite(specPath);
    console.log("\nGenerating manuals…");
    doManual(domain, exportFile);
    console.log(`\nDone. See src/modules/${domain}/documentation/ for the manuals.`);
  } else {
    return usage(`unknown command "${cmd}"`);
  }
}

main();
