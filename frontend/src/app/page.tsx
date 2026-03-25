import { Suspense } from "react";
import { loadStories } from "@/lib/load-stories";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default async function Page() {
  const stories = await loadStories();
  return (
    <Suspense fallback={null}>
      <DashboardShell stories={stories} />
    </Suspense>
  );
}
