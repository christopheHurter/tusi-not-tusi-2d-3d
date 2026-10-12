import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLICATION_RELATIVE_DIRECTORY = "dist/tusi-not-tusi-six-experiences";
export const PUBLICATION_DIRECTORY = resolve(PROJECT_ROOT, PUBLICATION_RELATIVE_DIRECTORY);
export const PUBLICATION_LOCK_RELATIVE_DIRECTORY =
  "dist/.tusi-not-tusi-six-experiences.build-lock";
export const PUBLICATION_LOCK_DIRECTORY = resolve(
  PROJECT_ROOT,
  PUBLICATION_LOCK_RELATIVE_DIRECTORY,
);

export const TRANSIENT_FILE_SYSTEM_ERROR_CODES = Object.freeze([
  "EACCES",
  "EBUSY",
  "EMFILE",
  "ENFILE",
  "ENOTEMPTY",
  "EPERM",
]);

const transientFileSystemErrorCodes = new Set(TRANSIENT_FILE_SYSTEM_ERROR_CODES);
const BUILD_LOCK_MAX_RETRIES = 80;
const BUILD_LOCK_RETRY_DELAY_MS = 100;

export const EXPERIENCE_IDS = Object.freeze(["v0", "tusi2", "v0bis", "v3", "tusi3d", "v4"]);
export const EXPERIENCE_ROUTES = Object.freeze(
  EXPERIENCE_IDS.map((id) => `examples/pedagogy/${id}/`),
);

export const PUBLICATION_SOURCE_FILES = Object.freeze([
  "index.html",
  "assets/styles.css",
  "examples/pedagogy/pedagogy-models.js",
  "examples/pedagogy/pedagogy-page.js",
  "examples/pedagogy/v4-presets.js",
  "examples/pedagogy/v4-spheres.js",
  ...EXPERIENCE_IDS.flatMap((id) => [
    `examples/pedagogy/${id}/index.html`,
    `examples/pedagogy/${id}/main.js`,
  ]),
  "src/core/config.js",
  "src/core/geometry.js",
  "src/core/index.js",
  "src/core/interpolation.js",
  "src/core/models.js",
  "src/core/presets.js",
  "src/renderers/three-renderer.js",
  "vendor/three/OrbitControls.js",
  "vendor/three/three.core.js",
  "vendor/three/three.module.js",
  "LICENSE",
  "CITATION.cff",
  "THIRD_PARTY_NOTICES.md",
  "vendor/three/LICENSE",
  "scripts/serve.mjs",
]);

export const PUBLICATION_GENERATED_FILES = Object.freeze(["package.json"]);
export const PUBLICATION_MANIFEST = Object.freeze(
  [...PUBLICATION_SOURCE_FILES, ...PUBLICATION_GENERATED_FILES].sort(),
);

function assertPublicationTarget() {
  const relativeTarget = relative(PROJECT_ROOT, PUBLICATION_DIRECTORY).replaceAll("\\", "/");
  if (relativeTarget !== PUBLICATION_RELATIVE_DIRECTORY) {
    throw new Error(`Refusing to replace unexpected publication target: ${PUBLICATION_DIRECTORY}`);
  }
  const relativeLock = relative(PROJECT_ROOT, PUBLICATION_LOCK_DIRECTORY).replaceAll("\\", "/");
  if (relativeLock !== PUBLICATION_LOCK_RELATIVE_DIRECTORY) {
    throw new Error(`Refusing to use unexpected publication lock: ${PUBLICATION_LOCK_DIRECTORY}`);
  }
}

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

export async function retryTransientFileOperation(
  operation,
  { maxRetries = 8, initialDelayMs = 40, maximumDelayMs = 640 } = {},
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const retryable = transientFileSystemErrorCodes.has(error?.code);
      if (!retryable || attempt >= maxRetries) throw error;
      const delay = Math.min(initialDelayMs * (2 ** attempt), maximumDelayMs);
      await wait(delay);
    }
  }
}

async function acquirePublicationLock() {
  await retryTransientFileOperation(
    () => mkdir(dirname(PUBLICATION_LOCK_DIRECTORY), { recursive: true }),
  );
  for (let attempt = 0; attempt <= BUILD_LOCK_MAX_RETRIES; attempt += 1) {
    try {
      await mkdir(PUBLICATION_LOCK_DIRECTORY);
      return;
    } catch (error) {
      const retryable = error?.code === "EEXIST" ||
        transientFileSystemErrorCodes.has(error?.code);
      if (!retryable || attempt === BUILD_LOCK_MAX_RETRIES) {
        throw new Error(
          `Could not acquire publication build lock at ${PUBLICATION_LOCK_DIRECTORY}.`,
          { cause: error },
        );
      }
      await wait(BUILD_LOCK_RETRY_DELAY_MS);
    }
  }
}

async function releasePublicationLock() {
  await retryTransientFileOperation(() => rm(PUBLICATION_LOCK_DIRECTORY, {
    force: true,
    maxRetries: 4,
    recursive: true,
    retryDelay: 50,
  }));
}

async function sourceVersion() {
  const packageJson = JSON.parse(await readFile(resolve(PROJECT_ROOT, "package.json"), "utf8"));
  if (typeof packageJson.version !== "string" || packageJson.version.length === 0) {
    throw new Error("Source package.json must provide a non-empty version.");
  }
  return packageJson.version;
}

export async function publicationPackageJson() {
  return {
    name: "tusi-not-tusi-six-experiences",
    version: await sourceVersion(),
    private: true,
    type: "module",
    description: "Six offline experiments for understanding the Tusi and Not-Tusi illusions.",
    license: "MIT",
    scripts: {
      serve: "node scripts/serve.mjs",
    },
    engines: {
      node: ">=20",
    },
  };
}

async function copyPublicationFile(relativePath) {
  const sourcePath = resolve(PROJECT_ROOT, relativePath);
  const sourceInfo = await stat(sourcePath);
  if (!sourceInfo.isFile()) {
    throw new Error(`Publication source is not a file: ${relativePath}`);
  }

  const destinationPath = resolve(PUBLICATION_DIRECTORY, relativePath);
  await retryTransientFileOperation(
    () => mkdir(dirname(destinationPath), { recursive: true }),
  );
  await retryTransientFileOperation(() => copyFile(sourcePath, destinationPath));
}

export async function buildPublication() {
  assertPublicationTarget();
  await acquirePublicationLock();
  try {
    await retryTransientFileOperation(() => rm(PUBLICATION_DIRECTORY, {
      force: true,
      maxRetries: 6,
      recursive: true,
      retryDelay: 75,
    }));
    await retryTransientFileOperation(
      () => mkdir(PUBLICATION_DIRECTORY, { recursive: true }),
    );

    for (const relativePath of PUBLICATION_SOURCE_FILES) {
      await copyPublicationFile(relativePath);
    }

    const generatedPackage = `${JSON.stringify(await publicationPackageJson(), null, 2)}\n`;
    await retryTransientFileOperation(() => writeFile(
      resolve(PUBLICATION_DIRECTORY, "package.json"),
      generatedPackage,
      "utf8",
    ));

    return {
      directory: PUBLICATION_DIRECTORY,
      files: PUBLICATION_MANIFEST,
    };
  } finally {
    await releasePublicationLock();
  }
}

function isDirectExecution() {
  const entryPath = process.argv[1];
  return Boolean(entryPath) && pathToFileURL(resolve(entryPath)).href === import.meta.url;
}

if (isDirectExecution()) {
  const publication = await buildPublication();
  console.log(`Built ${publication.files.length} publication files in ${publication.directory}`);
}
