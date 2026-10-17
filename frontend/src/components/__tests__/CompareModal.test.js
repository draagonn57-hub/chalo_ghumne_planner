import { validateCompareResult } from "../CompareModal";

describe("validateCompareResult", () => {
  const mockDestinations = [
    { name: "Rishikesh", country: "India" },
    { name: "Manali", country: "India" },
    { name: "Wayanad", country: "India" },
  ];

  it("validates well-formed compare data and extracts winner", () => {
    const raw = {
      winner: "Rishikesh",
      winner_reason: "Best adventure match within budget.",
      criteria: [
        {
          name: "Estimated total budget",
          scores: { Rishikesh: 9, Manali: 7, Wayanad: 8 },
          notes: { Rishikesh: "Fits perfectly", Manali: "Pricey flights", Wayanad: "Good" },
        },
        {
          name: "Match with user interests",
          scores: { Rishikesh: 10, Manali: 8, Wayanad: 7 },
        },
      ],
      overall_scores: { Rishikesh: 9.5, Manali: 7.5, Wayanad: 7.5 },
      why_not_others: {
        Manali: "Higher travel time.",
        Wayanad: "Fewer river rafting experiences.",
      },
    };

    const result = validateCompareResult(raw, mockDestinations);
    expect(result).not.toBeNull();
    expect(result.winner).toBe("Rishikesh");
    expect(result.winner_reason).toBe("Best adventure match within budget.");
    expect(result.criteria).toHaveLength(2);
    expect(result.why_not_others.Manali).toBe("Higher travel time.");
    expect(result.why_not_others.Wayanad).toBe("Fewer river rafting experiences.");
  });

  it("handles case-insensitive destination names safely", () => {
    const raw = {
      winner: "rishikesh",
      winner_reason: "Top pick.",
      criteria: [
        {
          name: "Budget",
          scores: { RISHIKESH: 8, manali: 7, WAYANAD: 6 },
        },
      ],
      overall_scores: { rishikesh: 8, manali: 7, wayanad: 6 },
      why_not_others: { manali: "Too cold." },
    };

    const result = validateCompareResult(raw, mockDestinations);
    expect(result).not.toBeNull();
    expect(result.winner).toBe("Rishikesh");
    expect(result.overall_scores.Rishikesh).toBe(8);
  });

  it("handles country parentheses and comma suffixes safely", () => {
    const raw = {
      winner: "Manali (India)",
      winner_reason: "Top pick for mountains.",
      criteria: [
        {
          name: "Budget",
          scores: { "Rishikesh (India)": 9, "Manali (India)": 8, "Wayanad (India)": 7 },
        },
      ],
      overall_scores: { "Rishikesh (India)": 8.4, "Manali (India)": 8.5, "Wayanad (India)": 7.9 },
      why_not_others: { "Rishikesh (India)": "Less trekking." },
    };

    const result = validateCompareResult(raw, mockDestinations);
    expect(result).not.toBeNull();
    expect(result.winner).toBe("Manali");
    expect(result.criteria[0].scores.Rishikesh).toBe(9);
    expect(result.criteria[0].scores.Manali).toBe(8);
    expect(result.criteria[0].scores.Wayanad).toBe(7);
  });

  it("breaks ties cleanly and guarantees exactly one winner", () => {
    const raw = {
      winner: "Manali",
      winner_reason: "Selected for best scenic landscape fit.",
      criteria: [
        {
          name: "Vibe",
          scores: { Rishikesh: 8, Manali: 8, Wayanad: 8 },
        },
      ],
      overall_scores: { Rishikesh: 8.0, Manali: 8.0, Wayanad: 8.0 },
      why_not_others: {
        Rishikesh: "Slightly less relaxed atmosphere.",
      },
    };

    const result = validateCompareResult(raw, mockDestinations);
    expect(result).not.toBeNull();
    expect(result.winner).toBe("Manali");
    expect(result.why_not_others.Manali).toBeUndefined();
    expect(result.why_not_others.Rishikesh).toBe("Slightly less relaxed atmosphere.");
    // Wayanad didn't have a note in raw, should get a sensible fallback
    expect(result.why_not_others.Wayanad).toContain("fits this trip a little better");
  });

  it("calculates overall scores from criteria when overall_scores is omitted", () => {
    const raw = {
      winner: "Rishikesh",
      winner_reason: "Top average score across criteria.",
      criteria: [
        {
          name: "Budget",
          scores: { Rishikesh: 9, Manali: 7, Wayanad: 8 },
        },
        {
          name: "Experiences",
          scores: { Rishikesh: 7, Manali: 9, Wayanad: 8 },
        },
      ],
    };

    const result = validateCompareResult(raw, mockDestinations);
    expect(result).not.toBeNull();
    expect(result.overall_scores.Rishikesh).toBe(8);
    expect(result.overall_scores.Manali).toBe(8);
    expect(result.overall_scores.Wayanad).toBe(8);
  });
});
