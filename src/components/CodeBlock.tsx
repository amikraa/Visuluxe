import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  showCopyButton?: boolean;
}

export function CodeBlock({ code, language = 'bash', title, showCopyButton = true }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const formatCode = (code: string) => {
    // Simple syntax highlighting for bash/curl commands
    return code.replace(
      /(curl|POST|GET|PUT|DELETE|Authorization|Content-Type|application\/json)/g,
      '<span class="text-blue-400 font-bold">$1</span>'
    ).replace(
      /(Bearer|YOUR_API_KEY|https?:\/\/[^\s]+)/g,
      '<span class="text-green-400">$1</span>'
    ).replace(
      /("[^"]*")/g,
      '<span class="text-yellow-400">$1</span>'
    ).replace(
      /(\{|\}|\[|\])/g,
      '<span class="text-purple-400">$1</span>'
    );
  };

  return (
    <div className="group relative">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700 rounded-t-lg">
          <span className="text-sm font-medium text-gray-300">{title}</span>
          {showCopyButton && (
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-800"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400 hover:text-white" />
              )}
            </button>
          )}
        </div>
      )}
      
      <div className="relative">
        {showCopyButton && (
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-black/50 backdrop-blur-sm rounded-lg border border-gray-600 hover:bg-black/70 hover:border-gray-500"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-gray-300" />
            )}
          </button>
        )}
        
        <pre className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 overflow-auto max-h-96">
          <code 
            className="text-sm text-gray-300 font-mono leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formatCode(code) }}
          />
        </pre>
      </div>
    </div>
  );
}