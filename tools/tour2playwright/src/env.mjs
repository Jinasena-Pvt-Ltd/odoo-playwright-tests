// Minimal zero-dependency .env loader (avoids pulling in `dotenv`).
//
// Reads KEY=VALUE lines from the repo-root .env — the SAME file the rest of
// the Playwright HR test suite uses — into process.env, without overwriting
// variables already present in the real environment. There is no separate
// .env inside this tool; deliberately not, so there's only one place to keep
// Odoo credentials in sync.
//
// tour2playwright's own var names differ from this repo's, so recognized
// root-.env names are aliased onto them after loading:
//   ODOO_URL      ← ODOO_BASE_URL
//   ODOO_LOGIN    ← ADMIN_EMAIL
//   ODOO_PASSWORD ← ADMIN_PASSWORD
//   ODOO_DB       (same name in both — no alias needed)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// tools/tour2playwright/src -> tools/tour2playwright -> tools -> repo root
const ENV_PATH = path.resolve(__dirname, "..", "..", "..", ".env");

function parseEnv(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // Strip surrounding quotes if present.
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

// Map this repo's root .env variable names onto the names the rest of
// tour2playwright expects.
const ALIASES = {
  ODOO_URL: "ODOO_BASE_URL",
  ODOO_LOGIN: "ADMIN_EMAIL",
  ODOO_PASSWORD: "ADMIN_PASSWORD",
};

let loaded = false;
export function loadEnv() {
  if (loaded) return;
  loaded = true;
  if (!fs.existsSync(ENV_PATH)) return;
  const parsed = parseEnv(fs.readFileSync(ENV_PATH, "utf8"));
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  for (const [want, sourceKey] of Object.entries(ALIASES)) {
    if (process.env[want] === undefined && process.env[sourceKey] !== undefined) {
      process.env[want] = process.env[sourceKey];
    }
  }
}

// Load immediately on import so `import "./env.mjs"` is enough.
loadEnv();

export const ODOO_URL = () => process.env.ODOO_URL || "http://localhost:8069";
export const ODOO_DB = () => process.env.ODOO_DB || "";
export const ODOO_LOGIN = () => process.env.ODOO_LOGIN || "admin";
export const ODOO_PASSWORD = () => process.env.ODOO_PASSWORD || "admin";
