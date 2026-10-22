import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  Bot,
  ChartNoAxesColumnIncreasing,
  CircleCheck,
  Database,
  FileJson,
  Fingerprint,
  KeyRound,
  ScanEye,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { CostEstimator } from "@/components/landing/estimator";
import { LandingHeader } from "@/components/landing/header";
import { ButtonLink } from "@/components/ui/button";
import { Mark } from "@/components/ui/logo";
import { serverApiOrNull } from "@/lib/server";
import type { MLMetrics } from "@/lib/types";

export const metadata: Metadata = {
  title: "Eventora AI — Your imagination. Intelligently orchestrated.",
  description:
    "The editorial event atelier: plan weddings, birthdays, festivals, and corporate gatherings with ML cost intelligence and a validated generative planning assistant.",
};

const categories = [
  {
    title: "Weddings",
    note: "Ceremony, dinner, and the after-party hour.",
    image: "/images/wedding.jpg",
    alt: "An outdoor wedding table styled with white florals and candles",
    span: "md:col-span-7",
    ratio: "aspect-[16/10]",
  },
  {
    title: "Milestones",
    note: "Birthdays, anniversaries, and the people who matter.",
    image: "/images/birthday.jpg",
    alt: "A birthday celebration with balloons and warm lights",
    span: "md:col-span-5",
    ratio: "aspect-[4/5]",
  },
  {
    title: "Campus & culture",
    note: "Festivals, showcases, and community programmes.",
    image: "/images/table.jpg",
    alt: "A long banquet table set for a celebration under warm light",
    span: "md:col-span-5",
    ratio: "aspect-[4/5]",
  },
  {
    title: "Corporate",
    note: "Launches, offsites, and rooms that say something.",
    image: "/images/corporate.jpg",
    alt: "Guests mingling at a contemporary corporate reception",
    span: "md:col-span-7",
    ratio: "aspect-[16/10]",
  },
];

const steps = [
  {
    number: "01",
    title: "Write the brief",
    body: "Set the occasion, date, guest ceiling, budget, and the details that actually shape a room: venue type, catering level, decoration, photography, accessibility.",
    detail: "Validated on the client and again on the server",
  },
  {
    number: "02",
    title: "Read the intelligence",
    body: "The cost model estimates a planning range. The recommendation engine ranks catalogue concepts by style, scale, and budget. Risk triage flags where the plan is thin.",
    detail: "Three trained models · honest limitations",
  },
  {
    number: "03",
    title: "Direct the plan",
    body: "Generate a structured plan, revise it with notes, then run the workspace: timeline, event-day schedule, vendor checklist, tasks, expenses, and the assistant.",
    detail: "Everything saved per event, per account",
  },
];

const faqs = [
  {
    question: "Is the cost estimate a real quote?",
    answer:
      "No. The Random Forest is trained on a synthetic dataset generated from documented planning assumptions, because no suitably licensed transaction dataset was available. It produces a planning range in USD, not a vendor quote, and its holdout metrics measure recovery of the generator's cost structure — not market accuracy. Always validate with written supplier quotes.",
  },
  {
    question: "How does the AI planning assistant work?",
    answer:
      "The backend calls an OpenAI-compatible provider server-side, with the API key held only in server environment variables. Output is validated against a strict Pydantic schema before it is saved or shown. If no provider is configured, or the provider fails, a clearly labelled deterministic planner produces the same structured shape, so the product keeps working.",
  },
  {
    question: "Who can see my event?",
    answer:
      "Only the signed-in account that created it. Every read, update, and delete is filtered by owner on the server. Another account using the same event ID receives a 404, which avoids confirming that the record exists.",
  },
  {
    question: "Does Eventora book vendors or check availability?",
    answer:
      "No. Recommendations come from an original editorial catalogue and do not represent live vendor inventory. No availability, booking, or price is verified. The vendor checklist is a tool for confirming those details directly.",
  },
  {
    question: "Is the application search-engine indexed?",
    answer:
      "The landing page is public. Dashboard, events, recommendations, settings, and authentication routes are excluded in robots.txt, and authenticated API responses are marked no-store.",
  },
];

