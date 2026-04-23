/** Convert an ISO-8601 UTC string → "YYYY-MM-DDTHH:mm" in the local tz
 *  (the format expected by <input type="datetime-local">). */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Inverse of toLocalInput — reads the local-tz "YYYY-MM-DDTHH:mm" back to ISO UTC. */
export function fromLocalInput(local: string): string {
  return new Date(local).toISOString();
}
