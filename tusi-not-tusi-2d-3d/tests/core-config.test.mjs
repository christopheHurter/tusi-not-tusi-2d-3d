import test from "node:test";
import assert from "node:assert/strict";

import {
  CIRCLE_PLANES,
  CIRCULATION_MODES,
  ConfigValidationError,
  GOLDEN_ANGLE,
  MODEL_KINDS,
  PALETTES,
  SAMPLING_METHODS,
  SCHEMA_VERSION,
  createConfig,
  deserializeConfig,
  fibonacciSphere,
  getDefaultConfig,
  serializeConfig,
  sphereTangentBasis,
  validateConfig,
} from "../src/core/index.js";

const EPSILON = 1e-12;

function dot(a, b) {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function near(actual, expected, epsilon = EPSILON) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

test("public configuration enums and schema version are stable", () => {
  assert.equal(SCHEMA_VERSION, 1);
  assert.deepEqual(MODEL_KINDS, [
    "tusi-2d",
    "not-tusi-2d",
    "tusi-3d",
    "not-tusi-3d",
  ]);
  assert.deepEqual(SAMPLING_METHODS, [
    "full-circle",
    "half-circle",
    "fibonacci-sphere",
  ]);
  assert.deepEqual(CIRCULATION_MODES, [
    "forward",
    "reverse",
    "alternating",
  ]);
  assert.deepEqual(CIRCLE_PLANES, ["meridian", "azimuthal"]);
  assert.deepEqual(PALETTES, ["phase", "radius", "direction", "mono"]);
});

test("every kind receives complete canonical defaults", () => {
  for (const kind of MODEL_KINDS) {
    const config = getDefaultConfig(kind);
    const dimension = kind.endsWith("-3d") ? 3 : 2;
    assert.equal(config.kind, kind);
    assert.equal(config.schemaVersion, 1);
    assert.deepEqual(config.center, Array(dimension).fill(0));
    assert.equal(config.radius, 1);
    assert.equal(
      config.pointCount,
      kind === "tusi-3d" ? 200 : dimension === 3 ? 260 : 24,
    );
    assert.equal(config.angularSpeed, 1);
    assert.equal(
      config.sampling,
      kind === "not-tusi-3d" ? "fibonacci-sphere" : "full-circle",
    );
    assert.deepEqual(config.animation, { time: 0, speed: 1, playing: true });
    assert.deepEqual(config.visualization, {
      showPaths: true,
      palette: "phase",
      pointSize: 5,
    });
    assert.equal(validateConfig(config).valid, true);
    assert.equal(Object.isFrozen(config), true);
    assert.equal(Object.isFrozen(config.center), true);
    assert.equal(Object.isFrozen(config.phase), true);
    assert.equal(Object.isFrozen(config.animation), true);
    assert.equal(Object.isFrozen(config.visualization), true);
  }

  const tusi3d = getDefaultConfig("tusi-3d");
  near(Math.hypot(...tusi3d.seed), 1);
  assert.deepEqual(tusi3d.orientationWindings, { x: 1, y: 2, z: 3 });
  assert.deepEqual(tusi3d.orientationBends, { x: 0, y: 0, z: 0 });
  assert.equal(Object.isFrozen(tusi3d.orientationBends), true);
  assert.deepEqual(tusi3d.phase, { winding: 1 });
  assert.equal(Object.isFrozen(tusi3d.seed), true);
  assert.equal(Object.isFrozen(tusi3d.orientationWindings), true);
});

test("partial overrides merge nested fields without mutating the caller", () => {
  const overrides = {
    center: [2, -3],
    phase: { winding: 2.5 },
    animation: { playing: false },
    visualization: { pointSize: 8 },
  };
  const untouched = structuredClone(overrides);
  const config = createConfig("tusi-2d", overrides);
  assert.deepEqual(overrides, untouched);
  assert.deepEqual(config.phase, { winding: 2.5 });
  assert.deepEqual(config.animation, { time: 0, speed: 1, playing: false });
  assert.deepEqual(config.visualization, {
    showPaths: true,
    palette: "phase",
    pointSize: 8,
  });

  const tusi3d = createConfig("tusi-3d", {
    seed: [0, 3, 4],
    orientationWindings: { y: -4 },
    orientationBends: { x: 0.35 },
    phase: { winding: -3 },
  });
  assert.deepEqual(tusi3d.seed, [0, 0.6, 0.8]);
  assert.deepEqual(tusi3d.orientationWindings, { x: 1, y: -4, z: 3 });
  assert.deepEqual(tusi3d.orientationBends, { x: 0.35, y: 0, z: 0 });
  assert.deepEqual(deserializeConfig(serializeConfig(tusi3d)), tusi3d);
  assert.deepEqual(tusi3d.phase, { winding: -3 });
});

test("validation reports invalid and unsupported values without throwing", () => {
  const invalid = {
    ...structuredClone(getDefaultConfig("not-tusi-2d")),
    schemaVersion: 2,
    radius: 0,
    pointCount: 2.5,
    orbitRatio: 1.1,
    sampling: "fibonacci-sphere",
    extra: true,
  };
  const result = validateConfig(invalid);
  assert.equal(result.valid, false);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.errors), true);
  assert.match(result.errors.join("\n"), /schemaVersion/);
  assert.match(result.errors.join("\n"), /radius/);
  assert.match(result.errors.join("\n"), /pointCount/);
  assert.match(result.errors.join("\n"), /orbitRatio/);
  assert.match(result.errors.join("\n"), /2-D model/);
  assert.match(result.errors.join("\n"), /extra is not supported/);
});

