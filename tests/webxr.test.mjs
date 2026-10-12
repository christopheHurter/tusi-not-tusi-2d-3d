import assert from "node:assert/strict";
import test from "node:test";

import {
  installWebXR,
  queryWebXRSupport,
} from "../src/renderers/webxr.js";

test("WebXR feature detection is a non-throwing progressive enhancement", async () => {
  assert.deepEqual(await queryWebXRSupport({ isSecureContext: false }), {
    supported: false,
    reason: "insecure-context",
  });
  assert.deepEqual(await queryWebXRSupport({ isSecureContext: true, navigator: {} }), {
    supported: false,
    reason: "api-unavailable",
  });
  assert.deepEqual(await queryWebXRSupport({
    isSecureContext: true,
    navigator: { xr: { isSessionSupported: async () => false } },
  }), {
    supported: false,
    reason: "immersive-vr-unavailable",
  });
  assert.deepEqual(await queryWebXRSupport({
    isSecureContext: true,
    navigator: { xr: { isSessionSupported: async (mode) => mode === "immersive-vr" } },
  }), {
    supported: true,
    reason: null,
  });
});

class FakeButton extends EventTarget {
  constructor() {
    super();
    this.attributes = new Map();
    this.classList = { add: (...names) => names.forEach((name) => this.classes.add(name)) };
    this.classes = new Set();
    this.disabled = false;
    this.parentNode = null;
    this.textContent = "";
    this.type = "button";
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  remove() {
    this.parentNode?.removeChild(this);
  }
}

class FakeSession extends EventTarget {
  async end() {
    this.dispatchEvent(new Event("end"));
  }
}

class FakeXRManager extends EventTarget {
  constructor() {
    super();
    this.enabled = false;
    this.session = null;
  }

  getSession() {
    return this.session;
  }

  async setSession(session) {
    this.session = session;
    session.addEventListener("end", () => {
      this.session = null;
      this.dispatchEvent(new Event("sessionend"));
    }, { once: true });
    this.dispatchEvent(new Event("sessionstart"));
  }
}

function nextTask() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test("mock immersive entry and exit preserve desktop controls and clean up", async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const session = new FakeSession();
  const navigatorValue = {
    xr: {
      isSessionSupported: async () => true,
      requestSession: async () => session,
    },
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: () => new FakeButton() },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: navigatorValue,
  });

  try {
    const children = [];
    const parent = {
      appendChild(child) {
        children.push(child);
        child.parentNode = this;
      },
      removeChild(child) {
        const index = children.indexOf(child);
        if (index >= 0) children.splice(index, 1);
        child.parentNode = null;
      },
    };
    const controls = { enabled: true };
    const renderer = { xr: new FakeXRManager(), domElement: { parentElement: parent } };
    const changes = [];
    const controller = await installWebXR(
      { renderer, controls, container: parent },
      {
        environment: { isSecureContext: true, navigator: navigatorValue },
        parent,
        onSessionChange: (active) => changes.push(active),
      },
    );

    assert.equal(controller.supported, true);
    assert.equal(children.length, 1);
    assert.equal(controller.button.getAttribute("aria-label"), "Enter virtual reality");

    controller.button.dispatchEvent(new Event("click"));
    await nextTask();
    assert.equal(renderer.xr.getSession(), session);
    assert.equal(controls.enabled, false);
    assert.equal(controller.button.getAttribute("aria-label"), "Exit virtual reality");

    await controller.endSession();
    await nextTask();
    assert.equal(renderer.xr.getSession(), null);
    assert.equal(controls.enabled, true);
    assert.equal(controller.button.getAttribute("aria-label"), "Enter virtual reality");
    assert.deepEqual(changes, [true, false]);

    await controller.dispose();
    assert.equal(children.length, 0);
    assert.equal(renderer.xr.enabled, false);
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else delete globalThis.document;
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else delete globalThis.navigator;
  }
});
