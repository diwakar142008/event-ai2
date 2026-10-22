"""Train all Eventora models and write metrics artifacts.

Usage (from the repository root):
    .venv/bin/python backend/scripts/train_models.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import get_settings  # noqa: E402
from app.ml.recommender import save as save_recommender  # noqa: E402
from app.ml.train_cost import train as train_cost  # noqa: E402
from app.ml.train_risk import train as train_risk  # noqa: E402


def main() -> int:
    artifacts = get_settings().artifacts_path
    artifacts.mkdir(parents=True, exist_ok=True)

    cost = train_cost(artifacts)
    risk = train_risk(artifacts)
    recommender = save_recommender(artifacts)

    summary = {
        "artifacts_dir": str(artifacts),
        "cost": {
            "model": cost["model"],
            "metrics": cost["metrics"],
            "trained_at": cost["trained_at"],
        },
        "budget_risk": {
            "model": risk["model"],
            "metrics": risk["metrics"],
            "trained_at": risk["trained_at"],
        },
        "recommender": {
            "model": recommender["model"],
            "catalogue_size": recommender["catalogue_size"],
        },
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
