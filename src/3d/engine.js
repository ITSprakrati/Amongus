import * as THREE from 'three';

export const Engine = {
  scene: null,
  camera: null,
  renderer: null,
  lights: null,
  controls: null,
  clock: new THREE.Clock()
};

export function init3DEngine(container) {
  // 1. Scene
  const scene = new THREE.Scene();
  Engine.scene = scene;

  // 2. Camera
  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 5, 15);
  Engine.camera = camera;

  // 3. Renderer (transparent background for CSS integration, e.g. warm ivory)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // optimize pixel ratio
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  
  // Append to container
  container.appendChild(renderer.domElement);
  Engine.renderer = renderer;

  // 4. Lights setup (Warm ivory theme)
  const lights = {};

  // Warm ambient base
  lights.ambient = new THREE.AmbientLight(0xfff5e6, 0.6); 
  scene.add(lights.ambient);

  // Directional key light (simulating sun/main source)
  lights.key = new THREE.DirectionalLight(0xffffff, 1.2);
  lights.key.position.set(10, 15, 10);
  lights.key.castShadow = true;
  lights.key.shadow.mapSize.width = 2048;
  lights.key.shadow.mapSize.height = 2048;
  lights.key.shadow.camera.near = 0.5;
  lights.key.shadow.camera.far = 50;
  lights.key.shadow.bias = -0.0005;
  scene.add(lights.key);

  // Fill light (slate/cool tone for contrast against warm key)
  lights.fill = new THREE.DirectionalLight(0x8fa3b8, 0.5);
  lights.fill.position.set(-10, 5, -10);
  scene.add(lights.fill);

  // Accent point light
  lights.accent = new THREE.PointLight(0xffd700, 0.8, 30);
  lights.accent.position.set(-5, 2, 5);
  scene.add(lights.accent);

  Engine.lights = lights;

  // 5. Window Resize Handling
  const onWindowResize = () => {
    if (!container) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  window.addEventListener('resize', onWindowResize);

  // 6. Render Loop
  const animate = () => {
    requestAnimationFrame(animate);

    const delta = Engine.clock.getDelta();

    // Update controls if injected later
    if (Engine.controls && typeof Engine.controls.update === 'function') {
      Engine.controls.update(delta);
    }

    if (Engine.updatables) {
        Engine.updatables.forEach(obj => {
            if (typeof obj.update === 'function') obj.update(delta);
        });
    }

    // Render the scene
    renderer.render(scene, camera);
  };

  // Start loop
  animate();

  return { scene, camera, renderer, lights };
}
