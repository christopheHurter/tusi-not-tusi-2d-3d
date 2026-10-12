import {
  CIRCLE_PLANES,
  CIRCULATION_MODES,
  PALETTES,
  SAMPLING_METHODS,
  TAU,
  createConfig,
  createModel,
  deserializeConfig,
  getDefaultConfig,
  getPreset,
  listPresets,
  serializeConfig,
} from "../src/core/index.js";
import { Canvas2DRenderer } from "../src/renderers/canvas-renderer.js";

const root = document.querySelector("#demo-root");
const kind = root?.dataset.demoKind;

const META = {
  "tusi-2d": {
    eyebrow: "T1 · T2 · T4",
    title: "Tusi · 2-D",
    description: "Each point oscillates on one fixed diameter. Change only the phase winding to replace the global figure.",
    equation: "pᵢ(t) = c + R cos(ωt − wθᵢ) u(θᵢ)",
    terms: [
      ["pᵢ(t)", "Position of sample i at time t."],
      ["c", "Common center of all fixed diameter paths."],
      ["R", "Radius, equal to half the diameter length."],
      ["ω, t", "Angular speed and elapsed time."],
      ["θᵢ", "Sample direction 2πi/N."],
      ["w", "Phase winding around the sampled directions."],
      ["u(θᵢ)", "Unit vector (cos θᵢ, sin θᵢ)."],
    ],
  },
  "not-tusi-2d": {
    eyebrow: "N1–N5",
    title: "Not-Tusi · 2-D",
    description: "Each point rides one fixed circle. Shared phase laws create translating rings, blades, polygons, and counter-rotation.",
    equation: "pᵢ(t) = c + r₁u(θᵢ) + r₂u(ωt − wθᵢ)",
    terms: [
      ["pᵢ(t)", "Position of sample i on its fixed local circle."],
      ["c", "Global center of the construction."],
      ["r₁", "Distance from c to the center of each local circle."],
      ["r₂", "Local orbit radius; the interface exposes r₂/R and r₁ = R − r₂."],
      ["θᵢ", "Direction of local circle i, sampled as 2πi/N."],
      ["w", "Relative phase winding across circle indices."],
      ["ω, t", "Angular speed and elapsed time; circulation may reverse traversal."],
    ],
  },
  "tusi-3d": {
    eyebrow: "G1–G4",
    title: "Tusi · Euler-wound diameters",
    description: "A closed curve on the sphere supplies antipodal endpoints for fixed diameters; integer turns and real periodic bends shape it independently of motion timing.",
    equation: "pᵢ(t) = c + R cos(ωt − Wsᵢ) Rz(γᵢ) Ry(βᵢ) Rx(αᵢ) u₀",
    terms: [
      ["pᵢ(t)", "Position of sample i on its fixed spatial diameter."],
      ["c", "Common center of the three-dimensional construction."],
      ["R", "Half-length of every fixed spatial diameter."],
      ["sᵢ", "Full-circle parameter 2πi/N."],
      ["u₀", "Normalized seed direction."],
      ["X, Y, Z", "Integer turns about fixed global axes; rotations apply X, then Y, then Z."],
      ["Bends", "Real amplitudes in radians: αᵢ = Xsᵢ + Bx sin sᵢ, βᵢ = Ysᵢ + By sin sᵢ, γᵢ = Zsᵢ + Bz sin sᵢ. The periodic bends preserve smooth closure."],
      ["W", "Independent integer winding of harmonic motion along the already-fixed diameters."],
      ["ω, t", "Angular speed and elapsed time."],
    ],
  },
  "not-tusi-3d": {
    eyebrow: "D7–D12",
    title: "Not-Tusi · sphere of circles",
    description: "Every point follows a fixed spatial circle while the same spherical phase fields sculpt moving shells and lobes.",
    equation: "pₖ(t) = c + r₁uₖ + r₂[cos(ωt − δₖ)uₖ + sin(ωt − δₖ)vₖ]",
    terms: [
      ["pₖ(t)", "Position of sample k on its fixed spatial circle."],
      ["c + r₁uₖ", "Center of local circle k."],
      ["r₂", "Radius of every local orbit circle."],
      ["uₖ", "Fibonacci-sphere radial direction."],
      ["vₖ", "Deterministic tangent selected by the meridian or azimuthal plane."],
      ["δₖ", "Spherical phase field evaluated for sample k."],
      ["ω, t", "Angular speed and elapsed time; circulation controls traversal direction."],
    ],
  },
};

