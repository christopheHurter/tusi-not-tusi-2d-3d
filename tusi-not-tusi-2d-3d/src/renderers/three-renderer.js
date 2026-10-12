/**
 * Reusable Three.js renderer for the DOM-independent point-model interface.
 *
 * The renderer owns presentation only. Mathematical models remain responsible
 * for producing point records and describing their fixed paths.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "../../vendor/three/three.module.js";
import { OrbitControls } from "../../vendor/three/OrbitControls.js";

const TAU = 2 * Math.PI;
const DEFAULT_CIRCLE_SEGMENTS = 128;
const DEFAULT_PIXEL_RATIO_LIMIT = 2;
const COLOR_EPSILON = 1e-12;
let rendererInteractionSequence = 0;

function createCircularPointTexture(ownerDocument) {
  const canvas = ownerDocument.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, 64, 64);
  context.beginPath();
  context.arc(32, 32, 30, 0, TAU);
  context.fillStyle = "#ffffff";
  context.fill();
  return new CanvasTexture(canvas);
}

/** Named palettes suitable for a small UI selector. */
export const THREE_PALETTES = Object.freeze({
  phase: Object.freeze({
    background: "#07111f",
    positive: "#38bdf8",
    negative: "#fb7185",
    neutral: "#f8fafc",
    path: "#94a3b8",
  }),
  radius: Object.freeze({
    background: "#07111f",
    positive: "#38bdf8",
    negative: "#fb7185",
    neutral: "#f8fafc",
    path: "#94a3b8",
  }),
  direction: Object.freeze({
    background: "#07111f",
    positive: "#22d3ee",
    negative: "#f472b6",
    neutral: "#f8fafc",
    path: "#94a3b8",
  }),
  mono: Object.freeze({
    background: "#07111f",
    positive: "#e2e8f0",
    negative: "#e2e8f0",
    neutral: "#e2e8f0",
    path: "#64748b",
  }),
  paper: Object.freeze({
    background: "#07111f",
    positive: "#38bdf8",
    negative: "#fb7185",
    neutral: "#f8fafc",
    path: "#94a3b8",
  }),
  light: Object.freeze({
    background: "#f8fafc",
    positive: "#0369a1",
    negative: "#be123c",
    neutral: "#0f172a",
    path: "#64748b",
  }),
  monochrome: Object.freeze({
    background: "#050505",
    positive: "#ffffff",
    negative: "#a3a3a3",
    neutral: "#d4d4d4",
    path: "#737373",
  }),
});

export const DEFAULT_THREE_PALETTE = THREE_PALETTES.paper;

function timestampInSeconds(timestamp) {
  return timestamp * 0.001;
}

function isCanvas(value) {
  return value?.nodeType === 1 && value.tagName?.toLowerCase() === "canvas";
}

function resolveConstructorArguments(containerOrOptions, maybeOptions) {
  if (
    containerOrOptions &&
    typeof containerOrOptions === "object" &&
    "container" in containerOrOptions &&
    containerOrOptions.nodeType !== 1
  ) {
    return { ...containerOrOptions };
  }

  return { ...maybeOptions, container: containerOrOptions };
}

function resolvePalette(palette, previous = DEFAULT_THREE_PALETTE) {
  const selected =
    typeof palette === "string" ? THREE_PALETTES[palette] : palette;

  if (!selected || typeof selected !== "object") {
    if (typeof palette === "string") {
      throw new RangeError(
        `Unknown Three.js palette "${palette}". Expected one of: ${Object.keys(
          THREE_PALETTES,
        ).join(", ")}.`,
      );
    }
    throw new TypeError("A palette must be a named palette or a color object.");
  }

  return {
    background: selected.background ?? previous.background,
    positive: selected.positive ?? previous.positive,
    negative: selected.negative ?? previous.negative,
    neutral: selected.neutral ?? previous.neutral,
    path: selected.path ?? previous.path,
  };
}

