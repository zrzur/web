/**
 * Ready starts for a new event. A template fills the form; the organiser
 * changes anything before publishing. The words are translated where they
 * are shown (the editor), this is only the shape.
 */
export type EventTemplate = {
  id: "game-night" | "tournament" | "watch-party" | "questions" | "hangout";
  /** Where it usually takes place */
  place: "Voice" | "Text" | "External";
  /** How long it usually is, in hours */
  hours: number;
  /** How it usually repeats */
  repeat?: "Daily" | "Weekly" | "EveryTwoWeeks" | "Monthly";
  /** A seat limit to start with */
  seats?: number;
};

export const EVENT_TEMPLATES: EventTemplate[] = [
  { id: "game-night", place: "Voice", hours: 3, repeat: "Weekly" },
  { id: "tournament", place: "Voice", hours: 4, seats: 16 },
  { id: "watch-party", place: "Voice", hours: 2 },
  { id: "questions", place: "Text", hours: 1 },
  { id: "hangout", place: "Voice", hours: 2 },
];
