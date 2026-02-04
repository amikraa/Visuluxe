import { GlobalNavbar } from "@/components/GlobalNavbar";
import Sidebar from "@/components/docs/Sidebar";
import Footer from "@/components/docs/Footer";
import IntroSection from "@/components/docs/sections/IntroSection";
import AuthSection from "@/components/docs/sections/AuthSection";
import RateLimitsSection from "@/components/docs/sections/RateLimitsSection";
import TextToImageSection from "@/components/docs/sections/TextToImageSection";
import ImageToImageSection from "@/components/docs/sections/ImageToImageSection";
import ModelsSection from "@/components/docs/sections/ModelsSection";
import ErrorsSection from "@/components/docs/sections/ErrorsSection";
import SecuritySection from "@/components/docs/sections/SecuritySection";

const Docs = () => {
  return (
    <div className="relative flex min-h-[100svh] flex-col overflow-x-hidden bg-background">
      <GlobalNavbar />
      
      <div className="flex flex-1 overflow-x-hidden pt-14">
        <Sidebar />
        
        {/* Main content with proper overflow handling */}
        <main className="flex-1 lg:ml-64 w-full min-w-0 overflow-x-hidden">
          <div className="mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-10 lg:px-12 overflow-x-hidden">
            {/* Breadcrumbs */}
            <div className="mb-6 sm:mb-8 flex flex-wrap items-center justify-between gap-2 sm:gap-4 border-b border-border pb-4 sm:pb-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                <span>Docs</span>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-medium text-foreground truncate">Introduction</span>
              </div>
              <p className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground flex-shrink-0">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="whitespace-nowrap">Last updated: Dec 24, 2025</span>
              </p>
            </div>

            {/* Content Sections */}
            <div className="space-y-12 sm:space-y-16 overflow-x-hidden">
              <IntroSection />
              <AuthSection />
              <RateLimitsSection />
              <TextToImageSection />
              <ImageToImageSection />
              <ModelsSection />
              <ErrorsSection />
              <SecuritySection />
              <Footer />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Docs;