function component(value, axis, fallback = Number.NaN) {
  if (value == null) return fallback;

  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    const result = value[axis];
    return result == null && axis === 2 ? 0 : Number(result);
  }

  if (typeof value === "object") {
    const name = axis === 0 ? "x" : axis === 1 ? "y" : "z";
    const result = value[name];
    return result == null && axis === 2 ? 0 : Number(result);
  }

  return fallback;
}

function pointComponent(point, axis) {
  const directName = axis === 0 ? "x" : axis === 1 ? "y" : "z";
  const direct = point?.[directName];
  if (direct != null) return Number(direct);

  return component(point?.position, axis, axis === 2 ? 0 : Number.NaN);
}

function pointsFromSample(sample) {
  const points = sample?.points ?? sample;
  if (!points || typeof points.length !== "number") {
    throw new TypeError(
      "model.sample(time) must return an array of point records (or { points }).",
    );
  }
  return points;
}

function validateModel(model) {
  if (!model || typeof model !== "object") {
    throw new TypeError("A compatible point-model object is required.");
  }
  if (model.dimension !== 2 && model.dimension !== 3) {
    throw new RangeError("model.dimension must be either 2 or 3.");
  }
  if (typeof model.sample !== "function") {
    throw new TypeError("model.sample(time) must be a function.");
  }
  if (model.paths != null && !Array.isArray(model.paths)) {
    throw new TypeError("model.paths must be an array when provided.");
  }
}

function validateFinitePoints(points) {
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const x = pointComponent(point, 0);
    const y = pointComponent(point, 1);
    const z = pointComponent(point, 2);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new RangeError(
        `model.sample(time) returned a non-finite position at point ${index}.`,
      );
    }
  }
}

function normalizedDirection(path, name, fallbackName) {
  let value = path[name] ?? path[fallbackName];
  if (value == null && path.start != null && path.end != null) {
    value = [
      component(path.end, 0) - component(path.start, 0),
      component(path.end, 1) - component(path.start, 1),
      component(path.end, 2, 0) - component(path.start, 2, 0),
    ];
  }
  let x = component(value, 0);
  let y = component(value, 1);
  let z = component(value, 2, 0);
  const length = Math.hypot(x, y, z);
  if (!Number.isFinite(length) || length <= Number.EPSILON) {
    throw new RangeError(`Path ${name} must be a finite non-zero vector.`);
  }
  x /= length;
  y /= length;
  z /= length;
  return [x, y, z];
}

function pathCenter(path) {
  let value = path.center;
  if (value == null && path.start != null && path.end != null) {
    value = [
      (component(path.start, 0) + component(path.end, 0)) * 0.5,
      (component(path.start, 1) + component(path.end, 1)) * 0.5,
      (component(path.start, 2, 0) + component(path.end, 2, 0)) * 0.5,
    ];
  }
  value ??= [0, 0, 0];
  const x = component(value, 0, 0);
  const y = component(value, 1, 0);
  const z = component(value, 2, 0);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    throw new RangeError("A path center must contain finite coordinates.");
  }
  return [x, y, z];
}

function pathRadius(path) {
  let radius = Number(path.radius);
  if (!Number.isFinite(radius) && path.start != null && path.end != null) {
    radius =
      Math.hypot(
        component(path.end, 0) - component(path.start, 0),
        component(path.end, 1) - component(path.start, 1),
        component(path.end, 2, 0) - component(path.start, 2, 0),
      ) * 0.5;
  }
  if (!Number.isFinite(radius) || radius < 0) {
    throw new RangeError("A path radius must be a finite non-negative number.");
  }
  return radius;
}

/**
 * Three.js view for any model implementing the shared point-model contract.
 *
 * @example
 * const view = createThreeRenderer(host, { model });
 * view.start();
 */
