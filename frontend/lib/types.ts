export type RiskLevel = "low" | "medium" | "high";

export interface User {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface AuthSession {
  user: User;
  csrf_token: string;
}

export interface EventRecord {
  id: string;
  name: string;
  event_type: string;
  event_date: string;
  city: string;
  location_tier: string;
  guest_count: number;
  budget_cents: number;
  currency: string;
  theme: string;
  venue_type: string;
  catering_level: string;
  decor_level: string;
  photography: string;
  duration_hours: number;
  accessibility: string;
  notes: string;
  predicted_cost_cents: number | null;
  risk_level: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventList {
  items: EventRecord[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface TaskRecord {
  id: string;
  title: string;
  category: string;
  due_date: string | null;
  done: boolean;
  created_at: string;
}

export interface ExpenseRecord {
  id: string;
  label: string;
  category: string;
  amount_cents: number;
  paid: boolean;
  incurred_on: string | null;
  created_at: string;
}

export interface NoteRecord {
  id: string;
  body: string;
  created_at: string;
}

export interface BudgetLine {
  category: string;
  amount_cents: number;
  note: string;
}

export interface TimelinePhase {
  phase: string;
  timing: string;
  actions: string[];
}

export interface ScheduleItem {
  time: string;
  activity: string;
  owner: string;
}

export interface ChecklistItem {
  item: string;
  category: string;
  priority: "must" | "should" | "nice";
}

export interface EventPlan {
  event_summary: string;
  theme: string;
  budget_breakdown: BudgetLine[];
  recommendations: string[];
  preparation_timeline: TimelinePhase[];
  event_day_schedule: ScheduleItem[];
  vendor_checklist: ChecklistItem[];
  cost_saving_suggestions: string[];
  assumptions: string[];
  warnings: string[];
}

export interface PlanRecord {
  id: string;
  event_id: string;
  engine: string;
  model: string;
  schema_version: string;
  created_at: string;
  plan: EventPlan;
  ai_configured: boolean;
}

export interface CostPrediction {
  predicted_cost_cents: number;
  currency: string;
  guest_count: number;
  cost_per_guest_cents: number;
  factors: { name: string; detail: string; importance: number }[];
  model: {
    name: string;
    trained: boolean;
    synthetic_training_data: boolean;
    metrics?: {
      mae_usd?: number;
      rmse_usd?: number;
      r2?: number;
      mae_pct_of_mean?: number;
    } | null;
  };
  limitations: string[];
}

export interface RecommendationItem {
  id: string;
  kind: string;
  title: string;
  description: string;
  estimated_cost_band: string;
  provenance: string;
  score: number;
  reasons: string[];
}

export interface RecommendationResult {
  items: RecommendationItem[];
  model: { name: string; catalogue_based: boolean; catalogue_size: number };
  disclaimer: string;
}

export interface BudgetRisk {
  risk_level: RiskLevel;
  confidence: number;
  drivers: { driver: string; value: string }[];
  suggestions: string[];
  definition: string;
  model: {
    name: string;
    trained: boolean;
    synthetic_training_data: boolean;
    probabilities?: Record<string, number>;
  };
  disclaimer: string;
}

export interface ChatResponse {
  reply: string;
  engine: string;
  model: string;
  grounded_on: string;
  warnings: string[];
}

export interface DashboardData {
  stats: {
    event_count: number;
    upcoming_count: number;
    total_budget_cents: number;
    total_expenses_cents: number;
    tasks_open: number;
    tasks_done: number;
    plans_generated: number;
  };
  upcoming: EventRecord[];
  recent: EventRecord[];
  risk_distribution: { low: number; medium: number; high: number; unassessed: number };
  tasks: {
    id: string;
    event_id: string;
    event_name: string;
    title: string;
    due_date: string | null;
    category: string;
  }[];
  recent_plans: {
    id: string;
    event_id: string;
    event_name: string;
    engine: string;
    created_at: string;
  }[];
  budget_chart: { name: string; budget: number; estimated: number }[];
}

export interface ConfigStatus {
  environment: string;
  auth_mode: string;
  ai: {
    configured: boolean;
    provider: string;
    model: string | null;
    fallback: string;
  };
  models: { cost: boolean; recommender: boolean; budget_risk: boolean };
  currency: string;
  limitations: string[];
}

export interface AIStatus {
  configured: boolean;
  provider: string;
  model: string | null;
  fallback_available: boolean;
  fallback_engine: string;
  max_output_tokens: number;
  timeout_seconds: number;
  structured_output_schema: string;
  data_handling: string;
}

export interface MLMetrics {
  trained: { cost: boolean; recommender: boolean; budget_risk: boolean };
  cost: {
    dataset: { rows: number; synthetic: boolean };
    metrics: { mae_usd: number; rmse_usd: number; r2: number; mae_pct_of_mean: number };
    caveats: string[];
  } | null;
  budget_risk: {
    metrics: { accuracy: number; macro_f1: number };
    caveats: string[];
  } | null;
  recommender: { catalogue_size: number; caveats: string[] } | null;
  limitations: string[];
}
