import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDownRight,
  Download,
  ArrowRight,
  BadgeCheck,
  Bot,
  ChartNoAxesColumnIncreasing,
  CircleCheck,
  Database,
  FileJson,
  Fingerprint,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { CostEstimator } from "@/components/landing/estimator";
import { ExamplePlanDownload } from "@/components/landing/example-plan-download";
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

const occasionLabels = ["Festivals", "Corporate", "Weddings", "Engagements", "Community", "Birthdays"];

const exampleBudgetLines = [
  { category: "Venue & site", amount: 11700 },
  { category: "Catering & service", amount: 13500 },
  { category: "Florals & decoration", amount: 5400 },
  { category: "Photography", amount: 4950 },
  { category: "Contingency", amount: 2700 },
  { category: "Other costs", amount: 6750 },
];

const exampleBudgetTotal = exampleBudgetLines.reduce((total, line) => total + line.amount, 0);
const exampleCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

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
    question: "Is this a real price quote?",
    answer:
      "No. Cost estimates use computer-generated sample data and planning assumptions, not current prices from local suppliers. Use the estimate as an early budget guide and ask venues and suppliers for written quotes.",
  },
  {
    question: "What happens to my details when I use the AI assistant?",
    answer:
      "If an AI provider is enabled, relevant event details and your message may be sent to that provider to create a reply or plan. The provider's data policies apply. If no provider is enabled, the built-in planner creates a draft locally. Avoid adding sensitive personal information.",
  },
  {
    question: "Who can see my saved event?",
    answer:
      "Eventora checks account ownership whenever someone opens an event, plan, note, task, or expense. Other user accounts cannot view your records. The operator of a self-hosted instance may have access to its database, so choose an instance and hosting provider you trust.",
  },
  {
    question: "Can I download or delete my data?",
    answer:
      "Open Settings, then Privacy & data, to download your account and event records or delete all event data. Deleting your account permanently removes the account and its records.",
  },
  {
    question: "Does Eventora contact or book suppliers?",
    answer:
      "No. Eventora does not contact suppliers, check live prices or availability, or make bookings. Recommendations come from the in-app catalogue; use the checklist to confirm details directly with suppliers.",
  },
  {
    question: "Where can I see my event-day flowchart?",
    answer:
      "Create an event and generate its plan, then open the Timeline tab. You will find a flowchart built from that event's schedule, along with a preparation timeline.",
  },
];

