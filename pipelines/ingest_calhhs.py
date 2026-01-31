"""Ingest selected CalHHS datasets from the Open_claw bulk mirror.

This script will be expanded into a config-driven pipeline.

Inputs:
  - /media/brain/brain_3/Open_claw/Cal_HHS (outside this repo)

Outputs:
  - data/processed/* (derived, standardized)
"""

from pathlib import Path

CALHHS_MIRROR = Path("/media/brain/brain_3/Open_claw/Cal_HHS")


def main():
    if not CALHHS_MIRROR.exists():
        raise SystemExit(f"CalHHS mirror not found at {CALHHS_MIRROR}")

    print("Found CalHHS mirror:", CALHHS_MIRROR)
    # TODO: load CalHHS meta/manifest and select relevant datasets/resources


if __name__ == "__main__":
    main()
