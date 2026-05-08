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
// SHADERS — NIVEL AWWWARDS
// =====================
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vInfluence;
  uniform float uTime;
  uniform float uArcAngle;
  uniform float uRadius;
  uniform float uAngleOffset;
  uniform vec3 uMouse3D;
  uniform float uHoverStrength;

  void main() {
    vUv = uv;

    float t = position.x / 5.4;
    float localAngle = t * uArcAngle;
    float worldAngle = uAngleOffset + localAngle;

    vec3 pos;
    pos.x = cos(worldAngle) * uRadius;
    pos.z = sin(worldAngle) * uRadius;
    pos.y = position.y;

    // Normal radial del cilindro
    vec3 nor = normalize(vec3(cos(worldAngle), 0.0, sin(worldAngle)));

    // Distancia al cursor en espacio local
    float dist = distance(pos, uMouse3D);

    // Influencia con falloff suave — radio más grande para efecto más épico
    float influence = 1.0 - smoothstep(0.0, 5.0, dist);
    influence = pow(influence, 1.4); // curva más dramática
    vInfluence = influence;

    // ── EFECTO 1: Bulge hacia afuera (push radial) ──
    float bulge = influence * uHoverStrength * 1.1;
    pos += nor * bulge;

    // ── EFECTO 2: Hollow/sink en el centro exacto del cursor ──
    // El centro se hunde levemente, creando forma de "membrana presionada"
    float innerDist = distance(pos.xz, uMouse3D.xz);
    float innerInfluence = 1.0 - smoothstep(0.0, 1.8, innerDist);
    innerInfluence = pow(innerInfluence, 2.0);
    pos -= nor * innerInfluence * uHoverStrength * 0.55;

    // ── EFECTO 3: Wave ripple primaria — se expande desde el cursor ──
    float wave1 = sin(dist * 3.2 - uTime * 5.0) * influence * uHoverStrength * 0.18;
    pos += nor * wave1;

    // ── EFECTO 4: Wave secundaria perpendicular — movimiento en Y ──
    float wave2 = sin(dist * 2.0 - uTime * 3.5 + 1.57) * influence * uHoverStrength * 0.10;
    pos.y += wave2;

    // ── EFECTO 5: Micro turbulencia en los bordes del influence ──
    float edgeTurb = sin(pos.y * 6.0 + uTime * 4.0) * (influence * (1.0 - influence) * 4.0) * uHoverStrength * 0.08;
    pos += nor * edgeTurb;

    vec3 norFinal = normalize(vec3(cos(worldAngle), 0.0, sin(worldAngle)));
    vNormal = normalize(normalMatrix * norFinal);

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
  uniform vec3 uMouse3D;
  uniform float uHoverStrength;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vInfluence;

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  // Value noise suave
  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec2 uv = vUv;
    float inf = vInfluence * uHoverStrength;

    // ── UV LENS: deformación tipo lente de agua ──
    vec2 center = vec2(0.5);
    vec2 toCenter = uv - center;
    float lensDist = length(toCenter);

    // Lente que magnifica en el centro del influence
    vec2 lensUV = uv + toCenter * inf * 0.22 * (1.0 - lensDist * 1.5);

    // ── RIPPLE UV animado ──
    float ripple = sin(lensDist * 12.0 - uTime * 4.5) * inf * 0.028;
    lensUV += normalize(toCenter + 0.001) * ripple;

    // ── ABERRACIÓN CROMÁTICA ──
    // Cada canal RGB samplea desde un UV levemente diferente
    float aberration = inf * 0.032;
    vec2 aberDir = normalize(toCenter + 0.001);

    float r = texture2D(uTexture, lensUV + aberDir * aberration * 1.0).r;
    float g = texture2D(uTexture, lensUV).g;
    float b = texture2D(uTexture, lensUV - aberDir * aberration * 1.0).b;
    float a = texture2D(uTexture, lensUV).a;

    vec4 tex = vec4(r, g, b, a);

    // ── BRIGHTENING + HOT SPOT en el centro ──
    // Un highlight puntual tipo reflejo de luz en agua
    float hotspot = pow(1.0 - smoothstep(0.0, 0.35, lensDist), 3.0) * inf;
    tex.rgb += hotspot * 0.45;

    // Brightening general en el área de influencia
    tex.rgb += inf * 0.12;

    // ── GLOW EN EL BORDE DE LA DEFORMACIÓN ──
    // Donde la influencia pasa de 0 a 1 — anillo luminoso
    float edgeGlow = smoothstep(0.0, 0.5, inf) * (1.0 - smoothstep(0.5, 1.0, inf));
    edgeGlow = pow(edgeGlow, 0.8);
    tex.rgb += edgeGlow * vec3(0.9, 0.95, 1.0) * 0.25;

    // ── GRAIN cinematic ──
    float grain = random(uv * 520.0 + uTime * 0.4);
    tex.rgb += (grain - 0.5) * uNoiseStrength;

    // ── LIGHTING lateral + rim ──
    float lateralLight = clamp(dot(vNormal, normalize(vec3(1.0, 0.5, 1.0))), 0.0, 1.0);
    float rimDark = 1.0 - clamp(dot(vNormal, normalize(vec3(0.0, 0.0, 1.0))), 0.0, 1.0);
    tex.rgb *= 0.6 + lateralLight * 0.5;
    tex.rgb *= 1.0 - rimDark * 0.35;

    // ── COLOR GRADING ──
    tex.rgb = pow(tex.rgb, vec3(0.95));
    tex.rgb = mix(tex.rgb, tex.rgb * vec3(1.05, 1.0, 0.97), 0.4);

    // ── VIGNETTE ──
    float vignette = smoothstep(0.62, 0.08, length(uv - 0.5));
    tex.rgb *= 0.76 + vignette * 0.24;

    gl_FragColor = vec4(tex.rgb, uAlpha);
  }
