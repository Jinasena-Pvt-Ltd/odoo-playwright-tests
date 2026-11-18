/**
 * Step 3 — Daily security audit: internal user group assignments and CRUD access rights.
 *
 * Fetches current state via the admin-authenticated `rpc` fixture (no browser/page
 * needed — this is a pure API test), diffs against the most recent snapshot (which
 * may be today's own snapshot from an earlier run — see loadPreviousSnapshot), and
 * writes both a machine-readable JSON snapshot and a human-readable HTML diff report
 * to reports/snapshots/ — the master report's Security Audit section reads from there.
 *
 * Ported from the standalone workcenter_playwright/tests/user_groups_change_difference.spec.js
 * script: same RPC domains/fields, same delta logic, same HTML report — only the
 * fetch mechanism (rpc fixture instead of page.evaluate(fetch(...))), file I/O
 * target (reports/snapshots/ instead of test_logs/), and TypeScript types changed.
 */
import * as fs from 'fs';
import * as path from 'path';
import { test } from '../../../../core/fixtures/index';
import type { OdooRPC } from '../../../../core/api/OdooRPC';

const SNAPSHOT_DIR = path.join(process.cwd(), 'reports', 'snapshots');

// ── Types ──────────────────────────────────────────────────────────────────────

interface WriteMeta {
  id: number;
  name: string;
}

interface GroupInfo {
  id: number;
  name: string;
  fullName: string;
  category: string;
}

interface UserInfo {
  id: number;
  name: string;
  login: string;
  email: string;
  writeUid: WriteMeta | null;
  writeDate: string | null;
  groups: GroupInfo[];
}

interface AccessRule {
  id: number;
  name: string;
  modelId: number | null;
  modelDisplay: string;
  modelTech: string;
  groupId: number | null;
  groupName: string;
  perm_read: boolean;
  perm_write: boolean;
  perm_create: boolean;
  perm_unlink: boolean;
  writeUid: WriteMeta | null;
  writeDate: string | null;
}

interface AttrChange {
  field: string;
  from: string;
  to: string;
}

interface ChangedUser {
  user: UserInfo;
  groupsAdded: GroupInfo[];
  groupsRemoved: GroupInfo[];
}

interface AttrChangedUser {
  user: UserInfo;
  changes: AttrChange[];
}

interface DeltaResult {
  prevDate: string | null;
  newUsers: UserInfo[];
  removedUsers: UserInfo[];
  changedUsers: ChangedUser[];
  attrChangedUsers: AttrChangedUser[];
  totalGroupChanges: number;
  hasDiff: boolean;
}

interface PermDiff {
  perm: string;
  from: boolean;
  to: boolean;
}

interface ChangedRule {
  rule: AccessRule;
  prevRule: AccessRule;
  diffs: PermDiff[];
}

interface AccessDeltaResult {
  addedRules: AccessRule[];
  removedRules: AccessRule[];
  changedRules: ChangedRule[];
  totalChanges: number;
  hasDiff: boolean;
}

interface SnapshotUser {
  id: number;
  name: string;
  login: string;
  email: string;
  groupIds: number[];
  writeUid: WriteMeta | null;
  writeDate: string | null;
}

interface SnapshotGroup {
  id: number;
  name: string;
  fullName: string;
  category: string;
}

interface Snapshot {
  generatedAt: string;
  date: string;
  instance: string;
  users: SnapshotUser[];
  groups: SnapshotGroup[];
  accessRights: AccessRule[];
}

// Raw group row shape as returned by res.groups.search_read
interface GroupRow {
  id: number;
  name?: string;
  full_name?: string;
  category_id?: [number, string] | false;
}

// Raw RPC row shapes
interface RawUserRow {
  id: number;
  name: string;
  login: string;
  email?: string;
  groups_id?: number[];
  write_uid?: [number, string] | false;
  write_date?: string | null;
}

interface RawAccessRow {
  id: number;
  name?: string;
  model_id?: [number, string] | false;
  group_id?: [number, string] | false;
  perm_read?: boolean;
  perm_write?: boolean;
  perm_create?: boolean;
  perm_unlink?: boolean;
  write_uid?: [number, string] | false;
  write_date?: string | null;
}

