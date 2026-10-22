"""Budget-risk classifier.

LABEL METHODOLOGY (documented, rule-based, synthetic)
-----------------------------------------------------
For each simulated plan we compute a coverage ratio (budget / predicted cost)
and apply explicitly stated planning rules:

    1 point  coverage >= 1.25
    2 points 1.10 <= coverage < 1.25
    3 points 1.00 <= coverage < 1.10
    4 points coverage < 1.00
    +2       contingency < 5%
    +1       5% <= contingency < 10%
    +1       guest_count > 300 and contingency < 15%

    total >= 4 -> high risk
    total >= 2 -> medium risk
    otherwise  -> low risk

The tree learns these rules from simulated, labelled rows; the rules remain the
source of truth and are documented for users. The classifier therefore provides
a fast, explainable triage, not a guarantee that a budget will hold.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

from app.ml.dataset import EVENT_TYPES

RANDOM_SEED = 42
CLASSES = ["low", "medium", "high"]


def label_row(coverage: float, contingency_pct: float, guest_count: int) -> str:
    if coverage < 1.0:
        points = 4
    elif coverage < 1.10:
        points = 3
    elif coverage < 1.25:
        points = 2
    else:
        points = 1

    if contingency_pct < 5:
        points += 2
    elif contingency_pct < 10:
        points += 1
    if guest_count > 300 and contingency_pct < 15:
        points += 1

    if points >= 4:
        return "high"
    if points >= 2:
        return "medium"
    return "low"


def generate_training_data(rows: int = 4000, seed: int = RANDOM_SEED) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    predicted = rng.uniform(2_000, 180_000, size=rows)
    coverage = rng.uniform(0.65, 1.65, size=rows)
    budget = predicted * coverage
    contingency = rng.uniform(0, 25, size=rows)
    guests = rng.integers(10, 900, size=rows)
    per_guest = predicted / guests
    event_index = rng.integers(0, len(EVENT_TYPES), size=rows)

    X = np.column_stack([budget, predicted, coverage, contingency, guests, per_guest, event_index])
    y = np.array([label_row(c, p, g) for c, p, g in zip(coverage, contingency, guests, strict=True)])
    return X, y


def build_pipeline() -> Pipeline:
    return Pipeline(
        [
            ("scaler", StandardScaler()),
            (
                "tree",
                DecisionTreeClassifier(
                    max_depth=5, min_samples_leaf=12, class_weight="balanced", random_state=RANDOM_SEED
                ),
            ),
        ]
    )


def train(artifacts_dir: Path, rows: int = 4000) -> dict:
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    X, y = generate_training_data(rows)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y)

    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)
    predictions = pipeline.predict(X_test)

    report = classification_report(y_test, predictions, output_dict=True, zero_division=0)
    matrix = confusion_matrix(y_test, predictions, labels=CLASSES).tolist()

    metrics = {
        "model": "DecisionTreeClassifier",
        "model_version": "budget-risk-dt-v1",
        "classes": CLASSES,
        "features": [
            "budget_usd",
            "predicted_cost_usd",
            "coverage_ratio",
            "contingency_pct",
            "guest_count",
            "predicted_cost_per_guest_usd",
            "event_type_index (context only)",
        ],
        "training": {
            "rows": rows,
            "train_rows": len(X_train),
            "test_rows": len(X_test),
            "seed": RANDOM_SEED,
            "label_source": "documented rule-based labels on simulated plans",
            "synthetic": True,
        },
        "metrics": {
            "accuracy": round(float(accuracy_score(y_test, predictions)), 4),
            "macro_f1": round(float(report["macro avg"]["f1-score"]), 4),
            "per_class": {
                cls: {
                    "precision": round(float(report[cls]["precision"]), 4),
                    "recall": round(float(report[cls]["recall"]), 4),
                    "f1": round(float(report[cls]["f1-score"]), 4),
                }
                for cls in CLASSES
                if cls in report
            },
            "confusion_matrix": {"labels": CLASSES, "matrix": matrix},
        },
        "trained_at": datetime.now(UTC).isoformat(),
        "caveats": [
            "Trained on simulated budgets and rule-derived labels; it reproduces planning rules, not market outcomes.",
            "A 'low' classification is not a guarantee that the final cost will stay within budget.",
        ],
    }

    joblib.dump(pipeline, artifacts_dir / "budget_risk_model.joblib", compress=3)
    (artifacts_dir / "budget_risk_metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    return metrics


if __name__ == "__main__":
    from app.core.config import get_settings

    result = train(get_settings().artifacts_path)
    print(json.dumps(result["metrics"], indent=2))
