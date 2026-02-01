#!/usr/bin/env python3
"""Build GitHub Pages-friendly JSON artifacts under docs/data.

This repo is a static dashboard. We precompute aggregated, privacy-preserving outputs
from the CalHHS mirror in /media/brain/brain_3/Open_claw/Cal_HHS.

Outputs (small JSON):
- docs/data/meta.json
- docs/data/meta_manager.json
- docs/data/respiratory_deaths_state_weekly.json
- docs/data/wastewater_state_weekly.json
- docs/data/vax_state_weekly.json

Notes:
- We intentionally aggregate statewide (and can extend to county later).
- Wastewater source is large; we stream in chunks.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import pandas as pd

CALHHS = Path("/media/brain/brain_3/Open_claw/Cal_HHS/data")
OUT = Path(__file__).resolve().parents[1] / "docs" / "data"
OUT.mkdir(parents=True, exist_ok=True)


@dataclass
class Paths:
    resp_deaths: Path
    wastewater: Path
    vax_county: Path


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def week_start(dt: pd.Series) -> pd.Series:
    # Convert dates to Monday week starts.
    d = pd.to_datetime(dt, errors="coerce")
    return (d - pd.to_timedelta(d.dt.dayofweek, unit="D")).dt.date.astype(str)


def build_respiratory_deaths_state_weekly(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    df = df[df["AREA_TYPE"].str.lower().eq("state")]
    df["week"] = week_start(df["DATE"])

    # COVID + Influenza deaths (weekly)
    out = (
        df.groupby("week", as_index=False)[
            ["DEATHS_DC_DOD_COVID", "DEATHS_DC_DOD_INFLUENZA", "DEATHS_DC_DOD_ALL_DISEASE"]
        ]
        .sum(numeric_only=True)
        .sort_values("week")
    )
    # Create tidy format
    tidy = []
    for _, r in out.iterrows():
        tidy.append({"week": r["week"], "series": "COVID-19 deaths", "value": float(r["DEATHS_DC_DOD_COVID"])})
        tidy.append({"week": r["week"], "series": "Influenza deaths", "value": float(r["DEATHS_DC_DOD_INFLUENZA"])})
        tidy.append({"week": r["week"], "series": "All-cause deaths", "value": float(r["DEATHS_DC_DOD_ALL_DISEASE"])})
    return pd.DataFrame(tidy)


def build_vax_state_weekly(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    # Administered date seems daily
    df["week"] = week_start(df["ADMINISTERED_DATE"])

    # Aggregate statewide (sum across counties)
    agg = (
        df.groupby("week", as_index=False)[
            [
                "TOTAL_DOSES",
                "AT_LEAST_ONE_DOSE",
                "FULLY_VACCINATED",
                "UP_TO_DATE_COUNT",
            ]
        ]
        .sum(numeric_only=True)
        .sort_values("week")
    )

    tidy = []
    for _, r in agg.iterrows():
        tidy.append({"week": r["week"], "series": "Doses administered", "value": float(r["TOTAL_DOSES"])})
        tidy.append({"week": r["week"], "series": "Up-to-date (count)", "value": float(r["UP_TO_DATE_COUNT"])})
    return pd.DataFrame(tidy)


def build_wastewater_state_weekly(path: Path, targets: Iterable[str] = ("sars-cov-2", "fluav", "rsv")) -> pd.DataFrame:
    usecols = ["sample_collect_date", "pcr_target", "pcr_target_avg_conc"]
    targets = set(targets)

    rows = []
    # Stream in chunks; compute weekly median concentration per target across all samples.
    # We keep only finite numeric values.
    chunksize = 250_000
    for chunk in pd.read_csv(path, usecols=usecols, chunksize=chunksize, low_memory=False):
        chunk = chunk[chunk["pcr_target"].isin(targets)].copy()
        if chunk.empty:
            continue
        chunk["week"] = week_start(chunk["sample_collect_date"])
        chunk["value"] = pd.to_numeric(chunk["pcr_target_avg_conc"], errors="coerce")
        chunk = chunk.dropna(subset=["week", "value", "pcr_target"])
        # Collect for later groupby-median; to keep memory down, aggregate per chunk first.
        g = chunk.groupby(["week", "pcr_target"], as_index=False)["value"].median()
        rows.append(g)

    if not rows:
        return pd.DataFrame(columns=["week", "series", "value"])

    df = pd.concat(rows, ignore_index=True)
    # Second-stage aggregate in case multiple chunks contributed
    df = df.groupby(["week", "pcr_target"], as_index=False)["value"].median().sort_values(["pcr_target", "week"])

    # Tidy
    df = df.rename(columns={"pcr_target": "series"})
    # Make labels nicer
    label = {
        "sars-cov-2": "SARS‑CoV‑2 (wastewater)",
        "fluav": "Influenza A (wastewater)",
        "rsv": "RSV (wastewater)",
    }
    df["series"] = df["series"].map(lambda x: label.get(x, x))
    return df[["week", "series", "value"]]


def last_n_weeks(df: pd.DataFrame, n: int = 52) -> pd.DataFrame:
    if df.empty:
        return df
    weeks = sorted(df["week"].unique())
    keep = set(weeks[-n:])
    return df[df["week"].isin(keep)].copy()


def compute_simple_alert(series: pd.DataFrame, series_name: str) -> dict:
    # Simple alert: last value vs mean of previous 4 weeks
    s = series[series["series"].eq(series_name)].sort_values("week")
    if len(s) < 6:
        return {"level": "info", "signal": series_name, "geo": "Statewide", "week": None, "reason": "Insufficient history"}
    last = s.iloc[-1]
    prev = s.iloc[-5:-1]["value"].mean()
    if prev == 0:
        ratio = None
    else:
        ratio = float(last["value"]) / float(prev)
    level = "info"
    reason = "Stable"
    if ratio is not None:
        if ratio >= 1.5:
            level, reason = "high", f"Spike: {ratio:.2f}× vs prior 4-week mean"
        elif ratio <= 0.7:
            level, reason = "low", f"Drop: {ratio:.2f}× vs prior 4-week mean"
    return {"level": level, "signal": series_name, "geo": "Statewide", "week": str(last["week"]), "reason": reason}


def main():
    paths = Paths(
        resp_deaths=CALHHS / "respiratory-virus-dashboard-metrics" / "858a3393-7c51-4377-9167-405eb1591d97_Respiratory_Virus_Dashboard_Metrics_Deaths.csv",
        wastewater=CALHHS / "wastewater-surveillance-data-california" / "2742b824-3736-4292-90a9-7fad98e94c06_Wastewater_Surveillance_California.csv",
        vax_county=CALHHS / "vaccine-progress-dashboard" / "130d7ba2-b6eb-438d-a412-741bde207e1c_Statewide_COVID-19_Vaccines_Administered_By_County.csv",
    )

    for p in [paths.resp_deaths, paths.wastewater, paths.vax_county]:
        if not p.exists():
            raise SystemExit(f"Missing expected CalHHS file: {p}")

    generated_at = iso_now()

    resp = last_n_weeks(build_respiratory_deaths_state_weekly(paths.resp_deaths), 104)
    vax = last_n_weeks(build_vax_state_weekly(paths.vax_county), 104)
    ww = last_n_weeks(build_wastewater_state_weekly(paths.wastewater), 104)

    # KPIs (latest week)
    def latest_value(df: pd.DataFrame, name: str):
        s = df[df["series"].eq(name)].sort_values("week")
        if s.empty:
            return None, None
        r = s.iloc[-1]
        return r["week"], float(r["value"])

    wk_covid, covid_deaths = latest_value(resp, "COVID-19 deaths")
    wk_flu, flu_deaths = latest_value(resp, "Influenza deaths")

    wk_ww, ww_sars = latest_value(ww, "SARS‑CoV‑2 (wastewater)")
    wk_vax, doses = latest_value(vax, "Doses administered")

    meta = {
        "generated_at": generated_at,
        "kpis": {
            "respiratory": {
                "value": ("—" if covid_deaths is None else f"{int(covid_deaths)} COVID deaths (wk)"),
                "note": ("Latest statewide weekly deaths; source: Respiratory Virus Dashboard Metrics"),
                "week": wk_covid,
            },
            "wastewater": {
                "value": ("—" if ww_sars is None else f"{ww_sars:,.0f} avg conc"),
                "note": "Statewide median PCR target concentration (SARS‑CoV‑2)",
                "week": wk_ww,
            },
            "hospital": {
                "value": "Planned",
                "note": "Hooking hospitalization datasets next",
            },
            "vax": {
                "value": ("—" if doses is None else f"{int(doses):,} doses (wk)"),
                "note": "Statewide weekly administered doses",
                "week": wk_vax,
            },
        },
        "sources": {
            "calhhs_mirror": str(CALHHS),
        },
    }

    alerts = [
        compute_simple_alert(resp, "COVID-19 deaths"),
        compute_simple_alert(resp, "Influenza deaths"),
        compute_simple_alert(ww, "SARS‑CoV‑2 (wastewater)"),
        compute_simple_alert(ww, "Influenza A (wastewater)"),
        compute_simple_alert(ww, "RSV (wastewater)"),
    ]

    meta_mgr = {
        "generated_at": generated_at,
        "alerts": {
            "count": sum(1 for a in alerts if a["level"] in ("high", "low")),
            "note": "Simple anomaly heuristic (last week vs prior 4-week mean).",
            "items": alerts,
        },
        "privacy": {
            "release": "Statewide aggregates only (MVP)",
        },
    }

    # Write outputs
    (OUT / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    (OUT / "meta_manager.json").write_text(json.dumps(meta_mgr, indent=2), encoding="utf-8")

    (OUT / "respiratory_deaths_state_weekly.json").write_text(resp.to_json(orient="records"), encoding="utf-8")
    (OUT / "vax_state_weekly.json").write_text(vax.to_json(orient="records"), encoding="utf-8")
    (OUT / "wastewater_state_weekly.json").write_text(ww.to_json(orient="records"), encoding="utf-8")

    # Manager example chart uses wastewater + resp combined
    mgr_ts = pd.concat([
        ww.assign(domain="Wastewater"),
        resp.assign(domain="Deaths"),
    ], ignore_index=True)
    (OUT / "manager_timeseries.json").write_text(mgr_ts.to_json(orient="records"), encoding="utf-8")

    print("Wrote", OUT)


if __name__ == "__main__":
    main()
