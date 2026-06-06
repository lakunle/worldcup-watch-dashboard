const [matches, unitedPlayers, teams] = await Promise.all([
  fetch('./data/matches.json').then(r => r.json()),
  fetch('./data/man-utd-players.json').then(r => r.json()),
  fetch('./data/teams.json').then(r => r.json()),
]);

const state = {
  search: '',
  stage: 'all',
  status: 'all',
  continent: 'all',
  unitedOnly: false,
};

const $ = (id) => document.getElementById(id);
const collator = new Intl.Collator(undefined, { numeric: true });

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function teamMeta(team) {
  return teams[team] || { continent: 'TBD', flagCode: '' };
}

function flagHtml(team) {
  const meta = teamMeta(team);
  if (!meta.flagCode) return '<span class="flag-fallback" aria-hidden="true">⚽</span>';
  return `<img class="flag" src="https://flagcdn.com/${escapeHtml(meta.flagCode)}.svg" alt="${escapeHtml(team)} flag" loading="lazy" />`;
}

function teamPill(team) {
  return `<span class="team-pill">${flagHtml(team)}<span>${escapeHtml(team)}</span></span>`;
}

function playersForMatch(match) {
  return [match.homeTeam, match.awayTeam].flatMap(team =>
    (unitedPlayers[team] || []).map(player => ({ team, player }))
  );
}

function hasUnitedInterest(match) {
  return playersForMatch(match).length > 0;
}

function hasContinentInterest(match) {
  if (state.continent === 'all') return true;
  return [match.homeTeam, match.awayTeam].some(team => teamMeta(team).continent === state.continent);
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
  const stats = match.stats ? Object.entries(match.stats).map(([k, v]) => `<span class="badge">${escapeHtml(k)}: ${escapeHtml(v)}</span>`).join('') : '<span class="small">Stats not loaded</span>';
  const highlights = match.highlightsUrl ? `<div><a href="${escapeHtml(match.highlightsUrl)}" target="_blank" rel="noreferrer">Watch highlights</a></div>` : '<div class="small">Highlights link not loaded</div>';
  return `${score}<div>${stats}</div>${highlights}`;
}

function matchText(match) {
  const teamData = [match.homeTeam, match.awayTeam].flatMap(team => [teamMeta(team).continent, teamMeta(team).flagCode]);
  return [match.id, match.matchNumber, match.stage, match.homeTeam, match.awayTeam, match.venue, match.broadcast.US, match.broadcast.UK, match.broadcast.streamingUS, match.broadcast.streamingUK, ...teamData, ...playersForMatch(match).map(p => p.player)].join(' ').toLowerCase();
}

