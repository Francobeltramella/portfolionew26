import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from 'gsap';

const container = document.querySelector("._3d-element");

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.1,
  100
);
camera.position.set(0, 0, 28);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.sortObjects = true;
container.appendChild(renderer.domElement);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(2, 3, 4);
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const cursorLight = new THREE.PointLight(0xffffff, 8, 500);
scene.add(cursorLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableZoom = false;

// =====================
// SHADERS — cada card ES un arco del cilindro
// =====================
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  uniform float uTime;
  uniform float uArcAngle;   // ángulo que ocupa esta card en el círculo (radianes)
  uniform float uRadius;     // radio del cilindro
  uniform float uAngleOffset;// ángulo base de esta card en el círculo

  void main() {
    vUv = uv;

    // uv.x va de 0 a 1 a lo largo de la card
    // lo mapeamos al arco que le corresponde en el círculo
    float t = uv.x - 0.5; // -0.5 a 0.5
    float localAngle = t * uArcAngle; // ángulo local dentro del arco
    float worldAngle = uAngleOffset + localAngle;

    // Posición en el cilindro
    vec3 pos;
    pos.x = cos(worldAngle) * uRadius;
    pos.z = sin(worldAngle) * uRadius;
    pos.y = position.y; // altura del vértice original

    // Normal apunta hacia afuera del cilindro
    vec3 nor = normalize(vec3(cos(worldAngle), 0.0, sin(worldAngle)));
    vNormal = normalize(normalMatrix * nor);

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

    // Edge fade solo en Y (arriba/abajo) — en X se unen seamless
    float edgeY = smoothstep(0.0, 0.06, uv.y) * smoothstep(1.0, 0.94, uv.y);

    // Fade lateral suave para que se unan las cards
    float edgeX = smoothstep(0.0, 0.04, uv.x) * smoothstep(1.0, 0.96, uv.x);

    vec4 tex = texture2D(uTexture, uv);

    // Grain sutil
    float noise = random(uv * 480.0 + uTime * 0.35);
    tex.rgb += (noise - 0.5) * uNoiseStrength;

    // Fresnel
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - clamp(dot(viewDir, vNormal), 0.0, 1.0), 2.5);
    tex.rgb += fresnel * 0.04;

    // Vignette
    float vignette = smoothstep(0.55, 0.18, length(uv - 0.5));
    tex.rgb *= 0.82 + vignette * 0.18;

    gl_FragColor = vec4(tex.rgb, tex.a * uAlpha * edgeY * edgeX);
  }
`;

// =====================
// IMAGE PLANES — forman el cilindro
// =====================
const imageElements = [...document.querySelectorAll(".image-project")];
imageElements.forEach(img => {
  img.style.opacity = "0";
  img.style.visibility = "hidden";
});

const textureLoader = new THREE.TextureLoader();
const imagePlanes = [];

const ORBIT_RADIUS = 8;
const CARD_H = 3.2;
const TOTAL = imageElements.length;

// Cada card ocupa su porción del círculo completo
const ARC_PER_CARD = (Math.PI * 2) / TOTAL;

// Pivot group que rota todo el cilindro
const cylinderGroup = new THREE.Group();
scene.add(cylinderGroup);

imageElements.forEach((img, index) => {
  const texture = textureLoader.load(img.src);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  // Segmentos X altos para que la curva sea suave
  const geometry = new THREE.PlaneGeometry(1, CARD_H, 60, 1);

  const angleOffset = (index / TOTAL) * Math.PI * 2;

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    uniforms: {
      uTexture: { value: texture },
      uTime: { value: 0 },
      uNoiseStrength: { value: 0.022 },
      uAlpha: { value: 0.92 },       // opacity uniforme para todas
      uArcAngle: { value: ARC_PER_CARD },
      uRadius: { value: ORBIT_RADIUS },
      uAngleOffset: { value: angleOffset },
    },
    vertexShader,
    fragmentShader
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = -1.5;
  mesh.renderOrder = 5;

  cylinderGroup.add(mesh);
  imagePlanes.push(mesh);
});

// =====================
// ANIMATE — rota el grupo entero
// =====================
function animateImages(time) {
  // Rotamos el grupo en Y — todas las cards se mueven juntas formando el cilindro
  cylinderGroup.rotation.y = time * 0.28;

  imagePlanes.forEach((mesh) => {
    mesh.material.uniforms.uTime.value = time;
    // Alpha uniforme — todas igual
    mesh.material.uniforms.uAlpha.value = 0.92;
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
    glbModel.position.set(0, 0, -6);
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