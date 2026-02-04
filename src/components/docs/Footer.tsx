const Footer = () => {
  return (
    <footer className="mt-20 border-t border-border pt-8 text-center text-sm text-muted-foreground">
      <p>© 2025 Visuluxe. All rights reserved.</p>
      <div className="mt-4 flex justify-center gap-6">
        <a className="hover:text-foreground transition-colors" href="#">Terms of Service</a>
        <a className="hover:text-foreground transition-colors" href="#">Privacy Policy</a>
        <a className="hover:text-foreground transition-colors" href="#">Status</a>
      </div>
    </footer>
  );
};

export default Footer;
