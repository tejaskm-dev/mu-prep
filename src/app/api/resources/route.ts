import { NextResponse, type NextRequest } from "next/server";
import { getResourcesByIds } from "@/lib/data";
import { toCard } from "@/lib/serialize";

// Used by the client-side Saved / Recently viewed lists (ids live in localStorage).
export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 60);
  const rows = await getResourcesByIds(ids);
  return NextResponse.json({ resources: rows.map(toCard) }, { headers: { "Cache-Control": "private, max-age=30" } });
}
