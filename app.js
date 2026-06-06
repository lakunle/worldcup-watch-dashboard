const [matches, unitedPlayers, teams, friendlies] = await Promise.all([
  fetch('./data/matches.json?v=202606062241').then(r => r.json()),
  fetch('./data/man-utd-players.json?v=202606062241').then(r => r.json()),
  fetch('./data/teams.json?v=202606062241').then(r => r.json()),
  fetch('./data/friendlies.json?v=202606062241').then(r => r.json()),
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

function setTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('watch26-theme', next);
  const button = $('themeToggle');
  button.textContent = next === 'dark' ? '☀️' : '🌙';
  button.setAttribute('aria-label', next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

function initTheme() {
  const saved = localStorage.getItem('watch26-theme');
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  setTheme(saved || (prefersDark ? 'dark' : 'light'));
}

function toggleFilters() {
  const panel = $('filterPanel');
  const toggle = $('filterToggle');
  const isOpening = panel.hasAttribute('hidden');
  panel.toggleAttribute('hidden', !isOpening);
  toggle.setAttribute('aria-expanded', String(isOpening));
}

function updateFilterSummary(count) {
  const parts = [];
  if (state.search) parts.push(`“${state.search}”`);
  if (state.stage !== 'all') parts.push(state.stage.replace(' stage', ''));
  if (state.status !== 'all') parts.push(state.status);
  if (state.continent !== 'all') parts.push(state.continent === 'Africa' ? 'Africa' : state.continent);
  if (state.unitedOnly) parts.push('United');
  $('filterSummary').textContent = `${count} matches${parts.length ? ' · ' + parts.join(' · ') : ''}`;
}

function formatDate(iso) {
  const d = new Date(iso);
  const wat = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Lagos',
  }).format(d);
  return { main: `${wat} WAT (GMT+1)` };
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
    node.querySelector('.date-cell').innerHTML = `<div>${dates.main}</div>`;
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
    node.querySelector('.card-time').innerHTML = `<strong>${dates.main}</strong>`;
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
  updateFilterSummary(list.length);
  renderRows(list);
  renderCards(list);
}

function friendlyWatchHtml(match) {
  const tv = match.tv?.US ? `<div><strong>US TV:</strong> ${escapeHtml(match.tv.US)}</div>` : '<div class="small">US TV: not listed yet</div>';
  const stream = match.streaming?.US ? `<div><strong>US stream:</strong> ${escapeHtml(match.streaming.US)}</div>` : '<div class="small">US stream: not listed yet</div>';
  return `${tv}${stream}`;
}

function friendlyResultHtml(match) {
  const status = match.statusDetail || match.status || 'Scheduled';
  if (match.status === 'completed' && match.score) {
    const score = `<div class="match-title">FT: ${escapeHtml(match.homeTeam)} ${match.score.home}–${match.score.away} ${escapeHtml(match.awayTeam)}</div>`;
    const highlights = match.highlightsUrl
      ? `<a href="${escapeHtml(match.highlightsUrl)}" target="_blank" rel="noreferrer">Watch highlights</a><span class="small"> ${escapeHtml(match.highlightsLabel || 'YouTube highlights')}</span>`
      : '<span class="small">YouTube highlights not verified yet</span>';
    const source = match.resultSourceUrl ? `<a class="source-link" href="${escapeHtml(match.resultSourceUrl)}" target="_blank" rel="noreferrer">Score source</a>` : '';
    return `<div class="friendly-result completed">${score}<div>${highlights}</div>${source}</div>`;
  }
  if (match.status === 'live' && match.score) {
    const source = match.resultSourceUrl ? `<a class="source-link" href="${escapeHtml(match.resultSourceUrl)}" target="_blank" rel="noreferrer">Live source</a>` : '';
    return `<div class="friendly-result live"><div class="match-title">Live: ${escapeHtml(match.homeTeam)} ${match.score.home}–${match.score.away} ${escapeHtml(match.awayTeam)}</div><span class="badge">${escapeHtml(status)}</span>${source}</div>`;
  }
  if (match.status === 'cancelled') {
    return `<div class="friendly-result cancelled"><span class="badge">Cancelled</span></div>`;
  }
  return `<div class="friendly-result"><span class="small">${escapeHtml(status)}</span></div>`;
}

function toTwelveHour(hour, minute) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function formatFriendlyTimeWat(match) {
  if (!match.time || /TBD/i.test(match.time)) return 'TBD WAT (GMT+1)';

  const etMatch = match.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*ET/i);
  if (etMatch) {
    let hour = Number(etMatch[1]) % 12;
    if (etMatch[3].toUpperCase() === 'PM') hour += 12;
    const minute = Number(etMatch[2]);
    return `${toTwelveHour((hour + 5) % 24, minute)} WAT (GMT+1)`;
  }

  const bstMatch = match.time.match(/(\d{1,2}):(\d{2})\s*BST/i);
  if (bstMatch) {
    return `${toTwelveHour(Number(bstMatch[1]), Number(bstMatch[2]))} WAT (GMT+1)`;
  }

  return `${match.time} WAT (GMT+1)`;
}

function friendlyText(match) {
  return [
    match.id,
    match.date,
    match.time,
    match.homeTeam,
    match.awayTeam,
    match.venue,
    match.tv?.US,
    match.streaming?.US,
    match.status,
    match.statusDetail,
    match.score?.home,
    match.score?.away,
    match.highlightsLabel,
    match.statusNote,
  ].join(' ').toLowerCase();
}

function filteredFriendlies() {
  if (!state.search) return friendlies;
  const query = state.search.toLowerCase();
  return friendlies.filter(match => friendlyText(match).includes(query));
}

function renderFriendlies() {
  const cards = $('friendlyCards');
  const list = filteredFriendlies();
  $('friendlyCount').textContent = list.length === friendlies.length ? `${friendlies.length} listed` : `${list.length} of ${friendlies.length} listed`;
  if (!list.length) {
    cards.innerHTML = '<div class="empty card-empty">No friendlies match this search.</div>';
    return;
  }
  cards.innerHTML = list.map(match => `
    <article class="friendly-card">
      <div class="card-topline">
        <div class="card-meta"><span>${escapeHtml(match.date)}</span><span>${escapeHtml(formatFriendlyTimeWat(match))}</span></div>
      </div>
      <div class="card-fixture">${fixtureHtml(match)}</div>
      ${friendlyResultHtml(match)}
      <div class="card-venue">${escapeHtml(match.venue)}</div>
      ${match.statusNote ? `<div class="notice">${escapeHtml(match.statusNote)}</div>` : ''}
      <div class="friendly-watch">${friendlyWatchHtml(match)}</div>
      <a class="source-link" href="${escapeHtml(match.sourceUrl)}" target="_blank" rel="noreferrer">Source</a>
    </article>
  `).join('');
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
  initTheme();
  renderSummary();
  renderFriendlies();
  renderMatches();
}

$('themeToggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
$('filterToggle').addEventListener('click', toggleFilters);
$('search').addEventListener('input', e => { state.search = e.target.value; renderFriendlies(); renderMatches(); });
$('stageFilter').addEventListener('change', e => { state.stage = e.target.value; renderMatches(); });
$('statusFilter').addEventListener('change', e => { state.status = e.target.value; renderMatches(); });
$('continentFilter').addEventListener('change', e => { state.continent = e.target.value; renderMatches(); });
$('unitedOnly').addEventListener('change', e => { state.unitedOnly = e.target.checked; renderMatches(); });

render();
