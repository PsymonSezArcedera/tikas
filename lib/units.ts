// Unit conversion for display. Everything is stored in metric (kg, cm); these
// convert to/from the user's unitPreference at the edges — inputs on the way in,
// rendering on the way out. Shared by Server Actions and client components.

export type Unit = "METRIC" | "IMPERIAL";

export const KG_PER_LB = 0.45359237;
export const LB_PER_KG = 1 / KG_PER_LB;
export const CM_PER_IN = 2.54;
export const IN_PER_CM = 1 / CM_PER_IN;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** kg (stored) → the number shown in the user's unit. */
export function kgToDisplay(kg: number, unit: Unit): number {
  return round1(unit === "IMPERIAL" ? kg * LB_PER_KG : kg);
}

/** A weight the user typed (in their unit) → kg for storage. */
export function displayToKg(value: number, unit: Unit): number {
  return round1(unit === "IMPERIAL" ? value * KG_PER_LB : value);
}

/** cm (stored) → the number shown in the user's unit. */
export function cmToDisplay(cm: number, unit: Unit): number {
  return round1(unit === "IMPERIAL" ? cm * IN_PER_CM : cm);
}

/** A length the user typed (in their unit) → cm for storage. */
export function displayToCm(value: number, unit: Unit): number {
  return round1(unit === "IMPERIAL" ? value * CM_PER_IN : value);
}

export function weightUnitLabel(unit: Unit): string {
  return unit === "IMPERIAL" ? "lb" : "kg";
}

export function lengthUnitLabel(unit: Unit): string {
  return unit === "IMPERIAL" ? "in" : "cm";
}
