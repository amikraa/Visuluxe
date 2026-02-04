import { Shield, CheckCircle, CloudOff, Clock } from "lucide-react";

const guarantees = [
  { title: "Data Isolation", description: "Each request is handled in an isolated execution context to prevent cross-user access or data leakage." },
  { title: "Controlled Delivery", description: "Generated outputs are returned directly to the requester and are not indexed, cached, or reused." },
  { title: "Request Integrity", description: "All requests are validated and monitored to prevent abuse, tampering, or unauthorized usage." },
  { title: "Platform Security", description: "The service operates on hardened Cloudflare and AWS infrastructure with continuous monitoring." },
];

const details = [
  { title: "Encrypted Transport", description: "API requests and responses are protected in transit using modern TLS encryption." },
  { title: "Access Controls", description: "API keys enforce usage boundaries and can be rotated, restricted, or revoked instantly." },
  { title: "No Training", description: "Customer inputs and outputs are excluded from any model training or improvement processes." },
  { title: "DDoS Protection", description: "Automated traffic filtering and rate controls help protect against abuse and service disruption." },
];

const SecuritySection = () => {
  return (
    <section className="scroll-mt-24 overflow-hidden" id="security">
      <div className="mb-4 sm:mb-6 flex items-center gap-3">
        <span className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-surface text-primary flex-shrink-0">
          <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
        </span>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">Security & Privacy</h2>
      </div>

      <ul className="space-y-3 sm:space-y-4 text-sm sm:text-base text-muted-foreground mb-8 sm:mb-10">
        {guarantees.map((item) => (
          <li key={item.title} className="flex gap-2 sm:gap-3">
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span className="min-w-0">
              <strong className="text-foreground">{item.title}:</strong> {item.description}
            </span>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-10">
        <div className="flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-border bg-surface/30 overflow-hidden">
          <div className="size-8 sm:size-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            <CloudOff className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h4 className="font-bold mb-1 text-sm sm:text-base">No Persistent Storage</h4>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Generated images are stored only long enough to complete delivery and are automatically deleted afterward.
            </p>
          </div>
        </div>

        <div className="flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-border bg-surface/30 overflow-hidden">
          <div className="size-8 sm:size-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h4 className="font-bold mb-1 text-sm sm:text-base">Time-Limited Access</h4>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Signed URLs restrict access to generated images and automatically expire for added security.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-card to-background p-4 sm:p-6 md:p-8 border border-border overflow-hidden">
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 text-xs sm:text-sm text-muted-foreground">
          <ul className="space-y-2 sm:space-y-3">
            {details.slice(0, 2).map((item) => (
              <li key={item.title} className="flex items-start gap-2">
                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="min-w-0">
                  <strong className="text-foreground">{item.title}:</strong> {item.description}
                </span>
              </li>
            ))}
          </ul>
          <ul className="space-y-2 sm:space-y-3">
            {details.slice(2).map((item) => (
              <li key={item.title} className="flex items-start gap-2">
                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="min-w-0">
                  <strong className="text-foreground">{item.title}:</strong> {item.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default SecuritySection;
