/**
 * Same as playwright.config.ts, but runs the tests from .trial-src/: src/ with Clear-DB's Studio technical names
 * translated to the Odoo "Rename-HelpdeskRepair" trial names. Build it first: node scripts/make-trial-src.js
 */
import base from './playwright.config';

export default { ...base, testDir: process.env.TRIAL_SRC ?? './.trial-src' };
