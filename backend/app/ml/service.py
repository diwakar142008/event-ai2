from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.pipeline import Pipeline

from app.core.config import get_settings
from app.ml.dataset import EVENT_TYPES
from app.ml.recommender import Recommender


class ModelNotTrained(RuntimeError):
    """Raised when an inference request arrives before artifacts are trained."""

    def __init__(self, component: str):
        self.component = component
        super().__init__(
            f"The {component} model has not been trained in this environment. "
            "Run `python scripts/train_models.py` to build it."
        )


class MLEngine:
    LIMITATIONS = [
        "Trained on a synthetic dataset built from documented assumptions, not on real vendor quotes.",
        "Estimates are planning ranges in USD and exclude taxes, gratuities, permits, and travel unless noted.",
        "Seasonality, city-specific vendor pricing, and guest-list changes are not modelled.",
        "Validate any estimate with written quotes from venues and suppliers before committing.",
    ]

    RISK_DEFINITIONS = {
        "low": "Budget covers the predicted cost with a meaningful contingency (coverage >= 1.25 and contingency >= 10%).",
        "medium": "Budget is close to the predicted cost, or contingency is thin; scope adjustments are advisable.",
        "high": "Budget sits at or below the predicted cost, or contingency is very thin. Expect overruns without changes.",
    }

    def __init__(self, artifacts_dir: Path | None = None):
        self._dir = artifacts_dir
        self._lock = threading.Lock()
        self._cost: Pipeline | None = None
        self._risk: Pipeline | None = None
        self._recommender: Recommender | None = None
        self._metrics: dict[str, Any] | None = None

    @property
    def artifacts_dir(self) -> Path:
        return self._dir or get_settings().artifacts_path

    # ------------------------------------------------------------------
    # Loading
    # ------------------------------------------------------------------
    def _load_metrics(self) -> dict[str, Any]:
        if self._metrics is not None:
            return self._metrics
        collected: dict[str, Any] = {}
        mapping = {
            "cost": "cost_metrics.json",
            "recommender": "recommender_metrics.json",
            "budget_risk": "budget_risk_metrics.json",
        }
        for key, filename in mapping.items():
            path = self.artifacts_dir / filename
            if path.exists():
                try:
                    collected[key] = json.loads(path.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    collected[key] = None
            else:
                collected[key] = None
        collected["trained"] = {
            "cost": (self.artifacts_dir / "cost_model.joblib").exists(),
            "recommender": (self.artifacts_dir / "recommender.joblib").exists(),
            "budget_risk": (self.artifacts_dir / "budget_risk_model.joblib").exists(),
        }
        self._metrics = collected
        return collected

    def _cost_model(self) -> Pipeline:
        with self._lock:
            if self._cost is None:
                path = self.artifacts_dir / "cost_model.joblib"
                if not path.exists():
                    raise ModelNotTrained("event cost")
                self._cost = joblib.load(path)
        return self._cost

    def _risk_model(self) -> Pipeline:
        with self._lock:
            if self._risk is None:
                path = self.artifacts_dir / "budget_risk_model.joblib"
                if not path.exists():
                    raise ModelNotTrained("budget risk")
                self._risk = joblib.load(path)
        return self._risk

    def _recommender_model(self) -> Recommender:
        with self._lock:
            if self._recommender is None:
                path = self.artifacts_dir / "recommender.joblib"
                if not path.exists():
                    raise ModelNotTrained("recommendation")
                bundle = joblib.load(path)
                self._recommender = Recommender(
                    catalog=bundle["catalog"], scaler=bundle["scaler"], model=bundle["model"]
                )
        return self._recommender

    def reset(self) -> None:
        with self._lock:
            self._cost = None
            self._risk = None
            self._recommender = None
            self._metrics = None

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------
    def predict_cost(self, features: dict[str, Any]) -> dict[str, Any]:
        pipeline = self._cost_model()
        row = pd.DataFrame(
            [
                {
                    "event_type": features["event_type"],
                    "guest_count": features["guest_count"],
                    "location_tier": features["location_tier"],
                    "venue_type": features["venue_type"],
                    "duration_hours": features["duration_hours"],
                    "catering_level": features["catering_level"],
                    "decor_level": features["decor_level"],
                    "photography": features["photography"],
                }
            ]
        )
        prediction = float(pipeline.predict(row)[0])
        prediction = max(0.0, prediction)
        predicted_cents = int(round(prediction * 100))
        metrics = self._load_metrics().get("cost") or {}
        top = metrics.get("top_feature_importances", [])
        factors = [
            {
                "name": entry["feature"].replace("_", " "),
                "detail": f"Global model importance {entry['importance'] * 100:.1f}%",
                "importance": entry["importance"],
            }
            for entry in top[:4]
        ]
        return {
            "predicted_cost_cents": predicted_cents,
            "currency": "USD",
            "guest_count": features["guest_count"],
            "cost_per_guest_cents": int(round(predicted_cents / max(features["guest_count"], 1))),
            "factors": factors,
            "model": {
                "name": "RandomForestRegressor (cost-rf-v1)",
                "trained": True,
                "synthetic_training_data": True,
                "metrics": metrics.get("metrics"),
            },
            "limitations": self.LIMITATIONS,
        }

    def recommend(
        self,
        *,
        style: str,
        event_type: str,
        venue_type: str,
        guest_count: int,
        budget_cents: int,
        limit: int,
    ) -> dict[str, Any]:
        engine = self._recommender_model()
        items = engine.recommend(
            style=style,
            event_type=event_type,
            venue_type=venue_type,
            guest_count=guest_count,
            budget_cents=budget_cents,
            limit=limit,
        )
        return {
            "items": items,
            "model": {
                "name": "NearestNeighbors (recommender-knn-v1, cosine distance)",
                "catalogue_based": True,
                "catalogue_size": len(engine.catalog),
            },
            "disclaimer": (
                "Catalogue concepts ranked by content similarity. No vendor availability, "
                "quote, or booking is verified or implied."
            ),
        }

    def budget_risk(
        self,
        *,
        event_type: str,
        guest_count: int,
        budget_cents: int,
        predicted_cost_cents: int,
        contingency_pct: float,
    ) -> dict[str, Any]:
        pipeline = self._risk_model()
        budget = budget_cents / 100.0
        predicted = predicted_cost_cents / 100.0
        coverage = (budget / predicted) if predicted > 0 else 99.0
        per_guest = predicted / max(guest_count, 1)
        event_index = EVENT_TYPES.index(event_type) if event_type in EVENT_TYPES else 0
        row = [[budget, predicted, coverage, contingency_pct, guest_count, per_guest, event_index]]
        probabilities = pipeline.predict_proba(row)[0]
        classes = list(pipeline.classes_)
        best_index = int(probabilities.argmax())
        risk = str(classes[best_index])
        confidence = float(probabilities[best_index])

        drivers = [
            {"driver": "Budget coverage", "value": f"{coverage:.2f}x predicted cost"},
            {"driver": "Contingency", "value": f"{contingency_pct:.1f}% of budget"},
            {"driver": "Predicted cost per guest", "value": f"${per_guest:,.0f}"},
            {"driver": "Guest count", "value": f"{guest_count:,}"},
        ]
        suggestions: list[str] = []
        if coverage < 1.0:
            suggestions.append("Close the gap: reduce guest count, simplify catering service, or raise the budget.")
        elif coverage < 1.15:
            suggestions.append("Build at least a 12–15% contingency so the plan can absorb quote changes.")
        if contingency_pct < 10:
            suggestions.append("Move toward a 10–15% contingency; even confirmed quotes tend to move.")
        if per_guest > 350:
            suggestions.append("Review the highest per-guest lines (catering, bar, rentals) for scope reduction.")
        if guest_count > 300:
            suggestions.append("At this scale, request tiered quotes and confirm staffing ratios early.")
        if not suggestions:
            suggestions.append("Keep the contingency ring-fenced and re-check quotes as the date approaches.")

        return {
            "risk_level": risk,
            "confidence": round(confidence, 4),
            "drivers": drivers,
            "suggestions": suggestions,
            "definition": self.RISK_DEFINITIONS.get(risk, ""),
            "model": {
                "name": "DecisionTreeClassifier (budget-risk-dt-v1)",
                "trained": True,
                "synthetic_training_data": True,
                "probabilities": {cls: round(float(p), 4) for cls, p in zip(classes, probabilities, strict=True)},
            },
            "disclaimer": (
                "A planning triage based on rule-derived labels. It is not a guarantee that the "
                "final cost will stay within budget."
            ),
        }

    def metrics(self) -> dict[str, Any]:
        data = self._load_metrics()
        return {
            "trained": data["trained"],
            "cost": data.get("cost"),
            "recommender": data.get("recommender"),
            "budget_risk": data.get("budget_risk"),
            "limitations": self.LIMITATIONS,
        }


engine = MLEngine()
