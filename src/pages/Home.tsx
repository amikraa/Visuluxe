import { Link } from "react-router-dom";
import { Zap, Image, Code2, Sparkles, ArrowRight, Box } from "lucide-react";
import { GlobalNavbar } from "@/components/GlobalNavbar";
import { Card3D } from "@/components/ui/Card3D";
import { GlowButton } from "@/components/ui/GlowButton";
import { Icon3D } from "@/components/ui/Icon3D";
import { FloatingOrbs } from "@/components/ui/FloatingOrbs";
import heroImage from "@/assets/hero-image.webp";
import gallery1Image from "@/assets/gallery-1.webp";
import gallery2Image from "@/assets/gallery-2.webp";

const Home = () => {
  return (
    <div className="relative min-h-[100svh] w-full flex flex-col font-body overflow-x-hidden">
      {/* Floating background orbs */}
      <FloatingOrbs />
      
      {/* Grid pattern overlay */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--foreground) / 0.1) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--foreground) / 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }}
      />
      
      {/* Global Navbar */}
      <GlobalNavbar />

      {/* Main Content */}
      <main className="flex-grow pt-32 pb-20 relative z-10">
        {/* Hero Section */}
        <section className="relative px-6">
          <div className="max-w-5xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full badge-glow mb-10 animate-fade-in">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              <span className="text-xs font-semibold text-foreground/80 tracking-wide uppercase">V2.0 is now live</span>
            </div>
            
            {/* Heading */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold font-display tracking-tight leading-[1.05] mb-8 animate-fade-in-up opacity-0 stagger-1">
              Turn text into <br />
              <span className="text-gradient-primary">visual masterpieces.</span>
            </h1>
            
            {/* Subheading */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-in-up opacity-0 stagger-2">
              Generate high-fidelity assets for your projects in seconds. 
              Powered by the latest diffusion models. No credit card required.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up opacity-0 stagger-3">
              <GlowButton asChild size="lg" variant="primary">
                <Link to="/generate">
                  <Sparkles className="w-5 h-5" />
                  Generate Free
                </Link>
              </GlowButton>
              <GlowButton asChild size="lg" variant="secondary">
                <Link to="/pricing">
                  View Pricing
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </GlowButton>
            </div>
            
            {/* Hero Image */}
            <div className="mt-20 animate-fade-in-up opacity-0 stagger-4">
              <Card3D className="mx-auto max-w-4xl" glowOnHover>
                <div className="aspect-[16/9] md:aspect-[21/9] w-full relative overflow-hidden rounded-2xl">
                  <img 
                    src={heroImage} 
                    alt="Abstract colorful AI generated digital art with flowing neon shapes"
                    className="w-full h-full object-cover"
                    fetchPriority="high"
                    decoding="async"
                  />
                  {/* Gradient overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-r from-background/20 via-transparent to-background/20" />
                  
                  {/* Floating prompt badge */}
                  <div className="absolute bottom-6 left-6 right-6 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl glass flex items-center justify-center text-primary">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-medium text-foreground/90 truncate backdrop-blur-sm bg-background/30 px-4 py-2 rounded-lg border border-border/30">
                      "Abstract colorful AI generated digital art with flowing neon shapes"
                    </p>
                  </div>
                </div>
              </Card3D>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-32 px-6">
          <div className="max-w-6xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
                Built for <span className="text-gradient-primary">creators</span>
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Everything you need to bring your creative vision to life
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <Card3D className="group p-8">
                <Icon3D variant="primary" className="mb-6">
                  <Zap className="w-6 h-6" />
                </Icon3D>
                <h3 className="text-xl font-bold font-display text-foreground mb-3">Lightning Fast</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Generate images in under 2 seconds with our optimized inference engine. No queues, no waiting.
                </p>
              </Card3D>
              
              {/* Feature 2 */}
              <Card3D className="group p-8">
                <div className="absolute top-4 right-4">
                  <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent border border-accent/30 bg-accent/10 rounded-lg">
                    Pro
                  </span>
                </div>
                <Icon3D variant="accent" className="mb-6">
                  <Image className="w-6 h-6" />
                </Icon3D>
                <h3 className="text-xl font-bold font-display text-foreground mb-3">4K Upscaling</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Enhance your creations with AI-powered upscaling. Crisp details at any resolution for print or web.
                </p>
              </Card3D>
              
              {/* Feature 3 */}
              <Card3D className="group p-8">
                <Icon3D variant="primary" className="mb-6">
                  <Code2 className="w-6 h-6" />
                </Icon3D>
                <h3 className="text-xl font-bold font-display text-foreground mb-3">Developer API</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Integrate image generation into your own apps. Simple REST API with comprehensive documentation.
                </p>
              </Card3D>
            </div>
          </div>
        </section>

        {/* Gallery Section */}
        <section className="py-16 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold font-display mb-2">Fresh from the community</h2>
                <p className="text-muted-foreground text-sm">See what creators are building</p>
              </div>
              <GlowButton variant="ghost" size="sm" asChild>
                <a href="#">
                  Explore Gallery 
                  <ArrowRight className="w-4 h-4" />
                </a>
              </GlowButton>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Gallery Item 1 */}
              <Card3D className="group">
                <div className="flex items-center gap-5 p-5">
                  <div className="relative shrink-0">
                    <img 
                      src={gallery1Image}
                      alt="A futuristic city floating in a nebula with neon lights"
                      className="w-24 h-24 rounded-xl object-cover ring-1 ring-border/50"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-background/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground line-clamp-2 italic group-hover:text-foreground transition-colors leading-relaxed">
                      "A futuristic city floating in a nebula, neon lights, cyberpunk aesthetic, highly detailed..."
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="px-2 py-1 rounded-lg bg-surface-elevated border border-border/50 text-[10px] font-medium text-muted-foreground">
                        SDXL
                      </span>
                      <span className="text-[11px] text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                        Click to Remix →
                      </span>
                    </div>
                  </div>
                </div>
              </Card3D>
              
              {/* Gallery Item 2 */}
              <Card3D className="group">
                <div className="flex items-center gap-5 p-5">
                  <div className="relative shrink-0">
                    <img 
                      src={gallery2Image}
                      alt="Oil painting of a misty mountain range at sunrise"
                      className="w-24 h-24 rounded-xl object-cover ring-1 ring-border/50"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-background/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground line-clamp-2 italic group-hover:text-foreground transition-colors leading-relaxed">
                      "Oil painting of a misty mountain range at sunrise, golden hour light, soft brushstrokes..."
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="px-2 py-1 rounded-lg bg-surface-elevated border border-border/50 text-[10px] font-medium text-muted-foreground">
                        DALL-E 3
                      </span>
                      <span className="text-[11px] text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                        Click to Remix →
                      </span>
                    </div>
                  </div>
                </div>
              </Card3D>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-border/50 py-16 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="max-w-xs">
            <Link className="flex items-center gap-2.5 mb-5" to="/">
              <div className="w-10 h-10 rounded-xl glass flex items-center justify-center text-primary">
                <Box className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold font-display tracking-tight text-foreground">Visuluxe</span>
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Empowering creators with next-gen AI tools. <br />Designed for simplicity and speed.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-16 md:gap-20">
            <div>
              <h3 className="font-bold text-foreground text-sm mb-5">Product</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a className="hover:text-foreground transition-colors" href="#">Features</a></li>
                <li>
                  <Link className="hover:text-foreground transition-colors flex items-center gap-2" to="/pricing">
                    Pricing 
                    <span className="px-1.5 py-0.5 bg-accent/20 text-accent text-[10px] rounded font-bold">SALE</span>
                  </Link>
                </li>
                <li><Link className="hover:text-foreground transition-colors" to="/docs">API</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm mb-5">Resources</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><Link className="hover:text-foreground transition-colors" to="/docs">Docs</Link></li>
                <li><a className="hover:text-foreground transition-colors" href="#">Community</a></li>
                <li><a className="hover:text-foreground transition-colors" href="#">Help</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm mb-5">Company</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a className="hover:text-foreground transition-colors" href="#">About</a></li>
                <li><a className="hover:text-foreground transition-colors" href="#">Blog</a></li>
                <li><a className="hover:text-foreground transition-colors" href="#">Legal</a></li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="max-w-6xl mx-auto mt-16 pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© 2025 Visuluxe. All rights reserved.</p>
          <div className="flex gap-6">
            <a className="hover:text-foreground transition-colors" href="#">Privacy</a>
            <a className="hover:text-foreground transition-colors" href="#">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;