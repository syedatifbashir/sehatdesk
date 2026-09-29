import type { AppointmentStatus } from "@prisma/client";

// ── Appointment status machine (single enforcement point) ──
const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["IN_CONSULTATION", "CANCELLED", "NO_SHOW"],
  IN_CONSULTATION: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionAppointment(from: AppointmentStatus, to: AppointmentStatus): void {
  if (!canTransition(from, to)) {
    throw Object.assign(new Error(`Illegal transition ${from} → ${to}`), { code: "ILLEGAL_TRANSITION" });
  }
}

// ── Slot generation: pure function, unit-tested ──
export interface DaySchedule {
  day: string; // "MON".."SUN"
  slots: string[]; // ["10:00", "10:20"]
  slotMinutes: number;
}
export interface ScheduleOverride {
  date: string; // "2026-10-05"
  available: boolean;
  reason?: string;
}

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function getFreeSlots(
  schedule: DaySchedule[],
  overrides: ScheduleOverride[],
  dateISO: string, // "2026-10-05" (hospital-local date)
  booked: string[] // already-booked "HH:MM" strings
): string[] {
  const override = overrides.find((o) => o.date === dateISO);
  if (override && !override.available) return [];
  const d = new Date(dateISO + "T12:00:00"); // avoid TZ edge
  const day = DAYS[d.getDay()];
  const daySchedule = schedule.find((s) => s.day === day);
  if (!daySchedule) return [];
  const bookedSet = new Set(booked);
  return daySchedule.slots.filter((s) => !bookedSet.has(s));
}

// ── Money math: single function ──
export function invoiceStatus(paid: number, total: number): "UNPAID" | "PARTIAL" | "PAID" {
  if (paid <= 0) return "UNPAID";
  if (paid < total) return "PARTIAL";
  return "PAID";
}

export function money(n: number): string {
  return "Rs " + n.toLocaleString("en-PK");
}
