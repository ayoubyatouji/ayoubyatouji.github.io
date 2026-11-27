#!/usr/bin/env python3
"""Summarize numeric columns in a local CSV file. No network access is used."""

import argparse
import csv
import math
import sys
from pathlib import Path


def summarize(path: Path) -> list[tuple[str, int, float, float, float]]:
    with path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if not reader.fieldnames:
            raise ValueError("CSV must include a header row.")

        values = {name: [] for name in reader.fieldnames if name}
        for row in reader:
            for name in values:
                try:
                    number = float(row.get(name, ""))
                except (TypeError, ValueError):
                    continue
                if math.isfinite(number):
                    values[name].append(number)

    return [
        (name, len(numbers), sum(numbers) / len(numbers), min(numbers), max(numbers))
        for name, numbers in values.items()
        if numbers
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_file", type=Path, help="Local CSV path to read")
    args = parser.parse_args()

    try:
        rows = summarize(args.csv_file)
    except (OSError, UnicodeError, csv.Error, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1

    if not rows:
        print("No finite numeric columns found.")
        return 0

    print(f"{'Column':<28} {'Count':>8} {'Mean':>14} {'Min':>14} {'Max':>14}")
    for name, count, mean, minimum, maximum in rows:
        print(f"{name[:28]:<28} {count:>8} {mean:>14.4f} {minimum:>14.4f} {maximum:>14.4f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
