import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const AnimatedNavLink = ({ to, children }: { to: string; children: ReactNode }) => {
  return (
    <Link
      to={to}
      className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
    >
      {children}
    </Link>
  );
};

export function MiniNavbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [headerShapeClass, setHeaderShapeClass] = useState('rounded-full');
  const shapeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { user, loading } = useAuth();

  const toggleMenu = () => setIsOpen(!isOpen);

  useEffect(() => {
    if (shapeTimeoutRef.current) clearTimeout(shapeTimeoutRef.current);
    if (isOpen) {
      setHeaderShapeClass('rounded-xl');
    } else {
      shapeTimeoutRef.current = setTimeout(() => setHeaderShapeClass('rounded-full'), 300);
    }
    return () => { if (shapeTimeoutRef.current) clearTimeout(shapeTimeoutRef.current); };
  }, [isOpen]);

  const logoElement = (
    <Link to="/" className="flex items-center gap-2 flex-shrink-0">
      <div className="relative w-5 h-5 flex items-center justify-center">
        <span className="absolute w-1.5 h-1.5 rounded-full bg-primary top-0 left-1/2 transform -translate-x-1/2 opacity-80"></span>
        <span className="absolute w-1.5 h-1.5 rounded-full bg-primary left-0 top-1/2 transform -translate-y-1/2 opacity-80"></span>
        <span className="absolute w-1.5 h-1.5 rounded-full bg-primary right-0 top-1/2 transform -translate-y-1/2 opacity-80"></span>
        <span className="absolute w-1.5 h-1.5 rounded-full bg-primary bottom-0 left-1/2 transform -translate-x-1/2 opacity-80"></span>
      </div>
      <span className="text-foreground font-semibold text-sm">PixelAI</span>
    </Link>
  );

  const navLinksData = [
    { label: 'Home', to: '/' },
    { label: 'Docs', to: '/docs' },
    { label: 'Pricing', to: '/pricing' },
    ...(user ? [{ label: 'Dashboard', to: '/dashboard' }] : []),
  ];

  const authButtons = user ? (
    <>
      <Link to="/generate" className="px-3 py-2 text-xs sm:text-sm font-semibold text-primary-foreground bg-gradient-to-br from-primary to-accent rounded-full hover:opacity-90 transition-all duration-200 w-full md:w-auto whitespace-nowrap text-center">
        Generate
      </Link>
    </>
  ) : (
    <>
      <Link to="/signin" className="px-3 py-2 text-xs sm:text-sm border border-border bg-card/60 text-muted-foreground rounded-full hover:border-primary/50 hover:text-foreground transition-colors duration-200 w-full md:w-auto whitespace-nowrap text-center">
        Login
      </Link>
      <Link to="/signup" className="relative group w-full md:w-auto flex-shrink-0">
        <div className="absolute inset-0 -m-2 rounded-full hidden md:block bg-primary opacity-30 filter blur-lg pointer-events-none transition-all duration-300 ease-out group-hover:opacity-50 group-hover:blur-xl group-hover:-m-3"></div>
        <span className="relative z-10 px-3 py-2 text-xs sm:text-sm font-semibold text-primary-foreground bg-gradient-to-br from-primary to-accent rounded-full hover:opacity-90 transition-all duration-200 w-full md:w-auto whitespace-nowrap block text-center">
          Get API Key
        </span>
      </Link>
    </>
  );

  if (loading) return null;

  return (
    <header
      className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center px-4 sm:px-5 md:px-4 lg:px-6 py-3 backdrop-blur-md ${headerShapeClass} border border-border bg-card/60 w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] md:max-w-fit md:w-auto transition-[border-radius] duration-0 ease-in-out`}
    >
      <div className="flex items-center justify-between w-full gap-x-3 md:gap-x-4 lg:gap-x-6">
        <div className="flex items-center flex-shrink-0">{logoElement}</div>
        <nav className="hidden md:flex items-center space-x-3 lg:space-x-5 text-sm flex-shrink-0">
          {navLinksData.map((link) => (
            <AnimatedNavLink key={link.to} to={link.to}>{link.label}</AnimatedNavLink>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-2 lg:gap-3 flex-shrink-0">{authButtons}</div>
        <button className="md:hidden flex items-center justify-center w-8 h-8 text-muted-foreground focus:outline-none flex-shrink-0" onClick={toggleMenu} aria-label={isOpen ? 'Close Menu' : 'Open Menu'}>
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          )}
        </button>
      </div>
      <div className={`md:hidden flex flex-col items-center w-full transition-all ease-in-out duration-300 overflow-hidden ${isOpen ? 'max-h-[1000px] opacity-100 pt-4' : 'max-h-0 opacity-0 pt-0 pointer-events-none'}`}>
        <nav className="flex flex-col items-center space-y-4 text-base w-full">
          {navLinksData.map((link) => (
            <Link key={link.to} to={link.to} className="text-muted-foreground hover:text-foreground transition-colors w-full text-center">{link.label}</Link>
          ))}
        </nav>
        <div className="flex flex-col items-center space-y-4 mt-4 w-full">{authButtons}</div>
      </div>
    </header>
  );
}