interface RawModelRow {
  id: number;
  name?: string;
  model?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function escHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360},55%,32%)`;
}

function formatOdooDate(d: string | null | undefined): string {
  if (!d) return '';
  try {
    const s = String(d).replace(' ', 'T');
    return new Date(s.includes('Z') ? s : s + 'Z').toLocaleString();
  } catch {
    return String(d);
  }
}

// ── Snapshot I/O ───────────────────────────────────────────────────────────────

function loadPreviousSnapshot(logsDir: string): Snapshot | null {
  try {
    const files = fs.readdirSync(logsDir)
      .filter(f => f.startsWith('ugd_snapshot_') && f.endsWith('.json'));
    // Include today's snapshot so same-day re-runs still show a diff.
    // The snapshot is loaded BEFORE the current run overwrites it, so this
    // correctly shows what changed since the last run (intra-day or cross-day).
    const candidates = files
      .map(f => ({ file: f, date: f.replace('ugd_snapshot_', '').replace('.json', '') }))
      .sort((a, b) => b.date.localeCompare(a.date));
    if (candidates.length === 0) return null;
    const raw = fs.readFileSync(path.join(logsDir, candidates[0].file), 'utf8');
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

// ── Delta computation ──────────────────────────────────────────────────────────

function computeDelta(
  enrichedUsers: UserInfo[],
  prevSnapshot: Snapshot | null,
  allGroupMap: Record<number, GroupInfo>,
): DeltaResult {
  if (!prevSnapshot) {
    return { prevDate: null, newUsers: [], removedUsers: [], changedUsers: [], attrChangedUsers: [], totalGroupChanges: 0, hasDiff: false };
  }

  const prevDate = prevSnapshot.date;
  const prevUsers = prevSnapshot.users || [];
  const prevGroups = prevSnapshot.groups || [];

  const mergedGroupMap: Record<number, GroupInfo> = { ...allGroupMap };
  for (const g of prevGroups) {
    if (!mergedGroupMap[g.id]) mergedGroupMap[g.id] = g;
  }

  const currUserMap: Record<number, UserInfo & { groupIdSet: Set<number> }> = {};
  for (const u of enrichedUsers) {
    currUserMap[u.id] = { ...u, groupIdSet: new Set(u.groups.map(g => g.id)) };
  }

  const prevUserMap: Record<number, SnapshotUser & { groupIdSet: Set<number> }> = {};
  for (const u of prevUsers) {
    prevUserMap[u.id] = { ...u, groupIdSet: new Set(u.groupIds || []) };
  }

  const currIds = new Set(Object.keys(currUserMap).map(Number));
  const prevIds = new Set(Object.keys(prevUserMap).map(Number));

  const newUsers = enrichedUsers.filter(u => !prevIds.has(u.id));
  const removedUsers: UserInfo[] = prevUsers.filter(u => !currIds.has(u.id)).map(u => ({
    id: u.id,
    name: u.name,
    login: u.login,
    email: u.email,
    writeUid: u.writeUid,
    writeDate: u.writeDate,
    groups: (u.groupIds || []).map(gid => mergedGroupMap[gid]).filter(Boolean),
  }));

  const changedUsers: ChangedUser[] = [];
  for (const uid of currIds) {
    if (!prevIds.has(uid)) continue;
    const curr = currUserMap[uid];
    const prev = prevUserMap[uid];
    const added = [...curr.groupIdSet].filter(id => !prev.groupIdSet.has(id))
      .map(id => mergedGroupMap[id]).filter(Boolean);
    const removed = [...prev.groupIdSet].filter(id => !curr.groupIdSet.has(id))
      .map(id => mergedGroupMap[id]).filter(Boolean);
    if (added.length > 0 || removed.length > 0) {
      changedUsers.push({ user: curr, groupsAdded: added, groupsRemoved: removed });
    }
  }

  const totalGroupChanges = changedUsers.reduce(
    (s, c) => s + c.groupsAdded.length + c.groupsRemoved.length, 0,
  );

  const attrChangedUsers: AttrChangedUser[] = [];
  for (const uid of currIds) {
    if (!prevIds.has(uid)) continue;
    const curr = currUserMap[uid];
    const prev = prevUserMap[uid];
    const diffs: AttrChange[] = [];
    for (const f of ['name', 'login', 'email'] as const) {
      const currVal = String(curr[f] || '');
      const prevVal = String((prev as unknown as Record<string, string>)[f] || '');
      if (currVal !== prevVal) {
        diffs.push({ field: f, from: prevVal, to: currVal });
      }
    }
    if (diffs.length > 0) attrChangedUsers.push({ user: curr, changes: diffs });
  }

  return {
    prevDate,
    newUsers,
    removedUsers,
    changedUsers,
    attrChangedUsers,
    totalGroupChanges,
    hasDiff: newUsers.length > 0 || removedUsers.length > 0 || changedUsers.length > 0 || attrChangedUsers.length > 0,
  };
}

function computeAccessDelta(currRules: AccessRule[], prevRules: AccessRule[] | null): AccessDeltaResult {
  if (!prevRules || prevRules.length === 0) {
    return { addedRules: [], removedRules: [], changedRules: [], totalChanges: 0, hasDiff: false };
  }
  const prevMap: Record<number, AccessRule> = {};
  const currMap: Record<number, AccessRule> = {};
  for (const r of prevRules) prevMap[r.id] = r;
  for (const r of currRules) currMap[r.id] = r;
  const addedRules = currRules.filter(r => !prevMap[r.id]);
  const removedRules = prevRules.filter(r => !currMap[r.id]);
  const changedRules: ChangedRule[] = [];
  for (const r of currRules) {
    const prev = prevMap[r.id];
    if (!prev) continue;
    const diffs: PermDiff[] = [];
    for (const p of ['perm_read', 'perm_write', 'perm_create', 'perm_unlink'] as const) {
      if (Boolean(r[p]) !== Boolean(prev[p])) diffs.push({ perm: p, from: Boolean(prev[p]), to: Boolean(r[p]) });
    }
    if (diffs.length > 0) changedRules.push({ rule: r, prevRule: prev, diffs });
  }
  const totalChanges = addedRules.length + removedRules.length + changedRules.length;
  return { addedRules, removedRules, changedRules, totalChanges, hasDiff: totalChanges > 0 };
}

function printConsoleTable(title: string, headers: string[], rows: Array<Array<string | number>>): void {
  const allRows: Array<Array<string | number>> = [headers, ...rows];
  const colWidths = headers.map((h, i) => Math.max(h.length, ...allRows.map(r => String(r[i] ?? '').length)));
  const sep = '  +' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  const fmt = (cells: Array<string | number>) => '  |' + cells.map((c, i) => ` ${String(c ?? '').padEnd(colWidths[i])} `).join('|') + '|';
  console.log(`\n  ── ${title}`);
  console.log(sep);
  console.log(fmt(headers));
  console.log(sep);
  rows.forEach(r => console.log(fmt(r)));
  console.log(sep + '\n');
}

// ── HTML BUILDER ───────────────────────────────────────────────────────────────

function buildHtml(
  instance: string,
  todayDate: string,
  prevSnapshot: Snapshot | null,
  delta: DeltaResult,
  accessDelta: AccessDeltaResult,
  users: UserInfo[],
  allGroups: GroupRow[],
): string {
  const now = new Date().toLocaleString();

  const catStr = (g: GroupRow): string => {
    if (!Array.isArray(g.category_id)) return '(No Category)';
    const v = g.category_id[1];
    return v && typeof v === 'string' ? v : '(No Category)';
  };

  const allCategories = [...new Set(allGroups.map(catStr))].sort();

  const PALETTE = [
    '#60A5FA', '#34D399', '#A78BFA', '#FB923C', '#F472B6',
    '#38BDF8', '#FBBF24', '#4ADE80', '#F87171', '#C084FC',
    '#2DD4BF', '#E879F9', '#FCA5A5', '#6EE7B7', '#93C5FD',
  ];
  const catColor: Record<string, string> = {};
  allCategories.forEach((c, i) => { catColor[c] = PALETTE[i % PALETTE.length]; });

  // Extend colour map with any categories that only appear in the previous
  // snapshot (e.g. a group category that was entirely removed) so that chips
  // for removed/changed groups still get a deterministic colour.
  if (prevSnapshot) {
    (prevSnapshot.groups || []).forEach(g => {
      const cat = g.category || '(No Category)';
      if (!catColor[cat]) {
        catColor[cat] = PALETTE[Object.keys(catColor).length % PALETTE.length];
      }
    });
  }

  const avgGroups = users.length > 0
    ? Math.round(users.reduce((s, u) => s + u.groups.length, 0) / users.length) : 0;
  void avgGroups; // retained for parity with the original script; not currently rendered

  const resolvedAllGroups: GroupInfo[] = allGroups.map(g => ({
    id: g.id, name: String(g.name || ''), fullName: String(g.full_name || g.name || ''), category: catStr(g),
  }));
  const isApp = (g: GroupInfo) => g.category !== '(No Category)' && g.category !== 'Technical';
  const appGroupIds = new Set(resolvedAllGroups.filter(isApp).map(g => g.id));
  const techGroupIds = new Set(resolvedAllGroups.filter(g => !isApp(g)).map(g => g.id));

  // ── Shared: render a list of groups organised by category with labels ──────
  function renderGroupsByCat(groups: GroupInfo[], chipClass: string, prefix: string): string {
    if (!groups || groups.length === 0) return '<span class="dt-none">—</span>';
    const byCategory: Record<string, GroupInfo[]> = {};
    for (const g of groups) {
      const cat = g.category || '(No Category)';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(g);
    }
    return Object.entries(byCategory)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([cat, grps]) => {
        const col = catColor[cat] || '#64748b';
        const isTech = cat === 'Technical' || cat === '(No Category)';
        const chips = grps.map(g =>
          `<span class="chip ${chipClass}" style="--cc:${col}"
            title="${escHtml(cat)}: ${escHtml(g.fullName || g.name)}">${prefix ? prefix + ' ' : ''}${escHtml(g.name)}</span>`,
        ).join('');
        return `<div class="chg-cat-row">
          <span class="chg-cat-lbl${isTech ? ' chg-cat-tech' : ''}" style="color:${col}">
            ${isTech ? '⚙' : '◆'}&thinsp;${escHtml(cat)}<span class="chg-cat-cnt">${grps.length}</span>
          </span>
          <div class="chips">${chips}</div>
        </div>`;
      }).join('');
  }

  // ── Delta section HTML ─────────────────────────────────────────────────────
  function renderDeltaView(): string {
    if (!prevSnapshot) {
      return `<div class="delta-empty">
        <div class="delta-empty-icon">📋</div>
        <div class="delta-empty-title">First Run — No Baseline</div>
        <div class="delta-empty-sub">
          This is the first snapshot for <code>${escHtml(instance)}</code>.<br>
          The next run will compare against today's data (<strong>${escHtml(todayDate)}</strong>).
        </div>
      </div>`;
    }

    const prevGenAt = prevSnapshot.generatedAt
      ? new Date(prevSnapshot.generatedAt).toLocaleString()
      : prevSnapshot.date;
    const compareBar = `<div class="cmp-bar">
      <div class="cmp-side">
        <span class="cmp-lbl">Previous Snapshot</span>
        <span class="cmp-time">${escHtml(prevGenAt)}</span>
      </div>
      <div class="cmp-arrow">&#8594;</div>
      <div class="cmp-side">
        <span class="cmp-lbl">This Run</span>
        <span class="cmp-time">${escHtml(now)}</span>
      </div>
    </div>`;

    if (!delta.hasDiff && !accessDelta.hasDiff) {
      return compareBar + `<div class="delta-empty delta-ok">
        <div class="delta-empty-icon">✅</div>
        <div class="delta-empty-title">No Changes Detected</div>
        <div class="delta-empty-sub">
          All <strong>${users.length}</strong> users retain identical group assignments,
          profile attributes, and model access rights
          compared to <strong>${escHtml(delta.prevDate)}</strong>.
        </div>
      </div>`;
    }

    const summaryStrip = `<div class="delta-summary-strip">
      ${delta.newUsers.length > 0 ? `<span class="ds-pill ds-add">+${delta.newUsers.length} user${delta.newUsers.length !== 1 ? 's' : ''} added</span>` : ''}
      ${delta.removedUsers.length > 0 ? `<span class="ds-pill ds-rem">−${delta.removedUsers.length} user${delta.removedUsers.length !== 1 ? 's' : ''} removed</span>` : ''}
      ${delta.attrChangedUsers.length > 0 ? `<span class="ds-pill ds-attr">~${delta.attrChangedUsers.length} profile change${delta.attrChangedUsers.length !== 1 ? 's' : ''}</span>` : ''}
      ${delta.changedUsers.length > 0 ? `<span class="ds-pill ds-chg">~${delta.changedUsers.length} group change${delta.changedUsers.length !== 1 ? 's' : ''}</span>` : ''}
      ${accessDelta.changedRules.length > 0 ? `<span class="ds-pill ds-acc">~${accessDelta.changedRules.length} CRUD modified</span>` : ''}
      ${accessDelta.addedRules.length > 0 ? `<span class="ds-pill ds-add">+${accessDelta.addedRules.length} access rule${accessDelta.addedRules.length !== 1 ? 's' : ''} added</span>` : ''}
      ${accessDelta.removedRules.length > 0 ? `<span class="ds-pill ds-rem">−${accessDelta.removedRules.length} access rule${accessDelta.removedRules.length !== 1 ? 's' : ''} removed</span>` : ''}
    </div>`;

    let newSection = '';
    if (delta.newUsers.length > 0) {
      const rows = delta.newUsers.map(u => {
        return `<tr class="dt-add-row">
          <td class="dt-user">${renderMiniAvatar(u)}${escHtml(u.name)}</td>
          <td class="dt-login"><code>${escHtml(u.login)}</code></td>
          <td class="dt-email">${escHtml(u.email || u.login)}</td>
          <td class="dt-groups">${renderGroupsByCat(u.groups, '', '')}</td>
          <td class="dt-cnt">${u.groups.length}</td>
        </tr>`;
      }).join('');
      newSection = `<div class="delta-section">
        <div class="delta-sec-hdr delta-sec-add">
          <span class="delta-sec-icon">+</span>
          <span>New Users</span>
          <span class="delta-sec-cnt">${delta.newUsers.length}</span>
        </div>
        <div class="dt-wrap"><table class="dt">
          <thead><tr>
            <th class="dt-th">User</th><th class="dt-th">Login</th>
            <th class="dt-th">Email</th><th class="dt-th">Groups Assigned</th>
            <th class="dt-th">Count</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`;
    }

    let remSection = '';
    if (delta.removedUsers.length > 0) {
      const rows = delta.removedUsers.map(u => {
        return `<tr class="dt-rem-row">
          <td class="dt-user">${renderMiniAvatarName(u.name)}${escHtml(u.name)}</td>
          <td class="dt-login"><code>${escHtml(u.login)}</code></td>
          <td class="dt-email">${escHtml(u.email || u.login)}</td>
          <td class="dt-groups">${renderGroupsByCat(u.groups || [], 'chip-rem', '')}</td>
          <td class="dt-cnt">${(u.groups || []).length}</td>
        </tr>`;
      }).join('');
      remSection = `<div class="delta-section">
        <div class="delta-sec-hdr delta-sec-rem">
          <span class="delta-sec-icon">−</span>
          <span>Removed Users</span>
          <span class="delta-sec-cnt">${delta.removedUsers.length}</span>
        </div>
        <div class="dt-wrap"><table class="dt">
          <thead><tr>
            <th class="dt-th">User</th><th class="dt-th">Login</th>
            <th class="dt-th">Email</th><th class="dt-th">Last Known Groups</th>
            <th class="dt-th">Count</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`;
    }

    let chgSection = '';
    if (delta.changedUsers.length > 0) {
      const cards = delta.changedUsers.map((c, idx) => {
        const u = c.user;
        const accentCol = stringToColor(u.name);
        const initials = u.name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
        const addCatHtml = renderGroupsByCat(c.groupsAdded, 'chip-plus', '+');
        const remCatHtml = renderGroupsByCat(c.groupsRemoved, 'chip-minus', '−');

        const allChangedCats = [...new Set([
          ...c.groupsAdded.map(g => g.category || '(No Category)'),
          ...c.groupsRemoved.map(g => g.category || '(No Category)'),
        ])].sort();
        const catSummary = allChangedCats.map(cat => {
          const added = c.groupsAdded.filter(g => (g.category || '(No Category)') === cat).length;
          const removed = c.groupsRemoved.filter(g => (g.category || '(No Category)') === cat).length;
          const col = catColor[cat] || '#64748b';
          const isTech = cat === 'Technical' || cat === '(No Category)';
          const parts = [added > 0 ? `+${added}` : '', removed > 0 ? `−${removed}` : ''].filter(Boolean).join(' ');
          return `<span class="chg-cat-pill${isTech ? ' chg-cat-pill-tech' : ''}" style="border-color:${col};color:${col}"
            title="${escHtml(cat)}">${escHtml(cat.length > 12 ? cat.slice(0, 11) + '…' : cat)}&nbsp;${parts}</span>`;
        }).join('');

        return `<div class="chg-card collapsed" id="chg-${idx}">
          <div class="chg-card-hdr" onclick="document.getElementById('chg-${idx}').classList.toggle('collapsed')">
            <div class="avatar" style="background:${accentCol}">${escHtml(initials)}</div>
            <div class="chg-info">
              <div class="uname">${escHtml(u.name)}</div>
              <code class="ulogin">${escHtml(u.login)}</code>
              <div class="chg-cat-pills">${catSummary}</div>
            </div>
            <div class="chg-badges">
              ${c.groupsAdded.length > 0 ? `<span class="chg-add-badge">+${c.groupsAdded.length}</span>` : ''}
              ${c.groupsRemoved.length > 0 ? `<span class="chg-rem-badge">−${c.groupsRemoved.length}</span>` : ''}
            </div>
            <div class="chevron">&#9662;</div>
          </div>
          <div class="chg-card-body">
            <div class="chg-cols">
              <div class="chg-col chg-col-add">
                <div class="chg-col-hdr">Groups Added <span class="chg-col-cnt">${c.groupsAdded.length}</span></div>
                <div class="chg-cat-list">${addCatHtml}</div>
              </div>
              <div class="chg-col chg-col-rem">
                <div class="chg-col-hdr">Groups Removed <span class="chg-col-cnt">${c.groupsRemoved.length}</span></div>
                <div class="chg-cat-list">${remCatHtml}</div>
              </div>
            </div>
            ${u.writeUid ? `<div class="chg-by">
              <span class="chg-by-icon">✎</span>
              <span class="chg-by-lbl">Modified by</span>
              <span class="chg-by-name">${escHtml(u.writeUid.name)}</span>
              ${u.writeDate ? `<span class="chg-by-sep">·</span><span class="chg-by-date">${escHtml(formatOdooDate(u.writeDate))}</span>` : ''}
            </div>` : ''}
          </div>
        </div>`;
      }).join('');
      chgSection = `<div class="delta-section">
        <div class="delta-sec-hdr delta-sec-chg">
          <span class="delta-sec-icon">~</span>
          <span>Changed Users</span>
          <span class="delta-sec-cnt">${delta.changedUsers.length}</span>
          <button class="dexp-btn" id="dExpAll">Expand All</button>
          <button class="dexp-btn" id="dColAll">Collapse All</button>
        </div>
        <div class="chg-cards">${cards}</div>
      </div>`;
    }

    let attrSection = '';
    if (delta.attrChangedUsers.length > 0) {
      const cards = delta.attrChangedUsers.map((c, idx) => {
        const u = c.user;
        const accentCol = stringToColor(u.name);
        const initials = u.name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
        const rows = c.changes.map(d =>
          `<tr>
            <td class="ac-field">${escHtml(d.field)}</td>
            <td class="ac-from">${escHtml(d.from || '—')}</td>
            <td class="ac-arrow">→</td>
            <td class="ac-to">${escHtml(d.to || '—')}</td>
          </tr>`,
        ).join('');
        return `<div class="chg-card collapsed" id="attr-${idx}">
          <div class="chg-card-hdr" onclick="document.getElementById('attr-${idx}').classList.toggle('collapsed')">
            <div class="avatar" style="background:${accentCol}">${escHtml(initials)}</div>
            <div class="chg-info">
              <div class="uname">${escHtml(u.name)}</div>
              <code class="ulogin">${escHtml(u.login)}</code>
            </div>
            <div class="chg-badges"><span class="chg-chg-badge">${c.changes.length} field${c.changes.length !== 1 ? 's' : ''}</span></div>
            <div class="chevron">&#9662;</div>
          </div>
          <div class="chg-card-body">
            <div class="attr-table-wrap"><table class="attr-table">
              <thead><tr><th class="ac-th">Field</th><th class="ac-th">Previous Value</th><th class="ac-th"></th><th class="ac-th">New Value</th></tr></thead>
              <tbody>${rows}</tbody>
            </table></div>
          </div>
        </div>`;
      }).join('');
      attrSection = `<div class="delta-section">
        <div class="delta-sec-hdr delta-sec-attr">
          <span class="delta-sec-icon">~</span>
          <span>User Profile Changes</span>
          <span class="delta-sec-cnt">${delta.attrChangedUsers.length}</span>
        </div>
        <div class="chg-cards">${cards}</div>
      </div>`;
    }

    let accSection = '';
    if (accessDelta.hasDiff) {
      const PERM_KEYS = ['perm_read', 'perm_write', 'perm_create', 'perm_unlink'] as const;
      const PERM_LBL: Record<string, string> = { perm_read: 'R', perm_write: 'W', perm_create: 'C', perm_unlink: 'D' };
      const PERM_TITLE: Record<string, string> = { perm_read: 'Read', perm_write: 'Write', perm_create: 'Create', perm_unlink: 'Delete' };

      function crudStatic(rule: AccessRule): string {
        return PERM_KEYS.map(p =>
          rule[p]
            ? `<span class="cb cb-on"  title="${PERM_TITLE[p]} granted">${PERM_LBL[p]}</span>`
            : `<span class="cb cb-off" title="${PERM_TITLE[p]} denied">${PERM_LBL[p]}</span>`,
        ).join('');
      }

      function crudDiff(rule: AccessRule, _prevRule: AccessRule, diffs: PermDiff[]): string {
        const diffMap: Record<string, PermDiff> = {};
        for (const d of diffs) diffMap[d.perm] = d;
        return PERM_KEYS.map(p => {
          const d = diffMap[p];
          if (d) {
            return d.to
              ? `<span class="cb cb-gained" title="${PERM_TITLE[p]} GAINED">+${PERM_LBL[p]}</span>`
              : `<span class="cb cb-lost"   title="${PERM_TITLE[p]} REVOKED">−${PERM_LBL[p]}</span>`;
          }
          return rule[p]
            ? `<span class="cb cb-on"  title="${PERM_TITLE[p]} granted">${PERM_LBL[p]}</span>`
            : `<span class="cb cb-off" title="${PERM_TITLE[p]} denied">${PERM_LBL[p]}</span>`;
        }).join('');
      }

      let modSection = '';
      if (accessDelta.changedRules.length > 0) {
        const byGroup: Record<string, ChangedRule[]> = {};
        for (const c of accessDelta.changedRules) {
          const gn = c.rule.groupName || '(No Group)';
          if (!byGroup[gn]) byGroup[gn] = [];
          byGroup[gn].push(c);
        }
        const groupCards = Object.entries(byGroup)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([gName, changes], gi) => {
            const rows = changes
              .sort((a, b) => (a.rule.modelDisplay || '').localeCompare(b.rule.modelDisplay || ''))
              .map(c =>
                `<tr class="ar-row">
                  <td class="ar-model">${escHtml(c.rule.modelDisplay || c.rule.name)}</td>
                  <td class="ar-tech"><code>${escHtml(c.rule.modelTech)}</code></td>
                  <td class="ar-crud">${crudDiff(c.rule, c.prevRule, c.diffs)}</td>
                  <td class="ar-prev">${crudStatic(c.prevRule)}</td>
                  <td class="ar-by">${c.rule.writeUid
                    ? `<span class="ar-by-name">${escHtml(c.rule.writeUid.name)}</span>${c.rule.writeDate ? `<br><span class="ar-by-date">${escHtml(formatOdooDate(c.rule.writeDate))}</span>` : ''}`
                    : '<span class="ar-by-na">—</span>'}</td>
                </tr>`,
              ).join('');
            return `<div class="ar-group-card collapsed" id="armod-${gi}">
              <div class="ar-group-hdr" onclick="document.getElementById('armod-${gi}').classList.toggle('collapsed')">
                <span class="ar-group-name">${escHtml(gName)}</span>
                <span class="ar-group-cnt">${changes.length} model${changes.length !== 1 ? 's' : ''}</span>
                <span class="ar-chev">&#9662;</span>
              </div>
              <div class="ar-group-body">
                <div class="ar-table-wrap"><table class="ar-table">
                  <thead><tr>
                    <th class="ar-th">Model</th>
                    <th class="ar-th">Technical Name</th>
                    <th class="ar-th">New CRUD</th>
                    <th class="ar-th">Previous CRUD</th>
                    <th class="ar-th">Modified By</th>
                  </tr></thead>
                  <tbody>${rows}</tbody>
                </table></div>
              </div>
            </div>`;
          }).join('');
        modSection = `<div class="acc-sub">
          <div class="acc-sub-hdr acc-mod">
            <span>~ CRUD Modified</span>
            <span class="acc-sub-cnt">${accessDelta.changedRules.length} rule${accessDelta.changedRules.length !== 1 ? 's' : ''} across ${Object.keys(byGroup).length} group${Object.keys(byGroup).length !== 1 ? 's' : ''}</span>
          </div>
          ${groupCards}
        </div>`;
      }

      let addedAccSection = '';
      if (accessDelta.addedRules.length > 0) {
        const byGroup: Record<string, AccessRule[]> = {};
        for (const r of accessDelta.addedRules) {
          const gn = r.groupName || '(No Group)';
          if (!byGroup[gn]) byGroup[gn] = [];
          byGroup[gn].push(r);
        }
        const groupCards = Object.entries(byGroup)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([gName, rules], gi) => {
            const rows = rules
              .sort((a, b) => (a.modelDisplay || '').localeCompare(b.modelDisplay || ''))
              .map(r =>
                `<tr class="ar-row ar-add-row">
                  <td class="ar-model">${escHtml(r.modelDisplay || r.name)}</td>
                  <td class="ar-tech"><code>${escHtml(r.modelTech)}</code></td>
                  <td class="ar-crud">${crudStatic(r)}</td>
                </tr>`,
              ).join('');
            return `<div class="ar-group-card collapsed" id="aradd-${gi}">
              <div class="ar-group-hdr ar-add-hdr" onclick="document.getElementById('aradd-${gi}').classList.toggle('collapsed')">
                <span class="ar-group-name">${escHtml(gName)}</span>
                <span class="ar-group-cnt">${rules.length} model${rules.length !== 1 ? 's' : ''}</span>
                <span class="ar-chev">&#9662;</span>
              </div>
              <div class="ar-group-body">
                <div class="ar-table-wrap"><table class="ar-table">
                  <thead><tr><th class="ar-th">Model</th><th class="ar-th">Technical Name</th><th class="ar-th">CRUD Granted</th></tr></thead>
                  <tbody>${rows}</tbody>
                </table></div>
              </div>
            </div>`;
          }).join('');
        addedAccSection = `<div class="acc-sub">
          <div class="acc-sub-hdr acc-add">
            <span>+ Access Rules Added</span>
            <span class="acc-sub-cnt">${accessDelta.addedRules.length} rule${accessDelta.addedRules.length !== 1 ? 's' : ''}</span>
          </div>
          ${groupCards}
        </div>`;
      }

      let removedAccSection = '';
      if (accessDelta.removedRules.length > 0) {
        const byGroup: Record<string, AccessRule[]> = {};
        for (const r of accessDelta.removedRules) {
          const gn = r.groupName || '(No Group)';
          if (!byGroup[gn]) byGroup[gn] = [];
          byGroup[gn].push(r);
        }
        const groupCards = Object.entries(byGroup)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([gName, rules], gi) => {
            const rows = rules
              .sort((a, b) => (a.modelDisplay || '').localeCompare(b.modelDisplay || ''))
              .map(r =>
                `<tr class="ar-row ar-rem-row">
                  <td class="ar-model">${escHtml(r.modelDisplay || r.name)}</td>
                  <td class="ar-tech"><code>${escHtml(r.modelTech)}</code></td>
                  <td class="ar-crud">${crudStatic(r)}</td>
                </tr>`,
              ).join('');
            return `<div class="ar-group-card collapsed" id="arrem-${gi}">
              <div class="ar-group-hdr ar-rem-hdr" onclick="document.getElementById('arrem-${gi}').classList.toggle('collapsed')">
                <span class="ar-group-name">${escHtml(gName)}</span>
                <span class="ar-group-cnt">${rules.length} model${rules.length !== 1 ? 's' : ''}</span>
                <span class="ar-chev">&#9662;</span>
              </div>
              <div class="ar-group-body">
                <div class="ar-table-wrap"><table class="ar-table">
                  <thead><tr><th class="ar-th">Model</th><th class="ar-th">Technical Name</th><th class="ar-th">Last CRUD</th></tr></thead>
                  <tbody>${rows}</tbody>
                </table></div>
              </div>
            </div>`;
          }).join('');
        removedAccSection = `<div class="acc-sub">
          <div class="acc-sub-hdr acc-rem">
            <span>− Access Rules Removed</span>
            <span class="acc-sub-cnt">${accessDelta.removedRules.length} rule${accessDelta.removedRules.length !== 1 ? 's' : ''}</span>
          </div>
          ${groupCards}
        </div>`;
      }

      accSection = `<div class="delta-section">
        <div class="delta-sec-hdr delta-sec-acc">
          <span class="delta-sec-icon">⚡</span>
          <span>Access Rights Changes</span>
          <span class="delta-sec-cnt">${accessDelta.totalChanges} total</span>
        </div>
        <div class="acc-body">${modSection}${addedAccSection}${removedAccSection}</div>
      </div>`;
    } else if (delta.hasDiff) {
      accSection = `<div class="delta-section">
        <div class="delta-sec-hdr delta-sec-acc">
          <span class="delta-sec-icon">⚡</span>
          <span>Access Rights Changes</span>
          <span class="delta-sec-cnt">0</span>
        </div>
        <div class="acc-none">
          <span class="acc-none-icon">✔</span>&nbsp; No model access (CRUD) permission changes detected for this period.
        </div>
      </div>`;
    }

    return compareBar + summaryStrip + newSection + remSection + attrSection + chgSection + accSection;
  }

  function renderMiniAvatar(u: UserInfo): string {
    const col = stringToColor(u.name);
    const ini = u.name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
    return `<span class="mini-avatar" style="background:${col}">${escHtml(ini)}</span>`;
  }

  function renderMiniAvatarName(name: string): string {
    const col = stringToColor(name);
    const ini = name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
    return `<span class="mini-avatar" style="background:${col}">${escHtml(ini)}</span>`;
  }

  // ── Category sidebar ────────────────────────────────────────────────────────
  const catStats: Record<string, { groups: Set<number>; users: Set<number> }> = {};
  for (const u of users) {
    for (const g of u.groups) {
      if (!catStats[g.category]) catStats[g.category] = { groups: new Set(), users: new Set() };
      catStats[g.category].groups.add(g.id);
      catStats[g.category].users.add(u.id);
    }
  }

  const catSidebarItems = Object.entries(catStats)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cat, s]) => {
      const col = catColor[cat] || '#64748b';
      const isTech = (cat === 'Technical' || cat === '(No Category)');
      return `<div class="cat-item${isTech ? ' tech-cat' : ''}" data-cat="${escHtml(cat)}" role="button" tabindex="0">
        <span class="cat-dot" style="background:${col}"></span>
        <span class="cat-name">${escHtml(cat)}</span>
        <div class="cat-badges">
          <span class="cat-count" title="${s.groups.size} groups">${s.groups.size}g</span>
          <span class="cat-ucnt" title="${s.users.size} users">${s.users.size}u</span>
        </div>
      </div>`;
    }).join('');

  function renderSubSection(label: string, sGroups: GroupInfo[], dotClass: string, openByDefault: boolean): string {
    if (sGroups.length === 0) return '';
    const grouped: Record<string, GroupInfo[]> = {};
    for (const g of sGroups) {
      if (!grouped[g.category]) grouped[g.category] = [];
      grouped[g.category].push(g);
    }
    const catSections = Object.entries(grouped).map(([cat, grps]) => {
      const col = catColor[cat] || '#64748b';
      const chips = grps.map(g =>
        `<span class="chip" style="--cc:${col}" title="${escHtml(g.fullName)}&#10;Group ID: ${g.id}">${escHtml(g.name)}<span class="chip-id">&nbsp;#${g.id}</span></span>`,
      ).join('');
      return `<div class="cat-row">
        <div class="cat-row-label" style="color:${col}">${escHtml(cat)}<span class="cat-row-cnt">${grps.length}</span></div>
        <div class="chips">${chips}</div>
      </div>`;
    }).join('');

    const tableRows = sGroups.map(g => {
      const col = catColor[g.category] || '#64748b';
      return `<tr>
        <td class="gt-id">${g.id}</td>
        <td class="gt-cat"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${col};margin-right:6px;vertical-align:middle"></span>${escHtml(g.category)}</td>
        <td class="gt-name">${escHtml(g.name)}</td>
        <td class="gt-full">${escHtml(g.fullName)}</td>
      </tr>`;
    }).join('');

    return `<div class="usr-sec${openByDefault ? '' : ' collapsed'}">
      <div class="usr-sec-hdr" onclick="this.closest('.usr-sec').classList.toggle('collapsed')" role="button" tabindex="0">
        <span class="usr-sec-dot ${dotClass}"></span>
        <span class="usr-sec-title">${label}</span>
        <span class="usr-sec-cnt">${sGroups.length}</span>
        <span class="usr-sec-chev">&#9662;</span>
      </div>
      <div class="usr-sec-body">
        <div class="view-chips">${catSections}</div>
        <div class="view-table"><div class="gtable-wrap"><table class="gtable">
          <thead><tr><th class="gt-th">ID</th><th class="gt-th">Category</th><th class="gt-th">Group Name</th><th class="gt-th">Full Name</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table></div></div>
      </div>
    </div>`;
  }

  function renderUserCard(u: UserInfo): string {
    const initials = u.name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
    const accentCol = stringToColor(u.name);
    const pct = allGroups.length > 0 ? Math.round(u.groups.length / allGroups.length * 100) : 0;
    const appGrps = u.groups.filter(g => appGroupIds.has(g.id));
    const techGrps = u.groups.filter(g => techGroupIds.has(g.id));

    const sectionsHtml =
      renderSubSection('Application &amp; Business Groups', appGrps, 'dot-app', true) +
      renderSubSection('Technical &amp; Internal Groups', techGrps, 'dot-tech', false);

    const groupSearch = u.groups.map(g => g.name + ' ' + g.fullName + ' ' + g.category).join(' ').toLowerCase();
    const catList = [...new Set(u.groups.map(g => g.category))].join('|');

    const isNew = delta.newUsers.some(nu => nu.id === u.id);
    const hasChange = delta.changedUsers.some(c => c.user.id === u.id);
    const changeBadge = isNew
      ? '<span class="uc-badge uc-new">NEW</span>'
      : hasChange ? '<span class="uc-badge uc-chg">CHANGED</span>' : '';

    return `<div class="user-card"
      data-search="${escHtml((u.name + ' ' + u.login + ' ' + (u.email || '') + ' ' + groupSearch).toLowerCase())}"
      data-cats="${escHtml(catList)}">
  <div class="user-accent" style="background:${accentCol}"></div>
  <div class="user-card-inner">
    <div class="user-top" onclick="this.closest('.user-card').classList.toggle('collapsed')" role="button" tabindex="0">
      <div class="avatar" style="background:${accentCol}">${escHtml(initials)}</div>
      <div class="user-info">
        <div class="uname">${escHtml(u.name)}${changeBadge}</div>
        <div class="umeta">
          <span class="uid-badge">uid&nbsp;${u.id}</span>
          <code class="ulogin">${escHtml(u.login)}</code>
          ${u.email && u.email !== u.login ? `<span class="uemail">${escHtml(u.email)}</span>` : ''}
        </div>
        <div class="usplit">
          <span class="usplit-app" title="Application groups">${appGrps.length}&nbsp;app</span>
          <span class="usplit-sep">/</span>
          <span class="usplit-tech" title="Technical groups">${techGrps.length}&nbsp;tech</span>
        </div>
      </div>
      <div class="gcol">
        <div class="gnum">${u.groups.length}</div>
        <div class="glbl">of&nbsp;${allGroups.length}</div>
        <div class="cov-bar" title="${pct}% of all groups assigned">
          <div class="cov-fill" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="chevron">&#9662;</div>
    </div>
    <div class="user-groups">
      ${sectionsHtml || '<em class="no-groups">No groups assigned</em>'}
    </div>
  </div>
</div>`;
  }

  function renderGroupsView(): string {
    const appGroups = resolvedAllGroups.filter(g => appGroupIds.has(g.id))
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    const techGroups = resolvedAllGroups.filter(g => techGroupIds.has(g.id))
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

    function renderGRow(g: GroupInfo): string {
      const col = catColor[g.category] || '#64748b';
      const hasUsers = users.filter(u => u.groups.some(ug => ug.id === g.id));
      const badges = hasUsers.map(u => {
        const uc = stringToColor(u.name);
        const ini = u.name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
        return `<span class="ugbadge" title="${escHtml(u.name)} (uid:${u.id})" style="background:${uc}">${escHtml(ini)}</span>`;
      }).join('');
      const names = hasUsers.map(u =>
        `<span class="ugname">${escHtml(u.name.split(' ')[0])}</span>`,
      ).join('');
      return `<tr class="gr-row">
        <td class="gr-id">${g.id}</td>
        <td class="gr-cat"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${col};margin-right:5px;vertical-align:middle"></span>${escHtml(g.category)}</td>
        <td class="gr-name">${escHtml(g.name)}</td>
        <td class="gr-full">${escHtml(g.fullName)}</td>
        <td class="gr-users"><div class="gr-users-wrap">${badges || ''}<span class="gr-sep"></span>${names || '<span class="gr-none">—</span>'}</div></td>
      </tr>`;
    }

    function renderGSection(title: string, groups: GroupInfo[], secClass: string): string {
      return `<div class="gv-sec">
        <div class="gv-sec-hdr ${secClass}">
          <span class="gv-sec-title">${title}</span>
          <span class="gv-sec-cnt">${groups.length} groups</span>
        </div>
        <div class="gv-table-wrap"><table class="gv-table">
          <thead><tr><th class="gr-th">ID</th><th class="gr-th">Category</th><th class="gr-th">Group Name</th><th class="gr-th">Full Name</th><th class="gr-th">Assigned Users</th></tr></thead>
          <tbody>${groups.map(renderGRow).join('')}</tbody>
        </table></div>
      </div>`;
    }

    return renderGSection('Application &amp; Business Groups', appGroups, 'gv-app') +
           renderGSection('Technical &amp; Internal Groups', techGroups, 'gv-tech');
  }

  const userCardsHtml = users.map(renderUserCard).join('\n');
  const groupsViewHtml = renderGroupsView();
  const deltaViewHtml = renderDeltaView();

  // ── Matrix ──────────────────────────────────────────────────────────────────
  const matrixGroups = allGroups
    .map(g => ({ id: g.id, category: catStr(g), fullName: String(g.full_name || g.name || ''), name: String(g.name || '') }))
    .filter(g => g.category !== '(No Category)')
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  const matrixHeadCells = users.map(u =>
    `<th class="mth" title="${escHtml(u.login)}">${escHtml(u.name)}</th>`,
  ).join('');

  const matrixBodyRows = matrixGroups.map((g, idx) => {
    const col = catColor[g.category] || '#64748b';
    const cells = users.map(u => {
      const has = u.groups.some(ug => ug.id === g.id);
      return has
        ? `<td class="mcell mhit" style="--cc:${col}">&#10004;</td>`
        : `<td class="mcell mmiss">&middot;</td>`;
    }).join('');
    return `<tr class="mrow${idx % 2 ? ' alt' : ''}">
      <td class="mlabel">
        <span class="mdot" style="background:${col}"></span>
        <span class="mcat">${escHtml(g.category)}&nbsp;/</span>
        <span class="mgname">${escHtml(g.name)}</span>
        <span class="mgid">#${g.id}</span>
      </td>
      ${cells}
    </tr>`;
  }).join('');

  const comparisonPeriod = prevSnapshot
    ? `${escHtml(prevSnapshot.date)} &rarr; ${escHtml(todayDate)}`
    : `First run &mdash; ${escHtml(todayDate)}`;

  const deltaStatAdd = delta.newUsers.length > 0 ? `style="color:#22c55e"` : `style="color:var(--txm)"`;
  const deltaStatRem = delta.removedUsers.length > 0 ? `style="color:#ef4444"` : `style="color:var(--txm)"`;
  const deltaStatAttr = delta.attrChangedUsers.length > 0 ? `style="color:#a78bfa"` : `style="color:var(--txm)"`;
  const deltaStatGrp = delta.changedUsers.length > 0 ? `style="color:#f59e0b"` : `style="color:var(--txm)"`;
  const deltaStatAcc = accessDelta.totalChanges > 0 ? `style="color:#38bdf8"` : `style="color:var(--txm)"`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>User Group Access Changes &mdash; ${escHtml(instance)}</title>
