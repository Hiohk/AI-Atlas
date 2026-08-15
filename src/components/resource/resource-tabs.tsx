"use client";

import Link from "next/link";
import { useState } from "react";
import { ResourceCard } from "@/components/resource/resource-card";
import { ReviewForm } from "@/components/resource/review-form";
import { Icon } from "@/components/ui/icon";
import { Avatar, Callout, Card, Chip, EmptyState, StarRating } from "@/components/ui/primitives";
import { useDictionary, useLocale } from "@/components/providers/preferences-provider";
import { formatMessage } from "@/lib/i18n/dictionary";
import type { ResourceDetail } from "@/lib/queries/resources";
import type { ResourceListItem } from "@/lib/queries/types";
import { cn, relativeTime } from "@/lib/utils";

type Review = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  helpfulCount: number;
  author: { username: string; displayName: string; avatarUrl: string | null; headline: string | null };
};

type Audience = {
  learners: Array<{ displayName: string; avatarUrl: string | null; headline: string | null; state: string }>;
  states: Array<{ state: string; count: number }>;
  pathsIncluding: Array<{ slug: string; title: string; icon: string; accent: string; stageTitle: string }>;
};

export function ResourceTabs({
  resource,
  reviews,
  audience,
  similar,
  currentUserId,
}: {
  resource: ResourceDetail;
  reviews: Review[];
  audience: Audience;
  similar: ResourceListItem[];
  currentUserId: string | null;
}) {
  const dict = useDictionary();
  const tabs = [
    { id: "overview", label: dict.resourceDetail.overview, available: true },
    { id: "takeaways", label: dict.resourceDetail.takeaways, available: (resource.keyTakeaways?.length ?? 0) > 0 },
    { id: "related", label: formatMessage(dict.resourceDetail.relatedTab, { count: similar.length }), available: similar.length > 0 },
    { id: "audience", label: dict.resourceDetail.audienceTab, available: audience.learners.length > 0 || audience.pathsIncluding.length > 0 },
    { id: "reviews", label: formatMessage(dict.resourceDetail.reviewsTab, { count: reviews.length }), available: true },
  ].filter((tab) => tab.available);

  const [active, setActive] = useState(tabs[0]?.id ?? "overview");

  return (
    <div>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-hairline scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors",
              active === tab.id ? "border-brand-600 text-brand-700" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pt-6">
        {active === "overview" ? <Overview resource={resource} /> : null}
        {active === "takeaways" ? <Takeaways resource={resource} /> : null}
        {active === "related" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {similar.map((item) => (
              <ResourceCard key={item.id} resource={item} />
            ))}
          </div>
        ) : null}
        {active === "audience" ? <Who audience={audience} resource={resource} /> : null}
        {active === "reviews" ? (
          <Reviews resource={resource} reviews={reviews} currentUserId={currentUserId} />
        ) : null}
      </div>
    </div>
  );
}

function Overview({ resource }: { resource: ResourceDetail }) {
  const dict = useDictionary();
  return (
    <div className="space-y-8">
      {resource.whyItMatters ? (
        <section>
          <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">{dict.resourceDetail.whyItMatters}</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{resource.whyItMatters}</p>
        </section>
      ) : resource.summary ? (
        <section>
          <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">{dict.resourceDetail.summary}</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{resource.summary}</p>
        </section>
      ) : (
        <p className="text-[14.5px] leading-relaxed text-muted">{resource.description}</p>
      )}

      {resource.keyTakeaways?.length ? (
        <Callout tone="amber" className="space-y-2">
          {resource.keyTakeaways.slice(0, 3).map((takeaway) => (
            <p key={takeaway} className="flex items-start gap-2 text-[13px] leading-relaxed">
              <Icon name="sparkles" className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
              <span>{takeaway}</span>
            </p>
          ))}
        </Callout>
      ) : null}

      {resource.whatYouLearn?.length ? (
        <section>
          <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">{dict.resourceDetail.whatYouLearn}</h2>
          <ul className="mt-3 space-y-2">
            {resource.whatYouLearn.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-muted">
                <Icon name="check" className="mt-1 size-3.5 shrink-0 text-emerald-500" strokeWidth={3} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {resource.prerequisites?.length ? (
        <section>
          <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">{dict.resourceDetail.prerequisites}</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {resource.prerequisites.map((item) => (
              <Chip key={item} className="px-2.5 py-1 text-xs">
                {item}
              </Chip>
            ))}
          </div>
        </section>
      ) : null}

      {resource.summary && resource.whyItMatters ? (
        <section>
          <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">{dict.resourceDetail.summary}</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{resource.summary}</p>
        </section>
      ) : null}
    </div>
  );
}

