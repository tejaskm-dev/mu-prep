import { AnnouncementBar } from "@/components/site/announcement-bar";
import { OnboardingDialog } from "@/components/site/onboarding-dialog";
import { SearchLauncher } from "@/components/site/search-launcher";
import { SetupNotice } from "@/components/site/setup-notice";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getDepartments, getSiteSettings } from "@/lib/data";

// Static, cached shell: everything personal (class, saved items) is read in the browser.
export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [departments, settings] = await Promise.all([getDepartments(), getSiteSettings()]);
  const deptOptions = departments.map((d) => ({ slug: d.slug, code: d.code, name: d.name, icon: d.icon }));

  return (
    <div className="flex min-h-dvh flex-col">
      <SetupNotice />
      <AnnouncementBar settings={settings} />
      <div className="relative flex flex-1 flex-col">
        <SiteHeader departments={deptOptions} />
        <main className="flex-1">{children}</main>
        <SiteFooter college={settings.college_name} />
      </div>
      <SearchLauncher />
      <OnboardingDialog departments={deptOptions} />
    </div>
  );
}
