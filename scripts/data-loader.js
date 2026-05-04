// TANEO Permitting Dashboard — Data loading and shared utilities

// ---------------------------------------------------------------------------
// Status vocabulary. The JSON files use these exact strings; the dashboard
// normalises every variant of project/permit/milestone status against them.
const STATUS = {
  APPROVED: 'Approved',
  UNDER_REVIEW: 'Under Review',
  NOT_FILED: 'Not Filed',
  PRE_APPLICATION: 'Pre-Application',
  PROJECTED: 'Projected',
  GAP: 'GAP'
};

// Priority for collapsing multi-permit cells in the matrix. The cell shows the
// MOST ACTIVE permit, since that's what a Coordinator needs: an in-flight Under
// Review beats a settled Approved. Pre-Application (engaged with agency) beats
// Projected (anticipated only).
const STATUS_PRIORITY = {
  [STATUS.UNDER_REVIEW]: 6,
  [STATUS.GAP]: 5,
  [STATUS.NOT_FILED]: 4,
  [STATUS.PRE_APPLICATION]: 3,
  [STATUS.PROJECTED]: 2,
  [STATUS.APPROVED]: 1
};

// Matrix column definitions. Single source of truth for both the column
// headers and the permit→column routing function.
const MATRIX_COLUMNS = [
  { key: 'NRC',          label: 'NRC License' },
  { key: 'TCEQ-AIR',     label: 'TCEQ Air' },
  { key: 'TCEQ-WATER',   label: 'TCEQ Water Rights' },
  { key: 'TCEQ-TPDES',   label: 'TCEQ Wastewater' },
  { key: 'TCEQ-STORM',   label: 'TCEQ Stormwater' },
  { key: 'ERCOT',        label: 'ERCOT Interconnect' },
  { key: 'DSHS',         label: 'DSHS Materials' }
];

// ---------------------------------------------------------------------------
// Data loading