function Takeaways({ resource }: { resource: ResourceDetail }) {
  return (
    <ol className="space-y-3">
      {(resource.keyTakeaways ?? []).map((takeaway, index) => (
        <li key={takeaway}>
          <Card className="flex items-start gap-3 p-4">
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[11px] font-bold text-brand-700">
              {index + 1}
            </span>
            <p className="text-[14px] leading-relaxed text-ink">{takeaway}</p>
          </Card>
        </li>
      ))}
    </ol>
  );
}

function Who({ audience, resource }: { audience: Audience; resource: ResourceDetail }) {
  const dict = useDictionary();
  const total = audience.states.reduce((sum, entry) => sum + entry.count, 0);
  const labels: Record<string, string> = {
    saved: dict.state.wantToLearn,
    in_progress: dict.state.in_progress,
    completed: dict.state.completed,
  };

  return (
    <div className="space-y-8">
      {resource.bestFor?.length ? (
        <section>
          <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">{dict.resourceDetail.bestSuited}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {resource.bestFor.map((role) => (
              <Chip key={role} className="bg-brand-50 px-2.5 py-1 text-xs text-brand-700 ring-brand-100">
                <Icon name="users" className="size-3" />
                {role}
              </Chip>
            ))}
          </div>
        </section>
      ) : null}

      {total > 0 ? (
        <section>
          <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">{dict.resourceDetail.whereLearners}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {audience.states.map((entry) => (
              <Card key={entry.state} className="p-3.5">
                <p className="text-lg font-semibold text-ink">{entry.count}</p>
                <p className="text-xs text-muted">{labels[entry.state] ?? entry.state}</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {audience.learners.length > 0 ? (
        <section>
          <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">{dict.resourceDetail.recentLearners}</h2>
          <div className="mt-3 space-y-1.5">
            {audience.learners.map((learner) => (
              <div key={`${learner.displayName}-${learner.state}`} className="flex items-center gap-2.5 rounded-lg p-1.5">
                <Avatar src={learner.avatarUrl} name={learner.displayName} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink">{learner.displayName}</p>
                  {learner.headline ? <p className="truncate text-[11px] text-muted">{learner.headline}</p> : null}
                </div>
                <Chip>{labels[learner.state] ?? learner.state}</Chip>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {audience.pathsIncluding.length > 0 ? (
        <section>
          <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">{dict.resourceDetail.appearsIn}</h2>
          <div className="mt-3 space-y-2">
            {audience.pathsIncluding.map((path) => (
              <Link key={path.slug} href={`/paths/${path.slug}`}>
                <Card className="flex items-center gap-3 p-3.5 transition-shadow hover:shadow-lift">
                  <Icon name={path.icon} className="size-4 text-brand-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{path.title}</span>
                    <span className="block truncate text-[11px] text-muted">{formatMessage(dict.resourceDetail.stageOf, { title: path.stageTitle })}</span>
                  </span>
                  <Icon name="chevron-right" className="size-4 text-slate-300" />
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Reviews({
  resource,
  reviews,
  currentUserId,
}: {
  resource: ResourceDetail;
  reviews: Review[];
  currentUserId: string | null;
}) {
  const dict = useDictionary();
  const locale = useLocale();
  return (
    <div className="space-y-6">
      <ReviewForm resourceId={resource.id} isSignedIn={Boolean(currentUserId)} />

      {reviews.length === 0 ? (
        <EmptyState
          icon="message-square"
          title={dict.resourceDetail.noReviews}
          description={dict.resourceDetail.noReviewsBody}
        />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card key={review.id} className="p-4">
              <div className="flex items-start gap-3">
                <Avatar src={review.author.avatarUrl} name={review.author.displayName} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className="text-[13px] font-semibold text-ink">{review.author.displayName}</p>
                    {review.author.headline ? <p className="text-[11px] text-muted">· {review.author.headline}</p> : null}
                    <span className="ml-auto text-[11px] text-muted">{relativeTime(review.createdAt, locale)}</span>
                  </div>
                  <div className="mt-1">
                    <StarRating value={review.rating} showValue={false} />
                  </div>
                  {review.body ? <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{review.body}</p> : null}
                  {review.helpfulCount > 0 ? (
                    <p className="mt-2 text-[11px] text-muted">{formatMessage(dict.resourceDetail.helpful, { count: review.helpfulCount })}</p>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
