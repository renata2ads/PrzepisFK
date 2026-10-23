// Ocena wpływu zmiany na oprogramowanie dziedzinowe — wspólna dla skryptu (prompt) i strony (etykiety)

export const IMPACT_TYPES = {
  struktury: "Struktury XML / e-deklaracje",
  wzory: "Wzory sprawozdań i druków",
  slowniki: "Słowniki i klasyfikacje",
  algorytmy: "Algorytmy i naliczenia",
  terminy: "Terminy i okresy",
  raporty: "Wydruki i zestawienia",
  integracje: "Integracje (KSeF, ZUS, US, bank)",
} as const;

export type ImpactType = keyof typeof IMPACT_TYPES;

export const PRIORITY = {
  high: { label: "Pilne — wymaga zmian w systemie", short: "Pilne" },
  medium: { label: "Do weryfikacji", short: "Do weryfikacji" },
  info: { label: "Informacyjne", short: "Informacyjne" },
} as const;

export type Priority = keyof typeof PRIORITY;

export const isImpactType = (v: string): v is ImpactType => v in IMPACT_TYPES;
export const isPriority = (v: string): v is Priority => v in PRIORITY;
