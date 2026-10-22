from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session as OrmSession

from app.auth.deps import get_optional_user
from app.core.config import get_settings
from app.core.rate_limit import check_rate_limit, client_key, user_key
from app.database.db import get_db
from app.database.models import User
from app.ml.service import ModelNotTrained
from app.ml.service import engine as ml_engine
from app.schemas import (
    BudgetRiskOut,
    BudgetRiskRequest,
    CostFeatures,
    CostPredictionOut,
    RecommendationOut,
    RecommendationRequest,
)

router = APIRouter(prefix="/api/ml", tags=["machine-learning"])


def _guard(request: Request, db: OrmSession, user: User | None, scope: str) -> None:
    settings = get_settings()
    if user is not None:
        check_rate_limit(db, user_key(user.id, scope), settings.rate_limit_ml)
    else:
        check_rate_limit(db, client_key(request, scope), settings.rate_limit_ml)


def _unavailable(component: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=(
            f"The {component} model is not trained in this environment. "
            "Run the training script to enable real inference."
        ),
    )


@router.post("/predict-cost", response_model=CostPredictionOut)
def predict_cost(
    payload: CostFeatures,
    request: Request,
    db: OrmSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> CostPredictionOut:
    _guard(request, db, user, "ml")
    try:
        result = ml_engine.predict_cost(payload.model_dump())
    except ModelNotTrained:
        raise _unavailable("event cost") from None
    return CostPredictionOut(**result)


@router.post("/recommend", response_model=RecommendationOut)
def recommend(
    payload: RecommendationRequest,
    request: Request,
    db: OrmSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> RecommendationOut:
    _guard(request, db, user, "ml")
    try:
        result = ml_engine.recommend(
            style=payload.style,
            event_type=payload.event_type,
            venue_type=payload.venue_type,
            guest_count=payload.guest_count,
            budget_cents=payload.budget_cents,
            limit=payload.limit,
        )
    except ModelNotTrained:
        raise _unavailable("recommendation") from None
    return RecommendationOut(**result)


@router.post("/budget-risk", response_model=BudgetRiskOut)
def budget_risk(
    payload: BudgetRiskRequest,
    request: Request,
    db: OrmSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> BudgetRiskOut:
    _guard(request, db, user, "ml")
    try:
        result = ml_engine.budget_risk(
            event_type=payload.event_type,
            guest_count=payload.guest_count,
            budget_cents=payload.budget_cents,
            predicted_cost_cents=payload.predicted_cost_cents,
            contingency_pct=payload.contingency_pct,
        )
    except ModelNotTrained:
        raise _unavailable("budget risk") from None
    return BudgetRiskOut(**result)


@router.get("/metrics")
def metrics() -> dict:
    return ml_engine.metrics()
