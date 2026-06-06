# World Cup 2026 Watch Dashboard

A local dashboard for tracking all 104 FIFA World Cup 2026 matches, highlighting matches involving countries with Manchester United player candidates, and sending Telegram reminders 15 minutes before those matches.

## Run locally

```bash
cd /home/heckler/worldcup-dashboard
npm run serve
```

Open: http://127.0.0.1:8765/

## Data files

- `data/matches.json` — all fixtures, status, score, stats, highlights, and US/UK broadcast fields.
- `data/man-utd-players.json` — editable country → Manchester United player mapping used for highlights/reminders.
- `data/broadcast-overrides.json` — optional file for match-specific TV/IPTV channel and streaming overrides.

Current broadcast fields per match:

- `broadcast.US` — exact US TV channel once available.
- `broadcast.UK` — exact UK TV channel once available.
- `broadcast.streamingUS` — online streaming services/apps for the US.
- `broadcast.streamingUK` — online streaming services/apps for the UK.
- `broadcast.lastVerified` — note/timestamp/source for the broadcast data.

Seeded rights-holder assumptions until per-match schedules are published:

- US TV: FOX / FS1; Spanish: Telemundo / Universo.
- US streaming: FOX Sports app/FoxSports.com, Fubo, YouTube TV/Hulu Live/Sling where FOX/FS1 is carried; Spanish: Peacock/Telemundo app where available.
- UK TV: BBC / ITV split.
- UK streaming: BBC iPlayer or ITVX depending on allocation.

Exact per-match channels can be added as they are announced by editing `data/matches.json` or by adding overrides and regenerating.

## Regenerate schedule

```bash
cd /home/heckler/worldcup-dashboard
python3 scripts/generate_schedule.py
```

The generator scrapes Wikipedia fixture boxes and writes `data/matches.json`.

## Update completed games

Edit the relevant match in `data/matches.json`:

```json
{
  "status": "completed",
  "score": { "home": 2, "away": 1 },
  "stats": { "possession": "58%–42%", "shots": "14–8" },
  "highlightsUrl": "https://..."
}
```

## Reminders

Hermes cron job installed:

- Job ID: `dbf8374aa242`
- Name: `World Cup Man United match reminders`
- Schedule: every 5 minutes
- Script: `~/.hermes/scripts/worldcup-united-reminders.py`
- Sends to this Telegram chat only when a United-interest match is about 15 minutes away.

## Verify

```bash
cd /home/heckler/worldcup-dashboard
npm test
python3 -m py_compile scripts/generate_schedule.py scripts/remind_united_matches.py
```