async function loadAllData() {
  async function fetchJson(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}: HTTP ${res.status}`);
    return res.json();
  }
  const [projects, permits, milestones] = await Promise.all([
    fetchJson('data/projects.json'),
    fetchJson('data/permits.json'),
    fetchJson('data/milestones.json')
  ]);

  // Each JSON file carries its own last_updated. The dashboard's true
  // freshness is the OLDEST of the three: if permits.json was updated today
  // but milestones.json is six months stale, the user should see the stale
  // date. Lex-sort works because all three are strict YYYY-MM-DD ISO.
  const dates = [
    projects.metadata.last_updated,
    permits.metadata.last_updated,
    milestones.metadata.last_updated
  ].filter(Boolean);
  const last_updated = dates.sort()[0] || null;
  const mismatch = new Set(dates).size > 1;

  return {
    projects: projects.projects,
    permits: permits.permits,
    milestones: milestones.milestones,
    metadata: {
      projects: projects.metadata,
      permits: permits.metadata,
      milestones: milestones.metadata,
      last_updated,
      mismatch
    }
  };
}

function renderLoadError(error, containerSelector) {
  const target = document.querySelector(containerSelector);
  if (!target) return;
  target.innerHTML = `
    <div class="card" style="border-color: var(--industrial-red); background: rgba(139,43,43,0.04);">
      <h3 style="color: var(--industrial-red);">Could not load dashboard data</h3>
      <p>${(error && error.message) || error || 'Unknown error.'}</p>
      <p style="font-size: 12px; color: var(--gray-70);">
        Open this page over a local web server (not <code>file://</code>).
        From the project folder, run <code>python3 -m http.server</code>
        and visit <code>http://localhost:8000</code>.
      </p>
    </div>`;
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// Set the "Last updated" header on any page that has a #last-updated element.
function setLastUpdated(metadata) {
  const el = document.getElementById('last-updated');
  if (!el) return;
  el.textContent = `Last updated: ${fmtDate(metadata.last_updated)}${metadata.mismatch ? ' *' : ''}`;
  if (metadata.mismatch) {
    el.title = 'The three data files (projects, permits, milestones) carry different last_updated dates. Showing the oldest.';
  }
}

// ---------------------------------------------------------------------------
// Date utilities

// Parse an ISO YYYY-MM-DD string as a LOCAL-time Date (avoiding the UTC
// midnight shift JavaScript applies to bare ISO dates). Returns null for
// null/empty/GAP/non-string/non-ISO values; consumers can branch on null.
function parseLocalDate(s) {
  if (!s || isGap(s) || typeof s !== 'string') return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Format a date for display. Handles:
//   "2025-03-31"             → "Mar 31, 2025"
//   "2024-09-16 (CP issued)" → "Sep 16, 2024 (CP issued)"
//   "2026-Q4"                → "Q4 2026"
//   "2026", "Pre-1990"       → returned as-is
//   null / "GAP"             → "—"
function fmtDate(d) {
  if (!d || isGap(d)) return '—';
  if (typeof d !== 'string') return String(d);
  const isoWithSuffix = d.match(/^(\d{4})-(\d{2})-(\d{2})(\s+.+)?$/);
  if (isoWithSuffix) {
    const [, y, m, day, suffix] = isoWithSuffix;
    return `${MONTH_ABBR[parseInt(m,10)-1]} ${parseInt(day,10)}, ${y}${suffix || ''}`;
  }
  const quarter = d.match(/^(\d{4})-Q([1-4])$/);
  if (quarter) return `Q${quarter[2]} ${quarter[1]}`;
  return d;
}

// ---------------------------------------------------------------------------
// HTML output helpers

// Escape HTML-significant characters. Use whenever interpolating curated
// content fields into innerHTML. Pre-formatted HTML from helpers like
// flagHtml/statusBadge is safe and should NOT be re-escaped.
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function flagHtml(text) {
  if (!text) return '';
  return `<span class="flag ${escapeHtml(String(text).toLowerCase())}">[${escapeHtml(text)}]</span>`;
}

function isGap(v) {
  return typeof v === 'string' && v.trim().toUpperCase().startsWith('GAP');
}

// Render a possibly-GAP field. Produces a flag for GAP, em-dash for empty,
// raw value otherwise.
function fieldOrGap(v) {
  if (!v) return '—';
  if (isGap(v)) return flagHtml('GAP');
  return v;
}

// Render a value alongside its uncertainty flag (or GAP flag if the flag IS
// "GAP" — the value itself becomes redundant in that case).
function valueWithFlag(value, flag) {
  if (flag === 'GAP' || isGap(value)) return flagHtml('GAP');
  if (flag) return `${escapeHtml(String(value))} ${flagHtml(flag)}`;
  return escapeHtml(String(value));
}

// Take the first prose clause from a multi-clause status string, splitting on
// either ';' or em-dash. Used when truncating long status fields for table cells.
function firstClause(s) {
  if (!s) return '';
  return String(s).split(/[;—]/)[0].trim();
}

// ---------------------------------------------------------------------------
// Status / project semantics

function isOperating(project) {
  if (typeof project.is_operational === 'boolean') return project.is_operational;
  const s = (project.overall_status || '').toLowerCase();
  return s.startsWith('operating') || s.includes('operating;');
}

// Map a status string (canonical or prose) to a CSS class name. Single source
// of truth for both badge and matrix-cell styling. First match wins; specific
// predicates appear before general ones.
function statusToClass(status) {
  if (!status) return 'gap';
  const s = String(status).toLowerCase();
  if (s.includes('delay')) return 'delayed';
  if (s.includes('under review') || s.includes('underway') || s.includes('review')) return 'in-progress';
  if (s.includes('accepted') || s.includes('scoping') || s.includes('in progress') || s.includes('preparation')) return 'in-progress';
  if (s.includes('operating') || s.includes('renewed') || s.includes('issued') || s === 'approved' || s.includes('complete')) return 'complete';
  if (s.includes('pre-application') || s.includes('engagement') || s.includes('mou')) return 'pre-app';
  if (s === 'not filed') return 'not-filed';
  if (s === 'projected') return 'projected';
  if (s === 'gap') return 'gap';
  return 'pending';
}

function statusBadge(status) {
  if (!status) return '<span class="badge gap">unknown</span>';
  return `<span class="badge ${statusToClass(status)}">${escapeHtml(status)}</span>`;
}

// ---------------------------------------------------------------------------
// Permit semantics

// Map a permit to its matrix-column key. Stormwater is checked before TPDES
// because both contain "TPDES" in the permit_type. Returns null if the permit
// doesn't fit any column (renders as N/A).
function permitToColumn(p) {
  if (p.agency === 'NRC') return 'NRC';
  if (p.agency === 'ERCOT') return 'ERCOT';
  if (p.agency === 'DSHS') return 'DSHS';
  if (p.permit_type.includes('Stormwater')) return 'TCEQ-STORM';
  if (p.permit_type.includes('Air')) return 'TCEQ-AIR';
  if (p.permit_type.includes('Water Rights')) return 'TCEQ-WATER';
  if (p.permit_type.includes('TPDES') || p.permit_type.includes('Wastewater')) return 'TCEQ-TPDES';
  return null;
}

// Of N permits in the same matrix cell, return the most active per
// STATUS_PRIORITY (Under Review > GAP > Not Filed > Pre-Application >
// Projected > Approved). Settles ACU's {CP=Approved, OL=GAP} on GAP.
function pickMostActive(permits) {
  if (permits.length === 0) return null;
  if (permits.length === 1) return permits[0];
  return permits.reduce((best, p) =>
    (STATUS_PRIORITY[p.status] || 0) > (STATUS_PRIORITY[best.status] || 0) ? p : best
  , permits[0]);
}

// True for legacy/operational permits at existing reactor sites. A milestone-
// less permit on these projects is "historical, not tracked" — not a data gap.
function isHistoricalPermit(permit, project) {
  if (project && isOperating(project) && permit.status === STATUS.APPROVED) return true;
  return /existing|pre-1988|pre-1990|operational/i.test((permit.notes || '') + ' ' + (permit.permit_type || ''));
}

function groupPermitsByAgency(permits) {
  const groups = {};
  permits.forEach(p => {
    if (!groups[p.agency]) groups[p.agency] = [];
    groups[p.agency].push(p);
  });
  return groups;
}
