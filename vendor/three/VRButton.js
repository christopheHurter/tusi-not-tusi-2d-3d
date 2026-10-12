/**
 * @license
 * Copyright 2010-2024 Three.js Authors
 * SPDX-License-Identifier: MIT
 *
 * Adapted from the Three.js r171 VRButton example. Capability detection and
 * placement are intentionally left to the application-facing WebXR adapter.
 */
class VRButton {
  static createButton(renderer, sessionInit = {}) {
    if (!renderer?.xr || typeof renderer.xr.setSession !== "function") {
      throw new TypeError("VRButton requires a Three.js WebGLRenderer.");
    }

    const button = document.createElement("button");
    button.id = "VRButton";
    button.type = "button";
    button.textContent = "ENTER VR";
    button.setAttribute("aria-label", "Enter virtual reality");

    const optionalFeatures = new Set([
      "local-floor",
      "bounded-floor",
      "layers",
      ...(sessionInit.optionalFeatures ?? []),
    ]);
    const sessionOptions = {
      ...sessionInit,
      optionalFeatures: [...optionalFeatures],
    };
    let currentSession = null;

    function onSessionEnded() {
      currentSession = null;
      button.textContent = "ENTER VR";
      button.setAttribute("aria-label", "Enter virtual reality");
    }

    async function onSessionStarted(session) {
      await renderer.xr.setSession(session);
      currentSession = session;
      session.addEventListener("end", onSessionEnded, { once: true });
      button.textContent = "EXIT VR";
      button.setAttribute("aria-label", "Exit virtual reality");
    }

    async function toggleSession() {
      button.disabled = true;
      try {
        if (currentSession) {
          await currentSession.end();
        } else {
          const session = await navigator.xr.requestSession(
            "immersive-vr",
            sessionOptions,
          );
          await onSessionStarted(session);
        }
      } catch (error) {
        console.warn("Unable to change the immersive VR session.", error);
        if (typeof CustomEvent === "function") {
          button.dispatchEvent(new CustomEvent("webxrerror", { detail: error }));
        }
      } finally {
        button.disabled = false;
      }
    }

    button.addEventListener("click", toggleSession);
    button.dispose = () => {
      button.removeEventListener("click", toggleSession);
      currentSession?.removeEventListener("end", onSessionEnded);
    };
    return button;
  }
}

export { VRButton };
