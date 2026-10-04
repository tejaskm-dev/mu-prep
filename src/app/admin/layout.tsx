import type { Metadata } from "next";

// The admin is per-user and auth-gated, so it renders on every request.
export const instant = false;

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · µPrep Admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div className="min-h-dvh bg-[#f5f6f0]">{children}</div>;
}
