import {
  BackSide,
  CanvasTexture,
  GreaterDepth,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  LineLoop,
  Matrix4,
  MeshBasicMaterial,
  MeshMatcapMaterial,
  Points,
  PointsMaterial,
  SphereGeometry,
  SRGBColorSpace,
} from "../../vendor/three/three.module.js";

// A view-relative material keeps the same soft upper-left highlight as the
// hemisphere selector, even when the user orbits the actual 3D spheres.
function createSphereMatcap(ownerDocument) {
  const canvas = ownerDocument.createElement("canvas");
  canvas.width = canvas.height = 512;
  const context = canvas.getContext("2d");
  const center = 256;
  const radius = 256;
  const gradient = context.createRadialGradient(
    center - radius * 0.25, center - radius * 0.3, 8,
    center, center, radius,
  );
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.58, "#d8dadd");
  gradient.addColorStop(1, "#8e949a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 512);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Optional local spheres of radius s centered at every carrier sample. */
export function createV4SphereGuides(renderer) {
  const texture = createSphereMatcap(renderer.canvas.ownerDocument);
  const geometry = new SphereGeometry(1, 48, 32);
  const material = new MeshMatcapMaterial({
    matcap: texture,
    toneMapped: false,
    // Leave surface paths just in front of the sphere, without z-fighting.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const spheres = new InstancedMesh(geometry, material, 200);
  spheres.name = "v4-shaded-spheres";
  spheres.visible = false;
  // An expanded back-face shell gives a crisp silhouette even on small
  // spheres, where a rim painted into the shading texture can disappear.
  const outlineMaterial = new MeshBasicMaterial({ color: "#222629", side: BackSide });
  const outlines = new InstancedMesh(geometry, outlineMaterial, 200);
  outlines.name = "v4-sphere-outlines";
  outlines.visible = false;
  const transform = new Matrix4();

  const frontPathMaterial = new LineBasicMaterial({
    color: "#334155",
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const hiddenPathMaterial = new LineBasicMaterial({
    color: "#64748b",
    transparent: true,
    opacity: 0.28,
    linewidth: 1,
    // Draw only fragments behind an opaque sphere. Neither path pass writes
    // depth, so crossing paths cannot incorrectly hide or reveal each other.
    depthFunc: GreaterDepth,
    depthWrite: false,
  });
  const hiddenPaths = new WeakMap();

  function syncPaths(shown) {
    for (const path of renderer.pathGroup.children) {
      let hidden = hiddenPaths.get(path);
      if (!hidden) {
        const PathLine = path.isLineLoop ? LineLoop : Line;
        hidden = new PathLine(path.geometry, hiddenPathMaterial);
        hidden.name = "v4-hidden-path";
        // Share the same geometry and visibility switch as the normal path.
        // A model rebuild replaces the parent and releases both references.
        path.add(hidden);
        hiddenPaths.set(path, hidden);
      }
      path.material = shown ? frontPathMaterial : renderer.pathMaterial;
      hidden.visible = shown;
    }
  }

  // Reference spheres must not hide the moving markers. A small white halo
  // keeps their existing colors legible on the gray surface and dark rim.
  const haloMaterial = new PointsMaterial({
    color: "#ffffff",
    map: renderer.pointTexture,
    alphaTest: 0.05,
    transparent: true,
    sizeAttenuation: false,
    depthTest: false,
    depthWrite: false,
  });
  const halos = new Points(renderer.pointGeometry, haloMaterial);
  halos.name = "v4-sphere-marker-halos";
  halos.renderOrder = 1;
  halos.visible = false;
  const originalDepthTest = renderer.pointMaterial.depthTest;
  const originalRenderOrder = renderer.points.renderOrder;
  renderer.scene.add(spheres, outlines, halos);

  return {
    sync(model, { visible, pointSize }) {
      const { center, carrierRadius, localRadius, pointCount } = model.config;
      spheres.count = pointCount;
      outlines.count = pointCount;
      for (let index = 0; index < pointCount; index += 1) {
        const theta = 2 * Math.PI * index / pointCount;
        transform.makeScale(localRadius, localRadius, localRadius);
        transform.setPosition(
          center[0] + carrierRadius * Math.cos(theta),
          center[1] + carrierRadius * Math.sin(theta),
          center[2],
        );
        spheres.setMatrixAt(index, transform);
        transform.scale({ x: 1.018, y: 1.018, z: 1.018 });
        outlines.setMatrixAt(index, transform);
      }
      spheres.instanceMatrix.needsUpdate = true;
      outlines.instanceMatrix.needsUpdate = true;
      spheres.computeBoundingSphere();
      outlines.computeBoundingSphere();
      const shown = visible && localRadius > 0;
      spheres.visible = shown;
      outlines.visible = shown;
      halos.visible = shown;
      // setModel may replace the point buffer when the sample count changes.
      halos.geometry = renderer.pointGeometry;
      haloMaterial.size = pointSize + 3;
      renderer.pointMaterial.depthTest = shown ? false : originalDepthTest;
      renderer.points.renderOrder = shown ? 2 : originalRenderOrder;
      syncPaths(shown);
      renderer.canvas.dataset.shadedSpheres = String(visible);
      renderer.canvas.dataset.sphereCount = String(shown ? pointCount : 0);
      renderer.canvas.dataset.sphereRadius = String(localRadius);
    },
    dispose() {
      renderer.scene.remove(spheres, outlines, halos);
      renderer.pointMaterial.depthTest = originalDepthTest;
      renderer.points.renderOrder = originalRenderOrder;
      for (const path of renderer.pathGroup.children) {
        const hidden = hiddenPaths.get(path);
        if (hidden) path.remove(hidden);
        path.material = renderer.pathMaterial;
      }
      spheres.dispose();
      outlines.dispose();
      geometry.dispose();
      material.dispose();
      outlineMaterial.dispose();
      texture.dispose();
      haloMaterial.dispose();
      frontPathMaterial.dispose();
      hiddenPathMaterial.dispose();
      // Point geometry and marker texture are borrowed from the renderer.
    },
  };
}
