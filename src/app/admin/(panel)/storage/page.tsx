import { PageHeader } from "@/components/admin/page-header";
import { StorageManager } from "@/components/admin/storage-manager";
import { requireAdminPage } from "@/lib/auth";

export const metadata = { title: "Storage" };

export default async function StoragePage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="Storage" description="What's stored on UploadThing, and cleanup for files nobody uses." />
      <StorageManager />
    </>
  );
}
