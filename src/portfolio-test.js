import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from 'gsap';

// =====================
// CONTAINER
// =====================
const container = document.querySelector("._3d-element");

// =====================
// SCENE
// =====================
const scene = new THREE.Scene();

// =====================
// CAMERA
// =====================
const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.1,
  100
);
camera.position.set(0, 2, 16);

// =====================
// RENDERER
// =====================
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// =====================
// LIGHTS
// =====================
const light = new THREE.DirectionalLight(0xffffff, 1.2);
light.position.set(2, 3, 4);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

// =====================
// CONTROLS
// =====================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableZoom = false;

// =====================
// CURSOR LIGHT
// =====================
const cursorLight = new THREE.PointLight(0xffffff, 8, 500);
scene.add(cursorLight);

// =====================
// RAYCAST
// =====================
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -8);

// =====================
// MODEL
// =====================
let glbModel = null;
let intersecting = false;

// =====================
// SHADERS — Premium version
// =====================
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  uniform float uTime;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    vec3 pos = position;

    // Curva suave tipo "card flotante" — bend en Z basado en X
    float bend = sin(pos.x * 0.9) * 0.35;
    pos.z += bend;

    // Micro-wave orgánico en Y — muy sutil
    pos.z += sin(pos.y * 4.0 + uTime * 1.2) * 0.025;
    pos.y += sin(pos.x * 3.0 + uTime * 0.8) * 0.015;

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
  uniform vec3 uLightPos;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  void main() {
    vec2 uv = vUv;

    // Edge fade — bordes suaves tipo print elegante
    float edgeX = smoothstep(0.0, 0.06, uv.x) * smoothstep(1.0, 0.94, uv.x);
    float edgeY = smoothstep(0.0, 0.04, uv.y) * smoothstep(1.0, 0.96, uv.y);
    float edgeFade = edgeX * edgeY;

    vec4 tex = texture2D(uTexture, uv);

    // Noise mínimo — grain sutil, cinematográfico
    float noise = random(uv * 600.0 + uTime * 0.5);
    tex.rgb += (noise - 0.5) * uNoiseStrength;

    // Fresnel sutil — highlight en bordes según view direction
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - clamp(dot(viewDir, vNormal), 0.0, 1.0), 2.5);
    tex.rgb += fresnel * 0.06;

    // Vignette interior suave
    float vignette = smoothstep(0.5, 0.2, length(uv - 0.5));
    tex.rgb *= 0.88 + vignette * 0.12;

    float finalAlpha = tex.a * uAlpha * edgeFade;

    gl_FragColor = vec4(tex.rgb, finalAlpha);
  }
`;

// =====================
// IMAGE PROJECTS
// =====================
const imageElements = [...document.querySelectorAll(".image-project")];
imageElements.forEach(img => {
  img.style.opacity = "0";
  img.style.visibility = "hidden";
});

const textureLoader = new THREE.TextureLoader();
const imagePlanes = [];

// Helpers de orientación reutilizables
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _lookDir = new THREE.Vector3();

imageElements.forEach((img, index) => {
  const texture = textureLoader.load(img.src);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  // Más segmentos para que la curva sea suave
  const geometry = new THREE.PlaneGeometry(4.5, 2.8, 80, 50);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    uniforms: {
      uTexture: { value: texture },
      uTime: { value: 0 },
      uNoiseStrength: { value: 0.03 },
      uAlpha: { value: 0.0 },
      uLightPos: { value: new THREE.Vector3(2, 3, 4) }
    },
    vertexShader,
    fragmentShader
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = {
    baseAngle: (index / imageElements.length) * Math.PI * 2,
    radius: 10,
    index
  };

  scene.add(mesh);
  imagePlanes.push(mesh);
});

// =====================
// ANIMATION SPIRAL — premium
// =====================
const _camDir = new THREE.Vector3();

function animateImages(time) {
  imagePlanes.forEach((mesh, index) => {
    const angle = time * 0.28 + mesh.userData.baseAngle;
    const radius = mesh.userData.radius;

    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    // Spread vertical suave — sin stacking agresivo
    const y = index * 0.75 - (imagePlanes.length * 0.75 * 0.5) + Math.sin(time * 0.5 + index * 1.3) * 0.4;

    mesh.position.set(x, y, z);

    // Billboard suave — mira hacia cámara pero con leve inclinación Y orbital
    _lookDir.subVectors(camera.position, mesh.position).normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _lookDir);

    // Inclinación extra: tilt suave según posición en órbita (hace que se vean 3D)
    const tiltAngle = Math.sin(angle + Math.PI * 0.5) * 0.12;
    mesh.rotateY(tiltAngle);

    // Depth 0→1 según qué tan "cerca" está (frente = 1)
    const depth = (Math.sin(angle) * 0.5 + 0.5); // normalizado

    // Scale premium — rango más comprimido, menos zoom agresivo
    const scale = THREE.MathUtils.lerp(0.75, 1.1, depth);
    mesh.scale.setScalar(scale);

    // Alpha con fade suave — los de atrás casi invisibles
    const alpha = THREE.MathUtils.lerp(0.15, 1.0, Math.pow(depth, 1.4));
    mesh.material.uniforms.uAlpha.value = alpha;
    mesh.material.uniforms.uTime.value = time;

    // RenderOrder preciso
    mesh.renderOrder = depth * 100;
  });
}

// =====================
// MOUSE
// =====================
container.addEventListener('mousemove', (event) => {
  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const point = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, point);
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
loader.load("https://3dlive.netlify.app/portfolio.glb", (gltf) => {
  glbModel = gltf.scene;
  scene.add(glbModel);
});

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