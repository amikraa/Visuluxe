import { AlertTriangle, AlertCircle } from "lucide-react";

const errors = [
  { code: "200", meaning: "OK – Success", color: "text-green-400" },
  { code: "400", meaning: "Bad Request – Invalid parameters", color: "text-yellow-400" },
  { code: "401", meaning: "Unauthorized – Invalid API Key", color: "text-yellow-400" },
  { code: "429", meaning: "Too Many Requests – Rate limit exceeded", color: "text-red-400" },
  { code: "500", meaning: "Internal Server Error", color: "text-red-400" },
];

const ErrorsSection = () => {
  return (
    <section className="scroll-mt-24 overflow-hidden" id="errors">
      <div className="mb-4 sm:mb-6 flex items-center gap-3">
        <span className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-surface text-primary flex-shrink-0">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
        </span>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">Errors</h2>
      </div>

      <div className="grid gap-6 sm:gap-8 lg:gap-10 grid-cols-1 lg:grid-cols-2 items-start">
        <div className="max-w-full lg:max-w-xl min-w-0">
          <div className="mb-3 sm:mb-4 flex items-center gap-2">
            <span className="text-primary">⚡</span>
            <h3 className="text-base sm:text-lg font-semibold">Error Semantics for Image Generation</h3>
          </div>

          <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground mb-4 sm:mb-6">
            Errors indicate the exact stage at which an image request failed — from input validation to model execution to delivery. This separation allows clients to implement accurate retries, fallbacks, and monitoring.
          </p>

          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <h4 className="font-semibold text-yellow-400 mb-1 text-sm sm:text-base">Handling Rate Limits (429)</h4>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  When a <code className="bg-surface px-1 rounded text-xs">429</code> error is returned, clients should apply exponential backoff or retry after the window resets.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg bg-surface border border-border w-full">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-xs sm:text-sm">
              <thead className="bg-secondary text-muted-foreground">
                <tr>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 font-medium rounded-tl-lg">Code</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 font-medium rounded-tr-lg">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {errors.map((error, index) => (
                  <tr key={error.code}>
                    <td className={`px-3 sm:px-4 py-2 sm:py-3 font-mono ${error.color} ${index === errors.length - 1 ? 'rounded-bl-lg' : ''}`}>{error.code}</td>
                    <td className={`px-3 sm:px-4 py-2 sm:py-3 text-muted-foreground ${index === errors.length - 1 ? 'rounded-br-lg' : ''}`}>{error.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ErrorsSection;
