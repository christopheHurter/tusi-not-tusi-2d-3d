const TAU = Math.PI * 2;

function vectorComponent(value, index, name) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return Number(value[index] ?? 0);
  return Number(value?.[name] ?? 0);
}

function pointCoordinates(point) {
  const value = point.position ?? point;
  return {
    x: vectorComponent(value, 0, "x"),
    y: vectorComponent(value, 1, "y"),
    z: vectorComponent(value, 2, "z"),
  };
}

function modelKind(model) {
  return model?.kind ?? model?.config?.kind ?? model?.config?.model ?? model?.config?.modelKind ?? "";
}

function winding(model) {
  return Number(model?.config?.winding ?? model?.config?.phase?.winding ?? 0);
}

function centerOf(model) {
  const center = model?.config?.center ?? { x: 0, y: 0 };
  return {
    x: vectorComponent(center, 0, "x"),
    y: vectorComponent(center, 1, "y"),
  };
}

function radiusOf(model) {
  return Math.max(1e-9, Number(model?.config?.radius ?? 1));
}

function cssColor(point, index, count, palette) {
  if (palette === "radial" || palette === "radius") {
    const signed = Number(point.signedRadius ?? point.radius ?? 0);
    return signed < 0 ? "hsl(8 76% 54%)" : "hsl(215 76% 50%)";
  }
  if (palette === "direction") {
    return (point.circulation ?? point.direction ?? (index % 2 === 0 ? 1 : -1)) < 0
      ? "hsl(335 72% 52%)"
      : "hsl(202 78% 46%)";
  }
  if (palette === "mono") return "hsl(218 62% 43%)";
  return `hsl(${Math.round((index / Math.max(1, count)) * 330)} 72% 48%)`;
}

/**
 * Lightweight Canvas 2-D renderer for any model exposing `paths` and `sample(time)`.
 * Mathematical coordinates remain y-up; only this renderer flips y for the screen.
 */
export class Canvas2DRenderer {
  constructor(canvas, options = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new TypeError("Canvas2DRenderer requires an HTMLCanvasElement.");
    }
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.model = null;
    this.options = {
      background: "#fbfbf8",
      palette: "phase",
      pointRadius: 5,
      showBoundary: true,
      showEmergentGuide: true,
      showPaths: true,
      ...options,
    };
    this.viewport = { width: 1, height: 1, dpr: 1, scale: 1, cx: 0, cy: 0 };
    this.canvas.setAttribute("role", "img");
    this.canvas.setAttribute("aria-label", "Animated Tusi or Not-Tusi point configuration");
  }

  setModel(model) {
    if (!model || typeof model.sample !== "function") {
      throw new TypeError("A model with sample(time) is required.");
    }
    this.model = model;
    return this;
  }

  setOptions(options) {
    Object.assign(this.options, options);
    return this;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || this.canvas.width || 640));
    const height = Math.max(1, Math.round(rect.height || this.canvas.height || 640));
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    const radius = radiusOf(this.model);
    this.viewport = {
      width,
      height,
      dpr,
      scale: Math.min(width, height) / (2.35 * radius),
      cx: width / 2,
      cy: height / 2,
    };
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  toScreen(point) {
    const center = centerOf(this.model);
    return {
      x: this.viewport.cx + (point.x - center.x) * this.viewport.scale,
      y: this.viewport.cy - (point.y - center.y) * this.viewport.scale,
    };
  }

  drawPath(path) {
    const ctx = this.context;
    const kind = path.kind ?? path.type;
    ctx.strokeStyle = "rgba(42, 54, 69, 0.19)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (kind === "diameter" || kind === "line") {
      const direction = pointCoordinates(path.direction ?? { x: 1, y: 0 });
      const center = pointCoordinates(path.center ?? path.origin ?? this.model.config?.center ?? { x: 0, y: 0 });
      const radius = Number(path.radius ?? radiusOf(this.model));
      const start = this.toScreen(path.start
        ? pointCoordinates(path.start)
        : { x: center.x - radius * direction.x, y: center.y - radius * direction.y });
      const end = this.toScreen(path.end
        ? pointCoordinates(path.end)
        : { x: center.x + radius * direction.x, y: center.y + radius * direction.y });
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
    } else if (kind === "circle") {
      const center = this.toScreen(pointCoordinates(path.center));
      ctx.arc(center.x, center.y, Number(path.radius) * this.viewport.scale, 0, TAU);
    } else {
      return;
    }
    ctx.stroke();
  }

  drawGuides(time) {
    const ctx = this.context;
    const center = centerOf(this.model);
    const radius = radiusOf(this.model);
    if (this.options.showBoundary) {
      const screenCenter = this.toScreen(center);
      ctx.beginPath();
      ctx.arc(screenCenter.x, screenCenter.y, radius * this.viewport.scale, 0, TAU);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(29, 38, 48, 0.72)";
      ctx.stroke();
    }

    if (!this.options.showEmergentGuide) return;
    const kind = modelKind(this.model).toLowerCase();
    const w = winding(this.model);
    const speed = Number(this.model.config?.angularSpeed ?? 1);
    const phase = speed * time;
    let guideRadius = null;
    let guideCenter = null;

    if ((kind.includes("tusi") && !kind.includes("not")) && Math.abs(w - 1) < 1e-12) {
      guideRadius = radius / 2;
      guideCenter = {
        x: center.x + (radius / 2) * Math.cos(phase),
        y: center.y + (radius / 2) * Math.sin(phase),
      };
    } else if (kind.includes("not") && Math.abs(w) < 1e-12) {
      const ratio = Number(this.model.config?.orbitRatio ?? 0.5);
      guideRadius = radius * (1 - ratio);
      guideCenter = {
        x: center.x + radius * ratio * Math.cos(phase),
        y: center.y + radius * ratio * Math.sin(phase),
      };
    }

    if (guideCenter && guideRadius !== null) {
      const screenCenter = this.toScreen(guideCenter);
      ctx.beginPath();
      ctx.arc(screenCenter.x, screenCenter.y, guideRadius * this.viewport.scale, 0, TAU);
      ctx.setLineDash([7, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(207, 145, 12, 0.9)";
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  render(time) {
    if (!this.model) return [];
    this.resize();
    const { width, height } = this.viewport;
    const ctx = this.context;
    ctx.fillStyle = this.options.background;
    ctx.fillRect(0, 0, width, height);

    this.drawGuides(time);
    if (this.options.showPaths) {
      for (const path of this.model.paths ?? this.model.fixedPaths ?? []) this.drawPath(path);
    }

    const points = this.model.sample(time);
    for (let index = 0; index < points.length; index += 1) {
      const screen = this.toScreen(pointCoordinates(points[index]));
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, this.options.pointRadius, 0, TAU);
      ctx.fillStyle = cssColor(points[index], index, points.length, this.options.palette);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
      ctx.stroke();
    }
    return points;
  }

  dispose() {
    this.model = null;
  }
}
