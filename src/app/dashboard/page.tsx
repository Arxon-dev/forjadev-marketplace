import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { SiteHeader } from "@/components/layout/site-header";

export default function DashboardPage() {
  return (
    <main>
      <SiteHeader />
      <DashboardContent />
    </main>
  );
}