if (!root || !META[kind]) {
  throw new Error(`Unsupported demonstration kind: ${kind ?? "missing"}`);
}

window.addEventListener("error", (event) => {
  document.documentElement.dataset.demoError = event.message || "runtime error";
});
window.addEventListener("unhandledrejection", (event) => {
  document.documentElement.dataset.demoError = event.reason?.message || String(event.reason);
});

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function optionList(values, labels = {}) {
  return values.map((value) => `<option value="${value}">${labels[value] ?? value}</option>`).join("");
}

function rangeControl({ id, label, path, min, max, step, value, integer = false }) {
  return `
    <label class="control-row" for="${id}">
      <span>${label}</span>
      <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"
        data-config-path="${path}" data-value-type="${integer ? "integer" : "number"}">
      <output for="${id}" data-output-for="${path}" aria-live="off">${value}</output>
    </label>`;
}

function selectControl({ id, label, path, options }) {
  return `
    <label class="control-row" for="${id}">
      <span>${label}</span>
      <select id="${id}" data-config-path="${path}">${options}</select>
      <output aria-hidden="true" aria-live="off"></output>
    </label>`;
}

function equationPanel(meta) {
  const terms = meta.terms
    .map(([symbol, meaning]) => `<div><dt>${symbol}</dt><dd>${meaning}</dd></div>`)
    .join("");
  return `<section class="control-group equation-panel" aria-labelledby="model-equation-title">
    <h2 id="model-equation-title">Equation and terms</h2>
    <div class="equation-formulas"><p class="equation-formula">${meta.equation}</p></div>
    <dl class="equation-terms">${terms}</dl>
  </section>`;
}

function cycleDuration(config) {
  const angularSpeed = Math.abs(config.angularSpeed);
  return angularSpeed > Number.EPSILON ? TAU / angularSpeed : TAU;
}

function normalizeTime(time, config) {
  const duration = cycleDuration(config);
  return ((time % duration) + duration) % duration;
}

