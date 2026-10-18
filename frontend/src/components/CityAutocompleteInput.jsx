/**
 * CityAutocompleteInput
 *
 * A city search input with a Google Places Autocomplete dropdown.
 * Styled to match the ManualDestination destination input exactly.
 *
 * Props:
 *   id            {string}   – used for <label htmlFor>
 *   label         {string}   – label text (rendered as uppercase eyebrow)
 *   labelIcon     {ReactNode} – optional icon placed before the label text
 *   value         {string}
 *   onChange      {(val: string) => void}
 *   placeholder   {string}
 *   inputIcon     {ReactNode} – optional icon shown inside the input (left side)
 *   error         {string}   – inline error message; shown below input when truthy
 *   onKeyDown     {function} – forwarded to the <input>
 *   testId        {string}   – data-testid on the <input>
 *   disabled      {boolean}
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useCityAutocomplete } from "@/lib/useCityAutocomplete";

export default function CityAutocompleteInput({
  id,
  label,
  labelIcon,
  value,
  onChange,
  placeholder,
  inputIcon,
  error,
  onKeyDown,
  testId,
  disabled,
}) {
  const { getSuggestions } = useCityAutocomplete();
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // Fetch suggestions with a short debounce
  const fetchSuggestions = useCallback(
    (text) => {
      clearTimeout(debounceRef.current);
      if (!text || text.trim().length < 2) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        const results = await getSuggestions(text);
        setSuggestions(results);
        setOpen(results.length > 0);
        setActiveIdx(-1);
      }, 220);
    },
    [getSuggestions]
  );

  const handleChange = (e) => {
    onChange(e.target.value);
    fetchSuggestions(e.target.value);
  };

  const selectSuggestion = (suggestion) => {
    onChange(suggestion);
    setSuggestions([]);
    setOpen(false);
    setActiveIdx(-1);
  };

  // Keyboard navigation inside the dropdown
  const handleKeyDown = (e) => {
    if (open && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && activeIdx >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[activeIdx]);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        setActiveIdx(-1);
        return;
      }
    }
    // Bubble up any other key (e.g. Enter to submit)
    onKeyDown?.(e);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={wrapperRef}>
      {/* Label — identical markup/classes to ManualDestination's destination label */}
      <label
        htmlFor={id}
        className="text-xs uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1.5"
      >
        {labelIcon}
        {label}
      </label>

      {/* Input wrapper */}
      <div className="relative mt-2">
        {/* Left icon */}
        {inputIcon && (
          <span
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          >
            {inputIcon}
          </span>
        )}

        <input
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-activedescendant={
            activeIdx >= 0 ? `${id}-option-${activeIdx}` : undefined
          }
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          data-testid={testId}
          className={[
            "w-full py-3 rounded-xl border bg-white focus:outline-none transition-colors",
            inputIcon ? "pl-10 pr-4" : "px-4",
            error
              ? "border-red-400 focus:border-red-500"
              : "border-slate-200 focus:border-[#E76F51]",
          ].join(" ")}
        />

        {/* Suggestions dropdown */}
        {open && suggestions.length > 0 && (
          <ul
            id={`${id}-listbox`}
            role="listbox"
            aria-label={`${label} suggestions`}
            className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-52 overflow-y-auto"
          >
            {suggestions.map((s, idx) => (
              <li
                key={s}
                id={`${id}-option-${idx}`}
                role="option"
                aria-selected={idx === activeIdx}
                onMouseDown={() => selectSuggestion(s)}
                className={[
                  "px-4 py-2.5 text-sm cursor-pointer transition-colors",
                  idx === activeIdx
                    ? "bg-[#0D5C75]/10 text-[#0D5C75] font-medium"
                    : "text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Inline validation error */}
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-500 font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
