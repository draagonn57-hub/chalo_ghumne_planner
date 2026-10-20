import { useState } from "react";

/**
 * useFormState — lightweight hook for inline form validation messages.
 *
 * Returns:
 *   error       string | null   — current error message
 *   success     string | null   — current success message
 *   setError    (msg) => void
 *   setSuccess  (msg) => void
 *   reset       () => void      — clears both
 *
 * Render the messages with aria-live="polite" on the container so screen
 * readers announce state changes without interrupting the user.
 *
 * Example:
 *   const { error, success, setError, setSuccess, reset } = useFormState();
 *   ...
 *   {error && <p className="form-error" aria-live="polite">{error}</p>}
 *   {success && <p className="form-success" aria-live="polite">{success}</p>}
 */
export function useFormState() {
  const [error, setErrorState] = useState(null);
  const [success, setSuccessState] = useState(null);

  const setError = (msg) => {
    setSuccessState(null);
    setErrorState(msg || null);
  };

  const setSuccess = (msg) => {
    setErrorState(null);
    setSuccessState(msg || null);
  };

  const reset = () => {
    setErrorState(null);
    setSuccessState(null);
  };

  return { error, success, setError, setSuccess, reset };
}
