import { spawn } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  PROJECT_ROOT,
  PUBLICATION_DIRECTORY,
  buildPublication,
} from "../scripts/build-publication.mjs";

const port = 8127;
const baseUrl = `http://127.0.0.1:${port}`;

function browserCandidates() {
  const candidates = [process.env.BROWSER_BIN];
  if (process.platform === "win32") {
    const programFiles = process.env.ProgramFiles;
    const programFilesX86 = process.env["ProgramFiles(x86)"];
    const localAppData = process.env.LOCALAPPDATA;
    for (const base of [programFiles, programFilesX86, localAppData]) {
      if (!base) continue;
      candidates.push(
        join(base, "Microsoft", "Edge", "Application", "msedge.exe"),
        join(base, "Google", "Chrome", "Application", "chrome.exe"),
      );
    }
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    );
  } else {
    candidates.push("/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/microsoft-edge");
  }
  return candidates.filter(Boolean);
}

const browser = browserCandidates().find(existsSync);
if (!browser) {
  throw new Error("No Chrome/Edge executable found. Set BROWSER_BIN to run browser smoke tests.");
}
console.log(`Browser: ${browser}`);

await buildPublication();

const temporaryParent = mkdtempSync(join(tmpdir(), "tusi-not-tusi-publication-browser-"));
const browserRoot = join(temporaryParent, "publication");
cpSync(PUBLICATION_DIRECTORY, browserRoot, { recursive: true });
mkdirSync(join(browserRoot, "tests"), { recursive: true });
cpSync(
  resolve(PROJECT_ROOT, "tests/browser-smoke.html"),
  join(browserRoot, "tests/browser-smoke.html"),
);

const server = spawn(process.execPath, [join(browserRoot, "scripts", "serve.mjs")], {
  cwd: browserRoot,
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/index.html`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error("Local publication server did not become ready.");
}

async function stopServer() {
  if (server.exitCode !== null) return;
  const exited = new Promise((resolveExit) => server.once("exit", resolveExit));
  server.kill();
  await Promise.race([
    exited,
    new Promise((resolveTimeout) => setTimeout(resolveTimeout, 2000)),
  ]);
}

try {
  await waitForServer();
  const browserProfile = join(temporaryParent, "browser-profile");
  const common = [
    "--headless=new",
    "--no-sandbox",
    "--no-first-run",
    "--disable-background-networking",
    "--disable-dev-shm-usage",
    // Virtual-time timers can otherwise outrun frame scheduling in a newly
    // inserted iframe, starving the real requestAnimationFrame playback test.
    "--disable-frame-rate-limit",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--use-angle=swiftshader",
    "--enable-webgl",
    "--window-size=1440,1000",
    `--user-data-dir=${browserProfile}`,
  ];
  // Real-time DevTools polling keeps animation frames and timers on the same
  // clock. Virtual-time --dump-dom can time out before a child frame renders.
  const browserProcess = spawn(browser, [
    ...common, "--remote-debugging-port=0", "about:blank",
  ], { stdio: "ignore" });
  let socket;
  try {
    const { readFile } = await import("node:fs/promises");
    let debugPort;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      try {
        debugPort = Number((await readFile(join(browserProfile, "DevToolsActivePort"), "utf8")).split("\n")[0]);
        if (debugPort) break;
      } catch {}
      await new Promise(resolveWait => setTimeout(resolveWait, 50));
    }
    if (!debugPort) throw new Error("Browser DevTools endpoint did not become ready.");
    const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(`${baseUrl}/tests/browser-smoke.html`)}`, { method: "PUT" });
    const target = await targetResponse.json();
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolveOpen, rejectOpen) => {
      socket.addEventListener("open", resolveOpen, { once: true });
      socket.addEventListener("error", rejectOpen, { once: true });
    });
    let nextId = 0;
    const pending = new Map();
    socket.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      const callback = pending.get(message.id);
      if (callback) { pending.delete(message.id); callback(message); }
    });
    async function command(method, params = {}) {
      const id = ++nextId;
      const response = new Promise((resolveMessage, rejectMessage) => {
        const timer = setTimeout(() => { pending.delete(id); rejectMessage(new Error(`DevTools timeout: ${method}`)); }, 10000);
        pending.set(id, message => {
          clearTimeout(timer);
          if (message.error) rejectMessage(new Error(message.error.message));
          else resolveMessage(message.result);
        });
      });
      socket.send(JSON.stringify({ id, method, params }));
      return response;
    }
    const deadline = Date.now() + 120000;
    let state;
    while (Date.now() < deadline) {
      const evaluation = await command("Runtime.evaluate", {
        expression: "({ result: document.documentElement.dataset.result, summary: document.querySelector('#results')?.textContent })",
        returnByValue: true,
      });
      state = evaluation.result?.value;
      if (state?.result) break;
      await new Promise(resolveWait => setTimeout(resolveWait, 100));
    }
    if (state?.result !== "pass" || !/BROWSER_SMOKE_PASS 7 pages, 0 named presets/.test(state.summary ?? "")) {
      throw new Error(`Browser smoke failed: ${state?.summary ?? "real-time timeout"}`);
    }
    console.log(state.summary.trim());
  } finally {
    socket?.close();
    const exited = new Promise(resolveExit => browserProcess.once("exit", resolveExit));
    browserProcess.kill();
    await Promise.race([exited, new Promise(resolveWait => setTimeout(resolveWait, 2000))]);
  }
} finally {
  await stopServer();
  rmSync(temporaryParent, { recursive: true, force: true });
}
