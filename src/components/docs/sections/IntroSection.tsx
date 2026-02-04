import { Rocket, Shield } from "lucide-react";

const IntroSection = () => {
  return (
    <>
      {/* Hero */}
      <section className="scroll-mt-24 overflow-hidden" id="introduction">
        <div className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-surface to-background border border-border p-4 sm:p-8 md:p-12 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(hsl(var(--border)) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          <div className="relative z-10 max-w-full sm:max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 mb-4 sm:mb-6">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-wide text-primary">v2.0 Now Available</span>
            </div>
            <h1 className="mb-3 sm:mb-4 text-xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tight break-words">
              Build with the <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">AI Image API</span>
            </h1>
            <p className="mb-6 sm:mb-8 text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed">
              Integrate state-of-the-art image generation into your applications. Fast, scalable, and developer-friendly REST API for next-gen visual experiences.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
              <a className="flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-bold text-background hover:opacity-90 transition-opacity" href="#text-to-image">
                Read Quick Start
                <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
              <button className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-bold hover:bg-secondary transition-colors">
                View Examples
              </button>
            </div>
          </div>
          <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-primary/10 to-transparent pointer-events-none"></div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="overflow-hidden">
        <h1 className="mb-3 sm:mb-4 text-xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight">Introduction</h1>
        <p className="max-w-full sm:max-w-3xl text-sm sm:text-base md:text-lg leading-relaxed text-muted-foreground">
          Welcome to the AI Image Platform API documentation. Our API empowers developers to integrate state-of-the-art image synthesis into their applications.
        </p>
        <div className="mt-6 sm:mt-8 grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6 transition-all hover:border-primary/50 overflow-hidden">
            <div className="mb-3 sm:mb-4 flex size-10 sm:size-12 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 flex-shrink-0">
              <Rocket className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h3 className="mb-2 text-base sm:text-lg md:text-xl font-bold">High Performance</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">Generate 1024x1024 images in under 2 seconds with our optimized GPU clusters.</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6 transition-all hover:border-primary/50 overflow-hidden">
            <div className="mb-3 sm:mb-4 flex size-10 sm:size-12 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 flex-shrink-0">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h3 className="mb-2 text-base sm:text-lg md:text-xl font-bold">Enterprise Secure</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">SOC2 compliant infrastructure with ephemeral storage and end-to-end encryption.</p>
          </div>
        </div>
      </section>
    </>
  );
};

export default IntroSection;
