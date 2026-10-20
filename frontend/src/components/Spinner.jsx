/**
 * Spinner — accessible loading indicator.
 * Under prefers-reduced-motion falls back to a pulsing dot (no rotation).
 */
export default function Spinner({ size = 24, className = "", label = "Loading…" }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Rotating ring — hidden for reduced-motion users */}
      <svg
        className="animate-spin motion-reduce:hidden"
        viewBox="0 0 24 24"
        fill="none"
        width={size}
        height={size}
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="31.4"
          strokeDashoffset="10"
          opacity="0.25"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>

      {/* Pulsing dot — shown only under reduced-motion */}
      <span
        className="hidden motion-reduce:block rounded-full bg-current animate-pulse"
        style={{ width: size * 0.4, height: size * 0.4 }}
        aria-hidden="true"
      />
    </span>
  );
}