function buildMarkup(config, presets) {
  const meta = META[kind];
  const is3D = kind.endsWith("3d");
  const isNotTusi = kind.startsWith("not-");
  const presetOptions = presets
    .map((preset) => `<option value="${preset.id}">${preset.paperCallout}: ${preset.label}</option>`)
    .join("");
  const sampling = !is3D
    ? selectControl({
        id: "sampling",
        label: "Directions",
        path: "sampling",
        options: optionList(
          SAMPLING_METHODS.filter((value) => value !== "fibonacci-sphere"),
          { "full-circle": "Full circle", "half-circle": "Half circle" },
        ),
      })
    : kind === "tusi-3d"
      ? `<p class="message">Integer turns and real periodic bends keep the endpoint curve closed; every endpoint is paired with its antipode.</p>`
      : `<p class="message">Directions use the deterministic half-offset Fibonacci sphere.</p>`;
  const phaseControls = kind === "not-tusi-3d"
    ? [
        rangeControl({ id: "twist", label: "Twist", path: "phase.twist", min: -6, max: 6, step: 0.1, value: config.phase.twist }),
        rangeControl({ id: "pitch", label: "Pitch", path: "phase.pitch", min: -6, max: 6, step: 0.1, value: config.phase.pitch }),
        rangeControl({ id: "height", label: "Height", path: "phase.height", min: -6, max: 6, step: 0.1, value: config.phase.height }),
      ].join("")
    : rangeControl({
        id: "winding",
        label: kind === "tusi-3d" ? "Motion winding W" : "Winding w",
        path: "phase.winding",
        min: kind === "tusi-3d" ? -100 : -8,
        max: kind === "tusi-3d" ? 100 : 8,
        step: kind === "tusi-3d" ? 1 : 0.05,
        value: config.phase.winding,
        integer: kind === "tusi-3d",
      });
  const tusi3DGeometryControls = kind === "tusi-3d"
    ? [
        rangeControl({ id: "orientation-x", label: "X turns", path: "orientationWindings.x", min: -100, max: 100, step: 1, value: config.orientationWindings.x, integer: true }),
        rangeControl({ id: "orientation-y", label: "Y turns", path: "orientationWindings.y", min: -100, max: 100, step: 1, value: config.orientationWindings.y, integer: true }),
        rangeControl({ id: "orientation-z", label: "Z turns", path: "orientationWindings.z", min: -100, max: 100, step: 1, value: config.orientationWindings.z, integer: true }),
        rangeControl({ id: "bend-x", label: "X bend (rad)", path: "orientationBends.x", min: -3, max: 3, step: 0.05, value: config.orientationBends.x }),
        rangeControl({ id: "bend-y", label: "Y bend (rad)", path: "orientationBends.y", min: -3, max: 3, step: 0.05, value: config.orientationBends.y }),
        rangeControl({ id: "bend-z", label: "Z bend (rad)", path: "orientationBends.z", min: -3, max: 3, step: 0.05, value: config.orientationBends.z }),
      ].join("")
    : "";
  const notTusiControls = isNotTusi
    ? `
      ${rangeControl({ id: "orbit-ratio", label: "Orbit r₂/R", path: "orbitRatio", min: 0, max: 1, step: 0.01, value: config.orbitRatio })}
      ${selectControl({
        id: "circulation",
        label: "Circulation",
        path: "circulation",
        options: optionList(CIRCULATION_MODES, {
          forward: "Forward",
          reverse: "Reverse",
          alternating: "Alternating ±",
        }),
      })}
      ${is3D ? selectControl({
        id: "circle-plane",
        label: "Circle plane",
        path: "circlePlane",
        options: optionList(CIRCLE_PLANES, { meridian: "Meridian", azimuthal: "Azimuthal" }),
      }) : ""}`
    : "";

  root.innerHTML = `
    <section class="demo-heading">
      <div>
        <p class="eyebrow">${meta.eyebrow}</p>
        <h1>${meta.title}</h1>
        <p>${meta.description}</p>
      </div>
    </section>
    <section class="demo-layout">
      <aside class="control-panel" aria-label="Demonstration controls">
        <fieldset class="control-group">
          <legend>Paper preset</legend>
          <label class="control-row" for="preset-select">
            <span>Preset</span>
            <select id="preset-select"><option value="">Custom</option>${presetOptions}</select>
            <output aria-hidden="true" aria-live="off"></output>
          </label>
          <p id="preset-description" class="message"></p>
        </fieldset>
        ${equationPanel(meta)}
        <fieldset class="control-group" data-panel="animation">
          <legend>Animation</legend>
          <div class="button-row">
            <button type="button" class="primary" data-action="play">Pause</button>
            <button type="button" data-action="reset">Reset time</button>
            <button type="button" data-action="share">Copy link</button>
          </div>
          ${rangeControl({ id: "time", label: "Time t", path: "$time", min: 0, max: cycleDuration(config), step: 0.005, value: normalizeTime(config.animation.time, config) })}
          ${rangeControl({ id: "playback-speed", label: "Playback", path: "animation.speed", min: 0, max: 3, step: 0.05, value: config.animation.speed })}
        </fieldset>
        <fieldset class="control-group">
          <legend>Geometry</legend>
          ${rangeControl({ id: "point-count", label: "Points N", path: "pointCount", min: 1, max: is3D ? 1000 : 500, step: 1, value: config.pointCount, integer: true })}
          ${rangeControl({ id: "radius", label: "Radius R", path: "radius", min: 0.1, max: 5, step: 0.05, value: config.radius })}
          ${rangeControl({ id: "angular-speed", label: "Angular speed ω", path: "angularSpeed", min: -4, max: 4, step: 0.05, value: config.angularSpeed })}
          ${sampling}
          ${tusi3DGeometryControls}
          ${notTusiControls}
        </fieldset>
        <fieldset class="control-group">
          <legend>Relative phase</legend>
          ${phaseControls}
        </fieldset>
        <fieldset class="control-group">
          <legend>Appearance</legend>
          ${selectControl({ id: "palette", label: "Palette", path: "visualization.palette", options: optionList(PALETTES, {
            phase: "Phase / index",
            radius: "Signed radius",
            direction: "Circulation",
            mono: "Single color",
          }) })}
          ${rangeControl({ id: "point-size", label: "Point size", path: "visualization.pointSize", min: 1, max: 12, step: 0.5, value: config.visualization.pointSize })}
          <label class="control-row checkbox-row" for="show-paths">
            <span>Show fixed paths</span>
            <input id="show-paths" type="checkbox" data-config-path="visualization.showPaths" ${config.visualization.showPaths ? "checked" : ""}>
          </label>
          <div class="xr-slot" id="xr-slot"></div>
        </fieldset>
        <fieldset class="control-group">
          <legend>Configuration</legend>
          <div class="button-row">
            <button type="button" data-action="config">Import / export JSON</button>
            <button type="button" data-action="download">Download JSON</button>
          </div>
          <p id="message" class="message" aria-live="polite">Ready.</p>
        </fieldset>
      </aside>
      <section class="stage-panel" aria-label="Animated demonstration">
        ${is3D ? '<div class="render-host" id="render-host"></div>' : '<canvas id="stage-canvas"></canvas>'}
        <p class="stage-status" id="stage-status" aria-live="off"></p>
      </section>
    </section>
    <dialog id="config-dialog" aria-labelledby="config-dialog-title">
      <div class="dialog-content">
        <h2 id="config-dialog-title">Configuration JSON</h2>
        <p>Copy this versioned configuration, or replace it with another valid configuration and import it.</p>
        <textarea id="config-json" spellcheck="false" aria-label="Configuration JSON"></textarea>
        <div class="button-row">
          <button type="button" class="primary" data-action="import">Import configuration</button>
          <button type="button" data-action="close-dialog">Close</button>
        </div>
      </div>
    </dialog>`;
}

