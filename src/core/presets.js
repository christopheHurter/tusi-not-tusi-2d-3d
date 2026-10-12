import { createConfig } from "./config.js";

function preset(id, label, paperCallout, description, kind, overrides = {}) {
  return Object.freeze({
    id,
    label,
    kind,
    paperCallout,
    description,
    config: createConfig(kind, overrides),
  });
}

const entries = [
  // Demonstration T1: the two canonical 2-D Tusi organizations.
  preset(
    "tusi-2d-in-out",
    "In & out (w = 0)",
    "T1",
    "All points cross the centre and reach the rim together.",
    "tusi-2d",
    { phase: { winding: 0 } },
  ),
  preset(
    "tusi-2d-rotating-circle",
    "Rotating circle (w = 1)",
    "T1",
    "Straight local paths assemble into a revolving circle of radius R/2.",
    "tusi-2d",
    { phase: { winding: 1 } },
  ),

  // Demonstration T2: endpoint of the continuous winding sweep from 0 to 3.
  preset(
    "tusi-2d-winding-sweep",
    "Winding sweep (w = 0 to 3)",
    "T2",
    "Use the winding control from 0 to 3; this preset stores the w = 3 endpoint with N = 24.",
    "tusi-2d",
    { pointCount: 24, phase: { winding: 3 } },
  ),

  // Demonstration T4: sampling and wagon-wheel aliases.
  preset(
    "tusi-2d-alias-w3-n24",
    "Aliasing: w = 3, N = 24",
    "T4",
    "Dense sampling of the three-leaf rose.",
    "tusi-2d",
    { pointCount: 24, phase: { winding: 3 } },
  ),
  preset(
    "tusi-2d-alias-w3-n12",
    "Aliasing: w = 3, N = 12",
    "T4",
    "Coarse sampling of the three-leaf rose.",
    "tusi-2d",
    { pointCount: 12, phase: { winding: 3 } },
  ),
  preset(
    "tusi-2d-alias-w3-n5",
    "Aliasing: w = 3, N = 5",
    "T4",
    "Sparse sampling collapses the continuous rose organization.",
    "tusi-2d",
    { pointCount: 5, phase: { winding: 3 } },
  ),
  preset(
    "tusi-2d-wagon-reverse-w4-n5",
    "Wagon wheel: w = 4, N = 5",
    "T4",
    "The w = N-1 assignment aliases w = -1 and revolves backwards.",
    "tusi-2d",
    { pointCount: 5, phase: { winding: 4 } },
  ),
  preset(
    "tusi-2d-wagon-alias-w6-n5",
    "Wagon wheel: w = 6, N = 5",
    "T4",
    "The w = N+1 assignment reproduces w = 1 dot for dot.",
    "tusi-2d",
    { pointCount: 5, phase: { winding: 6 } },
  ),

  // Demonstrations N1-N3: equal-radius Not-Tusi family.
  preset(
    "not-tusi-2d-translating-ring",
    "Translating ring (w = 0)",
    "N1",
    "A ring of radius R/2 translates around the display without rotating.",
    "not-tusi-2d",
    { phase: { winding: 0 } },
  ),
  preset(
    "not-tusi-2d-sweeping-blade",
    "Sweeping blade (w = 1)",
    "N2",
    "The points align as a line that sweeps at half the temporal rate.",
    "not-tusi-2d",
    { phase: { winding: 1 } },
  ),
  preset(
    "not-tusi-2d-clover-w2",
    "Cloverleaf (w = 2)",
    "N3",
    "Equal placement and orbit radii form the w = 2 petal figure.",
    "not-tusi-2d",
    { pointCount: 24, phase: { winding: 2 } },
  ),
  preset(
    "not-tusi-2d-clover-w3",
    "Cloverleaf (w = 3)",
    "N3",
    "Equal placement and orbit radii form the w = 3 petal figure.",
    "not-tusi-2d",
    { pointCount: 24, phase: { winding: 3 } },
  ),
  preset(
    "not-tusi-2d-alias-few-dots",
    "Aliasing (few dots)",
    "N3",
    "Seven samples expose the gap between the continuous curve and the dot display.",
    "not-tusi-2d",
    { pointCount: 7, phase: { winding: 3 } },
  ),

  // Demonstration N4: split-radius dial.
  preset(
    "not-tusi-2d-rotating-ellipse",
    "Rotating ellipse (w = 1)",
    "N4",
    "A 1:3 riding/placement split opens the sweeping line into an ellipse.",
    "not-tusi-2d",
    { phase: { winding: 1 }, orbitRatio: 0.25 },
  ),
  preset(
    "not-tusi-2d-rounded-triangle",
    "Triangle (w = 2)",
    "N4",
    "A small riding circle produces a rounded triangle.",
    "not-tusi-2d",
    { phase: { winding: 2 }, orbitRatio: 0.25 },
  ),
  preset(
    "not-tusi-2d-rounded-pentagon",
    "Pentagon (w = 4)",
    "N4",
    "A small riding circle produces a rounded pentagon.",
    "not-tusi-2d",
    { phase: { winding: 4 }, orbitRatio: 0.25 },
  ),
  preset(
    "not-tusi-2d-spirograph",
    "Spirograph (w = 3)",
    "N4",
    "A large riding circle produces a four-lobed spirograph-like rosette.",
    "not-tusi-2d",
    { phase: { winding: 3 }, orbitRatio: 0.75 },
  ),

  // Demonstration N5: alternate dots circulate in opposite directions.
  preset(
    "not-tusi-2d-counter-triangles",
    "Counter triangles (w = 2 +/-)",
    "N5",
    "Twenty-two dots split into two rounded triangles rotating in opposite directions.",
    "not-tusi-2d",
    {
      pointCount: 22,
      phase: { winding: 2 },
      orbitRatio: 0.25,
      circulation: "alternating",
      visualization: { palette: "direction" },
    },
  ),
  preset(
    "not-tusi-2d-scissors",
    "Scissors (w = 1 +/-)",
    "N5",
    "Alternate circulation superimposes two counter-rotating ellipses.",
    "not-tusi-2d",
    {
      phase: { winding: 1 },
      orbitRatio: 0.25,
      circulation: "alternating",
      visualization: { palette: "direction" },
    },
  ),
  preset(
    "not-tusi-2d-counter-squares",
    "Counter squares (w = 3 +/-)",
    "N5",
    "Alternate circulation superimposes two rounded squares.",
    "not-tusi-2d",
    {
      phase: { winding: 3 },
      orbitRatio: 0.25,
      circulation: "alternating",
      visualization: { palette: "direction" },
    },
  ),

  // G1-G4: fixed Euler-wound diameter geometry with independent Tusi timing.
  preset(
    "tusi-3d-planar-ring",
    "Planar ring",
    "G1",
    "One global rotation winding gives the planar reference case.",
    "tusi-3d",
    {
      orientationWindings: { x: 0, y: 0, z: 1 },
      phase: { winding: 1 },
      visualization: { palette: "radius" },
    },
  ),
  preset(
    "tusi-3d-two-axis-loop",
    "Two-axis loop",
    "G2",
    "Two absolute rotation windings lift the endpoint curve off one plane.",
    "tusi-3d",
    {
      orientationWindings: { x: 1, y: 0, z: 2 },
      phase: { winding: 1 },
      visualization: { palette: "radius" },
    },
  ),
  preset(
    "tusi-3d-three-axis-weave",
    "Three-axis weave",
    "G3",
    "The default coprime X, Y, and Z windings trace a closed non-planar endpoint curve.",
    "tusi-3d",
    {
      orientationWindings: { x: 1, y: 2, z: 3 },
      phase: { winding: 1 },
      visualization: { palette: "radius" },
    },
  ),
  preset(
    "tusi-3d-dense-weave",
    "Dense weave",
    "G4",
    "Higher coprime geometry windings produce a denser closed endpoint weave.",
    "tusi-3d",
    {
      orientationWindings: { x: 2, y: 3, z: 5 },
      phase: { winding: 1 },
      visualization: { palette: "radius" },
    },
  ),

  // Demonstrations D7-D12: the same phase laws on fixed circular paths.
  preset(
    "not-tusi-3d-collapse-bloom",
    "Collapse & bloom",
    "D7",
    "The synchronous shell collapses to the centre once per cycle and blooms back.",
    "not-tusi-3d",
    { phase: { twist: 0, pitch: 0, height: 0 } },
  ),
  preset(
    "not-tusi-3d-revolving-lobe",
    "Revolving lobe",
    "D8",
    "One longitude phase cycle gathers the shell into a revolving lobe.",
    "not-tusi-3d",
    { phase: { twist: 1, pitch: 0, height: 0 } },
  ),
  preset(
    "not-tusi-3d-double-lobe",
    "Double lobe",
    "D9",
    "Two longitude phase cycles form two revolving lobes.",
    "not-tusi-3d",
    { phase: { twist: 2, pitch: 0, height: 0 } },
  ),
  preset(
    "not-tusi-3d-twin-shells",
    "Twin shells",
    "D10",
    "Two colatitude phase cycles create shells passing through one another.",
    "not-tusi-3d",
    { phase: { twist: 0, pitch: 2, height: 0 } },
  ),
  preset(
    "not-tusi-3d-height-wave",
    "Height wave",
    "D11",
    "A height phase gradient stacks travelling bands along the vertical axis.",
    "not-tusi-3d",
    { phase: { twist: 0, pitch: 0, height: 3 } },
  ),
  preset(
    "not-tusi-3d-vortex",
    "Vortex",
    "D12",
    "Longitude twist one plus colatitude pitch three swirls the shell pinch into a spiral.",
    "not-tusi-3d",
    { phase: { twist: 1, pitch: 3, height: 0 } },
  ),
];

export const PRESET_CATALOG = Object.freeze(
  Object.fromEntries(entries.map((entry) => [entry.id, entry])),
);

/** Return catalog entries in stable publication order, optionally filtered. */
export function listPresets({ kind, paperCallout } = {}) {
  return Object.freeze(
    entries.filter(
      (entry) =>
        (kind === undefined || entry.kind === kind) &&
        (paperCallout === undefined || entry.paperCallout === paperCallout),
    ),
  );
}

/** Resolve one semantic preset id, throwing clearly for stale URLs or typos. */
export function getPreset(id) {
  if (typeof id !== "string" || !Object.hasOwn(PRESET_CATALOG, id)) {
    throw new RangeError(`Unknown preset id: ${String(id)}`);
  }
  return PRESET_CATALOG[id];
}
