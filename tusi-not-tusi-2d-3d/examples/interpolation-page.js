import {
  TAU,
  createModel,
  getPreset,
  interpolateParameters,
  interpolatePoints,
  listPresets,
} from "../src/core/index.js";
import { Canvas2DRenderer } from "../src/renderers/canvas-renderer.js";

const root = document.querySelector("#demo-root");
window.addEventListener("error", (event) => {
  document.documentElement.dataset.demoError = event.message || "runtime error";
});
window.addEventListener("unhandledrejection", (event) => {
  document.documentElement.dataset.demoError = event.reason?.message || String(event.reason);
});

root.innerHTML = `
  <section class="demo-heading">
    <div>
      <p class="eyebrow">Two transition methods</p>
      <h1>Interpolation</h1>
      <p>Parameter interpolation stays inside the generative model. Point interpolation blends two complete configurations directly.</p>
    </div>
    <p class="message"><strong>Policy:</strong> point interpolation requires equal dimensions, counts, and sampling order.</p>
  </section>
  <section class="demo-layout">
    <aside class="control-panel" aria-label="Interpolation controls">
      <fieldset class="control-group">
        <legend>Endpoints</legend>
        <label class="control-row" for="family">
          <span>Model family</span>
          <select id="family"><option value="tusi-2d">Tusi · 2-D</option><option value="not-tusi-2d">Not-Tusi · 2-D</option></select>
          <output aria-hidden="true"></output>
        </label>
        <label class="control-row" for="source-preset"><span>Source A</span><select id="source-preset"></select><output aria-hidden="true"></output></label>
        <label class="control-row" for="target-preset"><span>Target B</span><select id="target-preset"></select><output aria-hidden="true"></output></label>
      </fieldset>
      <section class="control-group equation-panel" aria-labelledby="interpolation-equation-title">
        <h2 id="interpolation-equation-title">Equation and terms</h2>
        <div class="equation-formulas">
          <p class="equation-formula">C(α) = interpolateParameters(Cᴬ, Cᴮ, α)</p>
          <p class="equation-formula">pᵢ(α,t) = (1 − α)pᵢᴬ(t) + αpᵢᴮ(t)</p>
        </div>
        <dl class="equation-terms">
          <div><dt>α</dt><dd>Blend amount clamped to [0,1]: 0 selects A and 1 selects B.</dd></div>
          <div><dt>Cᴬ, Cᴮ</dt><dd>Compatible endpoint configurations used for parameter interpolation.</dd></div>
          <div><dt>C(α)</dt><dd>Interpolated configuration evaluated by the generative model.</dd></div>
          <div><dt>pᵢᴬ(t), pᵢᴮ(t)</dt><dd>Corresponding endpoint samples evaluated at the same time t.</dd></div>
          <div><dt>i</dt><dd>Stable point index; dimensions, counts, and sampling order must match.</dd></div>
        </dl>
      </section>
      <fieldset class="control-group" data-panel="animation">
        <legend>Transition</legend>
        <div class="button-row">
          <button type="button" class="primary" id="play">Pause</button>
          <button type="button" id="reset">Reset</button>
          <button type="button" id="share">Copy link</button>
        </div>
        <label class="control-row" for="alpha">
          <span>Blend α</span><input id="alpha" type="range" min="0" max="1" step="0.002" value="0.5"><output for="alpha" aria-live="off">0.50</output>
        </label>
        <label class="control-row" for="time">
          <span>Time t</span><input id="time" type="range" min="0" max="${TAU}" step="0.005" value="0"><output for="time" aria-live="off">0.00</output>
        </label>
        <label class="control-row checkbox-row" for="animate-alpha"><span>Animate α</span><input id="animate-alpha" type="checkbox"></label>
      </fieldset>
      <fieldset class="control-group">
        <legend>Interpretation</legend>
        <p class="message"><strong>Left:</strong> parameters are interpolated, then the model is evaluated.</p>
        <p class="message"><strong>Right:</strong> endpoint point positions are evaluated, then interpolated index by index.</p>
        <p id="message" class="message" aria-live="polite">Ready.</p>
      </fieldset>
    </aside>
    <section class="interpolation-stage">
      <section class="stage-panel" aria-label="Parameter-space interpolation">
        <canvas id="parameter-canvas"></canvas><p class="stage-status">Parameter space</p>
      </section>
      <section class="stage-panel" aria-label="Point-space interpolation">
        <canvas id="point-canvas"></canvas><p class="stage-status">Point space</p>
      </section>
    </section>
  </section>`;

