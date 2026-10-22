import type { Metadata } from "next";

import { RecommendationsClient } from "@/components/studio/recommendations-client";
import { PageHeader } from "@/components/studio/ui";
import { serverApiOrNull } from "@/lib/server";
import type { EventList } from "@/lib/types";

export const metadata: Metadata = { title: "Recommendations", robots: { index: false } };

export default async function RecommendationsPage() {
  const events = await serverApiOrNull<EventList>("/api/events?page=1&page_size=50");

  return (
    <div className="recommendations-page">
      <PageHeader
        eyebrow="Recommendation engine"
        title={<>Ideas for <span className="display-italic">your event.</span></>}
        description="Explore event ideas matched to your occasion, guest count, budget, style, and venue. Each suggestion includes why it may fit and an estimated planning cost."
      />
      <RecommendationsClient events={events?.items ?? []} />

      <div className="mt-8 grid gap-4 border-t border-line pt-6 md:grid-cols-3">
        <div>
          <p className="eyebrow text-[9px] text-ink-mute">What is ranked</p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-soft">
            Themes, decoration, catering formats, activities, and service bundles.
          </p>
        </div>
        <div>
          <p className="eyebrow text-[9px] text-ink-mute">How suggestions are ordered</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">
            Event details are compared with the catalogue; closer matches appear first.
          </p>
        </div>
        <div>
          <p className="eyebrow text-[9px] text-ink-mute">Before you decide</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">
            Ideas are inspiration, not supplier availability or bookings. Cost bands are planning estimates, not quotes.
          </p>
        </div>
      </div>
    </div>
  );
}
