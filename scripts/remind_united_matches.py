#!/usr/bin/env python3
"""Emit a reminder when a Man United-interest World Cup match is ~15 minutes away.

Designed for Hermes cron no_agent=True: print nothing when no alert is due.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
STATE = DATA / "reminder-state.json"
WINDOW_BEFORE = dt.timedelta(minutes=15)
TOLERANCE = dt.timedelta(minutes=3)


def parse_iso(value: str) -> dt.datetime:
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def load(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text())


def fmt(instant: dt.datetime, zone: str) -> str:
    return instant.astimezone(ZoneInfo(zone)).strftime("%a %d %b, %H:%M %Z")


def main() -> int:
    matches = load(DATA / "matches.json", [])
    players = load(DATA / "man-utd-players.json", {})
    state = load(STATE, {"sent": []})
    sent = set(state.get("sent", []))
    now = dt.datetime.now(dt.timezone.utc)
    due = []

    for match in matches:
        united = []
        for team in [match["homeTeam"], match["awayTeam"]]:
            for player in players.get(team, []):
                united.append(f"{player} ({team})")
        if not united or match["id"] in sent:
            continue
        kickoff = parse_iso(match["utcDateTime"])
        delta = kickoff - now
        if WINDOW_BEFORE - TOLERANCE <= delta <= WINDOW_BEFORE + TOLERANCE:
            due.append((kickoff, match, united))

    if not due:
        return 0

    due.sort(key=lambda x: x[0])
    lines = ["⏰ World Cup Man United-player reminder"]
    for kickoff, match, united in due:
        lines.append("")
        lines.append(f"{match['homeTeam']} vs {match['awayTeam']} kicks off in about 15 minutes")
        lines.append(f"Match #{match['matchNumber']} • {match['venue']}")
        lines.append(f"US TV: {match['broadcast']['US']}")
        lines.append(f"US stream: {match['broadcast'].get('streamingUS', 'TBD')}")
        lines.append(f"UK TV: {match['broadcast']['UK']}")
        lines.append(f"UK stream: {match['broadcast'].get('streamingUK', 'TBD')}")
        lines.append(f"Man Utd interest: {', '.join(united)}")
        sent.add(match["id"])

    STATE.write_text(json.dumps({"sent": sorted(sent), "updatedAt": now.isoformat()}, indent=2) + "\n")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
