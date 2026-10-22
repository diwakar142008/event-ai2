from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from app.ml.dataset import (
    CATERING_LEVELS,
    DECOR_LEVELS,
    EVENT_TYPES,
    FEATURE_COLUMNS,
    LOCATION_TIERS,
    PHOTOGRAPHY_LEVELS,
    RANDOM_SEED,
    TARGET_COLUMN,
    VENUE_TYPES,
    dataset_info,
    generate_dataset,
)

CATEGORICAL_FEATURES = [
    "event_type",
    "location_tier",
    "venue_type",
    "catering_level",
    "decor_level",
    "photography",
]
NUMERIC_FEATURES = ["guest_count", "duration_hours"]
ALLOWED_VALUES = {
    "event_type": EVENT_TYPES,
    "location_tier": LOCATION_TIERS,
    "venue_type": VENUE_TYPES,
    "catering_level": CATERING_LEVELS,
    "decor_level": DECOR_LEVELS,
    "photography": PHOTOGRAPHY_LEVELS,
}


def build_pipeline() -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            ("categorical", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
            ("numeric", "passthrough", NUMERIC_FEATURES),
        ]
    )
    model = RandomForestRegressor(
        n_estimators=300,
        max_depth=18,
        min_samples_leaf=2,
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )
    return Pipeline([("preprocessor", preprocessor), ("regressor", model)])


def _dataset_fingerprint(df: pd.DataFrame) -> str:
    payload = pd.util.hash_pandas_object(df, index=True).values.tobytes()
    return hashlib.sha256(payload).hexdigest()


def train(artifacts_dir: Path, rows: int = 3200, seed: int = RANDOM_SEED) -> dict:
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    df = generate_dataset(rows=rows, seed=seed)

    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=seed)

    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)
    predictions = pipeline.predict(X_test)

    mae = float(mean_absolute_error(y_test, predictions))
    rmse = float(np.sqrt(mean_squared_error(y_test, predictions)))
    r2 = float(r2_score(y_test, predictions))
    mean_cost = float(y_test.mean())

    # Group one-hot importances back to source columns for a human-readable card.
    regressor = pipeline.named_steps["regressor"]
    preprocessor = pipeline.named_steps["preprocessor"]
    names = preprocessor.get_feature_names_out()
    importances = regressor.feature_importances_
    grouped: dict[str, float] = {}
    for name, importance in zip(names, importances, strict=True):
        raw = str(name)
        feature = raw.split("__", 1)[1] if "__" in raw else raw
        if raw.startswith("categorical__"):
            label = next(
                (column for column in CATEGORICAL_FEATURES if feature.startswith(f"{column}_")),
                feature,
            )
        else:
            label = feature
        grouped[label] = grouped.get(label, 0.0) + float(importance)
    top_features = sorted(grouped.items(), key=lambda kv: kv[1], reverse=True)[:6]

    info = dataset_info(rows)
    metrics = {
        "model": "RandomForestRegressor",
        "model_version": "cost-rf-v1",
        "target": f"{TARGET_COLUMN} (USD)",
        "currency": "USD",
        "dataset": {
            "name": info.name,
            "version": info.version,
            "synthetic": True,
            "rows": int(len(df)),
            "train_rows": int(len(X_train)),
            "test_rows": int(len(X_test)),
            "seed": seed,
            "sha256": _dataset_fingerprint(df),
        },
        "split": {"test_size": 0.2, "random_state": seed},
        "preprocessing": {
            "categorical": CATEGORICAL_FEATURES,
            "numeric": NUMERIC_FEATURES,
            "encoder": "OneHotEncoder(handle_unknown='ignore')",
        },
        "metrics": {
            "mae_usd": round(mae, 2),
            "rmse_usd": round(rmse, 2),
            "r2": round(r2, 4),
            "mae_pct_of_mean": round(mae / mean_cost * 100, 2) if mean_cost else None,
        },
        "top_feature_importances": [{"feature": k, "importance": round(v, 4)} for k, v in top_features],
        "trained_at": datetime.now(UTC).isoformat(),
        "caveats": [
            "Trained on a synthetic dataset generated from documented assumptions, not market transactions.",
            "Metrics measure recovery of the generator's cost structure, not real-world forecast accuracy.",
            "Currency is USD only; no FX conversion is performed.",
            "Use estimates as a planning range and validate with local vendors.",
        ],
    }

    joblib.dump(pipeline, artifacts_dir / "cost_model.joblib", compress=3)
    (artifacts_dir / "cost_metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    return metrics


if __name__ == "__main__":
    from app.core.config import get_settings

    output = train(get_settings().artifacts_path)
    print(json.dumps(output["metrics"], indent=2))
