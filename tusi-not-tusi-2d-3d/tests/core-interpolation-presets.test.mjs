import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  InterpolationError,
  PRESET_CATALOG,
  createConfig,
  createModel,
  createNotTusi2D,
  createTusi2D,
  getPreset,
  interpolateParameters,
  interpolatePoints,
  listPresets,
  validateConfig,
} from "../src/core/index.js";

const EPSILON = 1e-12;

const configSchema = JSON.parse(
  readFileSync(new URL("../schema/config.schema.json", import.meta.url), "utf8"),
);

function near(actual, expected, epsilon = EPSILON) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

function nearVector(actual, expected, epsilon = EPSILON) {
  assert.equal(actual.length, expected.length);
  for (let axis = 0; axis < actual.length; axis += 1) {
    near(actual[axis], expected[axis], epsilon);
  }
}

test("parameter interpolation clamps alpha, rounds counts, and blends continuous values", () => {
  const a = createConfig("not-tusi-2d", {
    center: [-2, 4],
    radius: 2,
    pointCount: 10,
    angularSpeed: -1,
    phase: { winding: -2 },
    orbitRatio: 0.2,
    animation: { time: 1, speed: 0.5, playing: true },
    visualization: { showPaths: true, palette: "radius", pointSize: 2 },
  });
  const b = createConfig("not-tusi-2d", {
    center: [6, -4],
    radius: 6,
    pointCount: 15,
    angularSpeed: 3,
    phase: { winding: 4 },
    orbitRatio: 0.8,
    animation: { time: 5, speed: 1.5, playing: false },
    visualization: { showPaths: false, palette: "radius", pointSize: 10 },
  });

  assert.deepEqual(interpolateParameters(a, b, -3), a);
  assert.deepEqual(interpolateParameters(a, b, 7), b);

  const middle = interpolateParameters(a, b, 0.5);
  assert.deepEqual(middle.center, [2, 0]);
  assert.equal(middle.radius, 4);
  assert.equal(middle.pointCount, 13);
  assert.equal(middle.angularSpeed, 1);
  assert.equal(middle.phase.winding, 1);
  near(middle.orbitRatio, 0.5);
  assert.deepEqual(middle.animation, { time: 3, speed: 1, playing: false });
  assert.deepEqual(middle.visualization, {
    showPaths: false,
    palette: "radius",
    pointSize: 6,
  });
  assert.equal(Object.isFrozen(middle), true);
  assert.equal(validateConfig(middle).valid, true);
});

test("parameter interpolation accepts model objects as inputs", () => {
  const a = createTusi2D({ radius: 1, phase: { winding: 0 } });
  const b = createTusi2D({ radius: 3, phase: { winding: 2 } });
  const result = interpolateParameters(a, b, 0.25);
  near(result.radius, 1.5);
  near(result.phase.winding, 0.5);
});

test("parameter interpolation rejects model-kind and enum mismatches", () => {
  const tusi = createConfig("tusi-2d");
  const notTusi = createConfig("not-tusi-2d");
  assert.throws(
    () => interpolateParameters(tusi, notTusi, 0.5),
    InterpolationError,
  );
  assert.throws(
    () =>
      interpolateParameters(
        tusi,
        createConfig("tusi-2d", { sampling: "half-circle" }),
        0.5,
      ),
    /matching sampling/,
  );
  assert.throws(
    () =>
      interpolateParameters(
        notTusi,
        createConfig("not-tusi-2d", { circulation: "alternating" }),
        0.5,
      ),
    /matching circulation/,
  );
  assert.throws(
    () =>
      interpolateParameters(
        createConfig("not-tusi-3d"),
        createConfig("not-tusi-3d", { circlePlane: "azimuthal" }),
        0.5,
      ),
    /matching circlePlane/,
  );
  assert.throws(
    () =>
      interpolateParameters(
        tusi,
        createConfig("tusi-2d", {
          visualization: { palette: "mono" },
        }),
        0.5,
      ),
    /matching visualization.palette/,
  );
  assert.throws(() => interpolateParameters(tusi, tusi, Number.NaN), /alpha/);
});

