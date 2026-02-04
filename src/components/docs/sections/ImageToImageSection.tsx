import { Edit } from "lucide-react";

const parameters = [
  { field: "image", type: "file", description: "The image to edit. Must be a valid PNG or JPEG. Max 4MB." },
  { field: "prompt", type: "string", description: "Description of the desired output." },
  { field: "strength", type: "float", description: "Value between 0.0 and 1.0. Higher values allow more variation." },
];

const ImageToImageSection = () => {
  return (
    <section className="scroll-mt-24 overflow-hidden" id="image-to-image">
      <div className="mb-4 sm:mb-6 flex items-center gap-3">
        <span className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-surface text-primary flex-shrink-0">
          <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
        </span>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">Image to Image</h2>
      </div>
      
      <p className="mb-4 sm:mb-6 text-sm sm:text-base text-muted-foreground">
        Edit, enhance, or transform an existing image using a descriptive text prompt. This feature allows you to keep the core structure of an image while applying creative or stylistic changes through AI.
      </p>

      {/* API Endpoint Display */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-border bg-surface p-3 sm:p-4 gap-3 sm:gap-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 sm:gap-x-3 font-mono text-xs sm:text-sm min-w-0">
          <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-xs font-bold border border-primary/30 uppercase tracking-wide flex-shrink-0">POST</span>
          <span className="text-muted-foreground break-all">https://api.ai-image.com/v1/edits</span>
        </div>
      </div>

      {/* Grid with proper overflow handling */}
      <div className="grid gap-6 sm:gap-8 grid-cols-1 xl:grid-cols-2 min-w-0">
        {/* Parameters Table */}
        <div className="min-w-0 overflow-hidden">
          <h3 className="mb-3 sm:mb-4 text-base sm:text-lg font-bold">Parameters</h3>
          <div className="overflow-hidden rounded-lg bg-surface border border-border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] text-left text-xs sm:text-sm">
                <thead className="bg-secondary text-muted-foreground">
                  <tr>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 font-medium rounded-tl-lg">Field</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 font-medium">Type</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 font-medium rounded-tr-lg">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  {parameters.map((param, index) => (
                    <tr key={param.field}>
                      <td className={`px-3 sm:px-4 py-2 sm:py-3 font-mono whitespace-nowrap ${index === parameters.length - 1 ? 'rounded-bl-lg' : ''}`}>{param.field}</td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-muted-foreground whitespace-nowrap">{param.type}</td>
                      <td className={`px-3 sm:px-4 py-2 sm:py-3 text-muted-foreground ${index === parameters.length - 1 ? 'rounded-br-lg' : ''}`}>{param.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Code Example */}
        <div className="flex flex-col gap-4 min-w-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:mb-2">
            <h3 className="font-bold text-base sm:text-lg">Example Request</h3>
            <div className="flex rounded-lg border border-border bg-surface p-0.5 self-start">
              <button className="px-2 sm:px-3 py-1 rounded-md text-[10px] sm:text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">cURL</button>
              <button className="px-2 sm:px-3 py-1 rounded-md text-[10px] sm:text-xs font-medium bg-background shadow-sm">Python</button>
              <button className="px-2 sm:px-3 py-1 rounded-md text-[10px] sm:text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">Node.js</button>
            </div>
          </div>

          {/* Code block container with proper constraints */}
          <div className="rounded-xl border border-border bg-code-bg overflow-hidden max-w-full">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-code-header px-3 sm:px-4 py-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ff5f56]"></span>
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ffbd2e]"></span>
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#27c93f]"></span>
                </div>
                <span className="text-[10px] sm:text-xs font-mono text-muted-foreground select-none">Python</span>
              </div>
              <button className="text-muted-foreground hover:text-foreground transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>

            {/* Code scroll container */}
            <div className="p-3 img2img-code-scroll border-t border-border">
              <pre className="font-mono text-xs sm:text-sm leading-[1.35] whitespace-pre">
                <code>
                  <span className="code-syntax-keyword">import</span> requests{'\n\n'}
                  url = <span className="code-syntax-string">"https://api.ai-image.com/v1/edits"</span>{'\n'}
                  files = {'{'}<span className="code-syntax-string">"image"</span>: <span className="code-syntax-func">open</span>(<span className="code-syntax-string">"original.png"</span>, <span className="code-syntax-string">"rb"</span>){'}'}{'\n\n'}
                  data = {'{'}{'\n'}
                  {"  "}<span className="code-syntax-string">"prompt"</span>: <span className="code-syntax-string">"make it winter season, snow"</span>,{'\n'}
                  {"  "}<span className="code-syntax-string">"strength"</span>: <span className="code-syntax-number">0.7</span>{'\n'}
                  {'}'}{'\n\n'}
                  headers = {'{'}<span className="code-syntax-string">"Authorization"</span>: <span className="code-syntax-string">"Bearer YOUR_KEY"</span>{'}'}{'\n\n'}
                  response = requests.<span className="code-syntax-func">post</span>({'\n'}
                  {"  "}url, headers=headers, files=files, data=data{'\n'}
                  )
                </code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ImageToImageSection;
