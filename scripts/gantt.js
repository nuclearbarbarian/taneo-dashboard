// TANEO Permitting Dashboard — SVG Gantt chart renderer
// Adapted from Virginia PEEP model: target schedule (gray) + actual (colored)
// + delay indicators. Depends on data-loader.js for parseLocalDate, isGap,
// isHistoricalPermit, escapeHtml, fmtDate, groupPermitsByAgency.

const GANTT_COLORS = {
  ink: '#1A1A1A',
  paper: '#FDFCF9',
  newsprint: '#F5F2E8',
  warmGray: '#6B6759',
  industrialRed: '#8B2B2B',
  utilityBlue: '#2B4B6F',
  technicalGreen: '#3D5C3D',
  safetyYellow: '#C4A035',
  gray50: '#8A8A8A',
  gray30: '#B8B8B8',
  gray15: '#DCDCDC'
};

// Compute the date range across all milestones for a project. Always extends
// the range to include `referenceToday` so the TODAY marker can render even
// when all milestones are in the past (e.g., Comanche Peak renewal).
function computeDateRange(milestones, referenceToday) {
  const allDates = [];
  milestones.forEach(m => {
    const t = parseLocalDate(m.date_target);
    const a = parseLocalDate(m.date_actual);
    if (t) allDates.push(t);
    if (a) allDates.push(a);
  });
  if (allDates.length === 0) {
    const today = referenceToday || new Date();
    return { min: today, max: new Date(today.getFullYear() + 2, today.getMonth(), today.getDate()) };
  }
  if (referenceToday) allDates.push(referenceToday);
  const min = new Date(Math.min(...allDates));
  const max = new Date(Math.max(...allDates));
  min.setDate(min.getDate() - 90);
  max.setDate(max.getDate() + 90);
  return { min, max };
}

function dateToX(date, axis) {
  return ((date - axis.range.min) / (axis.range.max - axis.range.min)) * axis.width;
}

// Render time-axis gridlines (year boundaries + TODAY). When `withLabels` is
// false, returns lines only — for use as a backdrop on each milestone row,
// where year-number text would be visual noise.
function renderTimeAxis(axis, withLabels) {
  const { range, width, today } = axis;
  const startYear = range.min.getFullYear();
  const endYear = range.max.getFullYear();
  let svg = '';
  for (let y = startYear; y <= endYear; y++) {
    const tickDate = new Date(y, 0, 1);
    if (tickDate < range.min || tickDate > range.max) continue;
    const x = dateToX(tickDate, axis);
    svg += `<line x1="${x}" y1="0" x2="${x}" y2="20" stroke="${GANTT_COLORS.gray30}" stroke-width="0.5"/>`;
    if (withLabels) {
      svg += `<text x="${x + 3}" y="13" font-family="IBM Plex Mono, monospace" font-size="10" fill="${GANTT_COLORS.warmGray}">${y}</text>`;
    }
  }
  if (today >= range.min && today <= range.max) {
    const x = dateToX(today, axis);
    svg += `<line x1="${x}" y1="0" x2="${x}" y2="20" stroke="${GANTT_COLORS.industrialRed}" stroke-width="1.5"/>`;
    if (withLabels) {
      svg += `<text x="${x + 3}" y="13" font-family="IBM Plex Mono, monospace" font-size="10" font-weight="700" fill="${GANTT_COLORS.industrialRed}">TODAY</text>`;
    }
  }
  return svg;
}

function renderMilestoneBar(milestone, axis) {
  const target = parseLocalDate(milestone.date_target);
  const actual = parseLocalDate(milestone.date_actual);
  const status = milestone.status || 'Pending';
  const yCenter = 14;
  let svg = '';

  if (target) {
    const x = dateToX(target, axis);
    let stroke = GANTT_COLORS.warmGray;
    if (actual && actual <= target) stroke = GANTT_COLORS.technicalGreen;
    else if (!actual && target < axis.today) stroke = GANTT_COLORS.industrialRed;
    svg += `<polygon points="${x-5},${yCenter} ${x},${yCenter-5} ${x+5},${yCenter} ${x},${yCenter+5}" fill="${GANTT_COLORS.newsprint}" stroke="${stroke}" stroke-width="1.5"/>`;
  }

  if (actual) {
    const x = dateToX(actual, axis);
    const fill = status === 'Complete' ? GANTT_COLORS.technicalGreen : GANTT_COLORS.utilityBlue;
    svg += `<circle cx="${x}" cy="${yCenter}" r="4" fill="${fill}" stroke="${GANTT_COLORS.ink}" stroke-width="0.5"/>`;
  }

  // Connector between target and actual when both exist
  if (target && actual) {
    const lineColor = actual > target ? GANTT_COLORS.industrialRed : GANTT_COLORS.technicalGreen;
    svg += `<line x1="${dateToX(target, axis)}" y1="${yCenter}" x2="${dateToX(actual, axis)}" y2="${yCenter}" stroke="${lineColor}" stroke-width="1.5" stroke-dasharray="2,2"/>`;
  }

  // In-progress with no actual yet: dotted "projected remaining work" line
  // from today to the target. If today is past the target, the segment runs
  // from target to today and goes red to flag the delay.
  if (status === 'In Progress' && target && !actual) {
    const xTarget = dateToX(target, axis);
    const xToday = dateToX(axis.today, axis);
    if (xToday < xTarget) {
      svg += `<line x1="${xToday}" y1="${yCenter}" x2="${xTarget}" y2="${yCenter}" stroke="${GANTT_COLORS.utilityBlue}" stroke-width="1.5" stroke-dasharray="3,2"/>`;
    } else {
      svg += `<line x1="${xTarget}" y1="${yCenter}" x2="${xToday}" y2="${yCenter}" stroke="${GANTT_COLORS.industrialRed}" stroke-width="2" stroke-dasharray="3,2"/>`;
    }
  }

  return svg;
}