test("3-D Tusi parameter interpolation preserves matching fixed geometry and rejects geometry morphs", () => {
  const a = createConfig("tusi-3d", {
    seed: [1, 2, 3],
    orientationWindings: { x: 2, y: 3, z: 5 },
    orientationBends: { x: 0.25, y: -0.5, z: 1.75 },
    phase: { winding: -3 },
    radius: 1,
  });
  const b = createConfig("tusi-3d", {
    seed: [1, 2, 3],
    orientationWindings: { x: 2, y: 3, z: 5 },
    orientationBends: { x: 0.25, y: -0.5, z: 1.75 },
    phase: { winding: -3 },
    radius: 3,
  });

  const middle = interpolateParameters(a, b, 0.5);
  assert.equal(middle.radius, 2);
  assert.deepEqual(middle.seed, a.seed);
  assert.deepEqual(middle.orientationWindings, a.orientationWindings);
  assert.deepEqual(middle.orientationBends, a.orientationBends);
  assert.deepEqual(middle.phase, a.phase);

  assert.throws(
    () => interpolateParameters(a, createConfig("tusi-3d", {
      ...b,
      phase: { winding: -2 },
    }), 0.5),
    /matching phase\.winding/,
  );
  assert.throws(
    () => interpolateParameters(a, createConfig("tusi-3d", {
      ...b,
      seed: [1, 2, 4],
    }), 0.5),
    /matching seed/,
  );
  assert.throws(
    () => interpolateParameters(a, createConfig("tusi-3d", {
      ...b,
      orientationWindings: { x: 2, y: 4, z: 5 },
    }), 0.5),
    /matching orientationWindings\.y/,
  );
  assert.throws(
    () => interpolateParameters(a, createConfig("tusi-3d", {
      ...b, orientationBends: { ...b.orientationBends, y: 0.1 },
    }), 0.5),
    /matching orientationBends\.y/,
  );
});

test("configuration schema distinguishes Euler-wound Tusi from Fibonacci Not-Tusi", () => {
  const tusiShape = configSchema.$defs.tusi3d.allOf[1];
  assert.equal(tusiShape.properties.sampling.const, "full-circle");
  assert.equal(tusiShape.properties.pointCount.default, 200);
  assert.equal(tusiShape.properties.phase.$ref, "#/$defs/tusiPhase3d");
  assert.deepEqual(tusiShape.required, ["seed", "orientationWindings", "orientationBends"]);
  assert.equal(configSchema.$defs.tusiPhase3d.properties.winding.type, "integer");
  assert.deepEqual(
    configSchema.$defs.orientationWindings3d.required,
    ["x", "y", "z"],
  );
  assert.deepEqual(
    Object.values(configSchema.$defs.orientationWindings3d.properties).map(({ type }) => type),
    ["integer", "integer", "integer"],
  );
  assert.deepEqual(configSchema.$defs.orientationBends3d.required, ["x", "y", "z"]);
  assert.equal(tusiShape.properties.orientationBends.$ref, "#/$defs/orientationBends3d");
  assert.deepEqual(
    Object.values(configSchema.$defs.orientationBends3d.properties).map(({ type }) => type),
    ["number", "number", "number"],
  );

  const notTusiShape = configSchema.$defs.notTusi3d.allOf[2];
  assert.equal(notTusiShape.properties.sampling.const, "fibonacci-sphere");
  assert.equal(notTusiShape.properties.phase.$ref, "#/$defs/phase3d");
});

test("point interpolation blends corresponding point records at the same time", () => {
  const a = createTusi2D({
    pointCount: 12,
    phase: { winding: 1 },
  });
  const b = createNotTusi2D({
    pointCount: 12,
    phase: { winding: 2 },
    orbitRatio: 0.25,
  });
  const time = 0.73;
  const alpha = 0.25;
  const pointsA = a.sample(time);
  const pointsB = b.sample(time);
  const blended = interpolatePoints(a, b, time, alpha);
  assert.equal(blended.length, 12);

  for (let index = 0; index < blended.length; index += 1) {
    const expectedPosition = pointsA[index].position.map(
      (coordinate, axis) =>
        coordinate +
        (pointsB[index].position[axis] - coordinate) * alpha,
    );
    nearVector(blended[index].position, expectedPosition);
    near(
      blended[index].phase,
      pointsA[index].phase +
        (pointsB[index].phase - pointsA[index].phase) * alpha,
    );
    near(
      blended[index].signedRadius,
      pointsA[index].signedRadius +
        (pointsB[index].signedRadius - pointsA[index].signedRadius) * alpha,
    );
  }

  assert.deepEqual(
    interpolatePoints(a.config, b.config, time, -1),
    pointsA,
  );
  assert.deepEqual(
    interpolatePoints(a.config, b.config, time, 2),
    pointsB,
  );
});

