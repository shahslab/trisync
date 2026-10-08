#!/usr/bin/env python3
"""Builds TriSync's plan library from free triathlon training plans exported as CSV.

Usage: python3 scripts/build-plan-library.py "<folder of CSVs>"

Each CSV is named like "70.3_Beginner_8-Weeks.csv" and has the columns
Week, Phase, Day, Session, Duration/Distance, Workout, Intensity, Details.

Writes public/plans/<id>.json (one plan's workouts, fetched when a user picks it) and
src/plans/planLibrary.js (the index the app lists).
"""
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
DISTANCES = {'Sprint': 'sprint', 'Olympic': 'olympic', '70.3': '70.3', '140.6': '140.6'}
LEVELS = ['Beginner', 'Intermediate', 'Advanced']

# Spelling fixes for workout names in the source files
NAME_FIXES = {
    'bike': 'Bike', 'run off the': 'Run Off The Bike', 'open water system': 'Open Water Swim',
    'strength and conditionng': 'Strength and Conditioning', 'race practice': 'Race Practice Ride',
    'bike (optional)': 'Optional Bike',
}


def clean_name(raw):
    name = re.sub(r'\s+', ' ', raw).strip()
    name = re.sub(r'\bBIke\b', 'Bike', name)
    name = NAME_FIXES.get(name.lower(), name)
    return re.sub(r'\bthe Bike\b', 'The Bike', name, flags=re.I)


def workout_type(name):
    """Maps a workout name to a TriSync type, or None for rows that aren't workouts."""
    low = name.lower()
    if not low or 'rest day' in low or low == 'race day':
        return None
    if 'strength' in low:
        return 'Strength'
    if 'run off the bike' in low:
        return 'RunOffBike'  # resolved to Brick (or Run) once the whole day is known
    if 'swim' in low:
        return 'Swim'
    if 'bike' in low or 'ride' in low:
        return 'Bike'
    if 'run' in low:
        return 'Run'
    raise ValueError(f'Unknown workout name: {name!r}')


def clean_duration(raw, wtype):
    """Normalises durations ("1hr 20 mins", "42:30 mins", "25 mns") and swim distances."""
    text = re.sub(r'\s+', ' ', raw).strip()
    if not text:
        return ''
    if re.fullmatch(r'\d+', text):
        return f'{text} m' if wtype == 'Swim' else f'{text} mins'
    m = re.fullmatch(r'(\d+) ?[:;](\d+) mins', text)  # 42:30 mins = 42 mins 30 secs
    if m:
        return f'{m.group(1)} mins {m.group(2)} secs'
    hours = re.search(r'(\d+) ?(?:hrs?|hours?)\b', text)
    mins = re.search(r'(\d+) ?(?:mins?|mns)\b', text)
    secs = re.search(r'(\d+) ?secs?\b', text)
    parts = []
    if hours:
        parts.append(f"{hours.group(1)} {'hr' if hours.group(1) == '1' else 'hrs'}")
    if mins:
        parts.append(f"{mins.group(1)} {'min' if mins.group(1) == '1' else 'mins'}")
    if secs:
        parts.append(f'{secs.group(1)} secs')
    if not parts:
        raise ValueError(f'Unknown duration: {raw!r}')
    return ' '.join(parts)


def clean_intensity(raw):
    text = re.sub(r'\s*/+\s*', '/', raw.strip())
    # A few rows have a duration or "Good Luck!" typed in this column
    if not text or re.search(r'\d+ ?(?:hrs?|mins?)\b|luck', text, re.I):
        return ''
    text = re.sub(r'Thre?s?hh?old|Theshold', 'Threshold', text)
    text = re.sub(r'\bTemp\b', 'Tempo', text)
    text = re.sub(r'Mod\.(?=\S)', 'Mod. ', text)
    text = re.sub(r'V\.(?=\S)', 'V. ', text)
    return text.replace('(VO2 Max)', 'VO2 Max')


def convert(path):
    weeks_label = re.search(r'(\d+)-Weeks', path.stem).group(1)
    distance_label, level = path.stem.split('_')[:2]
    weeks = int(weeks_label)
    rows = list(csv.DictReader(path.open(encoding='utf-8-sig')))
    if max(int(r['Week']) for r in rows) != weeks:
        raise ValueError(f'{path.name}: week count does not match the file name')

    workouts = []
    for r in rows:
        name = clean_name(r['Workout'])
        wtype = workout_type(name)
        if wtype is None:
            continue
        workouts.append({
            'week': int(r['Week']),
            'day': DAYS.index(r['Day'].strip().upper()),
            'session': int(r['Session'] or 1),
            'type': wtype,
            'name': name,
            'duration': clean_duration(r['Duration/Distance'], 'Swim' if wtype == 'Swim' else wtype),
            'intensity': clean_intensity(r['Intensity']),
            'details': re.sub(r'\s+', ' ', r['Details']).strip(),
        })

    # A run off the bike and that day's ride form a brick; without a ride it's a plain run
    for w in workouts:
        if w['type'] != 'RunOffBike':
            continue
        rides = [o for o in workouts if o['week'] == w['week'] and o['day'] == w['day'] and o['type'] == 'Bike']
        w['type'] = 'Brick' if rides else 'Run'
        for ride in rides:
            ride['type'] = 'Brick'

    workouts.sort(key=lambda w: (w['week'], w['day'], w['session']))
    out = []
    for w in workouts:
        # Title: the session's own name when it says more than the type, then its length
        shown_name = '' if w['name'] in (w['type'], 'Strength and Conditioning') else w['name']
        if w['type'] == 'Brick' and w['name'] == 'Bike':
            shown_name = 'Bike'
        title = ' · '.join(p for p in [shown_name, w['duration']] if p)
        notes = '\n\n'.join(p for p in [w['intensity'] and f"Intensity: {w['intensity']}", w['details']] if p)
        out.append({'week': w['week'], 'day': w['day'], 'type': w['type'], 'title': title, 'notes': notes})

    return {
        'id': f"{DISTANCES[distance_label].replace('.', '')}-{level.lower()}-{weeks}",
        'distance': distance_label,
        'level': level,
        'weeks': weeks,
        'workouts': out,
    }


def main(folder):
    plans = sorted(
        (convert(p) for p in Path(folder).glob('*.csv')),
        key=lambda p: (list(DISTANCES).index(p['distance']), LEVELS.index(p['level']), p['weeks']),
    )
    out_dir = ROOT / 'public' / 'plans'
    out_dir.mkdir(parents=True, exist_ok=True)
    for plan in plans:
        (out_dir / f"{plan['id']}.json").write_text(json.dumps(plan['workouts'], ensure_ascii=False, separators=(',', ':')))

    index = [{k: p[k] for k in ('id', 'distance', 'level', 'weeks')} | {'count': len(p['workouts'])} for p in plans]
    lines = ',\n'.join(f'  {json.dumps(entry)}' for entry in index)
    (ROOT / 'src' / 'plans' / 'planLibrary.js').write_text(
        '// Generated by scripts/build-plan-library.py. Do not edit.\n'
        '// Each plan\'s workouts live in public/plans/<id>.json and are fetched when chosen.\n'
        f'export const PLAN_LIBRARY = [\n{lines},\n]\n'
    )
    print(f'Wrote {len(plans)} plans, {sum(len(p["workouts"]) for p in plans)} workouts')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
