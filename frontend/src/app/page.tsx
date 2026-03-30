import { Suspense } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DashboardShell />
    </Suspense>
  );
}