const elements = {
  family: root.querySelector("#family"),
  source: root.querySelector("#source-preset"),
  target: root.querySelector("#target-preset"),
  alpha: root.querySelector("#alpha"),
  alphaOutput: root.querySelector('output[for="alpha"]'),
  time: root.querySelector("#time"),
  timeOutput: root.querySelector('output[for="time"]'),
  animateAlpha: root.querySelector("#animate-alpha"),
  play: root.querySelector("#play"),
  reset: root.querySelector("#reset"),
  share: root.querySelector("#share"),
  message: root.querySelector("#message"),
};

const query = new URLSearchParams(location.search);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wrapTime = (value) => ((value % TAU) + TAU) % TAU;
const requestedTime = Number(query.get("time") ?? 0);
const state = {
  family: query.get("family") === "not-tusi-2d" ? "not-tusi-2d" : "tusi-2d",
  sourceId: null,
  targetId: null,
  sourceModel: null,
  targetModel: null,
  parameterModel: null,
  pointModel: null,
  alpha: Math.min(1, Math.max(0, Number(query.get("alpha") ?? 0.5))),
  time: Number.isFinite(requestedTime) ? wrapTime(requestedTime) : 0,
  playing: query.get("paused") !== "1" &&
    (query.get("autoplay") === "1" || !reducedMotion),
  lastTimestamp: null,
};

const parameterRenderer = new Canvas2DRenderer(root.querySelector("#parameter-canvas"));
const pointRenderer = new Canvas2DRenderer(root.querySelector("#point-canvas"), { showPaths: false, showEmergentGuide: false });

function announce(text, error = false) {
  elements.message.textContent = text;
  elements.message.classList.toggle("error", error);
}

function presetsForFamily() {
  return listPresets({ kind: state.family });
}

function presetsCompatibleForPointMorph(a, b) {
  return a.kind === b.kind && a.pointCount === b.pointCount && a.sampling === b.sampling;
}

function choosePair() {
  const presets = presetsForFamily();
  const requestedSource = query.get("source");
  const requestedTarget = query.get("target");
  const source = presets.find((entry) => entry.id === requestedSource) ?? presets[0];
  const target = presets.find((entry) => entry.id === requestedTarget)
    ?? presets.find((entry) => entry.id !== source.id && presetsCompatibleForPointMorph(source.config, entry.config))
    ?? presets[1]
    ?? source;
  state.sourceId = source.id;
  state.targetId = target.id;
}

function populatePresetSelects() {
  const options = presetsForFamily()
    .map((entry) => `<option value="${entry.id}">${entry.paperCallout}: ${entry.label}</option>`)
    .join("");
  elements.source.innerHTML = options;
  elements.target.innerHTML = options;
  elements.source.value = state.sourceId;
  elements.target.value = state.targetId;
}

