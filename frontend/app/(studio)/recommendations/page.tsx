import type { Metadata } from "next";

import { RecommendationsClient } from "@/components/studio/recommendations-client";
import { PageHeader } from "@/components/studio/ui";
import { serverApiOrNull } from "@/lib/server";
import type { EventList } from "@/lib/types";

export const metadata: Metadata = { title: "Recommendations", robots: { index: false } };

export default async function RecommendationsPage() {
  const events = await serverApiOrNull<EventList>("/api/events?page=1&page_size=50");

  return (
    <>
      <PageHeader
        eyebrow="Recommendation engine"
        title={<>Concepts, <span className="display-italic">ranked.</span></>}
        description="A content-based NearestNeighbors model matches your event against an original 24-piece catalogue. Each concept carries a plain-language reason for surfacing — and an honest provenance label."
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
          <p className="eyebrow text-[9px] text-ink-mute">How</p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-soft">
            Style, occasion, venue, budget per guest, and capacity are vectorised and compared with cosine distance.
          </p>
        </div>
        <div>
          <p className="eyebrow text-[9px] text-ink-mute">What it is not</p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-soft">
            Not vendor inventory, not availability, and not a booking. Prices are planning bands, not quotes.
          </p>
        </div>
      </div>
    </>
  );
}
