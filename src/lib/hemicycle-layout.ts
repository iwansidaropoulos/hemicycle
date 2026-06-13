/**
 * Shared seat geometry for the hemicycle charts. Lays out N seats across a
 * semicircle and returns them ordered left→right (so callers can assign groups
 * in political order). Used by both the home-page and scrutin hemicycles so the
 * two always have the same arrangement.
 */

export interface Seat {
  x: number;
  y: number;
  angle: number;
}

export const HEMICYCLE_WIDTH = 760;

export function layoutSemicircle(n: number): {
  seats: Seat[];
  height: number;
  seatRadius: number;
} {
  const innerRadius = HEMICYCLE_WIDTH * 0.2;
  const outerRadius = HEMICYCLE_WIDTH * 0.47;
  const cx = HEMICYCLE_WIDTH / 2;
  const rows = Math.min(18, Math.max(6, Math.round(n / 38)));
  const radii: number[] = [];
  for (let i = 0; i < rows; i++) {
    radii.push(innerRadius + ((outerRadius - innerRadius) * i) / (rows - 1));
  }
  const totalRadius = radii.reduce((a, b) => a + b, 0);
  const perRow = radii.map((r) => Math.max(1, Math.floor((n * r) / totalRadius)));
  let assigned = perRow.reduce((a, b) => a + b, 0);
  for (let i = rows - 1; assigned < n; i = (i - 1 + rows) % rows) {
    perRow[i]++;
    assigned++;
  }

  const cy = outerRadius + 14;
  const seats: Seat[] = [];
  radii.forEach((r, i) => {
    const count = perRow[i];
    for (let k = 0; k < count; k++) {
      const angle = count === 1 ? Math.PI / 2 : Math.PI * (1 - k / (count - 1));
      seats.push({ x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle), angle });
    }
  });
  seats.sort((a, b) => b.angle - a.angle); // left → right

  const rowGap = (outerRadius - innerRadius) / (rows - 1);
  return { seats: seats.slice(0, n), height: cy + 18, seatRadius: rowGap * 0.42 };
}
