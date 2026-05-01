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
camera.position.set(0, 2, 22);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.sortObjects = true;
container.appendChild(renderer.domElement);

// =====================
// LIGHTS
// =====================
scene.add(new THREE.DirectionalLight(0xffffff, 1.2).position.set(2, 3, 4) && new THREE.DirectionalLight(0xffffff, 1.2));
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

    // Curva horizontal suave
    pos.z += sin(pos.x * 0.8) * uCurve;

    // Micro-breathe
    pos.z += sin(pos.y * 4.0 + uTime * 1.1) * 0.02;

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

    // Edge fade
    float edgeX = smoothstep(0.0, 0.06, uv.x) * smoothstep(1.0, 0.94, uv.x);
    float edgeY = smoothstep(0.0, 0.05, uv.y) * smoothstep(1.0, 0.95, uv.y);
    float edgeFade = edgeX * edgeY;

    vec4 tex = texture2D(uTexture, uv);

    // Grain sutil
    float noise = random(uv * 500.0 + uTime * 0.4);
    tex.rgb += (noise - 0.5) * uNoiseStrength;

    // Fresnel
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - clamp(dot(viewDir, vNormal), 0.0, 1.0), 2.5);
    tex.rgb += fresnel * 0.05;

    // Vignette
    float vignette = smoothstep(0.55, 0.15, length(uv - 0.5));
    tex.rgb *= 0.85 + vignette * 0.15;

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

const ORBIT_RADIUS = 11;  // radio de la órbita
const ORBIT_Y_SPREAD = 0.9; // separación vertical entre cards
const CARD_W = 4.8;
const CARD_H = 3.0;
const TOTAL = imageElements.length;

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
      uNoiseStrength: { value: 0.028 },
      uAlpha: { value: 1.0 },
      uCurve: { value: 0.45 },
    },
    vertexShader,
    fragmentShader
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = {
    baseAngle: (index / TOTAL) * Math.PI * 2,
    index
  };

  // Siempre atrás del modelo
  mesh.renderOrder = 1;

  scene.add(mesh);
  imagePlanes.push(mesh);
});

// =====================
// ANIMATE IMAGES — órbita alrededor del GLB
// =====================
function animateImages(time) {
  imagePlanes.forEach((mesh, index) => {
    const angle = time * 0.3 + mesh.userData.baseAngle;

    // Posición en órbita XZ
    const x = Math.cos(angle) * ORBIT_RADIUS;
    const z = Math.sin(angle) * ORBIT_RADIUS;

    // Y: distribuidas verticalmente + breathe
    const centerY = (index - (TOTAL - 1) / 2) * ORBIT_Y_SPREAD;
    const y = centerY + Math.sin(time * 0.5 + index * 1.1) * 0.3;

    mesh.position.set(x, y, z);

    // Billboard: mira a cámara
    mesh.lookAt(camera.position);

    // Tilt orbital sutil — rompe el billboard flat
    const tilt = Math.sin(angle + Math.PI * 0.5) * 0.1;
    mesh.rotateY(tilt);

    // Depth: qué tan "adelante" está en la órbita
    // sin(angle) va de -1 (fondo) a +1 (frente)
    const rawDepth = Math.sin(angle); // -1 a 1
    const depth = rawDepth * 0.5 + 0.5; // 0 a 1

    // Las que están DETRÁS del modelo (z > 0 relativo) = más oscuras y pequeñas
    // Las que están adelante = más grandes y opacas
    // PERO todas tienen z menor al modelo (que está en z=0)
    // así que usamos depth para simular la profundidad

    const scale = THREE.MathUtils.lerp(0.7, 1.05, depth);
    mesh.scale.setScalar(scale);

    // Alpha: las de atrás casi invisibles
    const alpha = THREE.MathUtils.lerp(0.12, 0.95, Math.pow(depth, 1.6));
    mesh.material.uniforms.uAlpha.value = alpha;
    mesh.material.uniforms.uTime.value = time;

    // renderOrder dinámico dentro del grupo de imágenes
    // Todas van a estar visualmente detrás del GLB (renderOrder 1 < GLB renderOrder 10)
    mesh.renderOrder = 1 + depth * 8; // 1 a 9 — siempre < 10 del GLB
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

    // GLB siempre adelante de todas las imágenes
    glbModel.traverse(child => {
      if (child.isMesh) {
        child.renderOrder = 10;
        // Forzar que el depth test funcione bien
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