<style>
:root {
  --gnd:   #080E1A;
  --surf:  #0D1B2E;
  --surf2: #112038;
  --bdr:   #1E3250;
  --bdr2:  #263C5C;
  --tx:    #C8D8EE;
  --txm:   #5B7A9E;
  --txd:   #2A4060;
  --acc:   #C8963A;
  --accD:  rgba(200,150,58,.13);
  --teal:  #1E9E8C;
  --pass:  #1D8A62;
  --passD: rgba(29,138,98,.18);
  --app:   #22D3EE;
  --appD:  rgba(34,211,238,.12);
  --tech:  #F59E0B;
  --techD: rgba(245,158,11,.12);
  --add:   #22c55e;
  --addD:  rgba(34,197,94,.10);
  --rem:   #ef4444;
  --remD:  rgba(239,68,68,.10);
  --chg:   #f59e0b;
  --chgD:  rgba(245,158,11,.10);
  --r:     10px;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--gnd);color:var(--tx);
     font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
     font-size:14px;line-height:1.6;min-height:100vh}

/* ── HEADER ── */
.hdr{background:linear-gradient(155deg,#050C18 0%,#08142A 55%,#0C1E38 100%);
     border-bottom:1px solid var(--bdr);padding:44px 40px 38px;position:relative;overflow:hidden}
.hdr::before{content:'';position:absolute;inset:0;pointer-events:none;
  background-image:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.04) 3px,rgba(0,0,0,.04) 4px)}
