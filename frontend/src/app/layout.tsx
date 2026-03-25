import { Suspense } from "react";
import type { Metadata } from "next";
import "@/styles/globals.css";
import { Navbar } from "@/components/ui/navbar";
import { PipelineProvider } from "@/store/pipeline-context";

export const metadata: Metadata = {
  title: "CRMA — Continuous Risk Monitoring & Assessment",
  description: "Flood & Drought Early Warning Pipeline — ICPAC / IGAD",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <Suspense fallback={null}>
          <PipelineProvider>
            <main className="pt-14">{children}</main>
          </PipelineProvider>
        </Suspense>
      </body>
    </html>
  );
}
