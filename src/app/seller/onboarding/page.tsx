import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { OnboardingForm } from "@/components/seller/onboarding-form";

export default function SellerOnboardingPage() {
  return (
    <main>
      <SiteHeaderServer />
      <OnboardingForm />
    </main>
  );
}