const GANTT_LEGEND = `
  <div style="background: var(--newsprint); padding: var(--space-sm); font-size: 11px; border-top: 1px solid var(--ink);">
    <strong style="text-transform: uppercase; letter-spacing: 0.06em; font-family: var(--mono); font-size: 10px;">Legend:</strong>
    <span style="margin-left: 12px;">◆ target date</span>
    <span style="margin-left: 12px;">● actual date</span>
    <span style="margin-left: 12px; color: var(--technical-green);">━ on or ahead of target</span>
    <span style="margin-left: 12px; color: var(--industrial-red);">━ behind target</span>
    <span style="margin-left: 12px; color: var(--utility-blue);">━ in progress</span>
  </div>`;

// Federal first, state next, ERCOT last. Unknown agencies append in
// insertion order so the schema is forward-compatible.
const PREFERRED_AGENCY_ORDER = ['NRC', 'TCEQ', 'DSHS', 'RRC', 'PUC', 'ERCOT'];

function renderGantt(permits, milestones, container, project) {
  const projectMilestones = milestones.filter(m =>
    permits.some(p => p.permit_id === m.permit_id)
  );

  const today = new Date();
  const axis = { range: computeDateRange(projectMilestones, today), width: 800, today };
  const gridlinesOnly = renderTimeAxis(axis, false);

  const groups = groupPermitsByAgency(permits);
  const agencyOrder = [
    ...PREFERRED_AGENCY_ORDER.filter(a => groups[a] && groups[a].length > 0),
    ...Object.keys(groups).filter(a => !PREFERRED_AGENCY_ORDER.includes(a))
  ];

  let html = '<div class="gantt">';
  html += '<div class="gantt-header">Permit and milestone timeline</div>';

  // Time axis header (year labels appear here, not on every milestone row)
  html += `<div class="gantt-row" style="grid-template-columns: 280px 1fr; background: var(--newsprint); border-bottom: 1px solid var(--ink);">
    <div class="gantt-label" style="background: var(--newsprint);"><span class="label-meta">Permit / milestone</span></div>
    <div class="gantt-bar-track">
      <svg viewBox="0 0 ${axis.width} 20" preserveAspectRatio="none" style="height: 20px;">
        ${renderTimeAxis(axis, true)}
      </svg>
    </div>
  </div>`;

  agencyOrder.forEach(agency => {
    const agencyPermits = groups[agency];
    if (!agencyPermits || agencyPermits.length === 0) return;

    html += `<div class="gantt-swimlane">`;
    html += `<div class="gantt-swimlane-header">${escapeHtml(agency)}</div>`;

    agencyPermits.forEach(permit => {
      const permitMilestones = projectMilestones
        .filter(m => m.permit_id === permit.permit_id)
        .sort((a, b) => a.milestone_seq - b.milestone_seq);

      html += `<div class="gantt-row" style="background: rgba(0,0,0,0.02);">
        <div class="gantt-label">
          <span class="label-name"><strong>${escapeHtml(permit.permit_type)}</strong></span>
          <span class="label-meta">${escapeHtml(permit.status)}${permit.is_critical_path ? ' • CRITICAL PATH' : ''}</span>
        </div>
        <div class="gantt-bar-track"></div>
      </div>`;

      if (permitMilestones.length === 0) {
        // Operational permits at existing reactor sites get "historical, not
        // tracked" — distinct from real data gaps for in-flight permits.
        const historical = isHistoricalPermit(permit, project);
        const label = historical
          ? '<span class="label-name placeholder-text">Historical permit; milestone-level tracking not maintained</span>'
          : '<span class="label-name placeholder-text">No milestones tracked</span><span class="label-meta">[GAP]</span>';
        html += `<div class="gantt-row">
          <div class="gantt-label">${label}</div>
          <div class="gantt-bar-track"></div>
        </div>`;
        return;
      }

      permitMilestones.forEach(m => {
        const metaText = !isGap(m.date_actual) && m.date_actual
          ? `Actual: ${fmtDate(m.date_actual)}`
          : `Target: ${fmtDate(m.date_target)}`;
        const a11ySummary = escapeHtml(
          `${m.milestone_name}. Status: ${m.status || 'Pending'}. ` +
          (m.date_target && !isGap(m.date_target) ? `Target ${fmtDate(m.date_target)}. ` : '') +
          (m.date_actual && !isGap(m.date_actual) ? `Actual ${fmtDate(m.date_actual)}.` : '')
        );
        html += `<div class="gantt-row">
          <div class="gantt-label">
            <span class="label-name">${escapeHtml(m.milestone_name)}</span>
            <span class="label-meta">${escapeHtml(m.responsible_party)} • ${metaText}</span>
          </div>
          <div class="gantt-bar-track">
            <svg viewBox="0 0 ${axis.width} 28" preserveAspectRatio="none" role="img" aria-label="${a11ySummary}">
              <title>${a11ySummary}</title>
              ${gridlinesOnly}
              ${renderMilestoneBar(m, axis)}
            </svg>
          </div>
        </div>`;
      });
    });

    html += `</div>`;
  });

  html += GANTT_LEGEND;
  html += '</div>';

  container.innerHTML = html;
}
