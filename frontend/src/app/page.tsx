import { Suspense } from "react";
import { loadStories } from "@/lib/load-stories";
import { CRMADashboard } from "@/components/crma-dashboard";

export default async function Page() {
  const stories = await loadStories();
  return (
    <Suspense fallback={null}>
      <CRMADashboard stories={stories} />
    </Suspense>
  );
}
