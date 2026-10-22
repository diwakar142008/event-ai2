"""Synthetic event-cost dataset (USD).

WHY SYNTHETIC
-------------
No suitably licensed, feature-complete real dataset of celebration costs was
available in this environment. Fabricating "market data" while presenting it as
real would be dishonest, so the dataset is generated from *explicitly documented*
assumptions instead. Metrics from this data measure how well a model recovers
the generator's assumptions. They are NOT evidence of real-world accuracy.

ASSUMPTIONS (all USD, pre-tax, 2026 planning units)
---------------------------------------------------
* Venue base cost depends on venue type and location tier.
* Event-type base cost covers planning, staffing, and core production.
* Catering is charged per guest and varies by service level and location.
* Decoration is a fixed allowance scaled by location.
* Photography is a fixed allowance scaled by location.
* Each hour beyond four adds a staffing/venue premium.
* Random multiplicative noise (lognormal, sigma=0.09) models unobserved costs
  such as transport, gratuities, and seasonal surcharges.

TARGET LEAKAGE
--------------
The target is generated from the nine raw input features plus noise. No derived
or post-hoc column (such as venue cost or per-guest totals) is included as a
feature, and the preprocessing pipeline is fit only on the training split.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

RANDOM_SEED = 42
DATASET_VERSION = "synthetic-v1"

EVENT_TYPES = [
    "wedding",
    "engagement",
    "birthday",
    "anniversary",
    "college_festival",
    "cultural_event",
    "community_celebration",
    "corporate_event",
    "private_party",
]
LOCATION_TIERS = ["metro", "large_city", "regional"]
VENUE_TYPES = [
    "hotel_ballroom",
    "garden_outdoor",
    "loft_indoor",
    "banquet_hall",
    "community_hall",
    "private_residence",
]
CATERING_LEVELS = ["none", "light", "full", "premium"]
DECOR_LEVELS = ["minimal", "classic", "luxe"]
PHOTOGRAPHY_LEVELS = ["none", "partial", "full"]

EVENT_BASE = {
    "wedding": 9000,
    "engagement": 5200,
    "birthday": 2200,
    "anniversary": 2800,
    "college_festival": 6200,
    "cultural_event": 4600,
    "community_celebration": 1600,
    "corporate_event": 8200,
    "private_party": 3000,
}
LOCATION_MULTIPLIER = {"metro": 1.35, "large_city": 1.0, "regional": 0.78}
VENUE_BASE = {
    "hotel_ballroom": 6200,
    "garden_outdoor": 3400,
    "loft_indoor": 4200,
    "banquet_hall": 3700,
    "community_hall": 900,
    "private_residence": 500,
}
CATERING_PER_GUEST = {"none": 0, "light": 42, "full": 84, "premium": 148}
DECOR_BASE = {"minimal": 400, "classic": 1800, "luxe": 5200}
PHOTO_BASE = {"none": 0, "partial": 700, "full": 2300}

FEATURE_COLUMNS = [
    "event_type",
    "guest_count",
    "location_tier",
    "venue_type",
    "duration_hours",
    "catering_level",
    "decor_level",
    "photography",
]
TARGET_COLUMN = "cost_usd"


@dataclass(frozen=True)
class DatasetInfo:
    name: str
    version: str
    rows: int
    seed: int
    currency: str = "USD"
    synthetic: bool = True


def generate_dataset(rows: int = 3200, seed: int = RANDOM_SEED) -> pd.DataFrame:
    if rows < 200:
        raise ValueError("rows must be at least 200")
    rng = np.random.default_rng(seed)
    chosen_event = rng.choice(EVENT_TYPES, size=rows)
    chosen_location = rng.choice(LOCATION_TIERS, size=rows, p=[0.45, 0.4, 0.15])
    chosen_venue = rng.choice(VENUE_TYPES, size=rows)
    chosen_catering = rng.choice(CATERING_LEVELS, size=rows, p=[0.08, 0.22, 0.45, 0.25])
    chosen_decor = rng.choice(DECOR_LEVELS, size=rows, p=[0.3, 0.45, 0.25])
    chosen_photo = rng.choice(PHOTOGRAPHY_LEVELS, size=rows, p=[0.2, 0.35, 0.45])
    guests = rng.integers(20, 650, size=rows)
    duration = np.round(rng.uniform(3, 12, size=rows), 1)

    venue = np.array([VENUE_BASE[v] for v in chosen_venue])
    location = np.array([LOCATION_MULTIPLIER[t] for t in chosen_location])
    event_base = np.array([EVENT_BASE[e] for e in chosen_event])
    catering = np.array([CATERING_PER_GUEST[c] for c in chosen_catering]) * guests * location
    decor = np.array([DECOR_BASE[d] for d in chosen_decor]) * location
    photo = np.array([PHOTO_BASE[p] for p in chosen_photo]) * location
    overtime = np.maximum(0, duration - 4) * 240 * location

    base = (event_base * location) + (venue * location)
    noise = rng.lognormal(mean=0.0, sigma=0.09, size=rows)
    cost = (base + catering + decor + photo + overtime) * noise

    return pd.DataFrame(
        {
            "event_type": chosen_event,
            "guest_count": guests,
            "location_tier": chosen_location,
            "venue_type": chosen_venue,
            "duration_hours": duration,
            "catering_level": chosen_catering,
            "decor_level": chosen_decor,
            "photography": chosen_photo,
            TARGET_COLUMN: np.round(cost, 2),
        }
    )


def dataset_info(rows: int = 3200) -> DatasetInfo:
    return DatasetInfo(name="eventora-synthetic-event-costs", version=DATASET_VERSION, rows=rows, seed=RANDOM_SEED)
