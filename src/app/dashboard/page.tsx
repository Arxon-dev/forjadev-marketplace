import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { SiteHeaderServer } from "@/components/layout/site-header-server";

export default function DashboardPage() {
  return (
    <main>
      <SiteHeaderServer />
      <DashboardContent />
    </main>
  );
}