.hdr-inner{max-width:1440px;margin:0 auto;position:relative;z-index:1;
           display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:24px}
.hdr-eyebrow{font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:.18em;
             text-transform:uppercase;color:var(--acc);margin-bottom:10px;display:flex;align-items:center;gap:10px}
.ping{width:7px;height:7px;border-radius:50%;background:var(--pass);flex-shrink:0;
      box-shadow:0 0 0 0 rgba(29,138,98,.7);animation:ping 2.2s ease-out infinite}
@keyframes ping{
  0%  {box-shadow:0 0 0 0   rgba(29,138,98,.7)}
  70% {box-shadow:0 0 0 9px rgba(29,138,98,0)}
  100%{box-shadow:0 0 0 0   rgba(29,138,98,0)}
}
.hdr-title{font-size:2.15em;font-weight:800;letter-spacing:-.025em;color:#fff;line-height:1.1;margin-bottom:14px}
.hdr-title em{font-style:normal;color:var(--acc)}
.hdr-meta{font-family:'Courier New',Courier,monospace;font-size:11.5px;color:var(--txm);
          display:flex;flex-wrap:wrap;gap:16px;align-items:center}
.hdr-sep{color:var(--txd)}
.hdr-status{background:var(--passD);border:1px solid var(--pass);color:var(--pass);border-radius:4px;
            padding:4px 12px;font-family:'Courier New',Courier,monospace;
            font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;flex-shrink:0}

/* ── STATS BAR ── */
.stats-bar{background:var(--surf);border-bottom:1px solid var(--bdr)}
.stats-inner{max-width:1440px;margin:0 auto;padding:0 40px;display:grid;grid-template-columns:repeat(4,1fr)}
.stat{padding:18px 20px;border-right:1px solid var(--bdr)}
.stat:last-child{border-right:none}
.stat-num{font-family:'Courier New',Courier,monospace;font-size:2.1em;font-weight:700;
          color:var(--acc);line-height:1;letter-spacing:-.02em}
.stat-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--txm);margin-top:5px}

/* ── VIEW NAV ── */
.view-nav{background:var(--surf);border-bottom:2px solid var(--bdr)}
.view-nav-inner{max-width:1440px;margin:0 auto;padding:0 40px;display:flex}
.nav-btn{padding:13px 28px;font-size:12.5px;font-weight:600;cursor:pointer;
         color:var(--txm);background:transparent;border:none;
         border-bottom:3px solid transparent;font-family:inherit;
         transition:all .2s;letter-spacing:.02em;margin-bottom:-2px}
.nav-btn:hover{color:var(--tx)}
.nav-btn.on{color:var(--acc);border-bottom-color:var(--acc)}
.nav-badge{font-family:'Courier New',Courier,monospace;font-size:10px;
           background:var(--surf2);border:1px solid var(--bdr);border-radius:4px;
           padding:1px 6px;margin-left:8px;color:var(--txm)}
.nav-badge.add{background:var(--addD);border-color:var(--add);color:var(--add)}
.nav-badge.rem{background:var(--remD);border-color:var(--rem);color:var(--rem)}
.nav-badge.chg{background:var(--chgD);border-color:var(--chg);color:var(--chg)}

/* ── DELTA VIEW ── */
.delta-outer{max-width:1440px;margin:0 auto;padding:32px 40px 52px}
.delta-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;
             padding:80px 40px;text-align:center;gap:16px}