const securityItems = [
  {
    icon: Fingerprint,
    title: "Events are tied to your account",
    body: "Your saved event, plan, notes, tasks, and expenses are only available to the signed-in account that created them.",
  },
  {
    icon: KeyRound,
    title: "Clear about AI data use",
    body: "When an AI provider is enabled, relevant event details are sent to it for your request. The provider key stays on the server. Without a provider, the built-in planner creates a draft without contacting an external AI service.",
  },
  {
    icon: Download,
    title: "You can export or delete your data",
    body: "Settings lets you download account and event records, delete all event data, or permanently delete your account.",
  },
  {
    icon: ShieldCheck,
    title: "Planning help, not live bookings",
    body: "Cost estimates use generated sample data. Eventora does not verify supplier prices or availability, contact vendors, or place bookings.",
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

          <div className="relative z-10 overflow-hidden border-t border-line bg-ivory/60 py-3.5">
            <div className="shell">
              <div className="occasion-ticker" role="group" aria-label="Event occasions">
                <div className="occasion-ticker-track">
                  {[false, true].map((isClone) => (
                    <div
                      className="occasion-ticker-group"
                      aria-hidden={isClone || undefined}
                      key={isClone ? "clone" : "original"}
                    >
                      {occasionLabels.map((label) => (
                        <span className="occasion-ticker-entry" key={label}>
                          <span className="occasion-ticker-item">{label}</span>
                          <span className="occasion-ticker-dot" aria-hidden>·</span>
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
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
                <article key={step.number} className="bg-[#fbf9f3] p-6 sm:p-8">
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-[52px] font-semibold leading-none text-burgundy">{step.number}</span>
                    <Mark className="h-4 w-4 text-burgundy" />
                  </div>
                  <h3 className="mt-8 font-display text-[26px]">{step.title}</h3>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-ink">{step.body}</p>
                  <p className="mt-6 border-t border-line pt-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
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
                  <p className="eyebrow text-champagne">03 / Cost planning</p>
                </div>
                <h2 className="display mt-5 text-[clamp(2.5rem,5.3vw,4.8rem)] text-ivory">
                  Plan your budget
                  <br />
                  <span className="display-italic text-champagne">before you book.</span>
                </h2>
                <p className="mt-6 max-w-[48ch] text-[14.5px] leading-relaxed text-[#b9b3a4]">
                  Add a few details about your event to see an estimated total and cost per guest. Use it as an
                  early planning guide; it is not a quote from a venue or supplier.
                </p>

                <div className="mt-9 space-y-5">
                  {[
                    {
                      icon: ChartNoAxesColumnIncreasing,
                      title: "See an estimated cost",
                      body: "Get a rough total based on your occasion, guest count, location, venue, catering, and decor.",
                    },
                    {
                      icon: Sparkles,
                      title: "Find ideas that fit",
                      body: "Browse event concepts matched to your occasion, style, venue, guest count, and budget.",
                    },
                    {
                      icon: BadgeCheck,
                      title: "Check for budget pressure",
                      body: "A low, medium, or high warning can help you spot when your budget may be tight. It is a guide, not a guarantee.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="flex gap-4 border-t border-line-dark pt-4">
                      <item.icon size={18} aria-hidden className="mt-0.5 shrink-0 text-champagne" />
                      <div>
                        <h3 className="text-[15px] font-semibold text-ivory">{item.title}</h3>
                        <p className="mt-1 text-[14px] leading-relaxed text-[#c9c2b2]">{item.body}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 grid grid-cols-2 gap-px border border-line-dark bg-line-dark sm:grid-cols-3">
                  {[
                    { label: "Typical sample test gap*", value: costMetrics ? `$${Math.round(costMetrics.mae_usd).toLocaleString()}` : "N/A" },
                    { label: "Sample event plans", value: metrics?.cost?.dataset?.rows?.toLocaleString() ?? "N/A" },
                    { label: "Budget alerts correct*", value: riskMetrics ? `${(riskMetrics.accuracy * 100).toFixed(1)}%` : "N/A" },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-analytics p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#c9c2b2]">{stat.label}</p>
                      <p className="mt-1.5 font-display text-[22px] text-ivory">{stat.value}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-[#c9c2b2]">
                  *These figures use computer-generated examples, not real supplier prices. They show how the
                  models handled those examples; your actual event costs may differ.
                </p>
              </div>

              <div className="lg:pt-10">
                <CostEstimator />
                <div className="mt-4 flex items-start gap-2.5 border border-line-dark p-3 text-[11px] leading-relaxed text-[#a9a396]">
                  <Database size={14} aria-hidden className="mt-0.5 shrink-0 text-sage" />
                  This estimate uses sample data, so treat it as a starting point. Confirm actual prices with
                  venues and suppliers before you book.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Assistant */}
        <section id="assistant" className="border-b border-line py-16 sm:py-24">
          <div className="shell grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <p className="eyebrow text-burgundy">04 / Planning assistant</p>
              <h2 className="display mt-3 text-[clamp(2.4rem,5vw,4.2rem)]">
                Turn your event idea into an <span className="display-italic">action plan.</span>
              </h2>
              <p className="mt-6 max-w-[46ch] text-[14.5px] leading-relaxed text-ink-soft">
                Share a few event details to get a first draft with a budget breakdown, preparation timeline,
                event-day schedule, and supplier checklist. Review and edit the plan before saving it. If the
                AI service is unavailable, the built-in planner can still create a draft.
              </p>

              <ul className="mt-7 grid grid-cols-1 gap-x-5 gap-y-2.5 text-[13px] sm:grid-cols-2">
                {[
                  "Event overview and theme",
                  "Budget by category",
                  "Ideas that fit your event",
                  "Preparation timeline",
                  "Event-day schedule",
                  "Supplier checklist",
                  "Ways to save money",
                  "Planning assumptions",
                  "Items to double-check",
                ].map((field) => (
                  <li key={field} className="flex items-center gap-2 border-b border-line/70 pb-1.5">
                    <CircleCheck size={12} aria-hidden className="text-burgundy" />
                    <span className="text-ink-soft">{field}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex items-start gap-3 border-l-2 border-sage bg-sage-soft/40 p-4">
                <Bot size={17} aria-hidden className="mt-0.5 shrink-0 text-ink-soft" />
                <p className="text-[12px] leading-relaxed text-ink-soft">
                  Your draft is a starting point. Confirm prices, dates, and supplier availability directly;
                  Eventora does not contact or book suppliers.
                </p>
              </div>

              <ButtonLink href="/events/new" className="mt-6">
                Build my event plan <ArrowRight size={15} aria-hidden />
              </ButtonLink>
            </div>

            <div className="example-plan-frame">
              <article className="example-plan-document" aria-label="Illustrative event plan">
                <header className="example-plan-header">
                  <div>
                    <p className="example-plan-kicker">Example plan · illustrative only</p>
                    <h3 className="example-plan-title">Event plan</h3>
                  </div>
                  <div className="example-plan-brand" aria-label="Eventora AI">
                    <span className="example-plan-window-dots" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>Eventora AI</span>
                  </div>
                </header>

                <section className="example-plan-event" aria-labelledby="example-plan-event-title">
                  <div>
                    <p className="example-plan-label">Event summary</p>
                    <h4 id="example-plan-event-title" className="example-plan-event-title">Garden wedding</h4>
                    <p className="example-plan-summary">
                      A garden wedding for 120 guests with dinner, simple floral decor, and an outdoor ceremony near sunset.
                    </p>
                  </div>
                  <dl className="example-plan-meta">
                    <div>
                      <dt>Occasion</dt>
                      <dd>Wedding</dd>
                    </div>
                    <div>
                      <dt>Guest count</dt>
                      <dd>120 guests</dd>
                    </div>
                  </dl>
                </section>

                <section className="example-plan-budget" aria-labelledby="example-plan-budget-title">
                  <div className="example-plan-budget-heading">
                    <div>
                      <p className="example-plan-label">Example budget (USD)</p>
                      <h4 id="example-plan-budget-title">A considered allocation</h4>
                    </div>
                    <span className="example-plan-budget-total">{exampleCurrency.format(exampleBudgetTotal)}</span>
                  </div>
                  <p className="example-plan-budget-note">Illustrative amounts only; confirm costs with suppliers.</p>
                  <table className="example-plan-table">
                    <thead>
                      <tr>
                        <th scope="col">Description</th>
                        <th scope="col">Estimated cost</th>
                        <th scope="col">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exampleBudgetLines.map((line) => (
                        <tr key={line.category}>
                          <td>{line.category}</td>
                          <td>{exampleCurrency.format(line.amount)}</td>
                          <td>{Math.round((line.amount / exampleBudgetTotal) * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row">Total example budget</th>
                        <td colSpan={2}>{exampleCurrency.format(exampleBudgetTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </section>

                <section className="example-plan-notes" aria-label="Planning notes">
                  <div>
                    <p className="example-plan-label">Before the event</p>
                    <ul>
                      <li><span>16 weeks out</span>Confirm date and venue.</li>
                      <li><span>8 weeks out</span>Confirm menu and decor.</li>
                      <li><span>2 weeks out</span>Share the final schedule with suppliers.</li>
                    </ul>
                  </div>
                  <div className="example-plan-double-check">
                    <p className="example-plan-label">Double-check</p>
                    <p>Have a rain backup for the outdoor ceremony. Confirm the venue has enough power.</p>
                  </div>
                </section>

                <footer className="example-plan-footer">
                  <span><FileJson size={13} aria-hidden /> A thoughtful starting point for your celebration.</span>
                  <span>EVENTORA AI</span>
                </footer>
              </article>
              <div className="example-plan-actions">
                <ExamplePlanDownload
                  budgetLines={exampleBudgetLines}
                  budgetTotal={exampleBudgetTotal}
                />
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
                  Your privacy and <span className="display-italic">choices.</span>
                </h2>
              </div>
              <p className="max-w-[48ch] text-[14px] leading-relaxed text-ink-soft">
                Your events are separated by account, AI use is explained, and Settings gives you ways to
                download or delete your records. Here is what that means in practice.
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
            <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-[70ch] text-[11.5px] leading-relaxed text-ink-mute">
                This project has not had an independent security audit. The operator of a self-hosted instance may
                have access to its stored data.
              </p>
              <ButtonLink href="/settings" variant="outline" size="sm" className="shrink-0">
                Open privacy settings <ArrowRight size={13} aria-hidden />
              </ButtonLink>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-b border-line py-16 sm:py-24">
          <div className="shell grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="eyebrow text-burgundy">06 / Questions</p>
              <h2 className="display mt-3 text-[clamp(2.2rem,4.4vw,3.6rem)]">
                Common <span className="display-italic">questions.</span>
              </h2>
              <p className="mt-5 max-w-[32ch] text-[13px] leading-relaxed text-ink-mute">
                Straight answers about your event data, estimates, suppliers, and event schedule.
              </p>
            </div>
            <div className="border-t border-line">
              {faqs.map((faq, index) => (
                <details key={faq.question} name="eventora-faq" className="group border-b border-line py-4" open={index === 0}>
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
