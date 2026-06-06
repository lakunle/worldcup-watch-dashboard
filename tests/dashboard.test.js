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
