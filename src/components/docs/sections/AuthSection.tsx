import { Key, AlertTriangle } from "lucide-react";
import CodeBlock from "../CodeBlock";

const AuthSection = () => {
  return (
    <section className="scroll-mt-24 overflow-hidden" id="authentication">
      <div className="mb-4 sm:mb-6 flex items-center gap-3">
        <span className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-surface text-primary flex-shrink-0">
          <Key className="w-4 h-4 sm:w-5 sm:h-5" />
        </span>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">Authentication</h2>
      </div>
      <p className="mb-4 sm:mb-6 text-sm sm:text-base text-muted-foreground">
        The API uses API keys to authenticate requests. You can view and manage your API keys in the <a className="text-primary hover:underline" href="#">Dashboard</a>.
      </p>
      
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        <div className="space-y-4 min-w-0">
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 animate-pulse flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <h4 className="font-bold text-yellow-500 text-sm sm:text-base">Security Notice</h4>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Authentication requests must be made over <code className="rounded bg-surface px-1 py-0.5 text-xs">HTTPS</code>. Calls made over plain HTTP will fail.
                </p>
              </div>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Pass your API key in the <code className="rounded bg-surface border border-border px-1.5 py-0.5 font-mono text-xs break-all">Authorization</code> header with the Bearer scheme.
          </p>
        </div>
        
        <div className="min-w-0 max-w-full overflow-hidden">
          <CodeBlock 
            language="Terminal"
            code={
              <>
                <span className="code-syntax-func">curl</span> <span className="code-syntax-string">"https://api.ai-image.com/v1/models"</span> \{'\n'}
                {"  "}-H <span className="code-syntax-string">"Authorization: Bearer YOUR_API_KEY"</span>
              </>
            }
          />
        </div>
      </div>
      
      <div className="mt-4 sm:mt-5 max-w-full overflow-hidden">
        <CodeBlock 
          language="Authentication Header"
          code={
            <>
              Authorization: Bearer <span className="code-syntax-string">sk-proj-123456789...</span>
            </>
          }
        />
      </div>
    </section>
  );
};

export default AuthSection;