function setNested(object, path, value) {
  const parts = path.split(".");
  let target = object;
  for (const part of parts.slice(0, -1)) target = target[part];
  target[parts.at(-1)] = value;
}

function getNested(object, path) {
  return path.split(".").reduce((value, part) => value?.[part], object);
}

const presets = listPresets({ kind });
const query = new URLSearchParams(window.location.search);
let selectedPreset = null;
let initialConfig = getDefaultConfig(kind);
let initialMessage = "Ready.";

try {
  if (query.has("config")) {
    initialConfig = deserializeConfig(query.get("config"));
    if (initialConfig.kind !== kind) throw new Error(`The shared configuration is for ${initialConfig.kind}.`);
  } else if (query.has("preset")) {
    const preset = getPreset(query.get("preset"));
    if (preset.kind !== kind) throw new Error(`Preset ${preset.id} belongs to ${preset.kind}.`);
    initialConfig = preset.config;
    selectedPreset = preset.id;
  } else if (presets.length > 0) {
    initialConfig = presets[0].config;
    selectedPreset = presets[0].id;
  }
} catch (error) {
  initialMessage = `${error.message} Loaded the default configuration instead.`;
}

buildMarkup(initialConfig, presets);

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const requestedTime = query.has("time")
  ? Number(query.get("time"))
  : initialConfig.animation.time;
if (!Number.isFinite(requestedTime)) {
  initialMessage = `${initialMessage === "Ready." ? "" : `${initialMessage} `}Invalid time URL value; loaded the configured time instead.`;
}
const state = {
  config: initialConfig,
  model: createModel(initialConfig),
  time: normalizeTime(
    Number.isFinite(requestedTime) ? requestedTime : initialConfig.animation.time,
    initialConfig,
  ),
  playing: query.get("paused") === "1"
    ? false
    : reducedMotion && query.get("autoplay") !== "1"
      ? false
      : initialConfig.animation.playing,
  lastTimestamp: null,
  selectedPreset,
};

if (query.has("time") && String(state.time) !== query.get("time")) {
  const normalizedUrl = new URL(window.location.href);
  normalizedUrl.searchParams.set("time", String(state.time));
  history.replaceState(null, "", normalizedUrl);
}

const message = root.querySelector("#message");
const stageStatus = root.querySelector("#stage-status");
const presetSelect = root.querySelector("#preset-select");
const presetDescription = root.querySelector("#preset-description");
const dialog = root.querySelector("#config-dialog");
const jsonArea = root.querySelector("#config-json");
const is3D = kind.endsWith("3d");
let renderer;
let xrController = null;
let pageDisposed = false;
let animationFrame = null;

