import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const matches = JSON.parse(fs.readFileSync(new URL('../data/matches.json', import.meta.url), 'utf8'));
const unitedPlayers = JSON.parse(fs.readFileSync(new URL('../data/man-utd-players.json', import.meta.url), 'utf8'));

function hasUnitedInterest(match) {
  const countries = [match.homeTeam, match.awayTeam];
  return countries.flatMap(country => unitedPlayers[country] || []).length > 0;
}

test('all matches have required dashboard fields', () => {
  assert.ok(matches.length >= 100, `expected full World Cup schedule, got ${matches.length}`);
  for (const m of matches) {
    assert.ok(m.id, 'id missing');
    assert.ok(m.matchNumber, `matchNumber missing for ${m.id}`);
    assert.ok(m.utcDateTime, `utcDateTime missing for ${m.id}`);
    assert.ok(m.homeTeam, `homeTeam missing for ${m.id}`);
    assert.ok(m.awayTeam, `awayTeam missing for ${m.id}`);
    assert.ok(m.venue, `venue missing for ${m.id}`);
    assert.ok(m.broadcast?.US, `US broadcast missing for ${m.id}`);
    assert.ok(m.broadcast?.UK, `UK broadcast missing for ${m.id}`);
    assert.ok(m.broadcast?.streamingUS, `US streaming missing for ${m.id}`);
    assert.ok(m.broadcast?.streamingUK, `UK streaming missing for ${m.id}`);
    assert.ok(m.broadcast?.lastVerified, `broadcast verification note missing for ${m.id}`);
    assert.ok(Object.hasOwn(m, 'highlightsUrl'), `highlightsUrl missing for ${m.id}`);
  }
});

test('manchester united country matches are discoverable', () => {
  const unitedMatches = matches.filter(hasUnitedInterest);
  assert.ok(unitedMatches.length > 0, 'expected at least one match involving a Man United player country');
  assert.ok(unitedMatches.some(m => [m.homeTeam, m.awayTeam].includes('England')), 'expected England matches to be highlighted');
});

test('completed match shape supports scores, stats and highlights', () => {
  const sample = matches[0];
  assert.ok(sample.score && typeof sample.score.home === 'number' || sample.score === null);
  assert.ok(sample.stats === null || typeof sample.stats === 'object');
});

test('team metadata powers flags and African country filtering', () => {
  const teams = JSON.parse(fs.readFileSync(new URL('../data/teams.json', import.meta.url), 'utf8'));
  const concreteTeams = new Set(
    matches
      .flatMap(m => [m.homeTeam, m.awayTeam])
      .filter(team => !/^(Winner|Runner-up|Loser|3rd Group)/.test(team))
  );

  for (const team of concreteTeams) {
    assert.ok(teams[team], `team metadata missing for ${team}`);
    assert.ok(teams[team].continent, `continent missing for ${team}`);
    assert.ok(teams[team].flagCode, `flagCode missing for ${team}`);
  }

  const africanTeams = Object.entries(teams).filter(([, meta]) => meta.continent === 'Africa').map(([team]) => team);
  assert.deepEqual(
    africanTeams.sort(),
    ['Algeria', 'Cape Verde', 'DR Congo', 'Egypt', 'Ghana', 'Ivory Coast', 'Morocco', 'Senegal', 'South Africa', 'Tunisia'].sort()
  );
});

test('mobile-first interface exposes African filters and card layout hooks', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(html, /id="continentFilter"/, 'continent filter select should exist');
  assert.match(html, /value="Africa"/, 'Africa filter option should exist');
  assert.match(html, /class="match-card"/, 'mobile card template should exist');
  assert.match(css, /@media \(max-width: 760px\)/, 'mobile breakpoint should be optimized for phones');
  assert.match(css, /\.match-card/, 'match cards should be styled');
});