test("point interpolation rejects ambiguous correspondence", () => {
  const full12 = createTusi2D({ pointCount: 12 });
  assert.throws(
    () =>
      interpolatePoints(
        full12,
        createTusi2D({ pointCount: 13 }),
        0,
        0.5,
      ),
    /equal point counts/,
  );
  assert.throws(
    () =>
      interpolatePoints(
        full12,
        createTusi2D({ pointCount: 12, sampling: "half-circle" }),
        0,
        0.5,
      ),
    /same sampling order/,
  );
  assert.throws(
    () =>
      interpolatePoints(
        full12,
        createModel(createConfig("tusi-3d", { pointCount: 12 })),
        0,
        0.5,
      ),
    /equal dimensions/,
  );
  assert.throws(() => interpolatePoints(full12, full12, Infinity, 0.5), /time/);
});

test("preset catalog contains the retained paper callouts and the 3-D Tusi geometry studies", () => {
  const expectedCounts = {
    T1: 2,
    T2: 1,
    T4: 5,
    N1: 1,
    N2: 1,
    N3: 3,
    N4: 4,
    N5: 3,
    G1: 1,
    G2: 1,
    G3: 1,
    G4: 1,
    D7: 1,
    D8: 1,
    D9: 1,
    D10: 1,
    D11: 1,
    D12: 1,
  };
  assert.equal(listPresets().length, 30);
  assert.equal(listPresets({ paperCallout: "T3" }).length, 0);
  assert.equal(listPresets({ paperCallout: "D1" }).length, 0);
  for (const [callout, count] of Object.entries(expectedCounts)) {
    assert.equal(
      listPresets({ paperCallout: callout }).length,
      count,
      callout,
    );
  }
  assert.equal(Object.isFrozen(PRESET_CATALOG), true);
  assert.equal(Object.isFrozen(listPresets()), true);
});

test("all presets are valid, immutable, finite, and internally consistent", () => {
  for (const entry of listPresets()) {
    assert.equal(PRESET_CATALOG[entry.id], entry);
    assert.equal(getPreset(entry.id), entry);
    assert.equal(entry.kind, entry.config.kind);
    assert.equal(validateConfig(entry.config).valid, true, entry.id);
    assert.equal(Object.isFrozen(entry), true);
    assert.equal(Object.isFrozen(entry.config), true);
    const model = createModel(entry.config);
    assert.equal(model.paths.length, entry.config.pointCount, entry.id);
    for (const time of [0, 0.37]) {
      for (const point of model.sample(time)) {
        assert.equal(point.position.length, model.dimension);
        assert.ok(point.position.every(Number.isFinite), entry.id);
        assert.ok(Number.isFinite(point.phase), entry.id);
        assert.ok(Number.isFinite(point.motionPhase), entry.id);
        assert.ok(Number.isFinite(point.signedRadius), entry.id);
        assert.ok(Number.isFinite(point.radius), entry.id);
      }
    }
  }
  assert.throws(() => getPreset("T3-does-not-exist"), /Unknown preset id/);
});

test("semantic presets encode the exact named parameter laws", () => {
  assert.equal(getPreset("tusi-2d-in-out").config.phase.winding, 0);
  assert.equal(getPreset("tusi-2d-rotating-circle").config.phase.winding, 1);
  assert.deepEqual(
    [
      "tusi-2d-alias-w3-n24",
      "tusi-2d-alias-w3-n12",
      "tusi-2d-alias-w3-n5",
    ].map((id) => getPreset(id).config.pointCount),
    [24, 12, 5],
  );
  assert.deepEqual(getPreset("tusi-3d-three-axis-weave").config.orientationWindings, {
    x: 1,
    y: 2,
    z: 3,
  });
  assert.deepEqual(getPreset("tusi-3d-three-axis-weave").config.phase, {
    winding: 1,
  });
  assert.deepEqual(getPreset("not-tusi-3d-vortex").config.phase, {
    twist: 1,
    pitch: 3,
    height: 0,
  });
  assert.equal(
    getPreset("not-tusi-2d-counter-triangles").config.circulation,
    "alternating",
  );
  assert.equal(
    getPreset("not-tusi-2d-counter-triangles").config.pointCount,
    22,
  );
  assert.equal(
    getPreset("not-tusi-2d-rounded-pentagon").config.orbitRatio,
    0.25,
  );
});