function announce(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
}

function configForExport() {
  const raw = clone(state.config);
  raw.animation.time = state.time;
  raw.animation.playing = state.playing;
  return createConfig(kind, raw);
}

function applyRendererSettings() {
  if (is3D) {
    renderer.setPathsVisible(state.config.visualization.showPaths);
    renderer.setPalette(state.config.visualization.palette);
    renderer.setPointSize(state.config.visualization.pointSize);
  } else {
    renderer.setOptions({
      palette: state.config.visualization.palette,
      pointRadius: state.config.visualization.pointSize,
      showPaths: state.config.visualization.showPaths,
    });
  }
}

function syncControls() {
  root.querySelectorAll("[data-config-path]").forEach((input) => {
    const path = input.dataset.configPath;
    if (path === "$time") {
      input.max = String(cycleDuration(state.config));
      input.value = String(state.time);
      return;
    }
    const value = getNested(state.config, path);
    if (input.type === "checkbox") input.checked = Boolean(value);
    else input.value = String(value);
  });
  root.querySelectorAll("[data-output-for]").forEach((output) => {
    const path = output.dataset.outputFor;
    const value = path === "$time" ? state.time : getNested(state.config, path);
    output.value = Number.isFinite(Number(value)) ? Number(value).toFixed(path === "pointCount" ? 0 : 2) : String(value);
  });
  presetSelect.value = state.selectedPreset ?? "";
  const entry = state.selectedPreset ? getPreset(state.selectedPreset) : null;
  presetDescription.textContent = entry?.description ?? "Custom configuration; export it to preserve these values.";
  const playButton = root.querySelector('[data-action="play"]');
  playButton.textContent = state.playing ? "Pause" : "Play";
  updateTimeOutputs();
}

function replaceConfig(config, { resetAnimation = false, presetId = null } = {}) {
  state.config = config;
  state.model = createModel(config);
  state.selectedPreset = presetId;
  if (resetAnimation) {
    state.time = normalizeTime(config.animation.time, config);
    state.playing = reducedMotion ? false : config.animation.playing;
    state.lastTimestamp = null;
  } else {
    state.time = normalizeTime(state.time, config);
  }
  renderer.setModel(state.model, state.time);
  applyRendererSettings();
  if (!is3D) renderer.render(state.time);
  syncControls();
  if (state.playing) scheduleFrame();
}

function updateConfig(path, value) {
  try {
    const raw = clone(state.config);
    setNested(raw, path, value);
    replaceConfig(createConfig(kind, raw));
    announce("Configuration updated.");
  } catch (error) {
    announce(error.message, true);
    syncControls();
  }
}

function updateTimeOutputs() {
  const slider = root.querySelector('[data-config-path="$time"]');
  const output = root.querySelector('[data-output-for="$time"]');
  slider.max = String(cycleDuration(state.config));
  if (!slider.matches(":active")) slider.value = String(state.time);
  output.value = state.time.toFixed(2);
  stageStatus.textContent = `N = ${state.config.pointCount} · t = ${state.time.toFixed(2)} · ${state.playing ? "playing" : "paused"}`;
}

if (is3D) {
  const [{ createThreeRenderer }, { installWebXR }] = await Promise.all([
    import("../src/renderers/three-renderer.js"),
    import("../src/renderers/webxr.js"),
  ]);
  renderer = createThreeRenderer(root.querySelector("#render-host"), {
    model: state.model,
    time: state.time,
    ariaLabel: `${META[kind].title} interactive three-dimensional point animation`,
    showPaths: state.config.visualization.showPaths,
    pointSize: state.config.visualization.pointSize,
    palette: state.config.visualization.palette,
    autoFit: true,
  });
  renderer.start(() => state.time);
  // XR detection is optional and must never delay desktop rendering. Some
  // runtimes keep feature detection pending while an XR service starts.
  void installWebXR(renderer, {
    parent: root.querySelector("#xr-slot"),
    onSessionChange: (active) => announce(active ? "WebXR session started." : "WebXR session ended."),
  }).then((controller) => {
    if (pageDisposed) {
      void controller.dispose();
      return;
    }
    xrController = controller;
    if (!controller.supported) root.querySelector("#xr-slot").title = controller.reason;
  }).catch((error) => {
    root.querySelector("#xr-slot").title = `Optional WebXR unavailable: ${error.message}`;
  });
} else {
  renderer = new Canvas2DRenderer(root.querySelector("#stage-canvas"), {
    palette: state.config.visualization.palette,
    pointRadius: state.config.visualization.pointSize,
    showPaths: state.config.visualization.showPaths,
  }).setModel(state.model);
}

