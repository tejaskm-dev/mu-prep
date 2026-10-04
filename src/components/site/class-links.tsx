import Link from "next/link";
import { DynamicIcon } from "@/components/dynamic-icon";
import { SEMESTERS } from "@/lib/constants";
import type { Department } from "@/lib/database.types";
import { cn } from "@/lib/utils";

/** Server-rendered branch + semester pickers that link to `${base}?dept=&sem=`. */
export function ClassLinks({
  base,
  departments,
  dept,
  sem,
  allowAll = false,
  extra = {},
}: {
  base: string;
  departments: Department[];
  dept: string | null;
  sem: number | null;
  allowAll?: boolean;
  extra?: Record<string, string>;
}) {
  const href = (d: string | null, s: number | null) => {
    const p = new URLSearchParams(extra);
    p.set("dept", d ?? "all");
    p.set("sem", s ? String(s) : "all");
    return `${base}?${p}`;
  };
  return (
    <div className="space-y-3">
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {allowAll ? (
          <Link href={href(null, sem)} data-active={!dept} className="select-tile flex h-11 shrink-0 items-center px-4 text-sm font-semibold text-ink">
            All branches
          </Link>
        ) : null}
        {departments.map((d) => (
          <Link
            key={d.slug}
            href={href(d.slug, sem)}
            data-active={dept === d.slug}
            title={d.name}
            className="select-tile group flex h-11 shrink-0 items-center gap-2 px-4 text-sm font-semibold text-ink"
          >
            <DynamicIcon name={d.icon} className={cn("size-4", dept === d.slug ? "text-brand" : "text-ink/70")} />
            {d.code}
          </Link>
        ))}
      </div>
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {allowAll ? (
          <Link href={href(dept, null)} data-active={!sem} className="select-tile flex h-10 shrink-0 items-center px-4 text-sm font-semibold text-ink">
            All
          </Link>
        ) : null}
        {SEMESTERS.map((s) => (
          <Link
            key={s}
            href={href(dept, s)}
            data-active={sem === s}
            className="select-tile flex h-10 min-w-[60px] shrink-0 items-center justify-center px-3 text-sm font-semibold text-ink"
          >
            S{s}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function readClassParams(sp: Record<string, string | string[] | undefined>, prefs: { department: string | null; semester: number | null }) {
  const get = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const deptRaw = get("dept");
  const semRaw = get("sem");
  const dept = deptRaw === "all" ? null : /^[a-z0-9-]{1,40}$/.test(deptRaw) ? deptRaw : prefs.department;
  const semNum = Number(semRaw);
  const sem = semRaw === "all" ? null : semNum >= 1 && semNum <= 8 ? semNum : prefs.semester;
  return { dept, sem, get };
}
