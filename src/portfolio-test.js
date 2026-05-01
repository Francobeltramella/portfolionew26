import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from 'gsap';

const container = document.querySelector("._3d-element");

// =====================
// SCENE / CAMERA / RENDERER
// =====================
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.1,
  100
);
camera.position.set(0, 0, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.sortObjects = true;
container.appendChild(renderer.domElement);

// =====================
// LIGHTS
// =====================
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(2, 3, 4);
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const cursorLight = new THREE.PointLight(0xffffff, 8, 500);
scene.add(cursorLight);

// =====================
// CONTROLS
// =====================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableZoom = false;

// =====================
// SHADERS
// =====================
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  uniform float uTime;
  uniform float uCurve;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    vec3 pos = position;

    // Curva tipo coverflow — dobla en Z según X local
    pos.z += sin(pos.x * 0.75) * uCurve;

    // Micro breathe muy sutil solo en Z
    pos.z += sin(pos.y * 3.0 + uTime * 0.9) * 0.015;

    vec4 worldPos4 = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos4.xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uNoiseStrength;
  uniform float uAlpha;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  void main() {
    vec2 uv = vUv;

    // Edge fade — bordes se disuelven suave
    float edgeX = smoothstep(0.0, 0.07, uv.x) * smoothstep(1.0, 0.93, uv.x);
    float edgeY = smoothstep(0.0, 0.05, uv.y) * smoothstep(1.0, 0.95, uv.y);
    float edgeFade = edgeX * edgeY;

    vec4 tex = texture2D(uTexture, uv);

    // Grain cinematográfico
    float noise = random(uv * 480.0 + uTime * 0.35);
    tex.rgb += (noise - 0.5) * uNoiseStrength;

    // Fresnel sutil
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - clamp(dot(viewDir, vNormal), 0.0, 1.0), 2.5);
    tex.rgb += fresnel * 0.045;

    // Vignette
    float vignette = smoothstep(0.55, 0.18, length(uv - 0.5));
    tex.rgb *= 0.82 + vignette * 0.18;

    gl_FragColor = vec4(tex.rgb, tex.a * uAlpha * edgeFade);
  }
`;

// =====================
// IMAGE PLANES
// =====================
const imageElements = [...document.querySelectorAll(".image-project")];
imageElements.forEach(img => {
  img.style.opacity = "0";
  img.style.visibility = "hidden";
});

const textureLoader = new THREE.TextureLoader();
const imagePlanes = [];

// Parámetros del arco orbital
const ORBIT_RADIUS = 9;   // radio del círculo — más chico = más cerca al modelo
const CARD_W = 5.0;
const CARD_H = 3.1;
const TOTAL = imageElements.length;
const Y_FIXED = 0;         // todas en la misma altura — sin movimiento vertical

imageElements.forEach((img, index) => {
  const texture = textureLoader.load(img.src);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const geometry = new THREE.PlaneGeometry(CARD_W, CARD_H, 64, 40);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    uniforms: {
      uTexture: { value: texture },
      uTime: { value: 0 },
      uNoiseStrength: { value: 0.025 },
      uAlpha: { value: 1.0 },
      uCurve: { value: 0.55 },
    },
    vertexShader,
    fragmentShader
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = {
    baseAngle: (index / TOTAL) * Math.PI * 2,
    index
  };
  mesh.renderOrder = 1;

  scene.add(mesh);
  imagePlanes.push(mesh);
});

// =====================
// ANIMATE IMAGES
// =====================
// Vector reutilizable para lookAt
const _target = new THREE.Vector3();

function animateImages(time) {
  imagePlanes.forEach((mesh) => {
    const angle = time * 0.28 + mesh.userData.baseAngle;

    // Órbita en XZ — Y siempre fijo
    const x = Math.cos(angle) * ORBIT_RADIUS;
    const z = Math.sin(angle) * ORBIT_RADIUS;
    mesh.position.set(x, Y_FIXED, z);

    // Billboard horizontal puro:
    // La card mira a la cámara pero SOLO gira en Y (no tilt vertical)
    _target.set(camera.position.x, mesh.position.y, camera.position.z);
    mesh.lookAt(_target);

    // Rotación extra según posición en el arco
    // Las que están de costado se inclinan hacia el centro — efecto coverflow
    const angleNorm = Math.atan2(z, x); // ángulo real de la card
    const tiltY = -Math.sin(angleNorm) * 0.35; // inclinación coverflow
    mesh.rotateY(tiltY);

    // Depth: frente = 1, fondo = 0
    // z positivo = frente a la cámara (cámara está en z=20)
    const depth = (z / ORBIT_RADIUS) * 0.5 + 0.5; // 0 a 1

    // Scale: frente más grande, fondo más chico
    const scale = THREE.MathUtils.lerp(0.65, 1.08, depth);
    mesh.scale.setScalar(scale);

    // Alpha: fondo casi invisible
    const alpha = THREE.MathUtils.lerp(0.1, 1.0, Math.pow(depth, 1.5));
    mesh.material.uniforms.uAlpha.value = alpha;
    mesh.material.uniforms.uTime.value = time;

    // renderOrder: siempre debajo del GLB (max 9, GLB = 10)
    mesh.renderOrder = 1 + Math.floor(depth * 8);
  });
}

// =====================
// MOUSE
// =====================
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const planeMouse = new THREE.Plane(new THREE.Vector3(0, 0, 1), -8);
let intersecting = false;
let glbModel = null;

container.addEventListener('mousemove', (event) => {
  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const point = new THREE.Vector3();
  raycaster.ray.intersectPlane(planeMouse, point);
  cursorLight.position.copy(point);

  if (!glbModel) return;

  const intersects = raycaster.intersectObject(glbModel, true);

  if (intersects.length > 0 && !intersecting) {
    intersecting = true;
    gsap.to(document.body, { backgroundColor: "#000", duration: 0.4 });
    gsap.to(".no-hover", { opacity: 0, duration: 0.4 });
    gsap.to(".hover", { opacity: 1, duration: 0.4 });
    gsap.to(".hover-black", { color: "#F4F1EA", duration: 0.4 });
  }

  if (intersects.length === 0 && intersecting) {
    intersecting = false;
    gsap.to(document.body, { backgroundColor: "#F4F1EA", duration: 0.4 });
    gsap.to(".no-hover", { opacity: 1, duration: 0.4 });
    gsap.to(".hover", { opacity: 0, duration: 0.4 });
    gsap.to(".hover-black", { color: "#000", duration: 0.4 });
  }
});

// =====================
// LOAD MODEL
// =====================
const loader = new GLTFLoader();
loader.load(
  "https://3dlive.netlify.app/portfolio.glb",
  (gltf) => {
    glbModel = gltf.scene;
    glbModel.traverse(child => {
      if (child.isMesh) {
        child.renderOrder = 10;
        if (child.material) {
          child.material.depthTest = true;
          child.material.depthWrite = true;
        }
      }
    });
    scene.add(glbModel);
  }
);

// =====================
// RESIZE
// =====================
window.addEventListener("resize", () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// =====================
// LOOP
// =====================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();
  controls.update();
  animateImages(time);
  renderer.render(scene, camera);
}

animate();