/**
 * Shared vocabulary for the submission pipeline. Kept free of database imports
 * so client components can render pipeline state without pulling in the driver.
 */

export type SubmissionStatus =
  | "submitted"
  | "fetching"
  | "analyzing"
  | "duplicate_check"
  | "ready_for_review"
  | "approved"
  | "published"
  | "rejected"
  | "failed";

export const PIPELINE_STAGES: Array<{ status: SubmissionStatus; label: string; description: string }> = [
  { status: "submitted", label: "Queued", description: "URL validated and accepted" },
  { status: "fetching", label: "Fetching", description: "Reading the page under strict limits" },
  { status: "analyzing", label: "Analysing", description: "Classifying, summarising and scoring" },
  { status: "duplicate_check", label: "Deduplicating", description: "Comparing against the whole atlas" },
  { status: "ready_for_review", label: "Awaiting review", description: "An editor takes the final call" },
];

export const TERMINAL_STATUSES: SubmissionStatus[] = [
  "ready_for_review",
  "approved",
  "published",
  "rejected",
  "failed",
];

export type SubmissionDraft = {
  title?: string;
  description?: string;
  type?: string;
  topics?: string[];
  qualityScore?: number;
  difficulty?: string;
};

export type SubmissionProgress = {
  id: string;
  status: SubmissionStatus;
  url: string;
  riskLevel: string;
  errorMessage: string | null;
  duplicateSimilarity: number | null;
  duplicateSlug: string | null;
  duplicateTitle: string | null;
  resourceSlug: string | null;
  createdAt: string;
  draft: SubmissionDraft | null;
  events: Array<{ stage: string; status: string; message: string | null; durationMs: number | null }>;
};
