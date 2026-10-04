import type { Metadata, Viewport } from "next";
import { Caveat, Inter, Inter_Tight } from "next/font/google";
import { Suspense } from "react";
import { NavProgress } from "@/components/site/nav-progress";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "µPrep — Notes Hub", template: "%s · µPrep" },
  description:
    "Lecture notes, handwritten notes, previous papers, syllabus and more — for every department, semester and subject. A µLearn initiative.",
  applicationName: "µPrep",
  openGraph: { type: "website", siteName: "µPrep", locale: "en_IN" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#f8f9f2",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${interTight.variable} ${caveat.variable} antialiased`}
    >
      <body className="min-h-dvh">
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <TooltipProvider delayDuration={250}>{children}</TooltipProvider>
        <Toaster position="bottom-center" richColors={false} />
      </body>
    </html>
  );
}
