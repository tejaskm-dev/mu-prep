import { ViewTransition } from "react";

/** Re-mounts on every navigation: old page fades out quickly, the new one rises in. */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" update="page-in" default="none">
      {children}
    </ViewTransition>
  );
}
