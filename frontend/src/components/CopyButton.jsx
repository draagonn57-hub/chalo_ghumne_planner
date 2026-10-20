import { useState } from "react";
import { Copy, Check } from "lucide-react";

/**
 * CopyButton — copies `text` to clipboard.
 * Shows "Copied!" feedback for 2 seconds.
 * Falls back to document.execCommand when navigator.clipboard is unavailable.
 */
export default function CopyButton({ text, className = "" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // execCommand fallback for older browsers / non-secure contexts
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* silently ignore copy failures */
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 transition-colors dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 ${className}`}
    >
      {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
      <span aria-live="polite" aria-atomic="true">
        {copied ? "Copied!" : "Copy"}
      </span>
    </button>
  );
}
