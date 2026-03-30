export function addMinutes(timeStr: string, mins: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + mins;
  const rh = Math.floor(total / 60) % 24;
  const rm = total % 60;
  return String(rh).padStart(2, "0") + ":" + String(rm).padStart(2, "0");
}

export function formatDuration(mins: number): string {
  if (mins < 60) return mins + "min";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? h + "h" + String(m).padStart(2, "0") : h + "h";
}
