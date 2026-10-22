from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

from app.ml.catalog import CATALOG, PROVENANCE, STYLE_LABELS, STYLES
from app.ml.dataset import EVENT_TYPES, LOCATION_TIERS, VENUE_TYPES


def _event_one_hot(event_type: str) -> list[float]:
    return [1.0 if event_type == e else 0.0 for e in EVENT_TYPES]


def _style_one_hot(styles: list[str]) -> list[float]:
    return [1.0 if s in styles else 0.0 for s in STYLES]


def _venue_one_hot(venues: list[str]) -> list[float]:
    return [1.0 if v in venues else 0.0 for v in VENUE_TYPES]


def _item_event_vector(item: dict) -> list[float]:
    # Average one-hot over compatible event types and venues so multi-compatible
    # catalogue items are not artificially biased toward their first entry.
    events = [0.0] * len(EVENT_TYPES)
    for event_type in item["event_types"]:
        if event_type in EVENT_TYPES:
            events[EVENT_TYPES.index(event_type)] = 1.0
    venues = [0.0] * len(VENUE_TYPES)
    for venue in item["venues"]:
        if venue in VENUE_TYPES:
            venues[VENUE_TYPES.index(venue)] = 1.0
    return events, venues


def build_matrix_v2(catalog: list[dict]) -> np.ndarray:
    rows = []
    for item in catalog:
        events, venues = _item_event_vector(item)
        midpoint = (item["band"][0] + item["band"][1]) / 2
        rows.append([*_style_one_hot(item["styles"]), *events, *venues, np.log1p(midpoint), np.log1p(item["capacity"])])
    return np.asarray(rows, dtype=float)


def query_vector(
    style: str, event_type: str, venue_type: str, budget_per_guest: float, guest_count: int
) -> np.ndarray:
    return np.asarray(
        [
            *_style_one_hot([style]),
            *_event_one_hot(event_type),
            *_venue_one_hot([venue_type]),
            np.log1p(max(budget_per_guest, 1.0)),
            np.log1p(guest_count),
        ],
        dtype=float,
    )


class Recommender:
    def __init__(
        self,
        catalog: list[dict] | None = None,
        scaler: StandardScaler | None = None,
        model: NearestNeighbors | None = None,
    ):
        self.catalog = catalog or CATALOG
        self.matrix = build_matrix_v2(self.catalog)
        self.scaler = scaler or StandardScaler().fit(self.matrix)
        if model is not None:
            self.model = model
        else:
            scaled = self.scaler.transform(self.matrix)
            self.model = NearestNeighbors(n_neighbors=len(self.catalog), metric="cosine").fit(scaled)

    def recommend(
        self,
        *,
        style: str,
        event_type: str,
        venue_type: str,
        guest_count: int,
        budget_cents: int,
        limit: int = 8,
    ) -> list[dict]:
        budget_per_guest = (budget_cents / 100.0) / max(guest_count, 1)
        vector = query_vector(style, event_type, venue_type, budget_per_guest, guest_count)
        scaled = self.scaler.transform(vector.reshape(1, -1))
        distances, indices = self.model.kneighbors(scaled, n_neighbors=len(self.catalog))
        results: list[dict] = []
        for distance, index in zip(distances[0], indices[0], strict=True):
            item = self.catalog[int(index)]
            low, high = item["band"]
            similarity = max(0.0, min(1.0, 1.0 - float(distance)))
            reasons = [
                f"Style fit: {STYLE_LABELS.get(style, style)} is one of this concept's design directions.",
            ]
            if event_type in item["event_types"]:
                reasons.append(f"Designed for {event_type.replace('_', ' ')} celebrations.")
            if venue_type in item["venues"]:
                reasons.append(f"Works with a {venue_type.replace('_', ' ')} setting.")
            if budget_per_guest >= low:
                if budget_per_guest <= high:
                    reasons.append(
                        f"Your ${budget_per_guest:,.0f} per-guest envelope sits inside this concept's "
                        f"${low:,}–${high:,} planning band."
                    )
                else:
                    reasons.append(
                        f"Sits comfortably within your ${budget_per_guest:,.0f} per-guest envelope "
                        f"(concept band ${low:,}–${high:,})."
                    )
            else:
                reasons.append(
                    f"Above your ${budget_per_guest:,.0f} per-guest envelope "
                    f"(planning band ${low:,}–${high:,}) — treat it as an upgrade option."
                )
            results.append(
                {
                    "id": item["id"],
                    "kind": item["kind"],
                    "title": item["title"],
                    "description": item["description"],
                    "estimated_cost_band": f"${low:,}–${high:,} per guest (planning band, USD)",
                    "provenance": PROVENANCE,
                    "score": round(similarity, 4),
                    "reasons": reasons,
                }
            )
        # Prefer affordable options in the returned set without hiding upgrades:
        # sort by similarity, then by budget fit as a tie-breaker.
        results.sort(key=lambda r: (-r["score"], r["estimated_cost_band"]))
        affordable = [r for r in results if "Above your" not in " ".join(r["reasons"])]
        upgrades = [r for r in results if "Above your" in " ".join(r["reasons"])]
        ordered = (affordable + upgrades)[:limit]
        return ordered


def save(artifacts_dir: Path) -> dict:
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    engine = Recommender()
    joblib.dump({"catalog": engine.catalog, "scaler": engine.scaler, "model": engine.model}, artifacts_dir / "recommender.joblib", compress=3)
    metadata = {
        "model": "NearestNeighbors(metric='cosine')",
        "model_version": "recommender-knn-v1",
        "catalogue_size": len(engine.catalog),
        "catalogue_kinds": sorted({item["kind"] for item in engine.catalog}),
        "features": {
            "style_one_hot": STYLES,
            "event_type_one_hot": EVENT_TYPES,
            "venue_one_hot": VENUE_TYPES,
            "log_budget_per_guest": "natural log",
            "log_capacity": "natural log",
            "location_note": f"location tiers available for context: {LOCATION_TIERS}",
        },
        "provenance": PROVENANCE,
        "caveats": [
            "Catalogue-based content similarity, not collaborative filtering from user behaviour.",
            "No vendor availability, quote, or booking is verified or implied.",
        ],
    }
    (artifacts_dir / "recommender_metrics.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata
