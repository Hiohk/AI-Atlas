import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import { getSubmissionProgress } from "@/lib/queries/submissions";

export const dynamic = "force-dynamic";

/** Polled by the submit form so the pipeline stages appear as they complete. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const progress = await getSubmissionProgress(id, userId);
  if (!progress) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json(progress, { headers: { "cache-control": "no-store" } });
}
