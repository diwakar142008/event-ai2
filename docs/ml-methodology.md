# ML methodology

All models are reproducible with:

```bash
.venv/bin/python backend/scripts/train_models.py
```

Artifacts are written to `backend/ml_artifacts/` (gitignored): `cost_model.joblib`, `budget_risk_model.joblib`, `recommender.joblib`, and three metrics JSON files. Checked-in snapshots live in [metrics/](metrics/).

## Why the data is synthetic

No suitably licensed dataset with event type, guest count, location tier, venue category, duration, catering level, decor level, and photography needs — plus a USD cost target — was available in this environment. Presenting invented numbers as market data would be dishonest, so the dataset is generated from **explicit assumptions** and every surface labels it as synthetic.

The dataset does not model real vendor quotes, taxes, permits, travel, seasonality, or city-specific pricing.

## Model A — Event cost prediction

**Algorithm:** `RandomForestRegressor(n_estimators=300, max_depth=18, min_samples_leaf=2, random_state=42)` inside a scikit-learn `Pipeline` with a `ColumnTransformer`.

| Feature | Type | Values / range |
|---|---|---|
| `event_type` | categorical | wedding, engagement, birthday, anniversary, college_festival, cultural_event, community_celebration, corporate_event, private_party |
| `guest_count` | numeric | 20–650 in the generator; API accepts 1–5,000 |
| `location_tier` | categorical | metro, large_city, regional |
| `venue_type` | categorical | hotel_ballroom, garden_outdoor, loft_indoor, banquet_hall, community_hall, private_residence |
| `duration_hours` | numeric | 3–12 in the generator; API accepts 1–24 |
| `catering_level` | categorical | none, light, full, premium |
| `decor_level` | categorical | minimal, classic, luxe |
| `photography` | categorical | none, partial, full |
| **Target** | numeric | `cost_usd` (USD) |

**Generator (3,200 rows, seed 42):**

```
base      = event_base[type] × location_multiplier + venue_base[venue] × location_multiplier
catering  = catering_per_guest[level] × guests × location_multiplier
decor     = decor_base[level] × location_multiplier
photo     = photo_base[level] × location_multiplier
overtime  = max(0, duration_hours − 4) × 240 × location_multiplier
target    = (base + catering + decor + photo + overtime) × lognormal(σ = 0.09)
```

The specific coefficients live in `backend/app/ml/dataset.py` and are readable, not hidden. The lognormal noise represents unobserved costs such as transport, gratuities, and seasonal surcharges.

**Leakage prevention:** only the eight raw inputs are features. No derived totals (venue cost, per-guest cost, subtotal) are included. Preprocessing is fit inside the pipeline on the training split only. The split is 80/20 with `random_state=42`.

**Measured holdout results (640 test rows):**

| Metric | Value |
|---|---|
| MAE | **$4,175.38** |
| RMSE | **$5,696.98** |
| R² | **0.9556** |
| MAE as % of mean cost | **9.25%** |

These numbers demonstrate that the model recovers the generator's cost structure. They are **not** evidence that the model forecasts real market prices with 96% accuracy. A real deployment should re-train on licensed transaction data and re-evaluate with a time-based split.

**Inference response** includes: predicted cost in cents, cost per guest, global feature importances (grouped by source feature), model metadata and holdout metrics, and explicit limitations. Factors are described as *global model sensitivity*, not per-prediction causal explanations.

## Model B — Recommendations

**Algorithm:** `NearestNeighbors(metric="cosine")` over a content matrix, with `StandardScaler`.

**Catalogue:** 24 original editorial concepts (8 themes, 4 decor, 4 catering, 4 activities, 4 services) with style tags, compatible event types, compatible venues, a per-guest planning band, and a capacity.

**Vector:** one-hot styles (8) + one-hot event types (9) + one-hot venues (6) + `log1p(per-guest midpoint)` + `log1p(capacity)`.

**Query:** the event's style, event type, venue, budget per guest, and guest count.

**Output:** ranked by cosine similarity (reported as similarity, not probability of satisfaction), with human-readable reasons for style/occasion/venue/budget fit. Catalogue items above the user's per-guest envelope are marked as upgrade options. The response labels provenance: *Eventora curated catalogue — concept only, not a verified vendor or booking.*

No collaborative filtering, user behaviour tracking, availability lookup, or price quoting is performed.

## Model C — Budget-risk classification

**Algorithm:** `DecisionTreeClassifier(max_depth=5, min_samples_leaf=12, class_weight="balanced", random_state=42)` with `StandardScaler`.

**Features:** budget USD, predicted cost USD, coverage ratio, contingency %, guest count, predicted cost per guest, event-type index (context only).

**Transparent label rules** (applied to 4,000 simulated plans):

| Condition | Points |
|---|---|
| Coverage ≥ 1.25 | 1 |
| 1.10 ≤ coverage < 1.25 | 2 |
| 1.00 ≤ coverage < 1.10 | 3 |
| Coverage < 1.00 | 4 |
| Contingency < 5% | +2 |
| 5% ≤ contingency < 10% | +1 |
| Guests > 300 and contingency < 15% | +1 |

`total ≥ 4` → **high**; `total ≥ 2` → **medium**; otherwise **low**.

**Class meanings exposed to users:**
- **Low**: budget covers the predicted cost with a meaningful contingency (coverage ≥ 1.25 and contingency ≥ 10%).
- **Medium**: budget is close to the prediction, or contingency is thin; scope adjustments are advisable.
- **High**: budget sits at or below the predicted cost, or contingency is very thin; overruns are likely without changes.

**Measured holdout results (800 test rows):** accuracy **0.9475**, macro F1 **0.9359**. Per class:
low F1 0.9182, medium 0.9091, high 0.9805. Confusion matrix in [metrics/budget_risk_metrics.json](metrics/budget_risk_metrics.json).

The classifier is a fast, explainable triage that reproduces documented planning rules. It is **not** a guarantee. The API returns drivers, suggestions, the class definition, probabilities, and a disclaimer.

## Limitations

- Synthetic data and rule-derived labels; no market validation.
- USD only; no FX conversion. Budgets in other currencies are not accepted.
- Seasonality, city-level price differences, supplier quality, and availability are absent.
- Guest count and duration are point estimates; no uncertainty interval is calibrated.
- The recommendation catalogue is editorial, not vendor inventory.
- Model drift is not monitored; retrain when assumptions or markets change.
- Metrics are single-split holdout results, not cross-validated confidence intervals.

## Reproducibility

- Seeds fixed at 42 for dataset generation, splits, and estimators.
- Dataset SHA-256 is recorded in `cost_metrics.json`.
- The training entrypoint prints a JSON summary and writes artifacts atomically per model.
- No notebooks, manual steps, or hidden data downloads are required.
