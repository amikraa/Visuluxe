import { Layers } from "lucide-react";

const models = [
  {
    name: "Stable Core",
    badge: "Fastest",
    badgeColor: "text-green-500 bg-green-500/10",
    version: "v2.1.0",
    description: "Our fastest model. Best for general purpose generation and quick iterating.",
    code: "stable-core-v2",
  },
  {
    name: "Realism XL",
    badge: "High Quality",
    badgeColor: "text-purple-500 bg-purple-500/10",
    version: "v1.5.0",
    description: "Optimized for photorealistic outputs. Slower generation time but higher fidelity.",
    code: "realism-xl-v1",
  },
  {
    name: "Vector Art",
    badge: "Vector",
    badgeColor: "text-orange-500 bg-orange-500/10",
    version: "v1.0.0",
    description: "Generates clean, flat vector-style illustrations suitable for icons and logos.",
    code: "vector-art-v1",
  },
];

const ModelsSection = () => {
  return (
    <section className="scroll-mt-24 overflow-hidden" id="models">
      <div className="mb-4 sm:mb-6 flex items-center gap-3">
        <span className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-surface text-primary flex-shrink-0">
          <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
        </span>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">Available Models</h2>
      </div>

      <p className="mb-4 sm:mb-6 text-sm sm:text-base text-muted-foreground">
        We support various models optimized for different use cases. You can specify the model using the{" "}
        <code className="bg-surface px-1 rounded text-xs">model</code> parameter.
      </p>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {models.map((model) => (
          <div key={model.name} className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-5 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
            <div className="mb-3 sm:mb-4 flex items-center justify-between">
              <div className={`rounded px-2 py-0.5 text-[10px] sm:text-xs font-bold ${model.badgeColor}`}>
                {model.badge}
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">{model.version}</span>
            </div>
            <h3 className="mb-2 text-base sm:text-lg font-bold">{model.name}</h3>
            <p className="mb-3 sm:mb-4 text-xs sm:text-sm text-muted-foreground">{model.description}</p>
            <code className="rounded bg-background px-2 py-1 text-[10px] sm:text-xs font-mono break-all">{model.code}</code>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ModelsSection;
