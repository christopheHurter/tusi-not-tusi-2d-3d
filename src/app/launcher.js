const status = document.querySelector("#runtime-status");
const webglCanvas = document.createElement("canvas");
const webgl = Boolean(webglCanvas.getContext("webgl2") || webglCanvas.getContext("webgl"));

async function describeWebXRSupport() {
  if (!window.isSecureContext) {
    return "WebXR requires HTTPS or localhost";
  }

  const xr = navigator.xr;
  if (!xr) return "WebXR API unavailable";
  if (typeof xr.isSessionSupported !== "function") return "WebXR API detected";

  let timeoutId;
  try {
    const supported = await Promise.race([
      xr.isSessionSupported("immersive-vr"),
      new Promise((resolve) => {
        timeoutId = window.setTimeout(() => resolve(null), 2000);
      }),
    ]);
    if (supported === null) {
      return "WebXR API detected; immersive VR support could not be verified";
    }
    return supported
      ? "immersive VR ready"
      : "WebXR API detected; immersive VR unavailable";
  } catch {
    return "WebXR API detected; immersive VR support could not be verified";
  } finally {
    window.clearTimeout(timeoutId);
  }
}

const baseStatuses = [
  "Canvas 2-D ready",
  webgl ? "desktop 3-D ready" : "WebGL unavailable",
];
status.textContent = [...baseStatuses, "checking immersive VR support…"].join(" · ");
describeWebXRSupport().then((xrStatus) => {
  status.textContent = [...baseStatuses, xrStatus].join(" · ");
});
