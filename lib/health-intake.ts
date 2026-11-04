// The health form residents fill in when booking (health_intakes, 0017_nurse_intake_roster.sql).
// Shared by the booking form, the server action that checks it, and the nurse dashboard.

// Same list as the database check on health_intakes.conditions.
export const conditionOptions = ["Hypertension", "Diabetes", "Asthma", "Heart disease", "Tuberculosis", "Kidney disease"];
export const sexOptions = { female: "Female", male: "Male" } as const;
export const civilStatusOptions = { single: "Single", married: "Married", widowed: "Widowed", separated: "Separated" } as const;

export type HealthIntake = {
  reason: string;
  symptoms: string | null;
  symptom_duration: string | null;
  allergies: string | null;
  medications: string | null;
  conditions: string[];
  other_conditions: string | null;
  birthdate: string | null;
  sex: keyof typeof sexOptions | null;
  civil_status: keyof typeof civilStatusOptions | null;
  philhealth_no: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  last_period: string | null;
};

// What carries over to a resident's next booking: who they are and their medical background,
// not this visit's reason, symptoms or last period.
export type IntakeDefaults = Partial<
  Pick<
    HealthIntake,
    | "allergies" | "medications" | "conditions" | "other_conditions" | "birthdate" | "sex" | "civil_status"
    | "philhealth_no" | "emergency_name" | "emergency_phone" | "weight_kg" | "height_cm"
  >
>;

export const carriedOverColumns =
  "allergies, medications, conditions, other_conditions, birthdate, sex, civil_status, philhealth_no, emergency_name, emergency_phone, weight_kg, height_cm";

// Form field names, in the order they appear on the booking form.
export const intakeFields = [
  "reason", "symptoms", "symptomDuration", "allergies", "medications", "otherConditions", "birthdate", "sex",
  "civilStatus", "philhealthNo", "emergencyName", "emergencyPhone", "weightKg", "heightCm", "lastPeriod",
];

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "") || null;
const isDate = (v: string | null) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)));
const number = (value: unknown, min: number, max: number) => {
  if (value === "" || value === null || value === undefined) return null;
  const n = Math.round(Number(value) * 10) / 10;
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};

// Checks the health part of a booking form. `today` is YYYY-MM-DD in Philippine time.
export function readIntake(input: Record<string, unknown>, today: string): { intake: HealthIntake } | { error: string } {
  const sex = text(input.sex, 10);
  const civil = text(input.civilStatus, 10);
  const weight = number(input.weightKg, 1, 300);
  const height = number(input.heightCm, 30, 250);
  const intake: HealthIntake = {
    reason: text(input.reason, 300) ?? "",
    symptoms: text(input.symptoms, 500),
    symptom_duration: text(input.symptomDuration, 60),
    allergies: text(input.allergies, 300),
    medications: text(input.medications, 300),
    conditions: Array.isArray(input.conditions) ? conditionOptions.filter((c) => (input.conditions as unknown[]).includes(c)) : [],
    other_conditions: text(input.otherConditions, 200),
    birthdate: text(input.birthdate, 10),
    sex: sex && sex in sexOptions ? (sex as HealthIntake["sex"]) : null,
    civil_status: civil && civil in civilStatusOptions ? (civil as HealthIntake["civil_status"]) : null,
    philhealth_no: text(input.philhealthNo, 14),
    emergency_name: text(input.emergencyName, 100),
    emergency_phone: text(input.emergencyPhone, 20),
    weight_kg: weight ?? null,
    height_cm: height ?? null,
    last_period: text(input.lastPeriod, 10),
  };

  if (intake.reason.length < 3) return { error: "Please tell us the main reason for your visit." };
  if (!isDate(intake.birthdate) || (intake.birthdate && (intake.birthdate > today || intake.birthdate < "1900-01-01"))) {
    return { error: "Please enter a valid birthdate." };
  }
  if (!isDate(intake.last_period) || (intake.last_period && intake.last_period > today)) {
    return { error: "Please enter a valid date for your last period." };
  }
  // Same patterns as the database checks.
  if (intake.philhealth_no && !/^[0-9]{2}-?[0-9]{9}-?[0-9]$/.test(intake.philhealth_no)) {
    return { error: "PhilHealth numbers have 12 digits (e.g. 12-345678901-2)." };
  }
  if (intake.emergency_phone && !/^[0-9+ -]{7,20}$/.test(intake.emergency_phone)) {
    return { error: "Please enter a valid emergency contact number." };
  }
  if (weight === undefined) return { error: "Please enter your weight in kilograms (1 to 300)." };
  if (height === undefined) return { error: "Please enter your height in centimeters (30 to 250)." };
  return { intake };
}

// Age in whole years on `today` (both YYYY-MM-DD).
export function ageOn(birthdate: string, today: string) {
  const [by, bm, bd] = birthdate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}
