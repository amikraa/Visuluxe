import { Link } from "react-router-dom";

const Header = () => {
  return (
    <header className="sticky top-0 z-50 h-14 flex items-center justify-between border-b border-border bg-background/90 backdrop-blur-md px-3 sm:px-4 lg:px-10 gap-2 sm:gap-3">
      {/* Left section: Logo + Nav */}
      <div className="flex items-center gap-3 sm:gap-4 lg:gap-8 min-w-0 flex-shrink-0">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0">
          <div className="flex size-7 sm:size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <h2 className="text-sm sm:text-base lg:text-lg font-bold leading-tight tracking-tight whitespace-nowrap hidden sm:block">AI Image Platform</h2>
        </Link>
        <div className="hidden lg:flex items-center gap-4 lg:gap-6">
          <a className="text-sm font-bold leading-normal border-b-2 border-primary pb-0.5" href="#">Docs</a>
          <a className="text-muted-foreground text-sm font-medium leading-normal hover:text-primary transition-colors" href="#">Dashboard</a>
          <a className="text-muted-foreground text-sm font-medium leading-normal hover:text-primary transition-colors" href="#">Support</a>
        </div>
      </div>

      {/* Right section: Search + Version + Actions */}
      <div className="flex items-center justify-end gap-2 sm:gap-3 lg:gap-4 min-w-0 flex-1">
        {/* Search - hidden on small screens */}
        <div className="relative hidden lg:block w-full max-w-xs xl:max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input className="w-full rounded-lg border border-border bg-surface py-1.5 pl-9 pr-12 text-sm placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Search docs..." />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-secondary px-1 py-0.5 text-[10px] text-muted-foreground">⌘K</div>
        </div>

        {/* Version badge - hidden on very small screens */}
        <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-full bg-surface border border-border flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-[10px] sm:text-xs font-medium text-muted-foreground whitespace-nowrap">v2.0</span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <a className="hidden lg:block text-sm font-medium hover:underline" href="#">Login</a>
          <button className="flex cursor-pointer items-center justify-center rounded-lg bg-primary px-2.5 sm:px-3 lg:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs lg:text-sm font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95 whitespace-nowrap flex-shrink-0">
            <span className="hidden sm:inline">Get API Key</span>
            <span className="sm:hidden">API Key</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
