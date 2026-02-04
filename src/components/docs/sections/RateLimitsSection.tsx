import { Gauge, CheckCircle } from "lucide-react";

const plans = [
  {
    name: "Hobby",
    rate: "5 req/min",
    description: "Ideal for testing and prototypes.",
    features: ["Standard Models"],
    popular: false,
  },
  {
    name: "Pro",
    rate: "50 req/min",
    description: "For production applications.",
    features: ["All Models", "Priority Queue"],
    popular: true,
  },
  {
    name: "Enterprise",
    rate: "Unlimited",
    description: "For high scale and custom needs.",
    features: ["Dedicated GPU", "Custom Models"],
    popular: false,
  },
];

const RateLimitsSection = () => {
  return (
    <section className="scroll-mt-24 overflow-hidden" id="rate-limits">
      <div className="mb-4 sm:mb-6 flex items-center gap-3">
        <span className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-surface text-primary flex-shrink-0">
          <Gauge className="w-4 h-4 sm:w-5 sm:h-5" />
        </span>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">Rate Limits</h2>
      </div>
      <p className="mb-6 sm:mb-8 text-sm sm:text-base text-muted-foreground max-w-full sm:max-w-3xl">
        API rate limits apply per API key and are based on your subscription plan. Rate limits are enforced to ensure fair usage and stability of the platform.
      </p>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative rounded-xl border p-4 sm:p-6 transition-transform hover:-translate-y-1 overflow-hidden ${
              plan.popular 
                ? "border-primary/50 shadow-lg shadow-primary/10" 
                : "border-border"
            } bg-surface`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-4 sm:left-6 rounded-full bg-primary px-2 sm:px-3 py-0.5 text-[10px] sm:text-xs font-bold text-primary-foreground uppercase tracking-wider">
                Most Popular
              </div>
            )}
            <div className={`mb-3 sm:mb-4 ${plan.popular ? 'mt-2' : ''}`}>
              <span className={`rounded-full px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider ${
                plan.popular ? 'bg-background text-primary' : 'bg-background text-muted-foreground'
              }`}>
                {plan.name}
              </span>
            </div>
            <div className="mb-2 text-xl sm:text-2xl font-bold">{plan.rate}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">{plan.description}</p>
            <div className="mt-3 sm:mt-4 flex flex-col gap-2 border-t border-border pt-3 sm:pt-4">
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-xs sm:text-sm">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default RateLimitsSection;
