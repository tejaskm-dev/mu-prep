import { after, NextResponse, type NextRequest } from "next/server";
import { getResource } from "@/lib/data";
import { publicClient } from "@/lib/supabase/public";

// Counts the download, then sends the visitor to the file (or external link).
export async function GET(request: NextRequest, ctx: RouteContext<"/api/download/[id]">) {
  const { id } = await ctx.params;
  const resource = await getResource(id);
  const target = resource?.file_url ?? resource?.external_url;
  if (!resource || !target) return NextResponse.redirect(new URL("/notes?missing=1", request.url));

  after(async () => {
    const { error } = await publicClient().rpc("track_resource_event", { p_resource_id: resource.id, p_kind: "download" });
    if (error) console.error("[download] track failed", error.message);
  });

  return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": "no-store" } });
}
