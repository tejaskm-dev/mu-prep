import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { getSession } from "@/lib/auth";
import { getSiteSettings } from "@/lib/data";
import { hashIp } from "@/lib/ip";
import { hasServiceRole, serviceClient } from "@/lib/supabase/service";

const f = createUploadthing();

async function adminOnly() {
  const session = await getSession();
  if (!session.user || !session.admin) throw new UploadThingError({ code: "FORBIDDEN", message: "Admins only" });
  return { userId: session.user.id };
}

// Short in-memory burst limiter (per server instance) on top of the DB check.
const bursts = new Map<string, number[]>();
function tooManyBursts(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hits = (bursts.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  bursts.set(key, hits);
  return hits.length > limit;
}

const officeDocs = {
  "application/msword": { maxFileSize: "32MB", maxFileCount: 5 },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { maxFileSize: "32MB", maxFileCount: 5 },
  "application/vnd.ms-powerpoint": { maxFileSize: "32MB", maxFileCount: 5 },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { maxFileSize: "32MB", maxFileCount: 5 },
} as const;

export const uploadRouter = {
  /** Admin uploads: any document type, uploaded first and attached to resources on publish. */
  resourceFile: f(
    {
      pdf: { maxFileSize: "128MB", maxFileCount: 50 },
      image: { maxFileSize: "32MB", maxFileCount: 50 },
      blob: { maxFileSize: "128MB", maxFileCount: 50 },
    },
    { awaitServerData: false },
  )
    .middleware(adminOnly)
    .onUploadComplete(() => {}),

  /** Generated previews (first page renders / downscaled photos). */
  thumbnail: f({ image: { maxFileSize: "4MB", maxFileCount: 50 } }, { awaitServerData: false })
    .middleware(adminOnly)
    .onUploadComplete(() => {}),

  /** Hero image and other site artwork. */
  siteImage: f({ image: { maxFileSize: "16MB", maxFileCount: 1 } }, { awaitServerData: false })
    .middleware(adminOnly)
    .onUploadComplete(() => {}),

  /** Public submissions. They stay hidden until an admin approves them. */
  contribution: f(
    {
      pdf: { maxFileSize: "32MB", maxFileCount: 5 },
      image: { maxFileSize: "16MB", maxFileCount: 5 },
      ...officeDocs,
    },
    { awaitServerData: false },
  )
    .middleware(async ({ req }) => {
      const settings = await getSiteSettings();
      if (!settings.contributions_enabled) {
        throw new UploadThingError({ code: "FORBIDDEN", message: "Submissions are paused right now." });
      }
      const ipHash = hashIp(req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"));
      if (tooManyBursts(ipHash, 12, 10 * 60 * 1000)) {
        throw new UploadThingError({ code: "FORBIDDEN", message: "Too many uploads — try again in a bit." });
      }
      if (hasServiceRole()) {
        const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count } = await serviceClient()
          .from("submission_details")
          .select("resource_id", { count: "exact", head: true })
          .eq("ip_hash", ipHash)
          .gte("created_at", since);
        if ((count ?? 0) >= 15) {
          throw new UploadThingError({ code: "FORBIDDEN", message: "Hourly submission limit reached." });
        }
      }
      return { ipHash };
    })
    .onUploadComplete(() => {}),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