.delta-empty-icon{font-size:3em}
.delta-empty-title{font-size:1.4em;font-weight:800;color:#fff}
.delta-empty-sub{font-size:13.5px;color:var(--txm);max-width:480px;line-height:1.7}
.delta-empty.delta-ok .delta-empty-title{color:var(--add)}
.delta-summary-strip{display:flex;flex-wrap:wrap;gap:10px;padding:18px 0 24px}
.ds-pill{border-radius:20px;padding:6px 18px;font-size:12.5px;font-weight:700;letter-spacing:.02em}
.ds-add{background:var(--addD);border:1px solid var(--add);color:var(--add)}
.ds-rem{background:var(--remD);border:1px solid var(--rem);color:var(--rem)}
.ds-chg{background:var(--chgD);border:1px solid var(--chg);color:var(--chg)}
.ds-tot{background:var(--accD);border:1px solid var(--acc);color:var(--acc)}

/* ── DELTA SECTIONS ── */
.delta-section{margin-bottom:32px}
.delta-sec-hdr{display:flex;align-items:center;gap:12px;padding:12px 20px;
               border-radius:8px 8px 0 0;border:1px solid var(--bdr);border-bottom:none;
               font-size:13px;font-weight:700;color:#fff}
.delta-sec-add{background:linear-gradient(135deg,var(--addD),transparent);border-color:rgba(34,197,94,.3)}
.delta-sec-rem{background:linear-gradient(135deg,var(--remD),transparent);border-color:rgba(239,68,68,.3)}
.delta-sec-chg{background:linear-gradient(135deg,var(--chgD),transparent);border-color:rgba(245,158,11,.3)}
.delta-sec-icon{font-size:1.1em;font-family:'Courier New',Courier,monospace;font-weight:900}
.delta-sec-cnt{font-family:'Courier New',Courier,monospace;font-size:11px;color:var(--txm);
               background:var(--surf2);border:1px solid var(--bdr);border-radius:4px;padding:2px 10px}
.dexp-btn{margin-left:auto;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;
          padding:4px 12px;color:var(--txm);font-size:11px;cursor:pointer;font-family:inherit;
          transition:all .15s}
.dexp-btn:last-child{margin-left:4px}
.dexp-btn:hover{background:var(--surf2);color:var(--tx)}

/* ── DELTA TABLE ── */
.dt-wrap{overflow-x:auto;border:1px solid var(--bdr);border-radius:0 0 8px 8px}
.dt{border-collapse:collapse;width:100%;font-size:12.5px}
.dt-th{padding:9px 14px;text-align:left;font-family:'Courier New',Courier,monospace;font-size:9.5px;
       letter-spacing:.1em;text-transform:uppercase;color:var(--txm);
       background:var(--surf2);border-bottom:2px solid var(--bdr2)}
.dt-add-row{background:rgba(34,197,94,.04);border-bottom:1px solid var(--bdr)}
.dt-rem-row{background:rgba(239,68,68,.04);border-bottom:1px solid var(--bdr)}
.dt-add-row:last-child,.dt-rem-row:last-child{border-bottom:none}
.dt-user{padding:8px 14px;display:flex;align-items:center;gap:8px;font-weight:600;color:#fff;
         white-space:nowrap}
.dt-login{padding:8px 14px;white-space:nowrap}
.dt-email{padding:8px 14px;font-size:12px;color:var(--txm)}
.dt-groups{padding:6px 14px}
.dt-cnt{padding:8px 14px;font-family:'Courier New',Courier,monospace;font-size:13px;
        color:var(--acc);text-align:center}
.dt-none{color:var(--txd);font-size:11px;font-style:italic}
.mini-avatar{display:inline-flex;align-items:center;justify-content:center;
             width:26px;height:26px;border-radius:50%;font-size:10px;font-weight:800;
             color:#fff;font-family:'Courier New',Courier,monospace;flex-shrink:0}

/* ── CHANGED USERS CARDS ── */
.chg-cards{border:1px solid var(--bdr);border-top:none;border-radius:0 0 8px 8px;overflow:hidden}
.chg-card{border-bottom:1px solid var(--bdr)}
.chg-card:last-child{border-bottom:none}
.chg-card-hdr{display:flex;align-items:center;gap:12px;padding:12px 18px;cursor:pointer;
              user-select:none;transition:background .15s;background:var(--surf)}
.chg-card-hdr:hover{background:var(--surf2)}
.chg-card.collapsed .chg-card-body{display:none}
.chg-card.collapsed .chevron{transform:rotate(-90deg)}
.chg-info{flex:1;min-width:0}
.chg-badges{display:flex;gap:6px;flex-shrink:0}
.chg-add-badge{background:var(--addD);border:1px solid var(--add);color:var(--add);
               font-family:'Courier New',Courier,monospace;font-size:11px;border-radius:4px;padding:2px 8px;font-weight:700}
.chg-rem-badge{background:var(--remD);border:1px solid var(--rem);color:var(--rem);
               font-family:'Courier New',Courier,monospace;font-size:11px;border-radius:4px;padding:2px 8px;font-weight:700}
.chg-card-body{padding:14px 18px;background:#06101D}
.chg-cols{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.chg-col{border-radius:7px;padding:12px 16px}
.chg-col-add{background:var(--addD);border:1px solid rgba(34,197,94,.2)}
.chg-col-rem{background:var(--remD);border:1px solid rgba(239,68,68,.2)}
.chg-col-hdr{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;
             margin-bottom:10px}
.chg-col-add .chg-col-hdr{color:var(--add)}
.chg-col-rem .chg-col-hdr{color:var(--rem)}
.chg-col-cnt{font-family:'Courier New',Courier,monospace;font-size:10px;color:var(--txm);
             background:var(--gnd);border:1px solid var(--bdr);border-radius:4px;
             padding:0 5px;margin-left:6px;font-weight:400}
.chip-plus,.chip-minus{border-radius:20px}

/* Category rows inside changed-user / new-user / removed-user sections */
.chg-cat-list{display:flex;flex-direction:column;gap:7px}
.chg-cat-row{display:flex;flex-direction:column;gap:4px}
.chg-cat-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
             display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.chg-cat-cnt{font-family:'Courier New',Courier,monospace;font-size:9px;font-weight:400;
             background:rgba(0,0,0,.3);border-radius:3px;padding:0 4px;color:inherit;opacity:.7;margin-left:4px}
.chg-cat-tech{font-style:italic}
.chg-cat-pills{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.chg-cat-pill{font-family:'Courier New',Courier,monospace;font-size:9.5px;border:1px solid;
              border-radius:4px;padding:1px 7px;white-space:nowrap;cursor:default}
.chg-cat-pill-tech{font-style:italic}
/* dt-groups cell uses the same cat-row layout for new/removed user tables */
.dt-groups .chg-cat-row{flex-direction:row;flex-wrap:wrap;align-items:center;gap:6px}
.dt-groups .chg-cat-lbl{min-width:90px;flex-shrink:0}

/* ── CRUD BADGE CELLS ── */
.cb{display:inline-flex;align-items:center;justify-content:center;
    width:22px;height:22px;border-radius:4px;font-size:11px;font-weight:800;
    font-family:'Courier New',Courier,monospace;margin:0 1px;cursor:default}
.cb-on{background:rgba(34,197,94,.18);color:#22c55e;border:1px solid rgba(34,197,94,.4)}
.cb-off{background:rgba(0,0,0,.18);color:var(--txd);border:1px solid var(--bdr)}
.cb-gained{background:rgba(34,197,94,.35);color:#4ade80;border:2px solid #22c55e;font-size:12px}
.cb-lost{background:rgba(239,68,68,.25);color:#f87171;border:2px solid #ef4444;text-decoration:line-through;font-size:12px}

/* ── ACCESS RIGHTS SECTION ── */
.acc-body{border:1px solid var(--bdr);border-top:none;border-radius:0 0 8px 8px;overflow:hidden}
.acc-sub{border-bottom:1px solid var(--bdr)}
.acc-sub:last-child{border-bottom:none}
.acc-sub-hdr{display:flex;align-items:center;gap:12px;padding:10px 18px;
             font-size:12px;font-weight:700;background:var(--surf2)}
.acc-mod{color:var(--chg)}
.acc-add{color:var(--add)}
.acc-rem{color:var(--rem)}
.acc-sub-cnt{font-family:'Courier New',Courier,monospace;font-size:10px;color:var(--txm);
             background:var(--gnd);border:1px solid var(--bdr);border-radius:4px;padding:1px 8px;margin-left:auto}
.ar-group-card{border-bottom:1px solid var(--bdr)}
.ar-group-card:last-child{border-bottom:none}
.ar-group-hdr{display:flex;align-items:center;gap:10px;padding:9px 18px;cursor:pointer;
              user-select:none;background:var(--surf);transition:background .15s}
.ar-group-hdr:hover{background:var(--surf2)}
.ar-group-card.collapsed .ar-group-body{display:none}
.ar-group-card.collapsed .ar-chev{transform:rotate(-90deg)}
.ar-add-hdr{background:rgba(34,197,94,.04)}
.ar-rem-hdr{background:rgba(239,68,68,.04)}
.ar-group-name{font-size:12px;font-weight:700;color:var(--tx);flex:1}
.ar-group-cnt{font-family:'Courier New',Courier,monospace;font-size:10px;color:var(--txm);
              background:var(--surf2);border:1px solid var(--bdr);border-radius:4px;padding:1px 7px}
.ar-chev{color:var(--txd);font-size:13px;transition:transform .2s;line-height:1}
.ar-group-body{padding:0}
.ar-table-wrap{overflow-x:auto}
.ar-table{border-collapse:collapse;width:100%;font-size:12px}
.ar-th{padding:7px 14px;text-align:left;font-family:'Courier New',Courier,monospace;font-size:9px;
       letter-spacing:.1em;text-transform:uppercase;color:var(--txm);
       background:var(--surf2);border-bottom:1px solid var(--bdr2)}
.ar-row{border-bottom:1px solid var(--bdr);transition:background .1s}
.ar-row:last-child{border-bottom:none}
.ar-row:hover{background:var(--surf2)}
.ar-add-row{background:rgba(34,197,94,.03)}
.ar-rem-row{background:rgba(239,68,68,.03)}
.ar-model{padding:7px 14px;font-size:12px;font-weight:600;color:var(--tx);max-width:280px}
.ar-tech{padding:7px 14px;font-size:11px;color:var(--txm);white-space:nowrap}
.ar-tech code{font-family:'Courier New',Courier,monospace;font-size:10.5px;color:#93C5FD}
.ar-crud{padding:7px 14px;white-space:nowrap}
.ar-prev{padding:7px 14px;white-space:nowrap;opacity:.5}

/* ── USER PROFILE ATTRIBUTE TABLE ── */
.attr-table-wrap{overflow-x:auto;padding:8px 14px 14px}
.attr-table{border-collapse:collapse;font-size:12.5px;width:100%;max-width:640px}
.ac-th{padding:6px 14px;text-align:left;font-family:'Courier New',Courier,monospace;font-size:9px;
       letter-spacing:.1em;text-transform:uppercase;color:var(--txm);
       background:var(--surf2);border-bottom:1px solid var(--bdr2)}
.ac-field{padding:7px 14px;font-family:'Courier New',Courier,monospace;font-size:11.5px;color:var(--acc);
          font-weight:700;text-transform:uppercase;letter-spacing:.06em;width:80px}
.ac-from{padding:7px 14px;color:var(--rem);text-decoration:line-through;font-size:12px;max-width:240px}
.ac-arrow{padding:7px 4px;color:var(--txd);font-size:14px;text-align:center}
.ac-to{padding:7px 14px;color:var(--add);font-weight:600;font-size:12px;max-width:240px}

/* ── PROFILE SECTION HEADER ── */
.delta-sec-attr{background:linear-gradient(135deg,rgba(167,139,250,.1),transparent);border-color:rgba(167,139,250,.3)}
.delta-sec-acc{background:linear-gradient(135deg,rgba(56,189,248,.1),transparent);border-color:rgba(56,189,248,.3)}
.ds-attr{background:rgba(167,139,250,.1);border:1px solid #a78bfa;color:#a78bfa}
.ds-acc{background:rgba(56,189,248,.1);border:1px solid #38bdf8;color:#38bdf8}
.chg-chg-badge{background:rgba(167,139,250,.15);border:1px solid #a78bfa;color:#a78bfa;
               font-family:'Courier New',Courier,monospace;font-size:11px;border-radius:4px;padding:2px 8px;font-weight:700}

/* ── USER CHANGE BADGES ── */
.uc-badge{font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
          border-radius:4px;padding:1px 6px;margin-left:8px;vertical-align:middle}
.uc-new{background:var(--addD);border:1px solid var(--add);color:var(--add)}
.uc-chg{background:var(--chgD);border:1px solid var(--chg);color:var(--chg)}

/* ── LAYOUT ── */
.layout{max-width:1440px;margin:0 auto;padding:32px 40px;
        display:grid;grid-template-columns:230px 1fr;gap:28px;align-items:start}
.panel{background:var(--surf);border:1px solid var(--bdr);border-radius:var(--r);overflow:hidden}
.panel-hdr{padding:11px 16px;border-bottom:1px solid var(--bdr);font-family:'Courier New',Courier,monospace;
           font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--txm);
           display:flex;justify-content:space-between;align-items:center}
.panel-hint{font-size:9px;color:var(--txd);letter-spacing:.04em}
.cat-item{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid var(--bdr);
          transition:background .15s;cursor:pointer;user-select:none}
.cat-item:last-child{border-bottom:none}
.cat-item:hover{background:var(--surf2)}
.cat-item:focus{outline:2px solid var(--acc);outline-offset:-2px}
.cat-item.active{background:var(--accD);border-left:2px solid var(--acc);padding-left:12px}
.cat-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.cat-name{flex:1;font-size:11.5px;color:var(--tx);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cat-badges{display:flex;gap:3px;flex-shrink:0}
.cat-count{font-family:'Courier New',Courier,monospace;font-size:9.5px;color:var(--txm);
           background:var(--surf2);border:1px solid var(--bdr);border-radius:4px;padding:1px 5px}
.cat-ucnt{font-family:'Courier New',Courier,monospace;font-size:9.5px;color:#34D399;
          background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.25);border-radius:4px;padding:1px 5px}
.sidebar-reset{display:none;padding:8px 14px;font-size:11px;color:var(--acc);cursor:pointer;
               text-align:center;border-top:1px solid var(--bdr);transition:background .15s}
.sidebar-reset:hover{background:var(--surf2)}
.sidebar-reset.vis{display:block}
.sidebar{position:sticky;top:24px}

/* ── TOOLBAR ── */
.section-hdr{display:flex;align-items:center;justify-content:space-between;
             margin-bottom:12px;gap:12px;flex-wrap:wrap}
.section-label{font-family:'Courier New',Courier,monospace;font-size:10px;
               letter-spacing:.14em;text-transform:uppercase;color:var(--txm)}
.toolbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.tbtn{background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:5px 13px;
      color:var(--txm);font-size:11.5px;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap}
.tbtn:hover{background:var(--surf2);border-color:var(--bdr2);color:var(--tx)}
.tbtn.on{background:var(--accD);border-color:var(--acc);color:var(--acc)}
.search-box{background:var(--surf);border:1px solid var(--bdr);border-radius:6px;
            padding:7px 13px;color:var(--tx);font-size:13px;width:230px;
            outline:none;transition:border-color .2s;font-family:inherit}
.search-box:focus{border-color:var(--acc)}
.search-box::placeholder{color:var(--txd)}
.filter-bar{background:var(--accD);border:1px solid var(--acc);border-radius:6px;
            padding:6px 14px;font-size:11.5px;color:var(--acc);margin-bottom:10px;
            display:none;align-items:center;gap:8px}
.filter-bar.vis{display:flex}
.filter-x{cursor:pointer;opacity:.7;font-size:14px;line-height:1;margin-left:auto}
.filter-x:hover{opacity:1}

/* ── USER CARDS ── */
.user-card{background:var(--surf);border:1px solid var(--bdr);border-radius:var(--r);
           overflow:hidden;margin-bottom:10px;display:flex;transition:border-color .2s,box-shadow .2s}
.user-card:hover{border-color:var(--bdr2);box-shadow:0 4px 28px rgba(0,0,0,.35)}
.user-accent{width:3px;flex-shrink:0}
.user-card-inner{flex:1;min-width:0}
.user-top{display:flex;align-items:center;gap:14px;padding:14px 18px;cursor:pointer;
          user-select:none;transition:background .15s}
.user-top:hover{background:var(--surf2)}
.user-top:focus{outline:2px solid var(--acc);outline-offset:-2px}
.avatar{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;
        justify-content:center;font-size:14px;font-weight:800;color:#fff;flex-shrink:0;
        font-family:'Courier New',Courier,monospace}
.user-info{flex:1;min-width:0}
.uname{font-size:14px;font-weight:700;color:#fff;margin-bottom:3px;
       white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.umeta{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.uid-badge{font-family:'Courier New',Courier,monospace;font-size:10.5px;color:var(--txm);
           background:var(--surf2);border:1px solid var(--bdr);border-radius:4px;padding:1px 7px;flex-shrink:0}
.ulogin{font-family:'Courier New',Courier,monospace;font-size:11px;
        background:#060D1C;color:#93C5FD;padding:2px 9px;border-radius:5px;border:1px solid #1A3456}
.uemail{font-size:11.5px;color:var(--txm)}
.gcol{text-align:center;flex-shrink:0;min-width:52px}
.gnum{font-family:'Courier New',Courier,monospace;font-size:1.65em;font-weight:700;color:var(--acc);line-height:1}
.glbl{font-size:9px;color:var(--txm);text-transform:uppercase;letter-spacing:.06em;margin-top:2px}
.cov-bar{width:44px;height:3px;background:var(--bdr2);border-radius:2px;margin:5px auto 0;overflow:hidden}
.cov-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,var(--teal),var(--acc))}
.chevron{color:var(--txd);font-size:18px;transition:transform .2s;flex-shrink:0;line-height:1}
.user-card.collapsed .chevron{transform:rotate(-90deg)}
.user-groups{padding:4px 14px 14px;display:flex;flex-direction:column;gap:6px}
.user-card.collapsed .user-groups{display:none}
.usplit{display:flex;align-items:center;gap:5px;margin-top:4px}
.usplit-app{font-family:'Courier New',Courier,monospace;font-size:10px;color:var(--app);
            background:var(--appD);border:1px solid rgba(34,211,238,.25);border-radius:4px;padding:1px 7px}
.usplit-sep{color:var(--txd);font-size:10px}
.usplit-tech{font-family:'Courier New',Courier,monospace;font-size:10px;color:var(--tech);
             background:var(--techD);border:1px solid rgba(245,158,11,.25);border-radius:4px;padding:1px 7px}
.cat-row{display:flex;flex-wrap:wrap;align-items:flex-start;gap:6px}
.cat-row-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;
               min-width:128px;padding-top:4px;flex-shrink:0;display:flex;align-items:center;gap:5px}
.cat-row-cnt{font-family:'Courier New',Courier,monospace;font-size:9.5px;color:var(--txm);
             background:var(--surf2);border:1px solid var(--bdr);border-radius:3px;padding:0 5px;font-weight:400}
.chips{display:flex;flex-wrap:wrap;gap:5px}
.chip{border:1px solid var(--cc);color:var(--cc);border-radius:20px;padding:2px 10px;
      font-size:11px;font-weight:600;cursor:default;transition:opacity .15s;
      background:rgba(0,0,0,.25);display:inline-flex;align-items:center}
.chip:hover{opacity:.7}
.chip-rem{opacity:.75}
.chip-id{font-size:9px;opacity:.5;font-family:'Courier New',Courier,monospace;font-weight:400}
.no-groups{color:var(--txm);font-size:12px}
.view-table{display:none}
body.tbl .view-chips{display:none}
body.tbl .view-table{display:block}
.gtable-wrap{overflow-x:auto;border-radius:6px;border:1px solid var(--bdr)}
.gtable{border-collapse:collapse;width:100%;font-size:12px}
.gt-th{padding:8px 12px;text-align:left;font-family:'Courier New',Courier,monospace;font-size:9.5px;
       letter-spacing:.1em;text-transform:uppercase;color:var(--txm);
       background:var(--surf2);border-bottom:2px solid var(--bdr2)}
.gtable tbody tr{border-bottom:1px solid var(--bdr);transition:background .1s}
.gtable tbody tr:last-child{border-bottom:none}
.gtable tbody tr:hover{background:var(--surf2)}
.gt-id{padding:6px 12px;font-family:'Courier New',Courier,monospace;font-size:11px;color:var(--txm);width:50px}
.gt-cat{padding:6px 12px;font-size:11px;color:var(--txm);white-space:nowrap}
.gt-name{padding:6px 12px;font-size:12px;color:var(--tx);font-weight:600}
.gt-full{padding:6px 12px;font-size:11.5px;color:var(--txm)}
.usr-sec{border:1px solid var(--bdr);border-radius:7px;overflow:hidden}
.usr-sec-hdr{display:flex;align-items:center;gap:8px;padding:8px 14px;cursor:pointer;
             user-select:none;background:var(--surf2);transition:background .15s}
.usr-sec-hdr:hover{background:var(--bdr)}
.usr-sec.collapsed .usr-sec-chev{transform:rotate(-90deg)}
.usr-sec.collapsed .usr-sec-body{display:none}
.usr-sec-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.dot-app{background:var(--app)}
.dot-tech{background:var(--tech)}
.usr-sec-title{font-size:11.5px;font-weight:700;color:var(--tx);flex:1}
.usr-sec-cnt{font-family:'Courier New',Courier,monospace;font-size:10px;color:var(--txm);
             background:var(--gnd);border:1px solid var(--bdr);border-radius:4px;padding:1px 6px}
.usr-sec-chev{color:var(--txd);font-size:14px;transition:transform .2s;line-height:1}
.usr-sec-body{padding:10px 14px;display:flex;flex-direction:column;gap:7px}
.cat-item.tech-cat{border-left:2px solid rgba(245,158,11,.2)}
.cat-item.tech-cat .cat-name{color:var(--tech);opacity:.85}
.cat-item.tech-cat.active{background:var(--techD);border-left-color:var(--tech)}

/* ── GROUPS VIEW ── */
.gv-outer{max-width:1440px;margin:0 auto;padding:32px 40px 52px}
.gv-sec{margin-bottom:40px}
.gv-sec-hdr{display:flex;align-items:center;gap:16px;padding:13px 20px;
            border-radius:8px 8px 0 0;border:1px solid var(--bdr);border-bottom:none}
.gv-app{background:linear-gradient(135deg,var(--appD),transparent);border-color:rgba(34,211,238,.25)}
.gv-tech{background:linear-gradient(135deg,var(--techD),transparent);border-color:rgba(245,158,11,.25)}
.gv-sec-title{font-size:13px;font-weight:700;color:#fff}
.gv-sec-cnt{font-family:'Courier New',Courier,monospace;font-size:10.5px;color:var(--txm);
            background:var(--surf2);border:1px solid var(--bdr);border-radius:4px;padding:2px 10px}
.gv-table-wrap{overflow-x:auto;border:1px solid var(--bdr);border-radius:0 0 8px 8px}
.gv-table{border-collapse:collapse;width:100%;font-size:12px}
.gr-th{padding:8px 14px;text-align:left;font-family:'Courier New',Courier,monospace;font-size:9.5px;
       letter-spacing:.1em;text-transform:uppercase;color:var(--txm);
       background:var(--surf2);border-bottom:2px solid var(--bdr2)}
.gr-row{border-bottom:1px solid var(--bdr);transition:background .1s}
.gr-row:last-child{border-bottom:none}
.gr-row:hover{background:var(--surf2)}
.gr-id{padding:7px 14px;font-family:'Courier New',Courier,monospace;font-size:11px;color:var(--txd);width:50px}
.gr-cat{padding:7px 14px;font-size:11px;color:var(--txm);white-space:nowrap}
.gr-name{padding:7px 14px;font-size:12px;font-weight:700;color:var(--tx)}
.gr-full{padding:7px 14px;font-size:11.5px;color:var(--txm)}
.gr-users{padding:4px 14px}
.gr-users-wrap{display:flex;align-items:center;flex-wrap:wrap;gap:4px;padding:3px 0}
.gr-sep{display:inline-block;width:4px}
.ugbadge{width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;
         justify-content:center;font-size:9px;font-weight:800;color:#fff;
         font-family:'Courier New',Courier,monospace;cursor:default;flex-shrink:0}
.ugname{font-size:11px;color:var(--tx);background:var(--surf2);border:1px solid var(--bdr);
        border-radius:4px;padding:1px 7px;white-space:nowrap}
.gr-none{color:var(--txd);font-size:11px;font-style:italic}

/* ── MATRIX ── */
.matrix-outer{max-width:1440px;margin:0 auto;padding:0 40px 52px}
.matrix-title-bar{display:flex;align-items:center;margin-bottom:14px}
.matrix-wrap{background:var(--surf);border:1px solid var(--bdr);border-radius:var(--r);overflow-x:auto}
.mtable{border-collapse:collapse;font-size:12px}
.mthead-corner{padding:10px 14px;border-bottom:2px solid var(--bdr2);border-right:2px solid var(--bdr2);
               background:var(--surf);font-family:'Courier New',Courier,monospace;font-size:9.5px;
               letter-spacing:.12em;text-transform:uppercase;color:var(--txm);position:sticky;left:0;z-index:3}
.mth{min-width:108px;padding:8px 6px 12px;font-weight:600;font-size:10px;color:var(--txm);
     border-left:1px solid var(--bdr);border-bottom:2px solid var(--bdr2);writing-mode:vertical-rl;
     text-orientation:mixed;height:130px;white-space:nowrap;background:var(--surf);vertical-align:bottom}
.mrow.alt .mcell,.mrow.alt .mlabel{background:#070C18}
.mlabel{padding:6px 12px;border-right:2px solid var(--bdr2);border-bottom:1px solid var(--bdr);
        font-size:10.5px;white-space:nowrap;background:var(--surf);position:sticky;left:0;z-index:2}
.mdot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;vertical-align:middle}
.mcat{color:var(--txm);font-size:9.5px;margin-right:2px}
.mgname{color:var(--tx);font-weight:500}
.mgid{font-family:'Courier New',Courier,monospace;font-size:9px;color:var(--txd);margin-left:5px}
.mcell{text-align:center;padding:6px 4px;border-bottom:1px solid var(--bdr);
       border-left:1px solid var(--bdr);background:var(--surf)}
.mhit{color:var(--cc);font-size:12px;font-weight:700}
.mmiss{color:var(--txd);font-size:10px}
.matrix-note{padding:9px 14px;font-size:10.5px;color:var(--txm);border-top:1px solid var(--bdr)}

/* ── MODIFIED-BY FOOTER (inside changed-user cards) ── */
.chg-by{display:flex;align-items:center;gap:7px;margin-top:12px;padding:8px 14px;
        background:rgba(200,150,58,.07);border:1px solid rgba(200,150,58,.2);
        border-radius:6px;font-size:11.5px;flex-wrap:wrap}
.chg-by-icon{color:var(--acc);font-size:13px;flex-shrink:0}
.chg-by-lbl{font-family:'Courier New',Courier,monospace;font-size:9.5px;letter-spacing:.1em;
            text-transform:uppercase;color:var(--txm);flex-shrink:0}
.chg-by-name{color:var(--acc);font-weight:700;font-size:12px}
.chg-by-sep{color:var(--txd)}
.chg-by-date{color:var(--txm);font-family:'Courier New',Courier,monospace;font-size:11px}
/* ── MODIFIED-BY COLUMN (access rights table) ── */
.ar-by{padding:7px 14px;white-space:nowrap;min-width:160px}
.ar-by-name{font-size:11.5px;font-weight:600;color:var(--acc)}
.ar-by-date{font-family:'Courier New',Courier,monospace;font-size:10px;color:var(--txm);margin-top:2px;display:block}
.ar-by-na{color:var(--txd);font-size:11px;font-style:italic}

/* ── COMPARISON BAR ── */
.cmp-bar{display:flex;align-items:center;gap:16px;padding:14px 20px;margin-bottom:20px;
         background:var(--surf2);border:1px solid var(--bdr);border-radius:8px;flex-wrap:wrap}
.cmp-side{display:flex;flex-direction:column;gap:3px}
.cmp-lbl{font-family:'Courier New',Courier,monospace;font-size:9.5px;letter-spacing:.12em;
         text-transform:uppercase;color:var(--txm)}
.cmp-time{font-family:'Courier New',Courier,monospace;font-size:12.5px;color:var(--tx);font-weight:700}
.cmp-arrow{font-size:22px;color:var(--acc);flex:1;text-align:center}

/* ── NO CRUD CHANGES NOTICE ── */
.acc-none{border:1px solid var(--bdr);border-top:none;border-radius:0 0 8px 8px;
          padding:14px 20px;display:flex;align-items:center;gap:8px;
          font-size:12.5px;color:var(--pass);background:rgba(29,138,98,.05)}
.acc-none-icon{font-size:1.1em}

/* ── FOOTER ── */
.footer{text-align:center;padding:22px 40px;font-family:'Courier New',Courier,monospace;
        font-size:10.5px;color:var(--txd);border-top:1px solid var(--bdr)}

/* ── UTIL ── */
.hidden{display:none!important}
#noResults{color:var(--txm);padding:40px;text-align:center;
           font-family:'Courier New',Courier,monospace;font-size:12px;letter-spacing:.08em}

@media(max-width:1100px){.stats-inner{grid-template-columns:repeat(4,1fr)}}
@media(max-width:960px){
  .layout{grid-template-columns:1fr;padding:20px}
  .stats-inner{grid-template-columns:repeat(3,1fr);padding:0 20px}
  .sidebar{position:static}.hdr{padding:28px 20px}
  .matrix-outer{padding:0 20px 36px}.user-groups{padding-left:20px}
  .chg-cols{grid-template-columns:1fr}
  .delta-outer{padding:20px}
}
@media(max-width:600px){.stats-inner{grid-template-columns:repeat(2,1fr)}}
@media(prefers-reduced-motion:reduce){.ping{animation:none}}
</style>
</head>
<body>

<!-- HEADER -->
<header class="hdr">
  <div class="hdr-inner">
    <div>
      <div class="hdr-eyebrow">
        <span class="ping"></span>
        <span>Security Audit &nbsp;&middot;&nbsp; Odoo 17 &nbsp;&middot;&nbsp; Daily Diff</span>
      </div>
      <h1 class="hdr-title">User Group <em>Access Changes</em></h1>
      <div class="hdr-meta">
        <span>${escHtml(instance)}</span>
        <span class="hdr-sep">&middot;</span>
        <span>${escHtml(now)}</span>
        <span class="hdr-sep">&middot;</span>
        <span>Comparison: ${comparisonPeriod}</span>
      </div>
    </div>
    <div class="hdr-status">${delta.hasDiff ? 'Changes Detected' : prevSnapshot ? 'No Changes' : 'First Run'}</div>
  </div>
</header>

<!-- STATS BAR -->
<div class="stats-bar">
  <div class="stats-inner">
    <div class="stat">
      <div class="stat-num" data-target="${users.length}">0</div>
      <div class="stat-lbl">Internal Users</div>
    </div>
    <div class="stat">
      <div class="stat-num" data-target="${delta.newUsers.length}" ${deltaStatAdd}>0</div>
      <div class="stat-lbl">Users Added</div>
    </div>
    <div class="stat">
      <div class="stat-num" data-target="${delta.removedUsers.length}" ${deltaStatRem}>0</div>
      <div class="stat-lbl">Users Removed</div>
    </div>
    <div class="stat">
      <div class="stat-num" data-target="${delta.attrChangedUsers.length}" ${deltaStatAttr}>0</div>
      <div class="stat-lbl">Profile Changed</div>
    </div>
    <div class="stat">
      <div class="stat-num" data-target="${delta.changedUsers.length}" ${deltaStatGrp}>0</div>
      <div class="stat-lbl">Group Changes</div>
    </div>
    <div class="stat">
      <div class="stat-num" data-target="${accessDelta.totalChanges}" ${deltaStatAcc}>0</div>
      <div class="stat-lbl">Access Rule Changes</div>
    </div>
    <div class="stat">
      <div class="stat-num" data-target="${accessDelta.changedRules.length}" ${accessDelta.changedRules.length > 0 ? 'style="color:#38bdf8"' : 'style="color:var(--txm)"'}>0</div>
      <div class="stat-lbl">CRUD Modified</div>
    </div>
    <div class="stat">
      <div class="stat-num" data-target="${allGroups.length}">0</div>
      <div class="stat-lbl">Unique Groups</div>
    </div>
  </div>
</div>

<!-- VIEW NAV -->
<div class="view-nav">
  <div class="view-nav-inner">
    <button class="nav-btn on" id="navChanges">Changes
      ${(delta.hasDiff || accessDelta.hasDiff) ? `<span class="nav-badge ${delta.newUsers.length > 0 ? 'add' : delta.removedUsers.length > 0 ? 'rem' : 'chg'}">${delta.newUsers.length + delta.removedUsers.length + delta.attrChangedUsers.length + delta.changedUsers.length + accessDelta.totalChanges}</span>` : ''}
    </button>
    <button class="nav-btn" id="navUsers">By User<span class="nav-badge">${users.length}</span></button>
    <button class="nav-btn" id="navGroups">By Group<span class="nav-badge">${resolvedAllGroups.length}</span></button>
  </div>
</div>

<!-- ══ CHANGES VIEW ══════════════════════════════════════════════════════════ -->
<div id="changesView" class="delta-outer">
  ${deltaViewHtml}
</div>

<!-- ══ BY USER VIEW ═════════════════════════════════════════════════════════ -->
<div id="usersView" style="display:none">
<div class="layout">
  <aside class="sidebar">
    <div class="panel">
      <div class="panel-hdr">
        <span>Group Categories</span>
        <span class="panel-hint">click to filter</span>
      </div>
      ${catSidebarItems}
      <div class="sidebar-reset" id="catReset">&#10005;&nbsp; Clear filter</div>
    </div>
  </aside>
  <div class="main-col">
    <div class="section-hdr">
      <div class="section-label">User Roster &mdash; ${users.length} internal users</div>
      <div class="toolbar">
        <button class="tbtn" id="btnExpAll">Expand All</button>
        <button class="tbtn" id="btnColAll">Collapse All</button>
        <button class="tbtn on" id="btnChips">Chips</button>
        <button class="tbtn"    id="btnTable">Table</button>
        <input class="search-box" type="search" id="searchBox"
               placeholder="Search name, login, group&hellip;" autocomplete="off">
      </div>
    </div>
    <div class="filter-bar" id="filterBar">
      Filtering: <strong id="filterLbl"></strong>
      <span class="filter-x" id="filterX" title="Clear">&#10005;</span>
    </div>
    <div id="userList">${userCardsHtml}</div>
    <div id="noResults" class="hidden">NO MATCHING USERS</div>
  </div>
</div>

${matrixGroups.length > 0 ? `
<div class="matrix-outer">
  <div class="matrix-title-bar">
    <div class="section-label">Group &times; User Matrix &mdash; application groups only</div>
  </div>
  <div class="matrix-wrap">
    <table class="mtable">
      <thead>
        <tr>
          <th class="mthead-corner">Group</th>
          ${matrixHeadCells}
        </tr>
      </thead>
      <tbody>${matrixBodyRows}</tbody>
    </table>
    <div class="matrix-note">
      &#10004; = assigned &nbsp;&middot;&nbsp; &middot; = not assigned &nbsp;&middot;&nbsp;
      technical &amp; uncategorised groups are excluded from this matrix
    </div>
  </div>
</div>
` : ''}
</div><!-- /#usersView -->

<!-- ══ BY GROUP VIEW ════════════════════════════════════════════════════════ -->
<div id="groupsView" class="gv-outer" style="display:none">
  ${groupsViewHtml}
</div>

<!-- FOOTER -->
<footer class="footer">
  security-audit.reports.spec.ts &nbsp;&middot;&nbsp;
  ${escHtml(now)} &nbsp;&middot;&nbsp; ${escHtml(instance)}
  ${prevSnapshot ? `&nbsp;&middot;&nbsp; diff vs ${escHtml(prevSnapshot.date)}` : '&nbsp;&middot;&nbsp; first run'}
</footer>

<script>
(function () {
  // Count-up
  document.querySelectorAll('[data-target]').forEach(function (el) {
    var target = parseInt(el.getAttribute('data-target'), 10);
    if (!target) { el.textContent = '0'; return; }
    var start = performance.now(), dur = 800 + (target % 7) * 40;
    function step(ts) {
      var p = Math.min((ts - start) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(e * target);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });

  // Main view tabs
  var changesView = document.getElementById('changesView');
  var usersView   = document.getElementById('usersView');
  var groupsView  = document.getElementById('groupsView');
  var navChanges  = document.getElementById('navChanges');
  var navUsers    = document.getElementById('navUsers');
  var navGroups   = document.getElementById('navGroups');

  function showView(v) {
    changesView.style.display = v === 'c' ? '' : 'none';
    usersView.style.display   = v === 'u' ? '' : 'none';
    groupsView.style.display  = v === 'g' ? '' : 'none';
    navChanges.classList.toggle('on', v === 'c');
    navUsers.classList.toggle('on',   v === 'u');
    navGroups.classList.toggle('on',  v === 'g');
  }
  navChanges.addEventListener('click', function () { showView('c'); });
  navUsers.addEventListener('click',   function () { showView('u'); });
  navGroups.addEventListener('click',  function () { showView('g'); });

  // Changed-users expand/collapse all
  var dExpAll = document.getElementById('dExpAll');
  var dColAll = document.getElementById('dColAll');
  if (dExpAll) {
    dExpAll.addEventListener('click', function () {
      document.querySelectorAll('.chg-card').forEach(function (c) { c.classList.remove('collapsed'); });
    });
  }
  if (dColAll) {
    dColAll.addEventListener('click', function () {
      document.querySelectorAll('.chg-card').forEach(function (c) { c.classList.add('collapsed'); });
    });
  }

  // User card keyboard nav
  document.querySelectorAll('.user-top').forEach(function (el) {
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.closest('.user-card').classList.toggle('collapsed'); }
    });
  });

  // Expand / Collapse All user cards
  document.getElementById('btnExpAll').addEventListener('click', function () {
    document.querySelectorAll('.user-card').forEach(function (c) { c.classList.remove('collapsed'); });
  });
  document.getElementById('btnColAll').addEventListener('click', function () {
    document.querySelectorAll('.user-card').forEach(function (c) { c.classList.add('collapsed'); });
  });

  // Chips ↔ Table
  var btnChips = document.getElementById('btnChips');
  var btnTable = document.getElementById('btnTable');
  btnChips.addEventListener('click', function () {
    document.body.classList.remove('tbl'); btnChips.classList.add('on'); btnTable.classList.remove('on');
  });
  btnTable.addEventListener('click', function () {
    document.body.classList.add('tbl'); btnTable.classList.add('on'); btnChips.classList.remove('on');
  });

  // Category filter
  var activeCat = null;
  var filterBar = document.getElementById('filterBar');
  var filterLbl = document.getElementById('filterLbl');
  var filterX   = document.getElementById('filterX');
  var catReset  = document.getElementById('catReset');
  var searchBox = document.getElementById('searchBox');
  var userList  = document.getElementById('userList');
  var noResults = document.getElementById('noResults');

  function applyFilters() {
    var q = searchBox.value.trim().toLowerCase(), visible = 0;
    userList.querySelectorAll('.user-card').forEach(function (c) {
      var okSearch = !q || c.getAttribute('data-search').indexOf(q) !== -1;
      var okCat    = !activeCat || (c.getAttribute('data-cats') || '').split('|').indexOf(activeCat) !== -1;
      var show     = okSearch && okCat;
      c.classList.toggle('hidden', !show);
      if (show) visible++;
    });
    noResults.classList.toggle('hidden', visible > 0);
  }

  function setCat(cat) {
    activeCat = cat;
    document.querySelectorAll('.cat-item').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-cat') === cat);
    });
    if (cat) { filterBar.classList.add('vis'); filterLbl.textContent = cat; catReset.classList.add('vis'); }
    else      { filterBar.classList.remove('vis'); catReset.classList.remove('vis'); }
    applyFilters();
  }

  document.querySelectorAll('.cat-item').forEach(function (el) {
    el.addEventListener('click', function () {
      setCat(activeCat === this.getAttribute('data-cat') ? null : this.getAttribute('data-cat'));
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.click(); }
    });
  });
  filterX.addEventListener('click',  function () { setCat(null); });
  catReset.addEventListener('click', function () { setCat(null); });
  searchBox.addEventListener('input', applyFilters);
})();
</script>

</body>
</html>`;
}

// ── TEST ───────────────────────────────────────────────────────────────────────

test.describe('User Access Group Audit @module:security-audit @step:reporting', () => {

  test('Daily user group & access rights change diff @smoke', async ({ rpc }) => {
    test.setTimeout(180_000);
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

    const todayDate = new Date().toISOString().slice(0, 10);
    const instance = process.env.ODOO_BASE_URL ?? 'http://localhost:8069';

    // ── Fetch internal users ───────────────────────────────────────────────
    let rawUsers: RawUserRow[] = [];
    try {
      rawUsers = await rpc.searchRead<RawUserRow>(
        'res.users',
        [['share', '=', false], ['active', '=', true]],
        ['id', 'name', 'login', 'email', 'groups_id', 'write_uid', 'write_date'],
        { limit: 0, order: 'name asc' },
      );
      console.log(`✔ ${rawUsers.length} internal user(s) found`);
    } catch (e) {
      console.warn('⚠  Could not fetch internal users:', (e as Error).message);
    }

    // ── Fetch all groups referenced by those users ─────────────────────────
    const allGroupIds = [...new Set(rawUsers.flatMap(u => u.groups_id || []))];
    let groupRows: GroupRow[] = [];
    if (allGroupIds.length > 0) {
      try {
        groupRows = await rpc.searchRead<GroupRow>(
          'res.groups',
          [['id', 'in', allGroupIds]],
          ['id', 'name', 'full_name', 'category_id'],
          { limit: 0 },
        );
      } catch (e) {
        console.warn('⚠  Could not fetch groups:', (e as Error).message);
      }
    }
    console.log(`✔ ${groupRows.length} unique group(s) resolved`);

    // ── Fetch model access rules (CRUD) for all groups ─────────────────────
    let accessRows: RawAccessRow[] = [];
    const modelMap: Record<number, { display: string; technical: string }> = {};
    if (allGroupIds.length > 0) {
      try {
        accessRows = await rpc.searchRead<RawAccessRow>(
          'ir.model.access',
          [['group_id', 'in', allGroupIds], ['active', '=', true]],
          ['id', 'name', 'model_id', 'group_id', 'perm_read', 'perm_write', 'perm_create', 'perm_unlink', 'write_uid', 'write_date'],
          { limit: 0 },
        );
        const uniqueModelIds = [...new Set(
          accessRows.map(r => Array.isArray(r.model_id) ? r.model_id[0] : null).filter((id): id is number => id != null),
        )];
        if (uniqueModelIds.length > 0) {
          const models = await rpc.searchRead<RawModelRow>(
            'ir.model',
            [['id', 'in', uniqueModelIds]],
            ['id', 'name', 'model'],
            { limit: 0 },
          );
          for (const m of models) modelMap[m.id] = { display: String(m.name || ''), technical: String(m.model || '') };
        }
      } catch (e) {
        console.warn('⚠  Could not fetch model access rules:', (e as Error).message);
      }
    }
    const accessRules: AccessRule[] = accessRows.map(r => {
      const mid = Array.isArray(r.model_id) ? r.model_id[0] : null;
      const mi = mid != null ? modelMap[mid] : undefined;
      return {
        id: r.id,
        name: String(r.name || ''),
        modelId: mid,
        modelDisplay: mi?.display || (Array.isArray(r.model_id) ? String(r.model_id[1] || '') : ''),
        modelTech: mi?.technical || '',
        groupId: Array.isArray(r.group_id) ? r.group_id[0] : null,
        groupName: Array.isArray(r.group_id) ? String(r.group_id[1] || '') : '',
        perm_read: Boolean(r.perm_read),
        perm_write: Boolean(r.perm_write),
        perm_create: Boolean(r.perm_create),
        perm_unlink: Boolean(r.perm_unlink),
        writeUid: Array.isArray(r.write_uid) ? { id: r.write_uid[0], name: String(r.write_uid[1] || '') } : null,
        writeDate: r.write_date || null,
      };
    });
    console.log(`✔ ${accessRules.length} model access rule(s) fetched`);

    const groupMap: Record<number, GroupInfo> = {};
    for (const g of groupRows) {
      const catRaw = Array.isArray(g.category_id) ? g.category_id[1] : null;
      groupMap[g.id] = {
        id: g.id,
        name: String(g.name || ''),
        fullName: String(g.full_name || g.name || ''),
        category: catRaw ? String(catRaw) : '(No Category)',
      };
    }

    const enrichedUsers: UserInfo[] = rawUsers.map(u => ({
      id: u.id,
      name: u.name,
      login: u.login,
      email: u.email || '',
      writeUid: Array.isArray(u.write_uid) ? { id: u.write_uid[0], name: String(u.write_uid[1] || '') } : null,
      writeDate: u.write_date || null,
      groups: (u.groups_id || [])
        .map(gid => groupMap[gid])
        .filter(Boolean)
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    }));

    // ── Load previous snapshot ──────────────────────────────────────────────
    const prevSnapshot = loadPreviousSnapshot(SNAPSHOT_DIR);
    if (prevSnapshot) {
      console.log(`✔ Previous snapshot loaded: ugd_snapshot_${prevSnapshot.date}.json`);
    } else {
      console.log('ℹ  No previous snapshot found — this will be the first baseline.');
    }

    // ── Compute delta ────────────────────────────────────────────────────────
    const delta = computeDelta(enrichedUsers, prevSnapshot, groupMap);
    const accessDelta = computeAccessDelta(accessRules, prevSnapshot ? prevSnapshot.accessRights || [] : null);

    // ── Console tree ─────────────────────────────────────────────────────────
    console.log('\n  ┌── INTERNAL USERS & ASSIGNED GROUPS');
    for (const u of enrichedUsers) {
      console.log(`  │  [uid:${u.id}] ${u.name} <${u.login}>`);
      const cats: Record<string, string[]> = {};
      for (const g of u.groups) {
        if (!cats[g.category]) cats[g.category] = [];
        cats[g.category].push(g.name);
      }
      for (const [cat, names] of Object.entries(cats)) {
        console.log(`  │      ${cat}: ${names.join(', ')}`);
      }
    }
    console.log(`  └──  Total: ${enrichedUsers.length} users, ${allGroupIds.length} group refs\n`);

    // ── Console delta ────────────────────────────────────────────────────────
    if (delta.prevDate) {
      console.log(`── DELTA vs ${delta.prevDate} ${'─'.repeat(40)}`);
      const anyDiff = delta.hasDiff || accessDelta.hasDiff;
      if (!anyDiff) {
        console.log('  ✔ No changes detected.');
      } else {
        if (delta.newUsers.length > 0) {
          console.log(`  + ${delta.newUsers.length} new user(s):          ${delta.newUsers.map(u => u.name).join(', ')}`);
        }
        if (delta.removedUsers.length > 0) {
          console.log(`  - ${delta.removedUsers.length} removed user(s):      ${delta.removedUsers.map(u => u.name).join(', ')}`);
        }
        if (delta.attrChangedUsers.length > 0) {
          console.log(`  ~ ${delta.attrChangedUsers.length} profile change(s):   ${delta.attrChangedUsers.map(c => c.user.name).join(', ')}`);
        }
        if (delta.changedUsers.length > 0) {
          console.log(`  ~ ${delta.changedUsers.length} group change(s):`);
          for (const c of delta.changedUsers) {
            console.log(`      ${c.user.name.padEnd(28)} +${c.groupsAdded.length} / -${c.groupsRemoved.length} groups`);
          }
        }
        if (accessDelta.hasDiff) {
          console.log(`  ⚡ ${accessDelta.totalChanges} access rule change(s):`);
          if (accessDelta.addedRules.length > 0) console.log(`     + ${accessDelta.addedRules.length} rule(s) added`);
          if (accessDelta.removedRules.length > 0) console.log(`     - ${accessDelta.removedRules.length} rule(s) removed`);
          if (accessDelta.changedRules.length > 0) console.log(`     ~ ${accessDelta.changedRules.length} rule(s) CRUD modified`);
        }
      }
      console.log('─'.repeat(53) + '\n');
    }

    printConsoleTable(
      'USER ACCESS SUMMARY',
      ['Metric', 'Count'],
      [
        ['Internal users', enrichedUsers.length],
        ['Unique groups', groupRows.length],
        ['Access rules', accessRules.length],
      ],
    );

    // ── Save snapshot ────────────────────────────────────────────────────────
    const snapshotPath = path.join(SNAPSHOT_DIR, `ugd_snapshot_${todayDate}.json`);
    const snapshot: Snapshot = {
      generatedAt: new Date().toISOString(),
      date: todayDate,
      instance,
      users: enrichedUsers.map(u => ({
        id: u.id,
        name: u.name,
        login: u.login,
        email: u.email,
        groupIds: u.groups.map(g => g.id),
        writeUid: u.writeUid,
        writeDate: u.writeDate,
      })),
      groups: groupRows.map(g => ({
        id: g.id,
        name: String(g.name || ''),
        fullName: String(g.full_name || g.name || ''),
        category: groupMap[g.id]?.category || '(No Category)',
      })),
      accessRights: accessRules,
    };
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
    console.log(`📸 Snapshot: ${snapshotPath}`);

    // ── Write HTML report ────────────────────────────────────────────────────
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const htmlPath = path.join(SNAPSHOT_DIR, `user_groups_diff_${ts}.html`);
    fs.writeFileSync(htmlPath, buildHtml(instance, todayDate, prevSnapshot, delta, accessDelta, enrichedUsers, groupRows), 'utf8');
    console.log(`📄 Report:   ${htmlPath}`);
  });
});