test('mobile filters are collapsible to avoid covering the viewport', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const js = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

  assert.match(html, /id="filterToggle"/, 'filter toggle button should exist');
  assert.match(html, /id="filterPanel"/, 'collapsible filter panel should exist');
  assert.match(html, /aria-expanded="false"/, 'filters should start collapsed on mobile');
  assert.match(css, /\.filter-panel\[hidden\]/, 'hidden filter panel should be removed from layout');
  assert.match(js, /filterToggle/, 'filter toggle should be wired in JavaScript');
});

test('dark mode toggle and theme styles are present', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const js = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

  assert.match(html, /id="themeToggle"/, 'dark mode toggle should exist');
  assert.match(css, /\[data-theme="dark"\]/, 'dark theme CSS variables should exist');
  assert.match(js, /localStorage\.setItem\('watch26-theme'/, 'theme preference should persist');
});

test('friendly matches are available for the preparation section', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const friendlies = JSON.parse(fs.readFileSync(new URL('../data/friendlies.json', import.meta.url), 'utf8'));

  assert.match(html, /id="friendlyCards"/, 'friendly matches section should exist');
  assert.ok(friendlies.length >= 10, `expected a useful friendly schedule, got ${friendlies.length}`);
  assert.ok(friendlies.some(m => m.homeTeam === 'England' && m.awayTeam === 'New Zealand'), 'England v New Zealand friendly should be included');
  assert.ok(friendlies.some(m => m.tv?.US?.includes('TBS') || m.streaming?.US?.includes('HBO Max')), 'known US viewing options should be captured where available');
  for (const m of friendlies) {
    assert.ok(m.date, `friendly date missing for ${m.id}`);
    assert.ok(m.homeTeam, `homeTeam missing for ${m.id}`);
    assert.ok(m.awayTeam, `awayTeam missing for ${m.id}`);
    assert.ok(m.venue, `venue missing for ${m.id}`);
    assert.ok(m.sourceUrl, `sourceUrl missing for ${m.id}`);
  }
});

test('played friendlies expose scores and highlight links when verified', () => {
  const friendlies = JSON.parse(fs.readFileSync(new URL('../data/friendlies.json', import.meta.url), 'utf8'));
  const js = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

  const completed = friendlies.filter(m => m.status === 'completed');
  assert.ok(completed.length >= 10, `expected completed friendlies to be updated, got ${completed.length}`);
  assert.ok(completed.some(m => m.homeTeam === 'United States' && m.awayTeam === 'Germany' && m.score?.home === 1 && m.score?.away === 2), 'USA v Germany score should be loaded');
  assert.ok(completed.some(m => m.homeTeam === 'England' && m.awayTeam === 'New Zealand' && m.score?.home === 1 && m.score?.away === 0), 'England v New Zealand score should be loaded');
  assert.ok(friendlies.some(m => m.highlightsUrl?.includes('youtube.com/watch')), 'verified YouTube highlight links should be included when available');
  assert.match(js, /function friendlyResultHtml/, 'friendlies should render score and highlight state');
  assert.match(js, /Watch highlights/, 'friendlies should include highlight links in the card UI');
});

test('search also filters preparation friendlies so England v New Zealand is easy to find', () => {
  const js = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

  assert.match(js, /function friendlyText/, 'friendlies should expose searchable text');
  assert.match(js, /function filteredFriendlies/, 'friendlies should have their own filtered list');
  assert.match(js, /renderFriendlies\(\);/, 'search input should re-render friendlies as well as World Cup matches');
});

test('match and friendly times are displayed in West African Time', () => {
  const js = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

  assert.match(js, /timeZone: 'Africa\/Lagos'/, 'World Cup fixtures should be formatted in WAT');
  assert.match(js, /WAT/, 'UI should label displayed times as WAT');
  assert.match(js, /function formatFriendlyTimeWat/, 'friendlies should convert listed ET or BST times to WAT');
  assert.doesNotMatch(js, /US East:/, 'match cards should not prioritize US Eastern time');
});
