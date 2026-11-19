export class ReminderOffsetInputError extends Error {
  constructor(message = "Use up to 10 whole-minute offsets from 1 to 43,200, separated by commas. Leave blank to turn off automatic reminders.") {
    super(message);
    this.name = "ReminderOffsetInputError";
  }
}

/** Parse the editable notification setting with the same constraints as the API schema. */
export function parseReminderOffsets(input: string): number[] {
  const value = input.trim();
  if (!value) return [];
  const parts = value.split(",").map((part) => part.trim());
  if (parts.length > 10) throw new ReminderOffsetInputError();
  const offsets = parts.map((part) => {
    if (!/^\d+$/.test(part)) throw new ReminderOffsetInputError();
    const minutes = Number(part);
    if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 43_200) throw new ReminderOffsetInputError();
    return minutes;
  });
  return offsets;
}

/** Returns configured reminder times that are still in the future, in trigger order. */
export function configuredReminderTimes(
  dueAt: string | Date | null | undefined,
  offsetsMinutes: number[],
  now: number | Date = Date.now(),
): string[] {
  if (!dueAt) return [];
  const due = dueAt instanceof Date ? dueAt.getTime() : Date.parse(dueAt);
  const current = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(due) || !Number.isFinite(current)) return [];

  return [...new Set(offsetsMinutes
    .filter((offset) => Number.isInteger(offset) && offset > 0 && offset <= 43_200)
    .map((offset) => due - offset * 60_000)
    .filter((timestamp) => timestamp > current)
    .sort((a, b) => a - b))]
    .map((timestamp) => new Date(timestamp).toISOString());
}

/** Returns the earliest configured reminder time that is still in the future. */
export function nextConfiguredReminderAt(
  dueAt: string | Date | null | undefined,
  offsetsMinutes: number[],
  now: number | Date = Date.now(),
): string | null {
  return configuredReminderTimes(dueAt, offsetsMinutes, now)[0] ?? null;
}