function rebuild() {
  try {
    const source = getPreset(state.sourceId);
    const target = getPreset(state.targetId);
    state.sourceModel = createModel(source.config);
    state.targetModel = createModel(target.config);
    const parameterConfig = interpolateParameters(source.config, target.config, state.alpha);
    state.parameterModel = createModel(parameterConfig);
    const pointConfig = source.config;
    state.pointModel = {
      kind: `${state.family}-point-interpolation`,
      dimension: 2,
      config: pointConfig,
      paths: [],
      sample(time) {
        return interpolatePoints(state.sourceModel, state.targetModel, time, state.alpha);
      },
    };
    parameterRenderer.setModel(state.parameterModel).setOptions({
      palette: parameterConfig.visualization.palette,
      pointRadius: parameterConfig.visualization.pointSize,
      showPaths: parameterConfig.visualization.showPaths,
    });
    pointRenderer.setModel(state.pointModel).setOptions({
      palette: pointConfig.visualization.palette,
      pointRadius: pointConfig.visualization.pointSize,
      showPaths: false,
    });
    announce(`A: ${source.label} · B: ${target.label}`);
    return true;
  } catch (error) {
    announce(error.message, true);
    return false;
  }
}

function sync() {
  elements.family.value = state.family;
  elements.source.value = state.sourceId;
  elements.target.value = state.targetId;
  elements.alpha.value = String(state.alpha);
  elements.alphaOutput.value = state.alpha.toFixed(2);
  elements.time.value = String(state.time);
  elements.timeOutput.value = state.time.toFixed(2);
  elements.play.textContent = state.playing ? "Pause" : "Play";
}

function renderNow() {
  if (state.parameterModel && state.pointModel) {
    parameterRenderer.render(state.time);
    pointRenderer.render(state.time);
  }
  sync();
}

elements.family.addEventListener("change", () => {
  state.family = elements.family.value;
  query.delete("source");
  query.delete("target");
  choosePair();
  populatePresetSelects();
  rebuild();
  renderNow();
});

elements.source.addEventListener("change", () => {
  state.sourceId = elements.source.value;
  rebuild();
  renderNow();
});

elements.target.addEventListener("change", () => {
  state.targetId = elements.target.value;
  rebuild();
  renderNow();
});

elements.alpha.addEventListener("input", () => {
  state.alpha = Number(elements.alpha.value);
  rebuild();
  renderNow();
});

elements.time.addEventListener("input", () => {
  state.time = Number(elements.time.value);
  state.playing = false;
  state.lastTimestamp = null;
  renderNow();
});

elements.play.addEventListener("click", () => {
  state.playing = !state.playing;
  state.lastTimestamp = null;
  sync();
  if (state.playing) scheduleFrame();
});

elements.reset.addEventListener("click", () => {
  state.time = 0;
  state.alpha = 0.5;
  state.playing = false;
  state.lastTimestamp = null;
  rebuild();
  renderNow();
});

elements.share.addEventListener("click", async () => {
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("family", state.family);
  url.searchParams.set("source", state.sourceId);
  url.searchParams.set("target", state.targetId);
  url.searchParams.set("alpha", state.alpha.toFixed(4));
  url.searchParams.set("time", state.time.toFixed(4));
  history.replaceState(null, "", url);
  try {
    await navigator.clipboard.writeText(url.href);
    announce("Shareable comparison link copied.");
  } catch {
    announce("Shareable comparison link is now in the address bar.");
  }
});

choosePair();
populatePresetSelects();
rebuild();
renderNow();

let frameRequest = null;
function scheduleFrame() {
  if (!state.playing || frameRequest !== null) return;
  frameRequest = requestAnimationFrame(frame);
}

function frame(timestamp) {
  frameRequest = null;
  if (!state.playing) {
    state.lastTimestamp = null;
    return;
  }
  if (state.lastTimestamp === null) state.lastTimestamp = timestamp;
  const delta = Math.min(0.1, Math.max(0, (timestamp - state.lastTimestamp) / 1000));
  state.lastTimestamp = timestamp;
  state.time = wrapTime(state.time + delta);
  if (elements.animateAlpha.checked) {
    state.alpha = 0.5 + 0.5 * Math.sin(state.time * 0.6);
    rebuild();
  }
  renderNow();
  scheduleFrame();
}

document.documentElement.dataset.demoReady = "true";
scheduleFrame();
