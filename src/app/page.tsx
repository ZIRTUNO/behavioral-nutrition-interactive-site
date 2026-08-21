import { Hero } from "@/components/sections/Hero";
import { IdentifySection } from "@/components/sections/Identify";
import { MethodSection } from "@/components/sections/Method";
import { AboutSection } from "@/components/sections/About";
import { JourneySection } from "@/components/sections/Journey";
import { FaqSection } from "@/components/sections/Faq";
import { ContactSection } from "@/components/sections/Contact";
import { BrainStage, BrainStageProvider } from "@/components/BrainStage";
import { SiteFooter } from "@/components/layout/Footer";
import { ScrollRestoration } from "@/components/ScrollRestoration";
import { WhatsAppFab } from "@/components/ui/WhatsAppFab";

/**
 * Landing page. Sections are composed top-to-bottom in scroll order — add
 * future sections (manifesto, services, contact, etc.) directly below the
 * existing ones.
 *
 * The <BrainStageProvider> wraps everything so each section can register a
 * "brain slot" (a DOM spacer the brain canvas should sit over). <BrainStage />
 * mounts the single page-global 3D canvas in a fixed layer and follows the
 * active slot. This lets the brain travel between sections on scroll without
 * tearing down and re-creating the WebGL context.
 */
export default function Page() {
  return (
    <BrainStageProvider>
      <ScrollRestoration />
      <main>
        <Hero />
        <IdentifySection />
        <MethodSection />
        <AboutSection />
        {/* Section 5 (Depoimentos) is deliberately OUT on this branch: the
            client goes live before she has real testimonial videos and
            reviews. Nothing was deleted — sections/Testimonials still lives in
            the repo; putting it back is re-adding the import and the element
            here (or simply deploying main). */}
        <JourneySection />
        <FaqSection />
        <ContactSection />
      </main>
      <SiteFooter />
      <BrainStage />
      {/* Mobile-only floating WhatsApp shortcut — fixed at the bottom-right
          corner, revealed after the first fold scrolls away. */}
      <WhatsAppFab />
    </BrainStageProvider>
  );
}
