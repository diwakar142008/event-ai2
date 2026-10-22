from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

EventType = Literal[
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
LocationTier = Literal["metro", "large_city", "regional"]
VenueType = Literal[
    "hotel_ballroom", "garden_outdoor", "loft_indoor", "banquet_hall", "community_hall", "private_residence"
]
CateringLevel = Literal["none", "light", "full", "premium"]
DecorLevel = Literal["minimal", "classic", "luxe"]
PhotographyLevel = Literal["none", "partial", "full"]
ThemeKey = Literal[
    "romantic_garden", "modern_editorial", "warm_minimal", "playful_color",
    "heritage_classic", "coastal_air", "disco_night", "natural_rustic",
]
RiskLevel = Literal["low", "medium", "high"]


def normalize_event_date(value: datetime) -> datetime:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    if value.year < 2000 or value > now.replace(year=now.year + 10):
        raise ValueError("Event date must be between 2000 and ten years from now")
    return value.astimezone(timezone.utc)


def strip_control_chars(value: str) -> str:
    cleaned = "".join(ch for ch in value if ch in "\n\t" or ch.isprintable())
    return cleaned.strip()


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class SignUpRequest(StrictModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=10, max_length=128)
    display_name: str = Field(min_length=2, max_length=80)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        from app.core.security import is_valid_email, normalize_email

        value = normalize_email(value)
        if not is_valid_email(value):
            raise ValueError("Enter a valid email address")
        return value

    @field_validator("password")
    @classmethod
    def _password_strength(cls, value: str) -> str:
        if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError("Password must contain at least one letter and one number")
        if len(set(value)) < 5:
            raise ValueError("Password is too repetitive")
        return value


class SignInRequest(StrictModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class PasswordResetRequest(StrictModel):
    email: str = Field(min_length=5, max_length=254)


class PasswordResetConfirm(StrictModel):
    token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(min_length=10, max_length=128)

    @field_validator("new_password")
    @classmethod
    def _password_strength(cls, value: str) -> str:
        if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError("Password must contain at least one letter and one number")
        if len(set(value)) < 5:
            raise ValueError("Password is too repetitive")
        return value


class ProfileUpdate(StrictModel):
    display_name: str = Field(min_length=2, max_length=80)


class DeleteAccountRequest(StrictModel):
    password: str = Field(min_length=1, max_length=128)
    confirmation: Literal["DELETE"]


class UserOut(BaseModel):
    id: str
    email: str
    display_name: str
    created_at: datetime


class SessionOut(BaseModel):
    user: UserOut
    csrf_token: str


class EventBase(StrictModel):
    name: str = Field(min_length=2, max_length=120)
    event_type: EventType
    event_date: datetime
    city: str = Field(min_length=2, max_length=120)
    location_tier: LocationTier
    guest_count: int = Field(ge=1, le=5000)
    budget_cents: int = Field(ge=10_000, le=2_000_000_000)
    currency: Literal["USD"] = "USD"
    theme: ThemeKey
    venue_type: VenueType
    catering_level: CateringLevel
    decor_level: DecorLevel
    photography: PhotographyLevel
    duration_hours: float = Field(default=5.0, ge=1, le=24)
    accessibility: str = Field(default="", max_length=300)
    notes: str = Field(default="", max_length=2000)

    @field_validator("event_date")
    @classmethod
    def _date_window(cls, value: datetime) -> datetime:
        return normalize_event_date(value)

    @field_validator("notes", "accessibility")
    @classmethod
    def _no_control_chars(cls, value: str) -> str:
        return strip_control_chars(value)


class EventCreate(EventBase):
    pass


class EventUpdate(StrictModel):
    """Only these fields may be updated. Ownership and IDs are never client-writable."""

    name: str | None = Field(default=None, min_length=2, max_length=120)
    event_type: EventType | None = None
    event_date: datetime | None = None
    city: str | None = Field(default=None, min_length=2, max_length=120)
    location_tier: LocationTier | None = None
    guest_count: int | None = Field(default=None, ge=1, le=5000)
    budget_cents: int | None = Field(default=None, ge=10_000, le=2_000_000_000)
    theme: ThemeKey | None = None
    venue_type: VenueType | None = None
    catering_level: CateringLevel | None = None
    decor_level: DecorLevel | None = None
    photography: PhotographyLevel | None = None
    duration_hours: float | None = Field(default=None, ge=1, le=24)
    accessibility: str | None = Field(default=None, max_length=300)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("event_date")
    @classmethod
    def _date_window(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        return normalize_event_date(value)

    @field_validator("notes", "accessibility")
    @classmethod
    def _no_control_chars(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return strip_control_chars(value)


class EventOut(BaseModel):
    id: str
    name: str
    event_type: str
    event_date: datetime
    city: str
    location_tier: str
    guest_count: int
    budget_cents: int
    currency: str
    theme: str
    venue_type: str
    catering_level: str
    decor_level: str
    photography: str
    duration_hours: float
    accessibility: str
    notes: str
    predicted_cost_cents: int | None
    risk_level: str | None
    created_at: datetime
    updated_at: datetime


class EventListOut(BaseModel):
    items: list[EventOut]
    total: int
    page: int
    page_size: int
    pages: int


class TaskCreate(StrictModel):
    title: str = Field(min_length=2, max_length=160)
    category: str = Field(default="general", max_length=40)
    due_date: date | None = None


class TaskUpdate(StrictModel):
    title: str | None = Field(default=None, min_length=2, max_length=160)
    category: str | None = Field(default=None, max_length=40)
    due_date: date | None = None
    done: bool | None = None


class TaskOut(BaseModel):
    id: str
    title: str
    category: str
    due_date: date | None
    done: bool
    created_at: datetime


class ExpenseCreate(StrictModel):
    label: str = Field(min_length=2, max_length=120)
    category: str = Field(default="other", max_length=40)
    amount_cents: int = Field(ge=1, le=1_000_000_000)
    paid: bool = False
    incurred_on: date | None = None


class ExpenseUpdate(StrictModel):
    label: str | None = Field(default=None, min_length=2, max_length=120)
    category: str | None = Field(default=None, max_length=40)
    amount_cents: int | None = Field(default=None, ge=1, le=1_000_000_000)
    paid: bool | None = None
    incurred_on: date | None = None


class ExpenseOut(BaseModel):
    id: str
    label: str
    category: str
    amount_cents: int
    paid: bool
    incurred_on: date | None
    created_at: datetime


class NoteCreate(StrictModel):
    body: str = Field(min_length=1, max_length=2000)


class NoteOut(BaseModel):
    id: str
    body: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Machine learning
# ---------------------------------------------------------------------------


class CostFeatures(StrictModel):
    event_type: EventType
    guest_count: int = Field(ge=1, le=5000)
    location_tier: LocationTier
    venue_type: VenueType
    duration_hours: float = Field(ge=1, le=24)
    catering_level: CateringLevel
    decor_level: DecorLevel
    photography: PhotographyLevel


class CostPredictionOut(BaseModel):
    predicted_cost_cents: int
    currency: Literal["USD"]
    guest_count: int
    cost_per_guest_cents: int
    factors: list[dict]
    model: dict
    limitations: list[str]


class RecommendationRequest(StrictModel):
    event_type: EventType
    guest_count: int = Field(ge=1, le=5000)
    budget_cents: int = Field(ge=10_000, le=2_000_000_000)
    style: ThemeKey
    venue_type: VenueType
    limit: int = Field(default=8, ge=1, le=24)


class RecommendationItem(BaseModel):
    id: str
    kind: str
    title: str
    description: str
    estimated_cost_band: str
    provenance: str
    score: float
    reasons: list[str]


class RecommendationOut(BaseModel):
    items: list[RecommendationItem]
    model: dict
    disclaimer: str


class BudgetRiskRequest(StrictModel):
    event_type: EventType
    guest_count: int = Field(ge=1, le=5000)
    budget_cents: int = Field(ge=10_000, le=2_000_000_000)
    predicted_cost_cents: int = Field(ge=0, le=2_000_000_000)
    contingency_pct: float = Field(default=0.0, ge=0, le=50)


class BudgetRiskOut(BaseModel):
    risk_level: RiskLevel
    confidence: float
    drivers: list[dict]
    suggestions: list[str]
    definition: str
    model: dict
    disclaimer: str


# ---------------------------------------------------------------------------
# Generative AI
# ---------------------------------------------------------------------------


class BudgetLine(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: str = Field(min_length=1, max_length=60)
    amount_cents: int = Field(ge=0, le=2_000_000_000)
    note: str = Field(default="", max_length=180)


class TimelinePhase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phase: str = Field(min_length=1, max_length=80)
    timing: str = Field(min_length=1, max_length=80)
    actions: list[str] = Field(min_length=1, max_length=8)


class ScheduleItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    time: str = Field(min_length=1, max_length=20)
    activity: str = Field(min_length=1, max_length=120)
    owner: str = Field(default="", max_length=60)


class ChecklistItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item: str = Field(min_length=1, max_length=160)
    category: str = Field(default="general", max_length=40)
    priority: Literal["must", "should", "nice"] = "should"


class EventPlanPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_summary: str = Field(min_length=10, max_length=1200)
    theme: str = Field(min_length=2, max_length=120)
    budget_breakdown: list[BudgetLine] = Field(min_length=1, max_length=12)
    recommendations: list[str] = Field(min_length=1, max_length=12)
    preparation_timeline: list[TimelinePhase] = Field(min_length=1, max_length=12)
    event_day_schedule: list[ScheduleItem] = Field(min_length=1, max_length=16)
    vendor_checklist: list[ChecklistItem] = Field(min_length=1, max_length=16)
    cost_saving_suggestions: list[str] = Field(min_length=1, max_length=10)
    assumptions: list[str] = Field(default_factory=list, max_length=8)
    warnings: list[str] = Field(default_factory=list, max_length=8)

    @model_validator(mode="after")
    def _cap_lengths(self):
        for field in ("recommendations", "cost_saving_suggestions", "assumptions", "warnings"):
            items = getattr(self, field)
            for item in items:
                if len(item) > 400:
                    raise ValueError(f"{field} entries must be under 400 characters")
        return self


class PlanOut(BaseModel):
    id: str
    event_id: str
    engine: str
    model: str
    schema_version: str
    created_at: datetime
    plan: EventPlanPayload
    ai_configured: bool


class GeneratePlanRequest(StrictModel):
    event_id: str = Field(min_length=8, max_length=64, pattern=r"^[a-f0-9]+$")
    focus: str = Field(default="", max_length=400)
    revision_notes: str = Field(default="", max_length=600)


class ChatTurn(StrictModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1500)


class ChatRequest(StrictModel):
    event_id: str = Field(min_length=8, max_length=64, pattern=r"^[a-f0-9]+$")
    message: str = Field(min_length=1, max_length=1500)
    history: Annotated[list[ChatTurn], Field(max_length=6)] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str
    engine: str
    model: str
    grounded_on: str
    warnings: list[str] = Field(default_factory=list)
