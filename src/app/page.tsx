import {
  Footer,
  Hero,
  HowItWorks,
  MarketingHeader,
  TrustStrip,
} from "@/components/marketing";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-verity-bg">
      <MarketingHeader />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <TrustStrip />
      </main>
      <Footer />
    </div>
  );
}