test("createConfig rejects invalid kinds, mismatches, unknown fields, and nested typos", () => {
  assert.throws(() => createConfig("unknown"), ConfigValidationError);
  assert.throws(
    () => createConfig("tusi-2d", { kind: "tusi-3d" }),
    /does not match/,
  );
  assert.throws(
    () => createConfig("tusi-2d", { unknown: 1 }),
    /not supported/,
  );
  assert.throws(
    () => createConfig("tusi-3d", { phase: { twist: 1 } }),
    /phase.twist is not supported/,
  );
  assert.throws(
    () => createConfig("tusi-3d", { phase: { winding: 1.5 } }),
    /phase.winding must be an integer/,
  );
  assert.throws(
    () => createConfig("tusi-3d", { orientationWindings: { y: 0.5 } }),
    /orientationWindings.y must be an integer/,
  );
  assert.throws(
    () => createConfig("tusi-3d", { orientationWindings: { y: Number.POSITIVE_INFINITY } }),
    /orientationWindings.y must be a finite number/,
  );
  assert.throws(
    () => createConfig("tusi-3d", { seed: [0, 0, 0] }),
    /seed must be non-zero/,
  );
  assert.throws(
    () => createConfig("not-tusi-3d", { circlePlane: "diagonal" }),
    /circlePlane/,
  );
  assert.throws(
    () => createConfig("not-tusi-2d", { circulation: "random" }),
    /circulation/,
  );
});

test("3-D Tusi bend amplitudes are finite, strictly named, immutable geometry fields", () => {
  const bends = { x: 0.123, y: -2.75, z: 3 };
  const config = createConfig("tusi-3d", { orientationBends: bends });
  bends.x = 99;
  assert.equal(config.orientationBends.x, 0.123);
  for (const value of [NaN, Infinity, -Infinity, "0.5", null]) {
    assert.throws(() => createConfig("tusi-3d", { orientationBends: { y: value } }),
      /orientationBends.y must be a finite number/);
  }
  assert.throws(() => createConfig("tusi-3d", { orientationBends: { w: 1 } }), /orientationBends.w is not supported/);
  assert.throws(() => createConfig("tusi-3d", { orientationBends: null }), /orientationBends must be an object/);
  const incomplete = structuredClone(config);
  delete incomplete.orientationBends.z;
  assert.equal(validateConfig(incomplete).valid, false);
});

test("configuration JSON round trips in canonical form", () => {
  const source = createConfig("not-tusi-3d", {
    center: [1, 2, 3],
    radius: 4,
    pointCount: 17,
    angularSpeed: -0.75,
    phase: { twist: 1, pitch: 2, height: 3 },
    orbitRatio: 0.25,
    circulation: "alternating",
    circlePlane: "azimuthal",
    animation: { time: 2, speed: 0.5, playing: false },
    visualization: {
      showPaths: false,
      palette: "direction",
      pointSize: 7,
    },
  });
  const serialized = serializeConfig(source);
  assert.deepEqual(deserializeConfig(serialized), source);
  assert.throws(() => deserializeConfig("{"), ConfigValidationError);
  assert.throws(
    () => deserializeConfig(JSON.stringify({ ...source, schemaVersion: 99 })),
    /schemaVersion/,
  );
  assert.throws(() => serializeConfig(source, 11), RangeError);
});

test("half-offset Fibonacci sphere is deterministic and unit length", () => {
  const first = fibonacciSphere(101);
  const second = fibonacciSphere(101);
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first[0]), true);
  assert.equal(Object.isFrozen(first[0].direction), true);

  for (const sample of first) {
    near(Math.hypot(...sample.direction), 1);
    near(sample.z, 1 - (2 * (sample.index + 0.5)) / 101);
    near(sample.longitude, GOLDEN_ANGLE * sample.index);
    near(sample.colatitude, Math.acos(sample.z));
  }
  assert.ok(first[0].z < 1);
  assert.ok(first.at(-1).z > -1);
});

test("meridian and azimuthal tangent bases are deterministic and orthonormal", () => {
  for (const sample of fibonacciSphere(37)) {
    for (const plane of CIRCLE_PLANES) {
      const basis = sphereTangentBasis(sample, plane);
      assert.equal(basis.plane, plane);
      near(Math.hypot(...basis.radial), 1);
      near(Math.hypot(...basis.tangent), 1);
      near(Math.hypot(...basis.normal), 1);
      near(dot(basis.radial, basis.tangent), 0);
      near(dot(basis.radial, basis.normal), 0);
      near(dot(basis.tangent, basis.normal), 0);
      const rightHanded = cross(basis.radial, basis.tangent);
      for (let axis = 0; axis < 3; axis += 1) {
        near(rightHanded[axis], basis.normal[axis]);
      }
      assert.deepEqual(basis, sphereTangentBasis(sample, plane));
    }
  }
  assert.throws(() => sphereTangentBasis([0, 0, 0]), /non-zero/);
  assert.throws(() => sphereTangentBasis([1, 0, 0], "tilted"), /plane/);
});
