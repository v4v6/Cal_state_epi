# Cal_state_epi — California Statewide Epidemiology (Infectious Disease Emphasis)

This repository is the home for a **statewide epidemiological study + public/manager dashboards** for California, with special emphasis on:
- **infectious diseases**
- **diseases caused by microorganisms** (viral, bacterial, fungal, parasitic)

## What this repo will contain

- **Study design** (population, outcomes, exposures, methods, bias/ethics, governance)
- **Data inventory** (CalHHS open data + other CA sources)
- **ETL/ELT pipelines** to build a clean, analyzable dataset
- **Dashboards**
  - `dashboards/public/` (simple, fast, privacy-preserving)
  - `dashboards/manager/` (operational views: alerts, capacity, drill-down)

## Data sources

Primary source mirrored locally in the Open_claw workspace:
- `../Cal_HHS/` (CalHHS Open Data Portal bulk download)

This repo will reference those files and generate processed artifacts under `data/processed/`.

## GitHub Pages dashboard

This repo publishes a static dashboard from `/docs` via GitHub Pages.

Open: https://v4v6.github.io/Cal_state_epi/

## Quick start (planned)

1. Create a Python environment
2. Run the pipeline to build the analytical dataset
3. Launch the dashboard(s)

(We’ll fill in exact commands once the pipeline skeleton lands.)

## Project structure

- `docs/` — study protocol + governance + dictionary
- `data/raw/` — pointers/metadata only (do not commit large raw data)
- `data/processed/` — derived outputs (gitignored if large)
- `pipelines/` — ETL scripts
- `dashboards/` — dashboard apps
- `src/` — shared library code

