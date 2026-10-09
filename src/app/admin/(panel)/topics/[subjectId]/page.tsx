import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { TopicsWorkspace, type WorkspaceTopic } from "@/components/admin/topics-workspace";
import { requireAdminPage } from "@/lib/auth";
import { parseModules } from "@/lib/subject-utils";
import { parseQuestions } from "@/lib/topics";

export const metadata = { title: "Important topics" };

export default async function SubjectTopicsPage({ params }: PageProps<"/admin/topics/[subjectId]">) {
  const { subjectId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(subjectId)) notFound();
  const { supabase } = await requireAdminPage();

  const [{ data: subject }, { data: topics }, { data: resources }] = await Promise.all([
    supabase.from("subject_overview").select("id,slug,name,short_name,code,semester,icon,modules,is_active").eq("id", subjectId).maybeSingle(),
    supabase
      .from("important_topics")
      .select("id,module,title,notes,priority,questions,sort_order,is_published,updated_at")
      .eq("subject_id", subjectId)
      .order("module")
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("resource_feed")
      .select("id,title,type,module,page_count,status,thumbnail_url,exam_session")
      .eq("subject_id", subjectId)
      .in("status", ["published", "draft"])
      .order("module", { nullsFirst: false })
      .order("title")
      .limit(500),
  ]);
  if (!subject) notFound();

  const ids = (topics ?? []).map((t) => t.id);
  const { data: links } = ids.length
    ? await supabase.from("important_topic_resources").select("topic_id,resource_id,page,sort_order").in("topic_id", ids).order("sort_order")
    : { data: [] };

  const linksByTopic = new Map<string, { id: string; page: number | null }[]>();
  for (const l of links ?? []) linksByTopic.set(l.topic_id, [...(linksByTopic.get(l.topic_id) ?? []), { id: l.resource_id, page: l.page }]);

  const items: WorkspaceTopic[] = (topics ?? []).map((t) => ({
    id: t.id,
    module: t.module,
    title: t.title,
    notes: t.notes ?? "",
    priority: t.priority,
    questions: parseQuestions(t.questions),
    resources: linksByTopic.get(t.id) ?? [],
    isPublished: t.is_published,
    updatedAt: t.updated_at,
  }));

  return (
    <>
      <Link href="/admin/topics" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-ink">
        <ChevronLeft className="size-4" /> Important topics
      </Link>
      <TopicsWorkspace
        subject={{ id: subject.id, slug: subject.slug, name: subject.name, code: subject.code, semester: subject.semester, icon: subject.icon, isActive: subject.is_active }}
        modules={parseModules(subject.modules)}
        topics={items}
        files={resources ?? []}
      />
    </>
  );
}
