// Runs the Sales Cash/Credit flow spec with the opt-in flag set (works in any shell),
// then builds the HTML bug report. Extra args go to Playwright: npm run test:sales-flows -- --headed
const { spawnSync } = require('child_process');
const args = ['playwright', 'test', 'sales.customer-flows', '--project=setup', '--project=admin', ...process.argv.slice(2)];
const r = spawnSync('npx', args, { stdio: 'inherit', shell: true, env: { ...process.env, RUN_SALES_FLOWS: 'true' } });
spawnSync('node', ['scripts/generate-flow-report.js'], { stdio: 'inherit', shell: true });
process.exit(r.status ?? 1);
