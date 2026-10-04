import { NextResponse, type NextRequest } from "next/server";
import { getSubjects } from "@/lib/data";
import { toSubjectCard } from "@/lib/serialize";

// Subjects for a branch/semester (used by the search palette's "Your subjects").
export async function GET(request: NextRequest) {
  const dept = request.nextUrl.searchParams.get("dept");
  const sem = Number(request.nextUrl.searchParams.get("sem"));
  const subjects = await getSubjects(
    dept && /^[a-z0-9-]{1,40}$/.test(dept) ? dept : null,
    Number.isInteger(sem) && sem >= 1 && sem <= 8 ? sem : null,
  );
  return NextResponse.json(
    { subjects: subjects.map(toSubjectCard) },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
  );
}
