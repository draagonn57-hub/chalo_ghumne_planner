import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useCityAutocomplete } from "@/lib/useCityAutocomplete";

const MAX_CHIPS = 30;
const MAX_CHARS = 80;

/**
 * Reusable chips input for visited places.
 *
 * Props:
 *   chips          {string[]}   — current user-added chips (controlled)
 *   onChange       {fn}         — called with new chips array
 *   savedChips     {string[]}   — read-only chips shown from saved trips
 *   disabled       {boolean}
 */
export default function VisitedPlacesInput({
  chips = [],
  onChange,
  savedChips = [],
  disabled = false,
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);

  // ── autocomplete ──────────────────────────────────────────
  const { getSuggestions } = useCityAutocomplete();
  const [suggestions, setSuggestions] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef(null);

  const fetchSuggestions = useCallback(
    (text) => {
      clearTimeout(debounceRef.current);
      if (!text || text.trim().length < 2) {
        setSuggestions([]);
        setDropdownOpen(false);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        const results = await getSuggestions(text);
        setSuggestions(results);
        setDropdownOpen(results.length > 0);
        setActiveIdx(-1);
      }, 220);
    },
    [getSuggestions]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── chip helpers ──────────────────────────────────────────
  const allExisting = new Set(
    [...savedChips, ...chips].map((c) => c.trim().toLowerCase())
  );

  const addChip = (raw) => {
    const value = raw.trim();
    if (!value) return;
    if (value.length > MAX_CHARS) {
      toast.error(`Place name must be ${MAX_CHARS} characters or fewer.`);
      return;
    }
    if (allExisting.has(value.toLowerCase())) {
      toast.info(`"${value}" is already in your list.`);
      setInput("");
      setSuggestions([]);
      setDropdownOpen(false);
      return;
    }
    if (chips.length >= MAX_CHIPS) {
      toast.error(`You can add up to ${MAX_CHIPS} places.`);
      return;
    }
    onChange([...chips, value]);
    setInput("");
    setSuggestions([]);
    setDropdownOpen(false);
  };

  const selectSuggestion = (suggestion) => {
    addChip(suggestion);
  };

  const removeChip = (index) => {
    if (disabled) return;
    onChange(chips.filter((_, i) => i !== index));
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    fetchSuggestions(e.target.value);
  };

  const handleKeyDown = (e) => {
    // Navigate dropdown first
    if (dropdownOpen && suggestions.length > 0) {
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
        setDropdownOpen(false);
        setActiveIdx(-1);
        return;
      }
    }

    // Normal chip-add shortcuts
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addChip(input);
    } else if (e.key === "Backspace" && input === "" && chips.length > 0) {
      removeChip(chips.length - 1);
    }
  };

  return (
    <div className="space-y-3" ref={wrapperRef}>
      {/* Saved (read-only) chips */}
      {savedChips.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">
            From your saved trips
          </p>
          <div className="flex flex-wrap gap-2">
            {savedChips.map((place, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0D5C75]/8 text-[#0D5C75] text-sm font-medium"
              >
                <MapPin size={12} />
                {place}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Editable chips + input */}
      <div className="relative">
        <div
          className={`flex flex-wrap gap-2 min-h-[2.5rem] p-3 rounded-xl border bg-white transition-colors ${
            disabled
              ? "border-slate-100 bg-slate-50 cursor-not-allowed"
              : "border-slate-200 focus-within:border-[#0D5C75] focus-within:ring-2 focus-within:ring-[#0D5C75]/10"
          }`}
          onClick={() => !disabled && inputRef.current?.focus()}
        >
          <AnimatePresence initial={false}>
            {chips.map((chip, i) => (
              <motion.span
                key={chip + i}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-[#E76F51]/10 text-[#E76F51] text-sm font-medium"
                data-testid={`visited-chip-${i}`}
              >
                {chip}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeChip(i);
                  }}
                  disabled={disabled}
                  aria-label={`Remove ${chip}`}
                  className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-[#E76F51]/20 transition-colors disabled:opacity-50"
                >
                  <X size={11} strokeWidth={2.5} />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>

          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={dropdownOpen}
            aria-controls="visited-places-listbox"
            aria-activedescendant={
              activeIdx >= 0 ? `visited-places-option-${activeIdx}` : undefined
            }
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              chips.length === 0
                ? "Type a city or country, then press Enter…"
                : "Add another…"
            }
            className="flex-1 min-w-[140px] outline-none bg-transparent text-sm text-slate-700 placeholder-slate-400 disabled:cursor-not-allowed"
            data-testid="visited-input"
            aria-label="Enter a place you have visited"
            autoComplete="off"
          />
        </div>

        {/* Suggestions dropdown */}
        {dropdownOpen && suggestions.length > 0 && (
          <ul
            id="visited-places-listbox"
            role="listbox"
            aria-label="Place suggestions"
            className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-52 overflow-y-auto"
          >
            {suggestions.map((s, idx) => (
              <li
                key={s}
                id={`visited-places-option-${idx}`}
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

      {/* Add button row */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => addChip(input)}
          disabled={disabled || !input.trim()}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0D5C75] px-3 py-1.5 rounded-full border border-[#0D5C75]/20 hover:bg-[#0D5C75]/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="visited-add-btn"
        >
          <Plus size={14} />
          Add place
        </button>

        {chips.length > 0 && (
          <p className="text-xs text-slate-400">
            {chips.length}/{MAX_CHIPS} places added
          </p>
        )}
      </div>
    </div>
  );
}
