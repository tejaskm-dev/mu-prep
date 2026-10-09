import { NextResponse, type NextRequest } from "next/server";
import { searchEverything } from "@/lib/data";
import { toCard, toSubjectCard } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 1) return NextResponse.json({ subjects: [], resources: [] });

  const sem = Number(params.get("sem"));
  const { subjects, resources } = await searchEverything(q, {
    department: params.get("dept"),
    semester: Number.isInteger(sem) && sem >= 1 && sem <= 8 ? sem : null,
    limit: 8,
    strict: params.get("scope") === "class",
  });

  return NextResponse.json(
    { subjects: subjects.map(toSubjectCard), resources: resources.map(toCard) },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