`;

// =====================
// IMAGE PLANES
// =====================
const imageElements = [...document.querySelectorAll(".image-project")].slice(0, 8);
imageElements.forEach(img => {
  img.style.opacity = "0";
  img.style.visibility = "hidden";
});

const textureLoader = new THREE.TextureLoader();
const imagePlanes = [];

const ORBIT_RADIUS = 6.5;
const CARD_W = 5.4;
const CARD_H = 3.05;
const TOTAL = imageElements.length;
const GAP = 0.95;
const ARC_PER_CARD = ((Math.PI * 2) / TOTAL) * GAP;

const cylinderGroup = new THREE.Group();
scene.add(cylinderGroup);

const mouse3DWorld = new THREE.Vector3(9999, 9999, 9999);
const mouse3DLocal = new THREE.Vector3(9999, 9999, 9999);
const mouse3DLocalSmooth = new THREE.Vector3(9999, 9999, 9999);

let hoverStrength = 0;

imageElements.forEach((img, index) => {
  const texture = textureLoader.load(img.src);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const geometry = new THREE.PlaneGeometry(CARD_W, CARD_H, 100, 40);
  const angleOffset = (index / TOTAL) * Math.PI * 2;

  const material = new THREE.ShaderMaterial({
    transparent: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
    uniforms: {
      uTexture: { value: texture },
      uTime: { value: 0 },
      uNoiseStrength: { value: 0.018 },
      uAlpha: { value: 1.0 },
      uArcAngle: { value: ARC_PER_CARD },
      uRadius: { value: ORBIT_RADIUS },
      uAngleOffset: { value: angleOffset },
      uMouse3D: { value: mouse3DLocalSmooth },
      uHoverStrength: { value: 0.0 },
    },
    vertexShader,
    fragmentShader
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = -3.0;
  mesh.renderOrder = 0;

  cylinderGroup.add(mesh);
  imagePlanes.push(mesh);
});

// =====================
// ANIMATE
// =====================
function animateImages(time) {
  cylinderGroup.rotation.y = time * 0.28;

  mouse3DLocal.copy(mouse3DWorld);
  cylinderGroup.worldToLocal(mouse3DLocal);
  mouse3DLocalSmooth.lerp(mouse3DLocal, 0.07);

  imagePlanes.forEach((mesh, index) => {
    mesh.material.uniforms.uTime.value = time;
    mesh.material.uniforms.uAlpha.value = 1.0;
    mesh.material.uniforms.uHoverStrength.value = hoverStrength;

    const baseAngle = (index / TOTAL) * Math.PI * 2;
    const currentAngle = cylinderGroup.rotation.y + baseAngle;
    const worldZ = Math.sin(currentAngle) * ORBIT_RADIUS;

    const normalized = (worldZ / ORBIT_RADIUS) * 0.5 + 0.5;
    mesh.renderOrder = Math.round(normalized * 19) + 1;
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

  // Cursor light
  const lightPoint = new THREE.Vector3();
  raycaster.ray.intersectPlane(planeMouse, lightPoint);
  cursorLight.position.copy(lightPoint);

  // ✅ Proyección al frente del cilindro con perspectiva correcta
  const origin = camera.position.clone();
  const dir = new THREE.Vector3(mouse.x, mouse.y, 0.5)
    .unproject(camera)
    .sub(origin)
    .normalize();

  const tFront = (ORBIT_RADIUS - origin.z) / dir.z;
  mouse3DWorld.set(
    origin.x + dir.x * tFront,
    origin.y + dir.y * tFront + 3.0,
    ORBIT_RADIUS
  );

  gsap.to({ v: hoverStrength }, {
    v: 1.0,
    duration: 0.35,
    onUpdate: function() { hoverStrength = this.targets()[0].v; }
  });

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

container.addEventListener('mouseleave', () => {
  mouse3DWorld.set(9999, 9999, 9999);
  gsap.to({ v: hoverStrength }, {
    v: 0.0,
    duration: 0.7,
    onUpdate: function() { hoverStrength = this.targets()[0].v; }
  });
});

// =====================
// LOAD MODEL
// =====================
const loader = new GLTFLoader();
loader.load(
  "https://3dlive.netlify.app/portfolio.glb",
  (gltf) => {
    glbModel = gltf.scene;
    glbModel.position.set(0, 0, -2);
    glbModel.traverse(child => {
      if (child.isMesh) {
        child.renderOrder = 10;
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

// =====================
// LOADING
// =====================
const tl = gsap.timeline({
  defaults: { ease: "power2.out" },
  delay: 1.4,
  onComplete: () => {
    document.querySelector(".loading-wrapper").style.pointerEvents = "none";
  },
});

tl.to(".bg-color-courting", {
  x: "100%",
  duration: 4.2,
  stagger: { each: 0.45 },
}, 0);

tl.to(".heading-2", {
  x: "100%",
  duration: 3.6,
  stagger: { each: 0.38 },
}, 0.2);

tl.to(".courting-wrapper", {
  y: "100%",
  duration: 1.8,
  ease: "power2.inOut",
  stagger: {
    amount: 0.5,
    from: "end",
  },
}, "-=1.0");