export class ThreeModelRenderer {
  constructor(containerOrOptions, maybeOptions = {}) {
    const options = resolveConstructorArguments(
      containerOrOptions,
      maybeOptions,
    );
    const suppliedContainer = options.container;

    if (!suppliedContainer || suppliedContainer.nodeType !== 1) {
      throw new TypeError(
        "ThreeModelRenderer requires a canvas or an HTML container element.",
      );
    }

    this.container = suppliedContainer;
    this._canvasWasSupplied = Boolean(options.canvas || isCanvas(suppliedContainer));
    const canvas = isCanvas(suppliedContainer)
      ? suppliedContainer
      : options.canvas;

    this.renderer = new WebGLRenderer({
      antialias: options.antialias ?? true,
      alpha: options.alpha ?? false,
      canvas,
      powerPreference: options.powerPreference ?? "high-performance",
    });
    this.webglRenderer = this.renderer;
    this.canvas = this.renderer.domElement;
    this._originalCanvasAccessibility = new Map([
      ["aria-label", this.canvas.getAttribute("aria-label")],
      ["aria-describedby", this.canvas.getAttribute("aria-describedby")],
      ["aria-keyshortcuts", this.canvas.getAttribute("aria-keyshortcuts")],
      ["role", this.canvas.getAttribute("role")],
      ["tabindex", this.canvas.getAttribute("tabindex")],
    ]);
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.setAttribute(
      "aria-label",
      options.ariaLabel ?? "Interactive three-dimensional point animation",
    );
    this.canvas.setAttribute("role", "application");
    this.canvas.setAttribute("tabindex", "0");
    this.canvas.setAttribute(
      "aria-keyshortcuts",
      "ArrowLeft ArrowRight ArrowUp ArrowDown Equal Minus Home 0",
    );

    if (!isCanvas(suppliedContainer) && this.canvas.parentNode !== suppliedContainer) {
      suppliedContainer.appendChild(this.canvas);
    }

    const helpId = `three-renderer-keyboard-help-${++rendererInteractionSequence}`;
    const keyboardHelp = this.canvas.ownerDocument.createElement("span");
    keyboardHelp.id = helpId;
    keyboardHelp.className = "sr-only";
    keyboardHelp.textContent = "Use the arrow keys to orbit the view. Press plus or equal to zoom in, minus to zoom out, and Home or 0 to reset the view.";
    const helpHost = isCanvas(suppliedContainer)
      ? suppliedContainer.parentElement
      : suppliedContainer;
    if (helpHost) helpHost.appendChild(keyboardHelp);
    this._keyboardHelp = helpHost ? keyboardHelp : null;
    const describedBy = [
      this._originalCanvasAccessibility.get("aria-describedby"),
      helpHost ? helpId : null,
    ].filter(Boolean).join(" ");
    if (describedBy) this.canvas.setAttribute("aria-describedby", describedBy);

    this.scene = options.scene ?? new Scene();
    this.camera =
      options.camera ?? new PerspectiveCamera(options.fov ?? 45, 1, 0.01, 1000);
    // The mathematical core is right-handed and z-up. Avoid changing
    // Object3D.DEFAULT_UP globally; this renderer may coexist with other views.
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(2.6, -3.4, 2.4);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = options.enableDamping ?? true;
    this.controls.dampingFactor = options.dampingFactor ?? 0.08;
    this.controls.screenSpacePanning = false;

    this.pathGroup = new Group();
    this.pathGroup.name = "fixed-paths";
    this.scene.add(this.pathGroup);

    const sizeAttenuation = options.sizeAttenuation ?? false;
    this.pointTexture = createCircularPointTexture(this.canvas.ownerDocument);
    this.pointMaterial = new PointsMaterial({
      size: options.pointSize ?? (sizeAttenuation ? 0.045 : 5),
      sizeAttenuation,
      vertexColors: true,
      map: this.pointTexture,
      alphaTest: 0.05,
      transparent: true,
      opacity: options.pointOpacity ?? 1,
      depthWrite: options.depthWrite ?? true,
    });
    this.pathMaterial = new LineBasicMaterial({
      transparent: true,
      opacity: options.pathOpacity ?? 0.55,
    });

    this.pointGeometry = new BufferGeometry();
    this.points = new Points(this.pointGeometry, this.pointMaterial);
    this.points.name = "moving-points";
    this.scene.add(this.points);

    this.model = null;
    this.time = 0;
    this._pointCapacity = -1;
    this._positionArray = null;
    this._colorArray = null;
    this._positionAttribute = null;
    this._colorAttribute = null;
    this._lastPoints = null;
    this._disposed = false;
    this._isRendering = false;
    this.canvas.dataset.controlRenderCount = "0";
    this._boundControlsChange = () => {
      if (this._disposed || this._isRendering) return;
      this.renderer.render(this.scene, this.camera);
      const count = Number(this.canvas.dataset.controlRenderCount) || 0;
      this.canvas.dataset.controlRenderCount = String(count + 1);
    };
    this._boundControlPointerMove = (event) => {
      if (this._disposed || (event.pointerType !== "touch" && event.buttons === 0)) return;
      const renderCount = Number(this.canvas.dataset.controlRenderCount) || 0;
      queueMicrotask(() => {
        if (this._disposed) return;
        // OrbitControls normally emits `change` during its pointermove handler.
        // If a browser coalesces or suppresses that event, draw the updated
        // camera once so a paused lesson never appears stuck while dragging.
        if ((Number(this.canvas.dataset.controlRenderCount) || 0) === renderCount) {
          this._boundControlsChange();
        }
      });
    };
    this._boundCanvasKeydown = (event) => this._handleCanvasKeydown(event);
    this.controls.addEventListener("change", this._boundControlsChange);
    this.canvas.addEventListener("pointermove", this._boundControlPointerMove, { passive: true });
    this.canvas.addEventListener("keydown", this._boundCanvasKeydown);
    this._circleSegments = Math.max(
      8,
      Math.round(options.circleSegments ?? DEFAULT_CIRCLE_SEGMENTS),
    );
    this._explicitPointSize = options.pointSize != null;
    this._sizeAttenuation = sizeAttenuation;
    this._autoFit = options.autoFit ?? true;
    this._pixelRatioLimit = Math.max(
      1,
      Number(options.pixelRatioLimit ?? DEFAULT_PIXEL_RATIO_LIMIT),
    );

    this._positiveColor = new Color();
    this._negativeColor = new Color();
    this._neutralColor = new Color();
    this._backgroundColor = new Color();
    this._scratchColor = new Color();
    this._palette = DEFAULT_THREE_PALETTE;
    this._paletteName = "phase";
    this.setPalette(options.palette ?? "phase");
    this.setPathsVisible(options.showPaths ?? true);

    this._timeSource = timestampInSeconds;
    this._animationFrame = (timestamp, frame) => {
      const nextTime = this._timeSource(timestamp, frame);
      this.render(nextTime);
    };

    const ownerWindow = this.canvas.ownerDocument?.defaultView;
    this._ownerWindow = ownerWindow;
    this._boundResize = () => this.resize();
    const ResizeObserverClass = ownerWindow?.ResizeObserver;
    if (ResizeObserverClass) {
      this._resizeObserver = new ResizeObserverClass(this._boundResize);
      this._resizeObserver.observe(
        isCanvas(suppliedContainer)
          ? suppliedContainer.parentElement ?? suppliedContainer
          : suppliedContainer,
      );
    } else {
      this._resizeObserver = null;
      ownerWindow?.addEventListener("resize", this._boundResize);
    }

    this.resize();
    if (options.model) this.setModel(options.model, options.time ?? 0);
  }