function filteredMatches() {
  return matches.filter(match => {
    if (state.stage !== 'all' && match.stage !== state.stage) return false;
    if (state.status !== 'all' && match.status !== state.status) return false;
    if (!hasContinentInterest(match)) return false;
    if (state.unitedOnly && !hasUnitedInterest(match)) return false;
    if (state.search && !matchText(match).includes(state.search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => collator.compare(a.id, b.id));
}

function metaBadges(match, players) {
  return `<div class="match-title">#${match.matchNumber}</div><span class="badge">${escapeHtml(match.stage)}</span><span class="badge">${escapeHtml(match.status)}</span>${players.length ? '<span class="badge united">United interest</span>' : ''}`;
}

function fixtureHtml(match) {
  return `<div class="fixture-line">${teamPill(match.homeTeam)}<span class="versus">vs</span>${teamPill(match.awayTeam)}</div>`;
}

function broadcastHtml(match, market) {
  if (market === 'US') {
    return `<div class="watch-label">US</div><div class="channel"><strong>TV:</strong> ${escapeHtml(match.broadcast.US)}</div><div class="small channel"><strong>Stream:</strong> ${escapeHtml(match.broadcast.streamingUS || 'TBD')}</div><div class="small">${escapeHtml(match.broadcast.lastVerified || '')}</div>`;
  }
  return `<div class="watch-label">UK</div><div class="channel"><strong>TV:</strong> ${escapeHtml(match.broadcast.UK)}</div><div class="small channel"><strong>Stream:</strong> ${escapeHtml(match.broadcast.streamingUK || 'TBD')}</div>`;
}

function playersHtml(players) {
  return players.length ? `<div class="players">Man Utd: ${players.map(p => `${escapeHtml(p.player)} (${escapeHtml(p.team)})`).join(', ')}</div>` : '';
}

function renderRows(list) {
  const rows = $('matchRows');
  rows.innerHTML = '';
  const template = $('rowTemplate');
  if (!list.length) {
    rows.innerHTML = '<tr><td colspan="7" class="empty">No matches match these filters.</td></tr>';
    return;
  }
  for (const match of list) {
    const node = template.content.firstElementChild.cloneNode(true);
    const players = playersForMatch(match);
    node.classList.toggle('united', players.length > 0);
    node.classList.toggle('completed', match.status === 'completed');
    node.querySelector('.match-meta').innerHTML = metaBadges(match, players);
    const dates = formatDate(match.utcDateTime);
    node.querySelector('.date-cell').innerHTML = `<div>${dates.main}</div><div class="small">UK: ${dates.uk}</div><div class="small">US East: ${dates.usEast}</div>`;
    node.querySelector('.fixture-cell').innerHTML = `${fixtureHtml(match)}${playersHtml(players)}`;
    node.querySelector('.venue-cell').textContent = match.venue;
    node.querySelector('.broadcast-us').innerHTML = broadcastHtml(match, 'US');
    node.querySelector('.broadcast-uk').innerHTML = broadcastHtml(match, 'UK');
    node.querySelector('.result-cell').innerHTML = resultHtml(match);
    rows.appendChild(node);
  }
}

function renderCards(list) {
  const cards = $('matchCards');
  cards.innerHTML = '';
  const template = $('cardTemplate');
  if (!list.length) {
    cards.innerHTML = '<div class="empty card-empty">No matches match these filters.</div>';
    return;
  }
  for (const match of list) {
    const node = template.content.firstElementChild.cloneNode(true);
    const players = playersForMatch(match);
    const dates = formatDate(match.utcDateTime);
    node.classList.toggle('united', players.length > 0);
    node.classList.toggle('completed', match.status === 'completed');
    node.querySelector('.card-meta').innerHTML = `<span>#${match.matchNumber}</span><span>${escapeHtml(match.stage)}</span>`;
    node.querySelector('.card-status').textContent = match.status;
    node.querySelector('.card-fixture').innerHTML = fixtureHtml(match);
    node.querySelector('.card-time').innerHTML = `<strong>${dates.main}</strong><span>UK ${dates.uk} · US East ${dates.usEast}</span>`;
    node.querySelector('.card-venue').textContent = match.venue;
    node.querySelector('.card-players').innerHTML = playersHtml(players);
    node.querySelector('.card-us').innerHTML = broadcastHtml(match, 'US');
    node.querySelector('.card-uk').innerHTML = broadcastHtml(match, 'UK');
    node.querySelector('.card-result').innerHTML = resultHtml(match);
    cards.appendChild(node);
  }
}

function renderMatches() {
  const list = filteredMatches();
  renderRows(list);
  renderCards(list);
}

function renderSummary() {
  const now = Date.now();
  const united = matches.filter(hasUnitedInterest);
  const upcoming = matches.filter(m => new Date(m.utcDateTime).getTime() > now);
  const completed = matches.filter(m => m.status === 'completed');
  const african = matches.filter(m => [m.homeTeam, m.awayTeam].some(team => teamMeta(team).continent === 'Africa'));
  $('summary').innerHTML = [
    ['Total matches', matches.length],
    ['African-team matches', african.length],
    ['United-interest', united.length],
    ['Upcoming', upcoming.length],
    ['Completed', completed.length],
  ].map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join('');

  const next = united.filter(m => new Date(m.utcDateTime).getTime() > now).sort((a,b) => new Date(a.utcDateTime) - new Date(b.utcDateTime))[0];
  if (next) {
    const d = formatDate(next.utcDateTime);
    $('nextUnitedMatch').innerHTML = `${fixtureHtml(next)}<div class="next-time">${d.main}</div><span class="small">${playersForMatch(next).map(p => `${escapeHtml(p.player)} (${escapeHtml(p.team)})`).join(', ')}</span>`;
  } else {
    $('nextUnitedMatch').textContent = 'No future United-interest matches in the data.';
  }
}

function render() {
  renderSummary();
  renderMatches();
}

$('search').addEventListener('input', e => { state.search = e.target.value; renderMatches(); });
$('stageFilter').addEventListener('change', e => { state.stage = e.target.value; renderMatches(); });
$('statusFilter').addEventListener('change', e => { state.status = e.target.value; renderMatches(); });
$('continentFilter').addEventListener('change', e => { state.continent = e.target.value; renderMatches(); });
$('unitedOnly').addEventListener('change', e => { state.unitedOnly = e.target.checked; renderMatches(); });

render();
