import { useState, forwardRef } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * PasswordInput — reusable password field with visibility toggle.
 * Standalone component; NOT wired into Auth.jsx (which is passwordless/OTP).
 * Use wherever a real password input is needed.
 *
 * Props: all standard <input> props are forwarded.
 */
const PasswordInput = forwardRef(function PasswordInput(
  { className = "", id, ...props },
  ref
) {
  const [shown, setShown] = useState(false);
  const inputId = id || "password-input";

  return (
    <div className="relative">
      <input
        ref={ref}
        id={inputId}
        type={shown ? "text" : "password"}
        className={`w-full pr-11 ${className}`}
        autoComplete="current-password"
        {...props}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        aria-controls={inputId}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E76F51] focus-visible:ring-offset-1 rounded-r"
      >
        {shown ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
});

export default PasswordInput;
