/**
 * Optional WebXR progressive enhancement for ThreeModelRenderer.
 *
 * Desktop rendering never depends on this module. An entry button is mounted
 * only after a secure-context and immersive-VR support check succeeds.
 */
import { VRButton } from "../../vendor/three/VRButton.js";

function rawRenderer(target) {
  const renderer = target?.webglRenderer ?? target?.renderer ?? target;
  if (!renderer?.xr || typeof renderer.xr.setSession !== "function") {
    throw new TypeError(
      "WebXR requires a ThreeModelRenderer or a Three.js WebGLRenderer.",
    );
  }
  return renderer;
}

function defaultEnvironment() {
  return typeof window === "undefined" ? globalThis : window;
}

/**
 * Check WebXR without creating UI or requesting a session.
 *
 * @returns {Promise<{supported: boolean, reason: string|null}>}
 */
export async function queryWebXRSupport(environment = defaultEnvironment()) {
  if (environment?.isSecureContext !== true) {
    return { supported: false, reason: "insecure-context" };
  }

  const xr = environment.navigator?.xr;
  if (!xr || typeof xr.isSessionSupported !== "function") {
    return { supported: false, reason: "api-unavailable" };
  }

  try {
    const supported = await xr.isSessionSupported("immersive-vr");
    return {
      supported: Boolean(supported),
      reason: supported ? null : "immersive-vr-unavailable",
    };
  } catch (error) {
    return { supported: false, reason: "permission-or-policy", error };
  }
}

/** Manages the optional button and desktop-control handoff for one renderer. */
export class WebXRSessionController {
  constructor(target, renderer, button, options = {}) {
    this.target = target;
    this.renderer = renderer;
    this.button = button;
    this.supported = true;
    this.reason = null;
    this._controls = options.controls ?? target?.controls ?? null;
    this._controlsWereEnabled = this._controls?.enabled ?? true;
    this._onSessionChange = options.onSessionChange ?? null;
    this._onError = options.onError ?? null;
    this._enterLabel = options.ariaLabel ?? "Enter virtual reality";
    this._exitLabel = options.exitAriaLabel ?? "Exit virtual reality";
    this._disposed = false;

    this._handleSessionStart = () => {
      if (this._controls) {
        this._controlsWereEnabled = this._controls.enabled;
        this._controls.enabled = false;
      }
      this.button.setAttribute("aria-label", this._exitLabel);
      this._onSessionChange?.(true, this.renderer.xr.getSession());
    };
    this._handleSessionEnd = () => {
      if (this._controls) this._controls.enabled = this._controlsWereEnabled;
      this.button.setAttribute("aria-label", this._enterLabel);
      this._onSessionChange?.(false, null);
    };
    this._handleError = (event) => this._onError?.(event.detail);

    this.renderer.xr.addEventListener(
      "sessionstart",
      this._handleSessionStart,
    );
    this.renderer.xr.addEventListener("sessionend", this._handleSessionEnd);
    this.button.addEventListener("webxrerror", this._handleError);
  }

  get session() {
    return this.renderer.xr.getSession();
  }

  async endSession() {
    const session = this.session;
    if (session) await session.end();
  }

  async dispose() {
    if (this._disposed) return;
    try {
      await this.endSession();
    } finally {
      this.renderer.xr.removeEventListener(
        "sessionstart",
        this._handleSessionStart,
      );
      this.renderer.xr.removeEventListener(
        "sessionend",
        this._handleSessionEnd,
      );
      this.button.removeEventListener("webxrerror", this._handleError);
      if (this._controls) this._controls.enabled = this._controlsWereEnabled;
      this.button?.dispose?.();
      this.button?.remove();
      this.renderer.xr.enabled = false;
      this._disposed = true;
    }
  }
}

/**
 * Enable immersive viewing when, and only when, it is available.
 *
 * The returned unsupported result deliberately has no button. Call
 * `ThreeModelRenderer.start()` (or Three.js `setAnimationLoop`) so the same
 * animation loop is used on desktop and in a headset.
 */
export async function installWebXR(target, options = {}) {
  const environment = options.environment ?? defaultEnvironment();
  const support = await queryWebXRSupport(environment);
  if (!support.supported) {
    return {
      ...support,
      button: null,
      session: null,
      async endSession() {},
      async dispose() {},
    };
  }

  const renderer = rawRenderer(target);
  const parent =
    options.parent ?? target?.container ?? renderer.domElement?.parentElement;
  if (!parent || typeof parent.appendChild !== "function") {
    throw new TypeError("A DOM parent is required to mount the WebXR button.");
  }

  renderer.xr.enabled = true;
  const button = VRButton.createButton(renderer, options.sessionInit ?? {});
  button.type = "button";
  button.classList.add("webxr-entry");
  button.setAttribute("aria-label", options.ariaLabel ?? "Enter virtual reality");
  parent.appendChild(button);

  return new WebXRSessionController(target, renderer, button, options);
}

export const enableWebXR = installWebXR;