applyRendererSettings();
syncControls();
announce(initialMessage, initialMessage !== "Ready.");

root.addEventListener("input", (event) => {
  const input = event.target.closest("[data-config-path]");
  if (!input) return;
  const path = input.dataset.configPath;
  if (path === "$time") {
    state.time = normalizeTime(Number(input.value), state.config);
    state.playing = false;
    state.lastTimestamp = null;
    if (!is3D) renderer.render(state.time);
    syncControls();
    return;
  }
  let value = input.type === "checkbox" ? input.checked : input.value;
  if (input.dataset.valueType === "integer") value = Number.parseInt(value, 10);
  else if (input.type === "range" || input.type === "number") value = Number(value);
  updateConfig(path, value);
});

presetSelect.addEventListener("change", () => {
  if (!presetSelect.value) return;
  const preset = getPreset(presetSelect.value);
  replaceConfig(preset.config, { resetAnimation: true, presetId: preset.id });
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("preset", preset.id);
  history.replaceState(null, "", url);
  announce(`Loaded ${preset.paperCallout}: ${preset.label}.`);
});

root.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "play") {
    state.playing = !state.playing;
    state.lastTimestamp = null;
    syncControls();
    if (state.playing) scheduleFrame();
  } else if (action === "reset") {
    state.time = normalizeTime(state.config.animation.time, state.config);
    state.playing = false;
    state.lastTimestamp = null;
    syncControls();
    if (!is3D) renderer.render(state.time);
  } else if (action === "config") {
    jsonArea.value = serializeConfig(configForExport());
    dialog.showModal();
  } else if (action === "close-dialog") {
    dialog.close();
  } else if (action === "import") {
    try {
      const imported = deserializeConfig(jsonArea.value);
      if (imported.kind !== kind) throw new Error(`This page expects ${kind}, not ${imported.kind}.`);
      replaceConfig(imported, { resetAnimation: true });
      dialog.close();
      announce("Configuration imported.");
    } catch (error) {
      announce(error.message, true);
    }
  } else if (action === "download") {
    const text = serializeConfig(configForExport());
    const blobUrl = URL.createObjectURL(new Blob([`${text}\n`], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${kind}-configuration.json`;
    link.click();
    URL.revokeObjectURL(blobUrl);
  } else if (action === "share") {
    const url = new URL(window.location.href);
    url.search = "";
    if (state.selectedPreset) url.searchParams.set("preset", state.selectedPreset);
    else url.searchParams.set("config", serializeConfig(configForExport()));
    url.searchParams.set("time", state.time.toFixed(4));
    history.replaceState(null, "", url);
    try {
      await navigator.clipboard.writeText(url.href);
      announce("Shareable link copied.");
    } catch {
      announce("Shareable link is now in the address bar.");
    }
  }
});

function scheduleFrame() {
  if (!state.playing || animationFrame !== null || pageDisposed) return;
  animationFrame = requestAnimationFrame(frame);
}

function frame(timestamp) {
  animationFrame = null;
  if (!state.playing || pageDisposed) return;
  if (state.lastTimestamp === null) state.lastTimestamp = timestamp;
  const delta = Math.min(0.1, Math.max(0, (timestamp - state.lastTimestamp) / 1000));
  state.lastTimestamp = timestamp;
  state.time = normalizeTime(
    state.time + delta * state.config.animation.speed,
    state.config,
  );
  if (!is3D) renderer.render(state.time);
  updateTimeOutputs();
  scheduleFrame();
}

window.addEventListener("pagehide", () => {
  pageDisposed = true;
  if (animationFrame !== null) cancelAnimationFrame(animationFrame);
  xrController?.dispose();
  renderer.dispose();
}, { once: true });

document.documentElement.dataset.demoReady = "true";
if (!is3D) renderer.render(state.time);
scheduleFrame();
