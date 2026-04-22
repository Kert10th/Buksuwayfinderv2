// Path cleanup utilities — makes hand-drawn custom routes look tidy.
//
// Applied at display time so legacy (wobbly) routes get cleaned up without
// admin intervention. Two-stage process:
//   1) Ramer-Douglas-Peucker simplification — strips redundant/noisy points
//      while preserving the overall shape of the path.
//   2) Angle snapping — nudges each segment to the nearest 0°/45°/90° when
//      it's already close, so near-horizontal / near-vertical lines render
//      perfectly straight.
//
// First and last waypoints are always preserved so the path still connects
// to the START and END pins.

export interface Point {
  x: number;
  y: number;
}

/** Perpendicular distance from point p to the line through a -> b. */
const perpendicularDistance = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const mag2 = dx * dx + dy * dy;
  if (mag2 === 0) {
    // a and b coincide — just use plain distance from p to a
    const ex = p.x - a.x;
    const ey = p.y - a.y;
    return Math.sqrt(ex * ex + ey * ey);
  }
  // Project p onto line; then distance from p to that projection
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / mag2;
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const ex = p.x - projX;
  const ey = p.y - projY;
  return Math.sqrt(ex * ex + ey * ey);
};

/**
 * Ramer–Douglas–Peucker path simplification. Points that fall within
 * `tolerance` SVG units of the line between their neighbors get removed.
 */
export const simplifyPath = (points: Point[], tolerance: number): Point[] => {
  if (points.length < 3) return points.slice();

  const simplifyRecursive = (pts: Point[]): Point[] => {
    if (pts.length < 3) return pts;

    let maxDist = 0;
    let maxIdx = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = perpendicularDistance(pts[i], pts[0], pts[pts.length - 1]);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }

    if (maxDist > tolerance) {
      const left = simplifyRecursive(pts.slice(0, maxIdx + 1));
      const right = simplifyRecursive(pts.slice(maxIdx));
      // Drop the first point of `right` because it's the same as the last of `left`
      return left.concat(right.slice(1));
    }
    // All intermediate points fall within tolerance — keep just the endpoints
    return [pts[0], pts[pts.length - 1]];
  };

  return simplifyRecursive(points);
};

const SNAP_CANDIDATES_DEG = [0, 45, 90, 135, 180, -45, -90, -135, -180];

/**
 * Snap each segment's direction to the nearest cardinal/diagonal angle when
 * within `angleThresholdDeg` of one. First and last points are anchored to
 * their original positions (so the route still touches START/END pins); only
 * intermediate points get adjusted.
 */
export const snapAnglesToGrid = (
  points: Point[],
  angleThresholdDeg: number = 12,
): Point[] => {
  if (points.length < 3) return points.slice();

  const result: Point[] = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) continue;

    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    // Find the closest snap candidate within threshold
    let bestSnap: number | null = null;
    let bestDelta = angleThresholdDeg;
    for (const c of SNAP_CANDIDATES_DEG) {
      const delta = Math.abs(angleDeg - c);
      // Handle angle wrap (e.g. 179 and -179 are ~2° apart, not 358°)
      const wrappedDelta = Math.min(delta, 360 - delta);
      if (wrappedDelta < bestDelta) {
        bestDelta = wrappedDelta;
        bestSnap = c;
      }
    }

    if (bestSnap !== null) {
      const rad = (bestSnap * Math.PI) / 180;
      result.push({
        x: prev.x + Math.cos(rad) * dist,
        y: prev.y + Math.sin(rad) * dist,
      });
    } else {
      result.push(curr);
    }
  }

  // Last point: keep exactly as provided so the path ends at the END pin.
  result.push(points[points.length - 1]);
  return result;
};

/**
 * Default path cleanup: simplify then snap. Idempotent-ish — running it
 * multiple times produces the same shape.
 */
export const cleanupPath = (
  points: Point[],
  options: { simplifyTolerance?: number; snapThresholdDeg?: number } = {},
): Point[] => {
  const { simplifyTolerance = 0.8, snapThresholdDeg = 12 } = options;
  if (points.length < 3) return points.slice();
  const simplified = simplifyPath(points, simplifyTolerance);
  const snapped = snapAnglesToGrid(simplified, snapThresholdDeg);
  return snapped;
};
