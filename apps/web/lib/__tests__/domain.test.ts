import { describe, expect, it } from "vitest";
import { canTransition, getFreeSlots, invoiceStatus, money } from "../domain";

const SCHEDULE = [
  { day: "MON", slots: ["10:00", "10:20", "10:40"], slotMinutes: 20 },
  { day: "TUE", slots: ["10:00", "10:20"], slotMinutes: 20 },
];

describe("getFreeSlots", () => {
  it("returns slots for a scheduled day", () => {
    // 2026-10-05 is a Monday
    expect(getFreeSlots(SCHEDULE, [], "2026-10-05", [])).toEqual(["10:00", "10:20", "10:40"]);
  });
  it("returns empty for unscheduled day", () => {
    // 2026-10-04 is a Sunday
    expect(getFreeSlots(SCHEDULE, [], "2026-10-04", [])).toEqual([]);
  });
  it("honors leave overrides", () => {
    expect(
      getFreeSlots(SCHEDULE, [{ date: "2026-10-05", available: false, reason: "leave" }], "2026-10-05", [])
    ).toEqual([]);
  });
  it("excludes booked slots", () => {
    expect(getFreeSlots(SCHEDULE, [], "2026-10-05", ["10:20"])).toEqual(["10:00", "10:40"]);
  });
});

describe("appointment transitions", () => {
  it("allows the happy path", () => {
    expect(canTransition("PENDING", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "CHECKED_IN")).toBe(true);
    expect(canTransition("CHECKED_IN", "IN_CONSULTATION")).toBe(true);
    expect(canTransition("IN_CONSULTATION", "COMPLETED")).toBe(true);
  });
  it("allows cancel from anywhere active", () => {
    expect(canTransition("PENDING", "CANCELLED")).toBe(true);
    expect(canTransition("IN_CONSULTATION", "CANCELLED")).toBe(true);
  });
  it("blocks illegal jumps and terminal states", () => {
    expect(canTransition("PENDING", "COMPLETED")).toBe(false);
    expect(canTransition("COMPLETED", "CANCELLED")).toBe(false);
    expect(canTransition("CANCELLED", "PENDING")).toBe(false);
  });
});

describe("money math", () => {
  it("derives invoice status", () => {
    expect(invoiceStatus(0, 1500)).toBe("UNPAID");
    expect(invoiceStatus(500, 1500)).toBe("PARTIAL");
    expect(invoiceStatus(1500, 1500)).toBe("PAID");
  });
  it("formats PKR", () => {
    expect(money(1500)).toBe("Rs 1,500");
  });
});
