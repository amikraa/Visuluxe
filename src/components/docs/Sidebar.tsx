import { Flag, Key, Zap, Image, Edit, Layers, Gauge, AlertTriangle, Shield } from "lucide-react";

const navItems = [
  {
    section: "Getting Started",
    items: [
      { icon: Flag, label: "Introduction", href: "#introduction", active: true },
      { icon: Key, label: "Authentication", href: "#authentication" },
      { icon: Zap, label: "Quick Start", href: "#quickstart" },
    ],
  },
  {
    section: "Core API",
    items: [
      { icon: Image, label: "Text to Image", href: "#text-to-image" },
      { icon: Edit, label: "Image to Image", href: "#image-to-image" },
      { icon: Layers, label: "Models", href: "#models" },
    ],
  },
  {
    section: "Resources",
    items: [
      { icon: Gauge, label: "Rate Limits", href: "#rate-limits" },
      { icon: AlertTriangle, label: "Errors", href: "#errors" },
      { icon: Shield, label: "Security", href: "#security" },
    ],
  },
];

const Sidebar = () => {
  return (
    <aside className="fixed left-0 top-14 bottom-0 z-40 hidden w-64 flex-col overflow-y-auto border-r border-border bg-background pb-10 lg:flex">
      <div className="flex flex-col gap-6 p-6">
        {navItems.map((group) => (
          <div key={group.section} className="flex flex-col gap-2">
            <h3 className="px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {group.section}
            </h3>
            {group.items.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  item.active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </a>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;
