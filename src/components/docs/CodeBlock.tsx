import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  code: React.ReactNode;
  language?: string;
  showHeader?: boolean;
  showStatus?: boolean;
  statusCode?: string;
  isImg2Img?: boolean;
}

const CodeBlock = ({ 
  code, 
  language = "Terminal", 
  showHeader = true,
  showStatus = false,
  statusCode = "200 OK",
  isImg2Img = false,
}: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const textContent = typeof code === 'string' ? code : '';
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-code-bg max-w-full min-w-0">
      {showHeader && (
        <div className="flex items-center justify-between border-b border-border bg-code-header px-3 sm:px-4 py-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex gap-1.5 flex-shrink-0">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ff5f56]"></span>
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ffbd2e]"></span>
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#27c93f]"></span>
            </div>
            <span className="font-mono text-[10px] sm:text-xs text-muted-foreground select-none truncate">
              {language}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {showStatus && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500"></span>
                <span className="text-[10px] sm:text-xs font-bold text-green-500">{statusCode}</span>
              </div>
            )}
            <button
              onClick={handleCopy}
              className="text-muted-foreground hover:text-foreground transition"
            >
              {copied ? <Check className="w-3 h-3 sm:w-4 sm:h-4" /> : <Copy className="w-3 h-3 sm:w-4 sm:h-4" />}
            </button>
          </div>
        </div>
      )}
      
      {/* Code content with proper scrolling */}
      <div className={`p-3 ${isImg2Img ? 'img2img-code-scroll' : 'overflow-x-auto mobile-scroll-safe'}`}>
        <pre className="font-mono text-xs sm:text-sm leading-[1.35] whitespace-pre">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

export default CodeBlock;
