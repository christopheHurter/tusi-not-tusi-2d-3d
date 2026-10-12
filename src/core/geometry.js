/** Pure geometry helpers shared by the 2-D and 3-D models. */

export const TAU = 2 * Math.PI;
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function freezeRecord(record) {
  for (const value of Object.values(record)) {
    if (Array.isArray(value)) Object.freeze(value);
  }
  return Object.freeze(record);
}

function assertPointCount(pointCount) {
  if (!Number.isInteger(pointCount) || pointCount < 1) {
    throw new RangeError("pointCount must be a positive integer");
  }
}

function normalize3(vector) {
  if (
    !Array.isArray(vector) ||
    vector.length !== 3 ||
    !vector.every((component) =>
      typeof component === "number" && Number.isFinite(component)
    )
  ) {
    throw new TypeError("direction must contain three finite coordinates");
  }
  const length = Math.hypot(...vector);
  if (length === 0) throw new RangeError("direction must be non-zero");
  return vector.map((component) => component / length);
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/**
 * Generate a deterministic half-offset Fibonacci sphere.
 *
 * The longitude is deliberately stored as `GOLDEN_ANGLE * index` without
 * wrapping. Trigonometric positions are unchanged by wrapping, while the raw
 * value keeps the phase field continuous in sample order.
 */
export function fibonacciSphere(pointCount) {
  assertPointCount(pointCount);
  const samples = [];

  for (let index = 0; index < pointCount; index += 1) {
    const z = 1 - (2 * (index + 0.5)) / pointCount;
    const longitude = GOLDEN_ANGLE * index;
    const colatitude = Math.acos(Math.max(-1, Math.min(1, z)));
    const radial = Math.sqrt(Math.max(0, 1 - z * z));
    const direction = [
      radial * Math.cos(longitude),
      radial * Math.sin(longitude),
      z,
    ];

    samples.push(
      freezeRecord({
        index,
        direction,
        longitude,
        colatitude,
        z,
      }),
    );
  }

  return Object.freeze(samples);
}

/**
 * Construct the deterministic orthonormal plane used by a 3-D Not-Tusi path.
 *
 * - `meridian`: tangent points toward increasing colatitude.
 * - `azimuthal`: tangent points toward increasing longitude.
 *
 * The returned normal is `radial x tangent`, making the basis right-handed.
 */
export function sphereTangentBasis(sampleOrDirection, plane = "meridian") {
  if (plane !== "meridian" && plane !== "azimuthal") {
    throw new RangeError("plane must be meridian or azimuthal");
  }

  const suppliedSample =
    sampleOrDirection !== null &&
    typeof sampleOrDirection === "object" &&
    !Array.isArray(sampleOrDirection)
      ? sampleOrDirection
      : null;
  const radial = normalize3(suppliedSample?.direction ?? sampleOrDirection);
  const longitude = Number.isFinite(suppliedSample?.longitude)
    ? suppliedSample.longitude
    : Math.atan2(radial[1], radial[0]);
  const colatitude = Number.isFinite(suppliedSample?.colatitude)
    ? suppliedSample.colatitude
    : Math.acos(Math.max(-1, Math.min(1, radial[2])));

  const tangent =
    plane === "meridian"
      ? [
          Math.cos(colatitude) * Math.cos(longitude),
          Math.cos(colatitude) * Math.sin(longitude),
          -Math.sin(colatitude),
        ]
      : [-Math.sin(longitude), Math.cos(longitude), 0];

  const normalizedTangent = normalize3(tangent);
  const normal = normalize3(cross3(radial, normalizedTangent));

  return freezeRecord({
    plane,
    radial,
    tangent: normalizedTangent,
    normal,
    longitude,
    colatitude,
  });
}

