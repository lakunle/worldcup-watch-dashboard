#!/usr/bin/env python3
"""Generate data/matches.json from Wikipedia's 2026 FIFA World Cup fixture boxes.

No third-party dependencies. Broadcast fields are seeded from known tournament rights
and can be overridden manually in data/broadcast-overrides.json.
"""
from __future__ import annotations

import datetime as dt
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SOURCE_URL = "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup"

MONTHS = {m: i for i, m in enumerate([
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
], 1)}

DEFAULT_BROADCAST = {
    "US": "TBD per match — expected rights holders: FOX / FS1; Spanish: Telemundo / Universo",
    "UK": "TBD per match — expected rights holders: BBC / ITV split",
    "streamingUS": "TBD per match — check FOX Sports app/FoxSports.com, Fubo, YouTube TV/Hulu Live/Sling where FOX/FS1 is carried; Spanish stream: Peacock/Telemundo app where available",
    "streamingUK": "TBD per match — BBC iPlayer or ITVX depending on BBC/ITV allocation",
    "lastVerified": "Seeded rights-holder defaults; exact per-match broadcast not yet verified",
}


def strip_tags(s: str) -> str:
    s = re.sub(r"<style[\s\S]*?</style>", " ", s)
    s = re.sub(r"<sup[\s\S]*?</sup>", " ", s)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s).replace("\xa0", " ")
    return re.sub(r"\s+", " ", s).strip()


def first_anchor_text(block: str) -> str:
    # Prefer linked team/placeholder text; fall back to tag-stripped text.
    anchors = re.findall(r"<a [^>]*>(.*?)</a>", block, re.S)
    clean = [strip_tags(a) for a in anchors if strip_tags(a)]
    if clean:
        return clean[-1]
    return strip_tags(block)


def parse_date(date_text: str, time_text: str) -> str:
    # e.g. June 11, 2026 and 1:00 p.m. UTC−6
    date_text = strip_tags(date_text)
    time_text = strip_tags(time_text).replace("−", "-").replace("–", "-")
    m = re.search(r"([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})", date_text)
    if not m:
        raise ValueError(f"Could not parse date: {date_text!r}")
    month, day, year = MONTHS[m.group(1)], int(m.group(2)), int(m.group(3))
    tm = re.search(r"(\d{1,2}):(\d{2})\s*([ap])\.m\.\s*UTC([+-]\d+)", time_text, re.I)
    if not tm:
        raise ValueError(f"Could not parse time: {time_text!r}")
    hour, minute = int(tm.group(1)), int(tm.group(2))
    if tm.group(3).lower() == "p" and hour != 12:
        hour += 12
    if tm.group(3).lower() == "a" and hour == 12:
        hour = 0
    offset = int(tm.group(4))
    local_tz = dt.timezone(dt.timedelta(hours=offset))
    local = dt.datetime(year, month, day, hour, minute, tzinfo=local_tz)
    return local.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def infer_stage(match_number: int) -> str:
    if match_number <= 72:
        return "Group stage"
    if match_number <= 104:
        return "Knockout stage"
    return "Unknown"


def load_json(path: Path, default):
    return json.loads(path.read_text()) if path.exists() else default


def main() -> int:
    req = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "Mozilla/5.0"})
    source = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "ignore")

    boxes = re.findall(r"<div itemscope=\"\" itemtype=\"http&#58;//schema.org/SportsEvent\" class=\"footballbox\"[\s\S]*?(?=<link rel=\"mw-deduplicated-inline-style\"|<h2|<h3|<h4|<div class=\"navbox|</body>)", source)
    matches = []
    for box in boxes:
        date_m = re.search(r"<div class=\"fdate\">([\s\S]*?)</div>", box)
        time_m = re.search(r"<div class=\"ftime\">([\s\S]*?)</div>", box)
        home_m = re.search(r"<th class=\"fhome\"[\s\S]*?</th>", box)
        away_m = re.search(r"<th class=\"faway\"[\s\S]*?</th>", box)
        score_m = re.search(r"<th class=\"fscore\"[\s\S]*?>([\s\S]*?)</th>", box)
        venue_m = re.search(r"<div class=\"fright\">([\s\S]*?)</div></div></div>", box)
        if not all([date_m, time_m, home_m, away_m, score_m, venue_m]):
            continue
        score_text = strip_tags(score_m.group(1))
        num_m = re.search(r"Match\s+(\d+)", score_text)
        if not num_m:
            continue
        match_number = int(num_m.group(1))
        matches.append({
            "id": f"M{match_number:03d}",
            "matchNumber": match_number,
            "stage": infer_stage(match_number),
            "utcDateTime": parse_date(date_m.group(1), time_m.group(1)),
            "homeTeam": first_anchor_text(home_m.group(0)),
            "awayTeam": first_anchor_text(away_m.group(0)),
            "venue": strip_tags(venue_m.group(1)),
            "status": "scheduled",
            "score": None,
            "stats": None,
            "highlightsUrl": "",
            "broadcast": dict(DEFAULT_BROADCAST),
            "sourceUrl": SOURCE_URL,
        })

    matches.sort(key=lambda x: (x["matchNumber"], x["utcDateTime"]))

    overrides = load_json(DATA / "broadcast-overrides.json", {})
    for m in matches:
        if m["id"] in overrides:
            m.update(overrides[m["id"]])

    if len(matches) < 100:
        raise RuntimeError(f"Parsed only {len(matches)} matches; expected 104")

    out = DATA / "matches.json"
    out.write_text(json.dumps(matches, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {len(matches)} matches to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
