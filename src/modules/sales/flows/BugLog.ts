import * as fs from 'fs';
import * as path from 'path';
import type { Page } from '@playwright/test';

export type Severity = 'High' | 'Medium' | 'Low' | 'Info';

export interface Bug {
  id: string;
  group: string;
  flow: string;
  step: string;
  severity: Severity;
  title: string;
  detail: string;
  screenshot?: string;
}

/** A failure that came from Odoo itself (error dialog / warning toast), not from the test code. */
export class OdooSystemError extends Error {
  constructor(public readonly title: string, public readonly body: string) {
    super(`${title}: ${body}`);
  }
}

const OUT_DIR = path.resolve(__dirname, '../../../../test-results/flow-bugs');
const REPORT_DIR = path.resolve(__dirname, '../../../../reports');

/**
 * Collects every problem found while walking the Cash / Credit flows so the run
 * ends with one bug list instead of stopping at the first failure.
 */
export class BugLog {
  readonly bugs: Bug[] = [];
  readonly passed: string[] = [];

  add(b: Omit<Bug, 'id'>): Bug {
    const dup = this.bugs.find(
      x => x.flow === b.flow && x.step === b.step && x.title === b.title && x.group !== b.group,
    );
    const bug: Bug = { id: `BUG-${String(this.bugs.length + 1).padStart(3, '0')}`, ...b };
    if (dup) bug.detail += `\n(Same problem as ${dup.id} in group ${dup.group}.)`;
    this.bugs.push(bug);
    return bug;
  }

  ok(label: string): void {
    this.passed.push(label);
  }

  /** Runs one flow step. Records a bug and returns false instead of throwing when it fails. */
  async step(
    page: Page,
    ctx: { group: string; flow: string },
    name: string,
    fn: () => Promise<void>,
  ): Promise<boolean> {
    try {
      await fn();
      this.ok(`${ctx.group} / ${ctx.flow} / ${name}`);
      return true;
    } catch (e) {
      const isSystem = e instanceof OdooSystemError;
      const msg = e instanceof Error ? e.message : String(e);
      fs.mkdirSync(OUT_DIR, { recursive: true });
      const shot = path.join(
        OUT_DIR,
        `${ctx.group}-${ctx.flow}-${name}`.replace(/[^a-z0-9]+/gi, '_').slice(0, 90) + '.png',
      );
      await page.screenshot({ path: shot }).catch(() => {});
      this.add({
        group: ctx.group,
        flow: ctx.flow,
        step: name,
        severity: isSystem ? 'High' : 'Medium',
        title: isSystem ? (e as OdooSystemError).title : 'Step could not be completed (needs review)',
        detail: msg.split('\n').slice(0, 6).join('\n').slice(0, 900),
        screenshot: shot,
      });
      return false;
    }
  }

  writeReports(): { md: string; json: string } {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const md = path.join(REPORT_DIR, `sales-flow-bugs-${date}.md`);
    const json = path.join(REPORT_DIR, `sales-flow-bugs-${date}.json`);
    fs.writeFileSync(json, JSON.stringify({ bugs: this.bugs, passed: this.passed }, null, 2), 'utf-8');

    const bySeverity = (s: Severity) => this.bugs.filter(b => b.severity === s).length;
    let out = `# Sales flow bug report — ${date}\n\n`;
    out += `Cash and Credit flows walked step by step for every Customer Group.\n\n`;
    out += `| Steps passed | Bugs found | High | Medium | Low | Info |\n|---|---|---|---|---|---|\n`;
    out += `| ${this.passed.length} | ${this.bugs.length} | ${bySeverity('High')} | ${bySeverity('Medium')} | ${bySeverity('Low')} | ${bySeverity('Info')} |\n\n`;
    out += `Severity: **High** = Odoo showed an error / blocked the flow. **Medium** = a step could not be completed, needs a human to confirm. **Info** = data or configuration observation.\n\n`;
    out += `## Bugs\n\n`;
    if (!this.bugs.length) out += '_No bugs found._\n';
    for (const b of this.bugs) {
      out += `### ${b.id} — ${b.title}\n\n`;
      out += `- **Group:** ${b.group}  \n- **Flow:** ${b.flow}  \n- **Step:** ${b.step}  \n- **Severity:** ${b.severity}\n`;
      out += `- **Details:**\n\n\`\`\`\n${b.detail}\n\`\`\`\n`;
      if (b.screenshot) out += `- **Screenshot:** \`${path.relative(path.resolve(__dirname, '../../../..'), b.screenshot).replace(/\\/g, '/')}\`\n`;
      out += '\n';
    }
    out += `## Steps that passed\n\n`;
    out += this.passed.map(p => `- ${p}`).join('\n') + '\n';
    fs.writeFileSync(md, out, 'utf-8');
    return { md, json };
  }
}
