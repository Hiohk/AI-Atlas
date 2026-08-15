import { NextResponse } from "next/server";
import { getSearchSuggestions } from "@/lib/search/hybrid";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) {
    return NextResponse.json({ resources: [], topics: [] });
  }

  try {
    const suggestions = await getSearchSuggestions(q, 6);
    return NextResponse.json(suggestions, {
      headers: { "cache-control": "private, max-age=30" },
    });
  } catch (error) {
    console.error("[suggest]", error);
    return NextResponse.json({ resources: [], topics: [] }, { status: 200 });
  }
}
