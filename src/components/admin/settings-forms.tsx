"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, KeyRound, RotateCcw, Save, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { changePassword } from "@/lib/actions/admin/auth";
import { DEFAULT_HERO_IMAGE } from "@/lib/constants";
import { addAdmin, removeAdmin, updateSiteSettings } from "@/lib/actions/admin/site";
import type { AdminRow, SiteSettings } from "@/lib/database.types";
import { formatDate } from "@/lib/format";
import { imageThumbnail } from "@/lib/pdf";
import { uploadFiles } from "@/lib/uploadthing";
import { MuSpinner } from "@/components/brand/mu-loader";

export function SiteSettingsForm({ settings }: { settings: SiteSettings }) {
  const router = useRouter();
  const [s, setS] = useState({
    collegeName: settings.college_name,
    heroNote: settings.hero_note,
    announcement: settings.announcement ?? "",
    announcementLink: settings.announcement_link ?? "",
    announcementEnabled: settings.announcement_enabled,
    contributionsEnabled: settings.contributions_enabled,
    requestsEnabled: settings.requests_enabled,
  });
  const [hero, setHero] = useState<{ key: string | null; url: string | null } | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const heroUrl = hero ? hero.url : settings.hero_image_url;

  const save = () =>
    startTransition(async () => {
      const r = await updateSiteSettings({ ...s, heroImage: hero });
      if (r.ok) {
        toast.success("Settings saved");
        setHero(undefined);
        router.refresh();
      } else toast.error(r.error);
    });

  async function uploadHero(file: File) {
    setUploading(true);
    try {
      // Keep it crisp but light: downscale very large photos to 2000px wide.
      const resized = file.size > 1_500_000 ? ((await imageThumbnail(file, 2000)) ?? file) : file;
      const named = new File([resized], `hero-${Date.now()}.${resized.type === "image/webp" ? "webp" : "jpg"}`, { type: resized.type || file.type });
      const [res] = await uploadFiles("siteImage", { files: [named] });
      setHero({ key: res.key, url: res.ufsUrl });
      toast.success("Image uploaded — save to apply it");
    } catch (e) {
      toast.error(e instanceof Error && /503/.test(e.message) ? "Uploads aren't configured (UPLOADTHING_TOKEN)" : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-border bg-white p-5 shadow-card">
          <h2 className="text-[15px] font-semibold text-ink">Hero</h2>
          <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
            <img src={heroUrl || DEFAULT_HERO_IMAGE} alt="Hero preview" className="size-full object-cover" />
            <span className="absolute top-3 right-4 -rotate-6 font-hand text-[24px] leading-tight font-semibold text-ink [text-shadow:0_1px_10px_white]">
              {s.heroNote}
            </span>
            {uploading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                <MuSpinner className="size-5  text-brand" />
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="bg-white" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <ImageUp /> Upload campus photo
            </Button>
            {heroUrl ? (
              <Button variant="ghost" onClick={() => setHero({ key: null, url: null })}>
                <RotateCcw /> Use default
              </Button>
            ) : null}
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && void uploadHero(e.target.files[0])} />
          </div>
          <p className="text-[12px] text-muted-foreground">Landscape photos work best (at least 1400px wide). The default is a free Unsplash photo.</p>
          <Field label="Handwritten note on the photo">
            <Input value={s.heroNote} onChange={(e) => setS({ ...s, heroNote: e.target.value })} maxLength={60} className="h-10 rounded-lg" />
          </Field>
          <Field label="College name">
            <Input value={s.collegeName} onChange={(e) => setS({ ...s, collegeName: e.target.value })} maxLength={60} className="h-10 rounded-lg" />
          </Field>
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-white p-5 shadow-card">
          <h2 className="text-[15px] font-semibold text-ink">Announcement bar</h2>
          <Field label="Message">
            <Input value={s.announcement} onChange={(e) => setS({ ...s, announcement: e.target.value })} maxLength={200} placeholder="e.g. S3 series exam papers are up!" className="h-10 rounded-lg" />
          </Field>
          <Field label="Link (optional)">
            <Input value={s.announcementLink} onChange={(e) => setS({ ...s, announcementLink: e.target.value })} placeholder="/papers or https://…" className="h-10 rounded-lg" />
          </Field>
          <Toggle label="Show announcement" hint="A slim dark bar above the navigation on every page." checked={s.announcementEnabled} onChange={(v) => setS({ ...s, announcementEnabled: v })} />
          <div className="border-t border-border pt-4">
            <h2 className="mb-3 text-[15px] font-semibold text-ink">Community</h2>
            <div className="space-y-3">
              <Toggle label="Accept submissions" hint="Students can upload notes for review at /contribute." checked={s.contributionsEnabled} onChange={(v) => setS({ ...s, contributionsEnabled: v })} />
              <Toggle label="Accept requests" hint="Students can request missing notes from subject pages." checked={s.requestsEnabled} onChange={(v) => setS({ ...s, requestsEnabled: v })} />
            </div>
          </div>
        </section>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={pending || uploading} className="h-10 rounded-lg px-5">
          {pending ? <MuSpinner /> : <Save />} Save settings
        </Button>
      </div>
    </div>
  );
}

export function TeamManager({ admins, currentUserId, isOwner }: { admins: AdminRow[]; currentUserId: string; isOwner: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"editor" | "owner">("editor");
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      const r = await addAdmin({ email, password, role });
      if (r.ok) {
        toast.success(r.message ?? "Added");
        setEmail("");
        setPassword("");
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
      <h2 className="text-[15px] font-semibold text-ink">Team</h2>
      <p className="text-[12.5px] text-muted-foreground">Owners manage the team; editors manage content.</p>
      <ul className="mt-4 divide-y divide-border">
        {admins.map((a) => (
          <li key={a.user_id} className="flex items-center gap-3 py-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-lime-soft text-[12px] font-bold text-brand uppercase">{a.email[0]}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium text-ink">
                {a.email} {a.user_id === currentUserId ? <span className="text-muted-foreground">(you)</span> : null}
              </span>
              <span className="text-[12px] text-muted-foreground capitalize">
                {a.role} · since {formatDate(a.created_at)}
              </span>
            </span>
            {isOwner && a.user_id !== currentUserId ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() =>
                  startTransition(async () => {
                    if (!confirm(`Remove ${a.email} from the admin team?`)) return;
                    const r = await removeAdmin(a.user_id);
                    if (r.ok) {
                      toast.success("Removed");
                      router.refresh();
                    } else toast.error(r.error);
                  })
                }
              >
                <Trash2 />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {isOwner ? (
        <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-[1fr_1fr_120px_auto]">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="teammate@email.com" className="h-10 rounded-lg" />
          <Input value={password} onChange={(e) => setPassword(e.target.value)} type="text" placeholder="Temp password (new users)" className="h-10 rounded-lg" />
          <Select value={role} onValueChange={(v) => setRole(v as "editor" | "owner")}>
            <SelectTrigger className="h-10! w-full rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={add} disabled={pending || !email} className="h-10 rounded-lg">
            {pending ? <MuSpinner /> : <UserPlus />} Add
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-[12.5px] text-muted-foreground">Ask an owner to add or remove teammates.</p>
      )}
    </section>
  );
}

export function PasswordForm() {
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
      <h2 className="text-[15px] font-semibold text-ink">Your password</h2>
      <div className="mt-3 flex gap-2">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (8+ characters)" autoComplete="new-password" className="h-10 rounded-lg" />
        <Button
          variant="outline"
          className="h-10 bg-white"
          disabled={pending || password.length < 8}
          onClick={() =>
            startTransition(async () => {
              const r = await changePassword(password);
              if (r.ok) {
                toast.success("Password updated");
                setPassword("");
              } else toast.error(r.error);
            })
          }
        >
          {pending ? <MuSpinner /> : <KeyRound />} Update
        </Button>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-[13px]">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 text-[13.5px]">
      <span>
        <span className="block font-medium text-ink">{label}</span>
        <span className="text-[12px] text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
