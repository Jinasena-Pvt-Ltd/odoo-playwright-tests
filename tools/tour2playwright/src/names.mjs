// Shared naming helpers so the spec generator and the manual generator agree
// on screenshot paths, and so the CLI knows where to write generated output
// inside a target module.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// tools/tour2playwright/src -> tools/tour2playwright -> tools -> repo root
export const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

// Scratch space for intermediate build output (screenshots, REVIEW.md) — always
// relative to this tool's own directory, never committed, never written into a
// module. Only the final .spec.ts and .html land inside src/modules/<domain>/.
export const GENERATED_DIR = "generated";
export const SCREENSHOTS_DIR = path.join(GENERATED_DIR, "screenshots");

/** Confirm the target module already exists — never auto-scaffold one. */
export function assertModuleExists(domain) {
  const dir = path.join(REPO_ROOT, "src", "modules", domain);
  if (!fs.existsSync(dir)) {
    throw new Error(
      `Module "${domain}" does not exist at ${dir}. Scaffold it first with /add-module ${domain}.`
    );
  }
}

/** Where generated Playwright specs for this domain are written. */
export function specsDirFor(domain) {
  return path.join(REPO_ROOT, "src", "modules", domain, "tests", "02-business");
}

/** Where generated HTML manuals for this domain are written. */
export function docsDirFor(domain) {
  return path.join(REPO_ROOT, "src", "modules", domain, "documentation");
}

/** Zero-padded step number (width scales with the step count). */
export function pad(n, total) {
  const width = Math.max(2, String(total || 0).length);
  return String(n).padStart(width, "0");
}

/** Screenshot file name for a step, e.g. "step-03.png". */
export function shotFile(number, total) {
  return `step-${pad(number, total)}.png`;
}

/** Screenshot directory for a tour, relative to the tool root (scratch space). */
export function shotDir(slug) {
  return path.posix.join(SCREENSHOTS_DIR.replace(/\\/g, "/"), slug);
}

/**
 * Screenshot directory for a tour, relative to the REPO ROOT — this is the
 * path baked into the generated spec's SHOT_DIR constant, since the spec
 * always executes with cwd = repo root (run via the main suite's own
 * `npx playwright test`), not from inside tools/tour2playwright/.
 */
export function shotDirFromRepoRoot(slug) {
  return path.posix.join("tools", "tour2playwright", SCREENSHOTS_DIR.replace(/\\/g, "/"), slug);
}
