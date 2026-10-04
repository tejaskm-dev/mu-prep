"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { HardDrive, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteOrphans, scanStorage, type StorageFile } from "@/lib/actions/admin/site";
import { formatBytes, formatDate } from "@/lib/format";
import { MuSpinner } from "@/components/brand/mu-loader";

export function StorageManager() {
  const [data, setData] = useState<{ files: StorageFile[]; used: string[]; usage: { totalBytes: number; limitBytes: number; filesUploaded: number } | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, startDelete] = useTransition();

  const scan = useCallback(async () => {
    setLoading(true);
    const result = await scanStorage();
    setLoading(false);
    if (result.ok && result.data) {
      setData(result.data);
      setError(null);
    } else if (!result.ok) setError(result.error);
  }, []);

  useEffect(() => {
    void scan();
  }, [scan]);

  const { orphans, orphanBytes, usedBytes, largest } = useMemo(() => {
    const used = new Set(data?.used ?? []);
    const files = data?.files ?? [];
    const orphans = files.filter((f) => !used.has(f.key) && f.status === "Uploaded" && Date.now() - f.uploadedAt > 60 * 60 * 1000);
    return {
      orphans,
      orphanBytes: orphans.reduce((s, f) => s + f.size, 0),
      usedBytes: files.reduce((s, f) => s + f.size, 0),
      largest: [...files].sort((a, b) => b.size - a.size).slice(0, 8),
    };
  }, [data]);

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-[14px] text-amber-900">
        <HardDrive className="mb-2 size-6" />
        {error}
      </div>
    );
  }

  const total = data?.usage?.totalBytes ?? usedBytes;
  const limit = data?.usage?.limitBytes ?? 0;
  const pct = limit ? Math.min(100, (total / limit) * 100) : 0;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[12.5px] font-medium text-muted-foreground">UploadThing storage</p>
            <p className="mt-1 text-[28px] leading-none font-bold text-ink">
              {loading && !data ? "…" : formatBytes(total)}
              {limit ? <span className="ml-2 text-[15px] font-medium text-muted-foreground">of {formatBytes(limit)}</span> : null}
            </p>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">{data ? `${data.files.length} files stored` : "Scanning…"}</p>
          </div>
          <Button variant="outline" className="bg-white" onClick={() => void scan()} disabled={loading}>
            {loading ? <MuSpinner /> : <RefreshCw />} Rescan
          </Button>
        </div>
        {limit ? (
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-lime-soft" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Storage used">
            <div className={`h-full rounded-full ${pct > 90 ? "bg-destructive" : pct > 75 ? "bg-amber-500" : "bg-brand"}`} style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Orphaned files</h2>
            <p className="text-[12.5px] text-muted-foreground">
              Uploaded but never published (e.g. an abandoned upload batch), older than an hour. Safe to delete.
            </p>
          </div>
          <Button
            variant="outline"
            className="bg-white text-destructive hover:bg-destructive/10"
            disabled={!orphans.length || deleting}
            onClick={() =>
              startDelete(async () => {
                const r = await deleteOrphans(orphans.map((o) => o.key));
                if (r.ok) {
                  toast.success(`Deleted ${r.data?.deleted ?? 0} files · freed ${formatBytes(orphanBytes)}`);
                  void scan();
                } else toast.error(r.error);
              })
            }
          >
            {deleting ? <MuSpinner /> : <Trash2 />} Delete {orphans.length || ""} orphans
          </Button>
        </div>
        {orphans.length ? (
          <ul className="mt-4 max-h-72 divide-y divide-border overflow-auto rounded-lg border border-border text-[13px]">
            {orphans.map((f) => (
              <li key={f.key} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0 truncate text-ink">{f.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatBytes(f.size)} · {formatDate(new Date(f.uploadedAt))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[13px] text-muted-foreground">{loading ? "Scanning…" : "Nothing to clean up."}</p>
        )}
      </section>

      {largest.length ? (
        <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
          <h2 className="mb-3 text-[15px] font-semibold text-ink">Largest files</h2>
          <ul className="divide-y divide-border text-[13px]">
            {largest.map((f) => (
              <li key={f.key} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-ink">{f.name}</span>
                <span className="shrink-0 font-medium text-ink tabular-nums">{formatBytes(f.size)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
