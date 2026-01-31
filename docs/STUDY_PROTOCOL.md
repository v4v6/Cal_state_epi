# Study Protocol (Draft)

## 1. Objective
Design and operate a statewide epidemiological study for California with an emphasis on infectious diseases and microorganism-caused diseases. Outputs include:
- public-facing situational awareness dashboard
- manager/operations dashboard for public health and health system stakeholders

## 2. Study type
A **population-based observational study** using routinely collected surveillance, healthcare utilization, vaccination, wastewater, and contextual data.

Design: a hybrid of
- **descriptive epidemiology** (time, place, person)
- **nowcasting/forecasting** for selected syndromes/pathogens
- **quasi-experimental evaluation** (policy changes, campaigns)

## 3. Population & geography
- Population: California residents (all ages)
- Geography: Statewide + county + (where safe) ZIP/tract aggregation

## 4. Outcomes (initial)
- pathogen-specific indicators (where available)
- syndrome indicators: ILI, COVID-like illness, RSV-like illness
- severe outcomes: hospitalizations, ICU, mortality
- wastewater viral load indicators

## 5. Exposures / predictors
- vaccination coverage
- mobility / seasonality proxies
- demographics / SDOH (aggregated)
- healthcare capacity measures

## 6. Data sources
- CalHHS Open Data Portal (bulk download in Open_claw workspace)
- (Optional) CDPH, CDC, HHS Protect alternatives if needed

## 7. Methods
- Standardization: age-adjustment where possible
- Modeling: Poisson/negative binomial, GAMs, Bayesian hierarchical (county random effects)
- Nowcasting: delay-adjustment for reporting lags

## 8. Privacy & ethics
- Release only aggregated metrics
- suppression rules for small counts
- de-identification review for any microdata (prefer none)

## 9. Dashboard requirements
Public dashboard:
- fast, minimal, educational
- few key charts, clear definitions

Manager dashboard:
- drill-down, alerts, anomaly detection
- operational thresholds, capacity context

