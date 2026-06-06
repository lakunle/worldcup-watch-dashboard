const [matches, unitedPlayers] = await Promise.all([
  fetch('./data/matches.json').then(r => r.json()),
  fetch('./data/man-utd-players.json').then(r => r.json()),
]);

const state = {
  search: '',
  stage: 'all',
  status: 'all',
  unitedOnly: false,
};

const $ = (id) => document.getElementById(id);
const collator = new Intl.Collator(undefined, { numeric: true });

function playersForMatch(match) {
  return [match.homeTeam, match.awayTeam].flatMap(team =>
    (unitedPlayers[team] || []).map(player => ({ team, player }))
  );
}

function hasUnitedInterest(match) {
  return playersForMatch(match).length > 0;
}

function formatDate(iso) {
  const d = new Date(iso);
  return {
    main: new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(d),
    uk: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London', timeZoneName: 'short' }).format(d),
    usEast: new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' }).format(d),
  };
}

function resultHtml(match) {
  if (match.status !== 'completed') return '<span class="small">Not played yet</span>';
  const score = match.score ? `<div class="match-title">${match.score.home}–${match.score.away}</div>` : '<div class="match-title">Completed</div>';
  const stats = match.stats ? Object.entries(match.stats).map(([k, v]) => `<span class="badge">${k}: ${v}</span>`).join('') : '<span class="small">Stats not loaded</span>';
  const highlights = match.highlightsUrl ? `<div><a href="${match.highlightsUrl}" target="_blank" rel="noreferrer">Watch highlights</a></div>` : '<div class="small">Highlights link not loaded</div>';
  return `${score}<div>${stats}</div>${highlights}`;
}

function matchText(match) {
  return [match.id, match.matchNumber, match.stage, match.homeTeam, match.awayTeam, match.venue, match.broadcast.US, match.broadcast.UK, ...playersForMatch(match).map(p => p.player)].join(' ').toLowerCase();
}

function filteredMatches() {
  return matches.filter(match => {
    if (state.stage !== 'all' && match.stage !== state.stage) return false;
    if (state.status !== 'all' && match.status !== state.status) return false;
    if (state.unitedOnly && !hasUnitedInterest(match)) return false;
    if (state.search && !matchText(match).includes(state.search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => collator.compare(a.id, b.id));
}

function renderRows() {
  const rows = $('matchRows');
  rows.innerHTML = '';
  const template = $('rowTemplate');
  const list = filteredMatches();
  if (!list.length) {
    rows.innerHTML = '<tr><td colspan="7" class="empty">No matches match these filters.</td></tr>';
    return;
  }
  for (const match of list) {
    const node = template.content.firstElementChild.cloneNode(true);
    const players = playersForMatch(match);
    node.classList.toggle('united', players.length > 0);
    node.classList.toggle('completed', match.status === 'completed');
    node.querySelector('.match-meta').innerHTML = `<div class="match-title">#${match.matchNumber}</div><span class="badge">${match.stage}</span><span class="badge">${match.status}</span>${players.length ? '<span class="badge united">United interest</span>' : ''}`;
    const dates = formatDate(match.utcDateTime);
    node.querySelector('.date-cell').innerHTML = `<div>${dates.main}</div><div class="small">UK: ${dates.uk}</div><div class="small">US East: ${dates.usEast}</div>`;
    node.querySelector('.fixture-cell').innerHTML = `<div class="match-title">${match.homeTeam} vs ${match.awayTeam}</div>${players.length ? `<div class="players">Man Utd: ${players.map(p => `${p.player} (${p.team})`).join(', ')}</div>` : ''}`;
    node.querySelector('.venue-cell').textContent = match.venue;
    node.querySelector('.broadcast-us').innerHTML = `<div class="channel"><strong>TV:</strong> ${match.broadcast.US}</div><div class="small channel"><strong>Stream:</strong> ${match.broadcast.streamingUS || 'TBD'}</div><div class="small">${match.broadcast.lastVerified || ''}</div>`;
    node.querySelector('.broadcast-uk').innerHTML = `<div class="channel"><strong>TV:</strong> ${match.broadcast.UK}</div><div class="small channel"><strong>Stream:</strong> ${match.broadcast.streamingUK || 'TBD'}</div>`;
    node.querySelector('.result-cell').innerHTML = resultHtml(match);
    rows.appendChild(node);
  }
}

function renderSummary() {
  const now = Date.now();
  const united = matches.filter(hasUnitedInterest);
  const upcoming = matches.filter(m => new Date(m.utcDateTime).getTime() > now);
  const completed = matches.filter(m => m.status === 'completed');
  $('summary').innerHTML = [
    ['Total matches', matches.length],
    ['United-interest matches', united.length],
    ['Upcoming', upcoming.length],
    ['Completed', completed.length],
  ].map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join('');

  const next = united.filter(m => new Date(m.utcDateTime).getTime() > now).sort((a,b) => new Date(a.utcDateTime) - new Date(b.utcDateTime))[0];
  if (next) {
    const d = formatDate(next.utcDateTime);
    $('nextUnitedMatch').innerHTML = `<strong>${next.homeTeam} vs ${next.awayTeam}</strong><br>${d.main}<br><span class="small">${playersForMatch(next).map(p => `${p.player} (${p.team})`).join(', ')}</span>`;
  } else {
    $('nextUnitedMatch').textContent = 'No future United-interest matches in the data.';
  }
}

function render() {
  renderSummary();
  renderRows();
}

$('search').addEventListener('input', e => { state.search = e.target.value; renderRows(); });
$('stageFilter').addEventListener('change', e => { state.stage = e.target.value; renderRows(); });
$('statusFilter').addEventListener('change', e => { state.status = e.target.value; renderRows(); });
$('unitedOnly').addEventListener('change', e => { state.unitedOnly = e.target.checked; renderRows(); });

render();
