import { Image } from "lucide-react";

const parameters = [
  { name: "prompt", type: "string", required: true, description: "A text description of the desired image(s). The maximum length is 1000 characters." },
  { name: "model", type: "string", required: false, description: "The model to use for generation. Defaults to gen-v2." },
  { name: "size", type: "string", required: false, description: "The size of the generated images. Must be one of 256x256, 512x512, or 1024x1024." },
  { name: "n", type: "integer", required: false, description: "The number of images to generate. Must be between 1 and 4." },
];

const TextToImageSection = () => {
  const curlCode = `curl https://api.ai-platform.com/v1/images/gen \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -d '{
    "prompt": "A futuristic city",
    "n": 1,
    "size": "1024x1024"
  }'`;

  const responseCode = `{
  "id": "gen_abc123xyz",
  "created": 1698234000,
  "data": [
    {
      "url": "https://cdn.visionary.ai/generations/gen_abc123xyz.png",
      "seed": 48293
    }
  ]
}`;

  return (
    <section className="scroll-mt-24 overflow-hidden" id="text-to-image">
      <div className="mb-4 sm:mb-6 flex items-center gap-3">
        <span className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-surface text-primary flex-shrink-0">
          <Image className="w-4 h-4 sm:w-5 sm:h-5" />
        </span>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">Text to Image</h2>
      </div>

      {/* API Endpoint Display */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-border bg-surface p-3 sm:p-4 gap-3 sm:gap-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 sm:gap-x-3 font-mono text-xs sm:text-sm min-w-0">
          <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-xs font-bold border border-primary/30 uppercase tracking-wide flex-shrink-0">POST</span>
          <span className="text-muted-foreground break-all">https://api.ai-image.com/v1/images</span>
        </div>
      </div>

      <p className="mb-6 sm:mb-8 text-sm sm:text-base text-muted-foreground">
        Generate stunning, high-quality visuals from simple text prompts using our state-of-the-art diffusion models.
      </p>

      <div className="grid gap-6 sm:gap-x-8 sm:gap-y-6 grid-cols-1 xl:grid-cols-2">
        {/* Parameters */}
        <div className="flex flex-col gap-4 sm:gap-6 min-w-0">
          <h3 className="text-base sm:text-lg font-bold">Parameters</h3>
          <div className="space-y-4 sm:space-y-6">
            {parameters.map((param) => (
              <div key={param.name} className="border-l-2 border-border pl-3 sm:pl-4">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono text-xs sm:text-sm font-bold">{param.name}</span>
                  <span className="text-[10px] sm:text-xs text-primary">{param.type}</span>
                  <span className={`text-[10px] sm:text-xs ml-auto ${param.required ? 'text-red-400 font-medium' : 'text-muted-foreground'}`}>
                    {param.required ? 'Required' : 'Optional'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">{param.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Code Example */}
        <div className="flex flex-col gap-4 min-w-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:mb-2">
            <h3 className="font-bold text-base sm:text-lg">Example Request</h3>
            <div className="flex rounded-lg border border-border bg-surface p-0.5 self-start">
              <button className="px-2 sm:px-3 py-1 rounded-md text-[10px] sm:text-xs font-medium bg-background shadow-sm">cURL</button>
              <button className="px-2 sm:px-3 py-1 rounded-md text-[10px] sm:text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">Python</button>
              <button className="px-2 sm:px-3 py-1 rounded-md text-[10px] sm:text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">Node.js</button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-code-bg max-w-full">
            <div className="flex items-center justify-between border-b border-border bg-code-header px-3 sm:px-4 py-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ff5f56]"></span>
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ffbd2e]"></span>
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#27c93f]"></span>
                </div>
                <span className="font-mono text-[10px] sm:text-xs text-muted-foreground select-none">cURL</span>
              </div>
            </div>
            <div className="p-3 overflow-x-auto mobile-scroll-safe">
              <pre className="font-mono text-xs sm:text-sm leading-[1.35] whitespace-pre">
                <code>{curlCode}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Response - Full Width */}
        <div className="mt-2 sm:mt-4 xl:col-span-2 overflow-hidden">
          <h3 className="font-bold text-base sm:text-lg mb-2">Response</h3>
          <div className="overflow-hidden rounded-xl border border-border bg-code-bg max-w-full">
            <div className="flex items-center justify-between border-b border-border bg-code-header px-3 sm:px-4 py-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ff5f56]"></span>
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ffbd2e]"></span>
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#27c93f]"></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-[10px] sm:text-xs font-bold text-green-500">200 OK</span>
              </div>
            </div>
            <div className="p-3 overflow-x-auto mobile-scroll-safe">
              <pre className="font-mono text-xs sm:text-sm leading-[1.35] whitespace-pre">
                <code>{responseCode}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TextToImageSection;