  /** Replace the mathematical model without replacing scene objects. */
  setModel(model, time = 0) {
    this._assertUsable();
    validateModel(model);
    this.model = model;
    this._rebuildPaths(model.paths ?? []);
    const points = this.update(time);
    if (this._autoFit) this.fitView(points);
    return this;
  }

  /** Sample the model and update the existing GPU buffers in place. */
  update(time = this.time) {
    this._assertUsable();
    if (!this.model) return null;
    if (!Number.isFinite(time)) {
      throw new RangeError("Animation time must be finite.");
    }

    const points = pointsFromSample(this.model.sample(time));
    validateFinitePoints(points);
    this._ensurePointCapacity(points.length);

    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      const offset = index * 3;
      this._positionArray[offset] = pointComponent(point, 0);
      this._positionArray[offset + 1] = pointComponent(point, 1);
      this._positionArray[offset + 2] = pointComponent(point, 2);
      this._writePointColor(point, offset);
    }

    this.pointGeometry.setDrawRange(0, points.length);
    this._positionAttribute.needsUpdate = true;
    this._colorAttribute.needsUpdate = true;
    this.time = time;
    this._lastPoints = points;
    return points;
  }

  /** Update (when a time is supplied) and draw one frame. */
  render(time) {
    this._assertUsable();
    this._isRendering = true;
    try {
      if (time != null) this.update(time);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    } finally {
      this._isRendering = false;
    }
    return this;
  }

  _handleCanvasKeydown(event) {
    if (!this.controls.enabled || event.altKey || event.ctrlKey || event.metaKey) return;
    const orbitStep = event.shiftKey ? Math.PI / 12 : Math.PI / 36;
    let action = "";
    let reset = false;

    if (this.controls.enableRotate) {
      if (event.key === "ArrowLeft") {
        this.controls._rotateLeft(orbitStep);
        action = "orbit-left";
      } else if (event.key === "ArrowRight") {
        this.controls._rotateLeft(-orbitStep);
        action = "orbit-right";
      } else if (event.key === "ArrowUp") {
        this.controls._rotateUp(orbitStep);
        action = "orbit-up";
      } else if (event.key === "ArrowDown") {
        this.controls._rotateUp(-orbitStep);
        action = "orbit-down";
      }
    }

    if (!action && this.controls.enableZoom) {
      if (event.key === "+" || event.key === "=") {
        this.controls._dollyIn(0.9);
        action = "zoom-in";
      } else if (event.key === "-" || event.key === "_") {
        this.controls._dollyOut(0.9);
        action = "zoom-out";
      }
    }

    if (!action && (event.key === "Home" || event.key === "0")) {
      action = "reset";
      reset = true;
    }
    if (!action) return;

    event.preventDefault();
    this.canvas.dataset.keyboardAction = action;
    const renderCount = Number(this.canvas.dataset.controlRenderCount) || 0;
    if (reset) this.controls.reset();
    else this.controls.update();
    // OrbitControls normally emits `change` here. Keep keyboard interaction
    // deterministic in paused views and in browsers that suppress that event
    // when the camera delta is very small.
    if ((Number(this.canvas.dataset.controlRenderCount) || 0) === renderCount) {
      this._boundControlsChange();
    }
  }

  /**
   * Run the desktop/WebXR-compatible Three.js animation loop.
   * `timeSource(timestamp, xrFrame)` returns model time in seconds.
   */
  start(timeSource = timestampInSeconds) {
    this._assertUsable();
    if (typeof timeSource !== "function") {
      throw new TypeError("timeSource must be a function.");
    }
    this._timeSource = timeSource;
    this.renderer.setAnimationLoop(this._animationFrame);
    return this;
  }

  stop() {
    if (!this._disposed) this.renderer.setAnimationLoop(null);
    return this;
  }

  setPathsVisible(visible) {
    this.pathGroup.visible = Boolean(visible);
    return this;
  }

  showPaths(visible = true) {
    return this.setPathsVisible(visible);
  }

  setControlsEnabled(enabled) {
    this.controls.enabled = Boolean(enabled);
    return this;
  }

  setPointSize(size) {
    const numericSize = Number(size);
    if (!Number.isFinite(numericSize) || numericSize <= 0) {
      throw new RangeError("Point size must be a finite positive number.");
    }
    this._explicitPointSize = true;
    this.pointMaterial.size = numericSize;
    return this;
  }

  /** Apply a named palette or a partial palette object. */
  setPalette(palette) {
    this._paletteName = typeof palette === "string" ? palette : null;
    this._palette = resolvePalette(palette, this._palette);
    this._positiveColor.set(this._palette.positive);
    this._negativeColor.set(this._palette.negative);
    this._neutralColor.set(this._palette.neutral);
    this._backgroundColor.set(this._palette.background);
    this.pathMaterial.color.set(this._palette.path);
    this.scene.background = this._backgroundColor;

    if (this._lastPoints && this._colorArray) {
      for (let index = 0; index < this._lastPoints.length; index += 1) {
        this._writePointColor(this._lastPoints[index], index * 3);
      }
      this._colorAttribute.needsUpdate = true;
    }
    return this;
  }

  /** Resize to the host's CSS dimensions, or to explicit CSS pixels. */
  resize(width, height) {
    this._assertUsable();
    const sizeElement = isCanvas(this.container)
      ? this.container.parentElement ?? this.container
      : this.container;
    const nextWidth = Math.max(
      1,
      Math.round(width ?? sizeElement.clientWidth ?? this.canvas.clientWidth ?? 1),
    );
    const nextHeight = Math.max(
      1,
      Math.round(
        height ?? sizeElement.clientHeight ?? this.canvas.clientHeight ?? 1,
      ),
    );
    const devicePixelRatio = this._ownerWindow?.devicePixelRatio ?? 1;
    this.renderer.setPixelRatio(
      Math.min(this._pixelRatioLimit, Math.max(1, devicePixelRatio)),
    );
    this.renderer.setSize(nextWidth, nextHeight, false);
    this.camera.aspect = nextWidth / nextHeight;
    this.camera.updateProjectionMatrix();
    return this;
  }

  /** Frame the current fixed geometry and sampled points. */
  fitView(points = this._lastPoints) {
    this._assertUsable();
    if (!this.model) return this;

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    if (points) {
      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        const x = pointComponent(point, 0);
        const y = pointComponent(point, 1);
        const z = pointComponent(point, 2);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        maxZ = Math.max(maxZ, z);
      }
    }

    const configuredCenter = this.model.config?.center;
    let centerX = component(configuredCenter, 0);
    let centerY = component(configuredCenter, 1);
    let centerZ = component(configuredCenter, 2, 0);
    if (
      !Number.isFinite(centerX) ||
      !Number.isFinite(centerY) ||
      !Number.isFinite(centerZ)
    ) {
      centerX = Number.isFinite(minX) ? (minX + maxX) * 0.5 : 0;
      centerY = Number.isFinite(minY) ? (minY + maxY) * 0.5 : 0;
      centerZ = Number.isFinite(minZ) ? (minZ + maxZ) * 0.5 : 0;
    }

    let radius = Number(this.model.config?.radius);
    if (!Number.isFinite(radius) || radius <= 0) radius = 0;
    if (points) {
      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        radius = Math.max(
          radius,
          Math.hypot(
            pointComponent(point, 0) - centerX,
            pointComponent(point, 1) - centerY,
            pointComponent(point, 2) - centerZ,
          ),
        );
      }
    }
    for (const path of this.model.paths ?? []) {
      const center = pathCenter(path);
      radius = Math.max(
        radius,
        Math.hypot(
          center[0] - centerX,
          center[1] - centerY,
          center[2] - centerZ,
        ) + pathRadius(path),
      );
    }
    radius = Math.max(radius, 1e-3);

    const halfFov = (this.camera.fov * Math.PI) / 360;
    const distance = (radius / Math.sin(halfFov)) * 1.35;
    const directionLength = Math.hypot(1.15, -1.35, 0.9);
    this.camera.position.set(
      centerX + (distance * 1.15) / directionLength,
      centerY - (distance * 1.35) / directionLength,
      centerZ + (distance * 0.9) / directionLength,
    );
    this.camera.near = Math.max(radius / 1000, 1e-4);
    this.camera.far = Math.max(radius * 100, distance * 4);
    this.camera.updateProjectionMatrix();
    this.controls.target.set(centerX, centerY, centerZ);
    this.controls.minDistance = radius * 0.1;
    this.controls.maxDistance = radius * 50;
    this.controls.update();
    this.controls.saveState();
    if (this._sizeAttenuation && !this._explicitPointSize) {
      this.pointMaterial.size = radius * 0.045;
    }
    return this;
  }

  /** Stable scene-object count, useful in leak/smoke tests. */
  get sceneObjectCount() {
    let count = 0;
    this.scene.traverse(() => {
      count += 1;
    });
    return count;
  }

  dispose() {
    if (this._disposed) return;
    this.stop();
    this._resizeObserver?.disconnect();
    if (!this._resizeObserver) {
      this._ownerWindow?.removeEventListener("resize", this._boundResize);
    }
    this.controls.removeEventListener("change", this._boundControlsChange);
    this.canvas.removeEventListener("pointermove", this._boundControlPointerMove);
    this.canvas.removeEventListener("keydown", this._boundCanvasKeydown);
    this.controls.dispose();
    this._disposePaths();
    this.scene.remove(this.pathGroup);
    this.scene.remove(this.points);
    this.pointGeometry.dispose();
    this.pointMaterial.dispose();
    this.pointTexture.dispose();
    this.pathMaterial.dispose();
    this.renderer.dispose();
    this._keyboardHelp?.remove();
    if (this._canvasWasSupplied) {
      for (const [name, value] of this._originalCanvasAccessibility) {
        if (value === null) this.canvas.removeAttribute(name);
        else this.canvas.setAttribute(name, value);
      }
      delete this.canvas.dataset.controlRenderCount;
      delete this.canvas.dataset.keyboardAction;
    }
    if (!this._canvasWasSupplied && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this._disposed = true;
  }

  _assertUsable() {
    if (this._disposed) {
      throw new Error("This ThreeModelRenderer has been disposed.");
    }
  }

  _ensurePointCapacity(count) {
    if (this._pointCapacity === count) return;

    const oldGeometry = this.pointGeometry;
    this._positionArray = new Float32Array(count * 3);
    this._colorArray = new Float32Array(count * 3);
    this._positionAttribute = new BufferAttribute(this._positionArray, 3);
    this._colorAttribute = new BufferAttribute(this._colorArray, 3);
    this._positionAttribute.setUsage(DynamicDrawUsage);
    this._colorAttribute.setUsage(DynamicDrawUsage);

    this.pointGeometry = new BufferGeometry();
    this.pointGeometry.setAttribute("position", this._positionAttribute);
    this.pointGeometry.setAttribute("color", this._colorAttribute);
    this.pointGeometry.setDrawRange(0, count);
    this.points.geometry = this.pointGeometry;
    oldGeometry.dispose();
    this._pointCapacity = count;
  }

  _writePointColor(point, offset) {
    if (point?.color != null) {
      this._scratchColor.set(point.color);
      this._scratchColor.toArray(this._colorArray, offset);
      return;
    }
    const phaseColor = Number.isFinite(point?.colorPhase)
      ? point.colorPhase
      : point?.phase;
    if (this._paletteName === "phase" && Number.isFinite(phaseColor)) {
      const hue = ((phaseColor % TAU) + TAU) % TAU;
      this._scratchColor.setHSL(hue / TAU, 0.72, 0.58);
      this._scratchColor.toArray(this._colorArray, offset);
      return;
    }

    if (this._paletteName === "mono" || this._paletteName === "monochrome") {
      this._positiveColor.toArray(this._colorArray, offset);
      return;
    }

    const direction = Number(point?.circulation ?? point?.direction);
    const signedRadius = Number(point?.signedRadius);
    const color =
      this._paletteName === "direction" && Number.isFinite(direction)
        ? direction < 0
          ? this._negativeColor
          : direction > 0
            ? this._positiveColor
            : this._neutralColor
        : !Number.isFinite(signedRadius) || signedRadius > COLOR_EPSILON
        ? this._positiveColor
        : signedRadius < -COLOR_EPSILON
          ? this._negativeColor
          : this._neutralColor;
    color.toArray(this._colorArray, offset);
  }

  _rebuildPaths(paths) {
    this._disposePaths();
    for (let index = 0; index < paths.length; index += 1) {
      const descriptor = paths[index];
      const object = this._createPathObject(descriptor);
      object.name = descriptor.id ?? `${descriptor.kind ?? descriptor.type}-${index}`;
      object.userData.path = descriptor;
      this.pathGroup.add(object);
    }
  }

  _createPathObject(path) {
    if (!path || typeof path !== "object") {
      throw new TypeError("Each model path must be a descriptor object.");
    }
    const type = path.kind ?? path.type;
    const center = pathCenter(path);
    const radius = pathRadius(path);

    if (type === "diameter") {
      if (path.start != null && path.end != null) {
        const positions = new Float32Array(6);
        positions[0] = component(path.start, 0);
        positions[1] = component(path.start, 1);
        positions[2] = component(path.start, 2, 0);
        positions[3] = component(path.end, 0);
        positions[4] = component(path.end, 1);
        positions[5] = component(path.end, 2, 0);
        for (const coordinate of positions) {
          if (!Number.isFinite(coordinate)) {
            throw new RangeError("Diameter path endpoints must be finite.");
          }
        }
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(positions, 3));
        return new Line(geometry, this.pathMaterial);
      }
      const direction = normalizedDirection(path, "direction", "basisU");
      const positions = new Float32Array(6);
      positions[0] = center[0] - radius * direction[0];
      positions[1] = center[1] - radius * direction[1];
      positions[2] = center[2] - radius * direction[2];
      positions[3] = center[0] + radius * direction[0];
      positions[4] = center[1] + radius * direction[1];
      positions[5] = center[2] + radius * direction[2];
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      return new Line(geometry, this.pathMaterial);
    }

    if (type === "circle") {
      // 2-D circle descriptors need no explicit basis; their path lies in xy.
      const basisU =
        path.basisU == null && path.direction == null
          ? [1, 0, 0]
          : normalizedDirection(path, "basisU", "direction");
      const basisV =
        path.basisV == null
          ? [0, 1, 0]
          : normalizedDirection(path, "basisV", "basisU");
      const positions = new Float32Array(this._circleSegments * 3);
      for (let index = 0; index < this._circleSegments; index += 1) {
        const angle = (TAU * index) / this._circleSegments;
        const u = radius * Math.cos(angle);
        const v = radius * Math.sin(angle);
        const offset = index * 3;
        positions[offset] = center[0] + u * basisU[0] + v * basisV[0];
        positions[offset + 1] = center[1] + u * basisU[1] + v * basisV[1];
        positions[offset + 2] = center[2] + u * basisU[2] + v * basisV[2];
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      return new LineLoop(geometry, this.pathMaterial);
    }

    if (type === "curve") {
      if (!Array.isArray(path.points) || path.points.length < 2) {
        throw new RangeError("A curve path must contain at least two points.");
      }
      const positions = new Float32Array(path.points.length * 3);
      path.points.forEach((point, index) => {
        const offset = index * 3;
        positions[offset] = component(point, 0);
        positions[offset + 1] = component(point, 1);
        positions[offset + 2] = component(point, 2, 0);
        if (![positions[offset], positions[offset + 1], positions[offset + 2]].every(Number.isFinite)) {
          throw new RangeError("Curve path points must contain finite coordinates.");
        }
      });
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      return path.closed === false
        ? new Line(geometry, this.pathMaterial)
        : new LineLoop(geometry, this.pathMaterial);
    }

    throw new RangeError(
      `Unsupported path kind "${type}". Expected "diameter", "circle", or "curve".`,
    );
  }

  _disposePaths() {
    for (const child of this.pathGroup.children) child.geometry?.dispose();
    this.pathGroup.clear();
  }
}

/** Convenience factory matching the Canvas renderer style. */
export function createThreeRenderer(container, options = {}) {
  return new ThreeModelRenderer(container, options);
}