const securityItems = [
  {
    icon: KeyRound,
    title: "Secrets stay server-side",
    body: "Provider keys are read from server environment variables only. The browser bundle never receives them, and settings displays configuration status without values.",
  },
  {
    icon: Fingerprint,
    title: "Ownership on every record",
    body: "Event, task, expense, note, and plan queries are scoped to the authenticated user. Client-supplied IDs are never accepted as proof of identity.",
  },
  {
    icon: ScanEye,
    title: "Validated at the boundary",
    body: "Strict Pydantic schemas reject unexpected fields, oversized input, and non-finite numbers. SQL goes through a parameterised ORM layer.",
  },
  {
    icon: ShieldCheck,
    title: "Bounded and rate-limited",
    body: "Body-size caps, request timeouts, token ceilings, CSRF protection, and database-backed rate limits on authentication, AI, and ML endpoints.",
  },
];

export default async function LandingPage() {
  const metrics = await serverApiOrNull<MLMetrics>("/api/ml/metrics");
  const costMetrics = metrics?.cost?.metrics;
  const riskMetrics = metrics?.budget_risk?.metrics;

  return (
    <>
      <LandingHeader />
      <main id="main">
        {/* Hero */}
        <section className="grain relative overflow-hidden border-b border-line">
          <div className="shell grid items-end gap-12 pb-14 pt-12 lg:grid-cols-[1.06fr_0.94fr] lg:gap-16 lg:pb-20 lg:pt-16">
            <div className="animate-rise relative z-10">
              <div className="mb-7 flex items-center gap-3">
                <span className="h-px w-10 bg-burgundy" />
                <p className="eyebrow text-burgundy">The editorial event atelier</p>
              </div>
              <h1 className="display text-[clamp(3.2rem,7.4vw,7.1rem)]">
                Your imagination.
                <br />
                <span className="display-italic">Intelligently</span>
                <br />
                orchestrated.
              </h1>
              <p className="mt-7 max-w-[46ch] text-[15.5px] leading-relaxed text-ink-soft sm:text-[16.5px]">
                A planning studio for weddings, milestones, festivals, and gatherings that deserve a point of
                view. Bring the idea and the budget. Eventora estimates the cost, explains the risk, and turns
                the brief into a plan you can actually run.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonLink href="/events/new">
                  Plan an event <ArrowRight size={15} aria-hidden />
                </ButtonLink>
                <ButtonLink href="#intelligence" variant="outline">
                  Explore the experience
                </ButtonLink>
              </div>
              <dl className="mt-12 grid grid-cols-3 gap-4 border-t border-line pt-5 text-[11.5px]">
                <div>
                  <dt className="eyebrow text-[9px] text-ink-mute">Intelligence</dt>
                  <dd className="mt-1.5 font-medium">3 trained models</dd>
                </div>
                <div>
                  <dt className="eyebrow text-[9px] text-ink-mute">Assistant</dt>
                  <dd className="mt-1.5 font-medium">Schema-validated plans</dd>
                </div>
                <div>
                  <dt className="eyebrow text-[9px] text-ink-mute">Currency</dt>
                  <dd className="mt-1.5 font-medium">USD planning ranges</dd>
                </div>
              </dl>
            </div>

            <div className="animate-fade relative z-10">
              <div className="absolute -left-4 -top-4 hidden h-full w-full border border-champagne sm:block" aria-hidden />
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-ivory-deep">
                <Image
                  src="/images/wedding.jpg"
                  alt="An intimate outdoor wedding ceremony styled with soft white florals and natural light"
                  fill
                  priority
                  sizes="(max-width: 1024px) 92vw, 44vw"
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent p-5 pt-20 text-ivory">
                  <p className="eyebrow text-[9px] text-champagne">Atelier note · 001</p>
                  <p className="mt-2 max-w-[19ch] font-display text-[26px] leading-[1.05]">
                    “Plan the feeling first. The rest is logistics.”
                  </p>
                </div>
              </div>
              <div className="absolute -top-10 -right-6 z-20 hidden w-[230px] border border-line bg-ivory p-4 shadow-[0_18px_50px_-30px_rgba(23,23,21,0.5)] sm:block">
                <div className="flex items-center gap-2">
                  <ChartNoAxesColumnIncreasing size={15} aria-hidden className="text-burgundy" />
                  <p className="eyebrow text-[9px]">Model card</p>
                </div>
                <p className="mt-2 font-display text-[34px] leading-none">
                  {costMetrics ? costMetrics.r2.toFixed(3) : "—"}
                </p>
                <p className="mt-1 text-[10.5px] leading-snug text-ink-mute">
                  R² on the synthetic holdout set. Generator recovery, not market accuracy.
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-10 border-t border-line bg-ivory/60">
            <div className="shell flex flex-wrap items-center justify-between gap-x-8 gap-y-2 py-3.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-mute">
              <span>Weddings</span>
              <span aria-hidden>·</span>
              <span>Engagements</span>
              <span aria-hidden>·</span>
              <span>Birthdays</span>
              <span aria-hidden>·</span>
              <span>Festivals</span>
              <span aria-hidden>·</span>
              <span>Community</span>
              <span aria-hidden>·</span>
              <span>Corporate</span>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section id="categories" className="border-b border-line py-16 sm:py-24">
          <div className="shell">
            <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="eyebrow text-burgundy">01 / Occasions</p>
                <h2 className="display mt-3 max-w-[16ch] text-[clamp(2.4rem,5vw,4.2rem)]">
                  A studio for rooms with a point of view.
                </h2>
              </div>
              <p className="max-w-[38ch] text-[14px] leading-relaxed text-ink-mute md:text-right">
                Each occasion changes the shape of the plan: the staffing ratio, the menu format, the
                production, and what the budget can honestly carry.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
              {categories.map((category, index) => (
                <article key={category.title} className={`group ${category.span}`}>
                  <div className={`relative overflow-hidden bg-ivory-deep ${category.ratio}`}>
                    <Image
                      src={category.image}
                      alt={category.alt}
                      fill
                      sizes="(max-width: 768px) 92vw, 50vw"
                      className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035]"
                    />
                    <div className="absolute inset-0 bg-ink/10 transition-colors duration-500 group-hover:bg-ink/20" />
                    <span className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center border border-ivory/40 bg-ink/30 text-[10px] font-semibold text-ivory backdrop-blur-sm">
                      0{index + 1}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4 border-b border-line py-3.5">
                    <div>
                      <h3 className="font-display text-[23px] leading-none">{category.title}</h3>
                      <p className="mt-1.5 text-[12.5px] text-ink-mute">{category.note}</p>
                    </div>
                    <ArrowDownRight
                      size={18}
                      aria-hidden
                      className="mt-1 shrink-0 text-ink-mute transition-colors group-hover:text-burgundy"
                    />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Process */}
        <section id="process" className="border-b border-line bg-ivory-deep/40 py-16 sm:py-24">
          <div className="shell">
            <div className="mb-12 grid gap-6 md:grid-cols-[0.9fr_1.1fr] md:items-end">
              <div>
                <p className="eyebrow text-burgundy">02 / Process</p>
                <h2 className="display mt-3 text-[clamp(2.4rem,5vw,4.2rem)]">
                  Brief. Read. <span className="display-italic">Direct.</span>
                </h2>
              </div>
              <p className="max-w-[46ch] text-[14px] leading-relaxed text-ink-soft">
                The studio is deliberately sequential. A clear brief produces a usable estimate; the estimate
                makes risk visible; the plan turns all of it into decisions, owners, and dates.
              </p>
            </div>

            <div className="grid gap-px border border-line bg-line md:grid-cols-3">
              {steps.map((step) => (
                <article key={step.number} className="bg-ivory p-6 sm:p-8">
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-[52px] leading-none text-champagne">{step.number}</span>
                    <Mark className="h-4 w-4 text-ink-mute" />
                  </div>
                  <h3 className="mt-8 font-display text-[26px]">{step.title}</h3>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">{step.body}</p>
                  <p className="mt-6 border-t border-line pt-3 text-[10.5px] uppercase tracking-[0.12em] text-ink-mute">
                    {step.detail}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Intelligence */}
        <section id="intelligence" className="bg-analytics py-16 text-[#ece7dc] sm:py-24">
          <div className="shell">
            <div className="grid gap-12 lg:grid-cols-[1fr_0.92fr] lg:gap-16">
              <div>
                <div className="flex items-center gap-3">
                  <span className="h-px w-10 bg-champagne" />
                  <p className="eyebrow text-champagne">03 / Machine intelligence</p>
                </div>
                <h2 className="display mt-5 text-[clamp(2.5rem,5.3vw,4.8rem)] text-ivory">
                  The budget,
                  <br />
                  <span className="display-italic text-champagne">before</span> the invoices.
                </h2>
                <p className="mt-6 max-w-[48ch] text-[14.5px] leading-relaxed text-[#b9b3a4]">
                  A Random Forest regressor trained on nine event features returns a planning estimate with a
                  per-guest breakdown. It does not pretend to be a quote. It surfaces the drivers, the model
                  card, and the caveats in the same panel.
                </p>

                <div className="mt-9 space-y-5">
                  {[
                    {
                      icon: ChartNoAxesColumnIncreasing,
                      title: "Cost prediction",
                      body: "RandomForestRegressor · OneHotEncoder for categorical features · joblib pipeline with a reproducible training script.",
                    },
                    {
                      icon: Sparkles,
                      title: "Recommendation engine",
                      body: "NearestNeighbors over a 24-piece curated catalogue using style, occasion, venue, budget-per-guest, and capacity vectors.",
                    },
                    {
                      icon: BadgeCheck,
                      title: "Budget-risk triage",
                      body: "DecisionTreeClassifier with documented rule-derived labels: low, medium, and high, each with a plain-language definition.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="flex gap-4 border-t border-line-dark pt-4">
                      <item.icon size={18} aria-hidden className="mt-0.5 shrink-0 text-champagne" />
                      <div>
                        <h3 className="text-[13px] font-bold uppercase tracking-[0.1em] text-ivory">{item.title}</h3>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-[#a9a396]">{item.body}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 grid grid-cols-2 gap-px border border-line-dark bg-line-dark sm:grid-cols-4">
                  {[
                    { label: "Holdout MAE", value: costMetrics ? `$${Math.round(costMetrics.mae_usd).toLocaleString()}` : "—" },
                    { label: "Holdout R²", value: costMetrics ? costMetrics.r2.toFixed(3) : "—" },
                    { label: "Synthetic rows", value: metrics?.cost?.dataset?.rows?.toLocaleString() ?? "—" },
                    { label: "Risk accuracy", value: riskMetrics ? riskMetrics.accuracy.toFixed(3) : "—" },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-analytics p-3.5">
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8f897c]">{stat.label}</p>
                      <p className="mt-1.5 font-display text-[22px] text-ivory">{stat.value}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10.5px] leading-relaxed text-[#7f7a6e]">
                  Metrics come from a reproducible synthetic holdout split. They show the models recover the
                  generator&apos;s assumptions. They are not evidence of real-world forecast accuracy.
                </p>
              </div>

              <div className="lg:pt-10">
                <CostEstimator />
                <div className="mt-4 flex items-start gap-2.5 border border-line-dark p-3 text-[11px] leading-relaxed text-[#a9a396]">
                  <Database size={14} aria-hidden className="mt-0.5 shrink-0 text-sage" />
                  Model artifacts are generated locally by <code className="text-[#d8d0bf]">scripts/train_models.py</code>.
                  If they are missing, the API reports an honest 503 instead of inventing a prediction.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Assistant */}
        <section id="assistant" className="border-b border-line py-16 sm:py-24">
          <div className="shell grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <p className="eyebrow text-burgundy">04 / Generative planning</p>
              <h2 className="display mt-3 text-[clamp(2.4rem,5vw,4.2rem)]">
                A plan with <span className="display-italic">structure.</span>
              </h2>
              <p className="mt-6 max-w-[46ch] text-[14.5px] leading-relaxed text-ink-soft">
                The assistant returns a validated object, never loose prose pretending to be a plan. Every
                section has an explicit schema, and the server validates it before saving. If the provider is
                unavailable, the deterministic fallback produces the same shape and says so.
              </p>

              <ul className="mt-7 grid grid-cols-2 gap-x-5 gap-y-2.5 text-[12.5px]">
                {[
                  "event_summary",
                  "theme",
                  "budget_breakdown",
                  "recommendations",
                  "preparation_timeline",
                  "event_day_schedule",
                  "vendor_checklist",
                  "cost_saving_suggestions",
                  "assumptions",
                  "warnings",
                ].map((field) => (
                  <li key={field} className="flex items-center gap-2 border-b border-line/70 pb-1.5">
                    <CircleCheck size={12} aria-hidden className="text-burgundy" />
                    <span className="font-mono text-[11.5px] text-ink-soft">{field}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex items-start gap-3 border-l-2 border-sage bg-sage-soft/40 p-4">
                <Bot size={17} aria-hidden className="mt-0.5 shrink-0 text-ink-soft" />
                <p className="text-[12px] leading-relaxed text-ink-soft">
                  Prompts treat notes and revision requests as untrusted data. The model receives no tools,
                  cannot execute code, and cannot confirm vendor availability. Provider keys never reach the
                  browser.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -right-3 -top-3 hidden h-full w-full border border-champagne sm:block" aria-hidden />
              <div className="relative border border-line bg-[#fbf9f3]">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-burgundy" />
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.14em]">Plan preview</p>
                  </div>
                  <span className="label-chip text-[8.5px]">Illustrative example</span>
                </div>
                <div className="max-h-[480px] overflow-auto scroll-slim p-4 sm:p-5">
                  <p className="eyebrow text-[8.5px] text-ink-mute">Event summary</p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                    An intimate garden wedding for 120 guests in a warm minimal register: a long-table dinner,
                    a single suspended floral gesture, and a ceremony timed to the last hour of light.
                  </p>
                  <div className="mt-4 border-t border-line pt-3">
                    <p className="eyebrow text-[8.5px] text-ink-mute">Budget breakdown · USD</p>
                    <ul className="mt-2 space-y-1.5">
                      {[
                        ["Venue & site", "$11,700", "26%"],
                        ["Catering & service", "$13,500", "30%"],
                        ["Florals & decoration", "$5,400", "12%"],
                        ["Photography", "$4,950", "11%"],
                        ["Contingency", "$2,700", "6%"],
                      ].map(([label, amount, share]) => (
                        <li key={label} className="flex items-baseline gap-2 text-[12px]">
                          <span className="flex-1">{label}</span>
                          <span className="tabular-nums text-ink-soft">{amount}</span>
                          <span className="w-8 text-right text-[10px] text-ink-mute">{share}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-4 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
                    <div>
                      <p className="eyebrow text-[8.5px] text-ink-mute">Preparation</p>
                      <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-soft">
                        16 weeks out — lock brief and venue shortlist.
                        <br />
                        8 weeks out — menu tasting and floral mock-up.
                        <br />
                        2 weeks out — supplier run sheet issued.
                      </p>
                    </div>
                    <div>
                      <p className="eyebrow text-[8.5px] text-ink-mute">Warnings</p>
                      <p className="mt-1.5 border-l-2 border-champagne pl-2 text-[11.5px] leading-relaxed text-ink-soft">
                        Rain plan required for an outdoor ceremony. Venue power capacity unverified.
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 flex items-center gap-1.5 text-[10px] text-ink-mute">
                    <FileJson size={11} aria-hidden /> Validated against event_plan.v1 before saving.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust */}
        <section id="privacy" className="border-b border-line bg-ivory-deep/40 py-16 sm:py-24">
          <div className="shell">
            <div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr] md:items-end">
              <div>
                <p className="eyebrow text-burgundy">05 / Trust</p>
                <h2 className="display mt-3 text-[clamp(2.4rem,5vw,4.2rem)]">
                  Private by <span className="display-italic">construction.</span>
                </h2>
              </div>
              <p className="max-w-[48ch] text-[14px] leading-relaxed text-ink-soft">
                Security is part of the product surface: server-enforced ownership, bounded input, honest
                error states, and a settings page that shows configuration status without ever revealing a
                secret. The limits are documented too.
              </p>
            </div>

            <div className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-2">
              {securityItems.map((item) => (
                <article key={item.title} className="flex gap-4 bg-ivory p-5 sm:p-6">
                  <item.icon size={20} aria-hidden className="mt-0.5 shrink-0 text-burgundy" />
                  <div>
                    <h3 className="font-display text-[21px] leading-tight">{item.title}</h3>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-ink-mute">
              Implemented controls and residual risks are documented in <span className="font-mono">docs/security.md</span>.
              This is not a penetration test or a security certification.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-b border-line py-16 sm:py-24">
          <div className="shell grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="eyebrow text-burgundy">06 / Questions</p>
              <h2 className="display mt-3 text-[clamp(2.2rem,4.4vw,3.6rem)]">
                Read the <span className="display-italic">fine print.</span>
              </h2>
              <p className="mt-5 max-w-[32ch] text-[13px] leading-relaxed text-ink-mute">
                What is modelled, what is catalogue, and what is deliberately not claimed.
              </p>
            </div>
            <div className="border-t border-line">
              {faqs.map((faq, index) => (
                <details key={faq.question} className="group border-b border-line py-4" open={index === 0}>
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-5 text-[14.5px] font-semibold marker:hidden">
                    <span className="flex gap-4">
                      <span className="mt-0.5 font-mono text-[10px] text-ink-mute">0{index + 1}</span>
                      {faq.question}
                    </span>
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-line text-[14px] text-ink-mute transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-[62ch] pl-8 text-[13px] leading-relaxed text-ink-soft">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-burgundy py-16 text-ivory sm:py-20">
          <div className="shell flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
            <div>
              <p className="eyebrow text-champagne-soft">Start with a brief</p>
              <h2 className="display mt-3 max-w-[18ch] text-[clamp(2.4rem,5vw,4.2rem)]">
                Give the idea a plan.
              </h2>
              <p className="mt-4 max-w-[44ch] text-[13.5px] leading-relaxed text-[#eadfe0]">
                Create your first event, run the cost intelligence, and generate a plan in minutes. No
                vendor is contacted. Nothing is booked.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/events/new" variant="light">
                Plan an event <ArrowRight size={15} aria-hidden />
              </ButtonLink>
              <ButtonLink href="/sign-up" variant="ghost" className="!text-ivory hover:!text-champagne">
                Create an account
              </ButtonLink>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-ivory pb-10 pt-12">
          <div className="shell">
            <div className="grid gap-10 border-b border-line pb-10 md:grid-cols-[1.3fr_0.7fr_0.7fr_0.7fr]">
              <div>
                <div className="flex items-center gap-2.5">
                  <Mark className="h-7 w-7" />
                  <span className="font-display text-[24px]">Eventora AI</span>
                </div>
                <p className="mt-3 max-w-[30ch] text-[12.5px] leading-relaxed text-ink-mute">
                  Your imagination. Intelligently orchestrated. An editorial celebration studio with
                  transparent machine intelligence.
                </p>
                <p className="mt-5 text-[10.5px] uppercase tracking-[0.14em] text-ink-mute">
                  Photography via Unsplash · Free license
                </p>
              </div>
              <div>
                <p className="eyebrow text-[9px] text-ink-mute">Product</p>
                <ul className="mt-3 space-y-2 text-[12.5px]">
                  <li><Link href="/events/new" className="hover:text-burgundy">Plan an event</Link></li>
                  <li><Link href="/dashboard" className="hover:text-burgundy">Dashboard</Link></li>
                  <li><Link href="/recommendations" className="hover:text-burgundy">Recommendations</Link></li>
                  <li><Link href="/settings" className="hover:text-burgundy">Settings</Link></li>
                </ul>
              </div>
              <div>
                <p className="eyebrow text-[9px] text-ink-mute">Account</p>
                <ul className="mt-3 space-y-2 text-[12.5px]">
                  <li><Link href="/sign-in" className="hover:text-burgundy">Sign in</Link></li>
                  <li><Link href="/sign-up" className="hover:text-burgundy">Create account</Link></li>
                  <li><Link href="/forgot-password" className="hover:text-burgundy">Password reset</Link></li>
                </ul>
              </div>
              <div>
                <p className="eyebrow text-[9px] text-ink-mute">Documentation</p>
                <ul className="mt-3 space-y-2 text-[12.5px] text-ink-soft">
                  <li>Privacy &amp; data handling</li>
                  <li>Terms of use</li>
                  <li>Security model</li>
                  <li className="text-ink-mute">Repository links in the project README</li>
                </ul>
              </div>
            </div>
            <div className="flex flex-col justify-between gap-3 pt-5 text-[10.5px] uppercase tracking-[0.12em] text-ink-mute sm:flex-row">
              <p>© 2026 Eventora AI · A demonstration studio</p>
              <p>ML estimates are planning ranges, not quotes.</p>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
