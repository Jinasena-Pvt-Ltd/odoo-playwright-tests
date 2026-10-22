/**
 * StepRunReporter — saves every run so two reports can be generated from it.
 *
 * After each run it writes, under reports/run-history/:
 *   runs.json        every run so far (1st run, 2nd run, …) with the result of every test
 *   inventory.json   every test case ever seen, in file order (also filled by scripts/update-inventory.js)
 *   latest-run.json  full detail of the latest run: named steps (test.step), errors, failure screenshots
 * and then calls scripts/generate-run-reports.js, which writes
 *   reports/master-test-report-YYYY-MM-DD.html   (all test cases by module / test step, latest result)
 *   reports/custom-run-report-YYYY-MM-DD.html    (run by run, open items, step-by-step detail)
 *
 * Options: { outputDir?: string }  (default "reports")
 * Env:     RUN_LABEL — name for this run (default "1st run", "2nd run", …)
 *          RUN_NOTE  — one line for the "What happened" column of the custom report
 *          RUN_HISTORY=off — generate the reports from the existing history without saving this run
 */
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult, TestStep } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

type Status = 'passed' | 'failed' | 'skipped';

interface StepRow { title: string; durationMs: number; error: string; children: StepRow[] }

interface TestRow {
  key: string;
  project: string;
  module: string;
  stepKey: string;
  describe: string;
  title: string;
  file: string;
  placeholder: boolean;
  status: Status;
  durationMs: number;
  error: string;
  steps: StepRow[];
  annotations: Array<{ type: string; description: string }>;
  screenshot: string;
}

const STEP_FOLDER: Record<string, string> = {
  '01-config': 'config', '02-business': 'business', '03-reporting': 'reporting', '04-permissions': 'permissions',
  '05-validations': 'validations', '06-edge-cases': 'edge', '07-archive': 'archive',
};
const MAX_RUNS_KEPT = 30;

const strip = (s: string): string => s.replace(/\u001b\[[0-9;]*m/g, '').replace(/\[[0-9;]*m/g, '');
const norm = (s: string): Status => (s === 'passed' ? 'passed' : s === 'skipped' ? 'skipped' : 'failed');
const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd']; const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]} run`;
};

function collectSteps(steps: TestStep[]): StepRow[] {
  const out: StepRow[] = [];
  for (const s of steps) {
    if (s.category === 'test.step') {
      out.push({
        title: s.title,
        durationMs: s.duration,
        error: s.error ? strip(s.error.message ?? '').split('\n')[0].slice(0, 300) : '',
        children: collectSteps(s.steps),
      });
    } else {
      out.push(...collectSteps(s.steps)); // hooks / api calls: keep only the named steps inside them
    }
  }
  return out;
}

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) as T; } catch { return fallback; }
}

export default class StepRunReporter implements Reporter {
  private rows = new Map<string, TestRow>();
  private startedAt = new Date();
  private outputDir: string;
  private rootDir = process.cwd();

  constructor(options: { outputDir?: string } = {}) {
    this.outputDir = options.outputDir ?? 'reports';
  }

  onBegin(config: FullConfig, _suite: Suite): void {
    this.rootDir = config.rootDir ? path.resolve(config.rootDir, '..') : process.cwd();
    this.startedAt = new Date();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const file = test.location.file.replace(/\\/g, '/');
    const mod = (file.match(/\/modules\/([^/]+)\//) ?? [])[1] ?? (file.includes('/fixtures/') ? 'setup' : 'other');
    const folder = (file.match(/\/tests\/([^/]+)\//) ?? [])[1] ?? '';
    const stepKey = mod === 'setup' ? 'setup' : STEP_FOLDER[folder] ?? 'other';
    const titlePath = test.titlePath().filter(Boolean);
    const project = titlePath[0] ?? '';
    const describe = titlePath.slice(2, -1).map(t => t.replace(/@\S+/g, '').trim()).filter(Boolean).join(' › ');
    const title = test.title.replace(/@\S+/g, '').trim();
    const shot = result.attachments.find(a => a.contentType === 'image/png' && a.path);
    let screenshot = '';
    if (shot?.path && fs.existsSync(shot.path)) screenshot = `data:image/png;base64,${fs.readFileSync(shot.path).toString('base64')}`;

    const key = [project, mod, stepKey, describe, title].join('|');
    this.rows.set(test.id, {
      key, project, module: mod, stepKey, describe, title,
      file: path.basename(file),
      placeholder: /^placeholder/i.test(title),
      status: norm(result.status),
      durationMs: result.duration,
      error: result.errors.map(e => strip(e.message ?? '')).join('\n').trim(),
      steps: collectSteps(result.steps),
      annotations: test.annotations.map(a => ({ type: a.type, description: a.description ?? '' })),
      screenshot,
    });
  }

  onEnd(_result: FullResult): void {
    const rows = [...this.rows.values()];
    const dir = path.resolve(this.rootDir, this.outputDir, 'run-history');
    fs.mkdirSync(dir, { recursive: true });

    if (process.env.RUN_HISTORY !== 'off') {
      // runs.json
      const runsFile = path.join(dir, 'runs.json');
      const runs = readJson<Array<Record<string, unknown>>>(runsFile, []);
      const label = process.env.RUN_LABEL ?? ordinal(runs.length + 1);
      runs.push({
        id: this.startedAt.toISOString(),
        startedAt: this.startedAt.toISOString(),
        label,
        note: process.env.RUN_NOTE ?? '',
        results: Object.fromEntries(rows.map(r => [r.key, { status: r.status, durationMs: r.durationMs, error: r.error.split('\n')[0].slice(0, 240) }])),
      });
      fs.writeFileSync(runsFile, JSON.stringify(runs.slice(-MAX_RUNS_KEPT), null, 1), 'utf-8');

      // inventory.json — keep file order, add anything new
      const invFile = path.join(dir, 'inventory.json');
      const inventory = readJson<Array<{ key: string }>>(invFile, []);
      const known = new Set(inventory.map(i => i.key));
      for (const r of rows) {
        if (!known.has(r.key)) {
          inventory.push({ key: r.key, project: r.project, mod: r.module, stepKey: r.stepKey, describe: r.describe, title: r.title, file: r.file, placeholder: r.placeholder } as never);
          known.add(r.key);
        }
      }
      fs.writeFileSync(invFile, JSON.stringify(inventory, null, 1), 'utf-8');

      // latest-run.json — full detail for the step-by-step section
      fs.writeFileSync(path.join(dir, 'latest-run.json'), JSON.stringify({ label, startedAt: this.startedAt.toISOString(), rows }), 'utf-8');
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require(path.resolve(this.rootDir, 'scripts', 'generate-run-reports.js')).generate();
    } catch (e) {
      console.log(`Run reports were not generated: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
