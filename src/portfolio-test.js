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
// SHADERS
// =====================
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
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

    float dist = distance(pos, uMouse3D);
    float influence = 1.0 - smoothstep(0.0, 3.5, dist);

    vec3 nor = normalize(vec3(cos(worldAngle), 0.0, sin(worldAngle)));
    pos += nor * influence * uHoverStrength * 0.6;

    float wave = sin(dist * 2.5 - uTime * 4.0) * influence * uHoverStrength * 0.15;
    pos += nor * wave;

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

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  void main() {
    vec2 uv = vUv;

    float edgeY = smoothstep(0.0, 0.06, uv.y) * smoothstep(1.0, 0.94, uv.y);

    vec4 tex = texture2D(uTexture, uv);

    float dist = distance(vWorldPos, uMouse3D);
    float influence = 1.0 - smoothstep(0.0, 3.5, dist);

    vec2 uvDistorted = uv;
    uvDistorted += (uv - 0.5) * influence * uHoverStrength * 0.08;
    uvDistorted.x += sin(uv.y * 8.0 + uTime * 3.0) * influence * uHoverStrength * 0.015;
    uvDistorted.y += sin(uv.x * 8.0 + uTime * 3.0) * influence * uHoverStrength * 0.015;

    tex = texture2D(uTexture, uvDistorted);

    tex.rgb += influence * uHoverStrength * 0.18;

    float noise = random(uv * 480.0 + uTime * 0.35);
    tex.rgb += (noise - 0.5) * uNoiseStrength;

    float lateralLight = clamp(dot(vNormal, normalize(vec3(1.0, 0.5, 1.0))), 0.0, 1.0);
    float rimDark = 1.0 - clamp(dot(vNormal, normalize(vec3(0.0, 0.0, 1.0))), 0.0, 1.0);
    tex.rgb *= 0.6 + lateralLight * 0.5;
    tex.rgb *= 1.0 - rimDark * 0.35;

    tex.rgb = pow(tex.rgb, vec3(0.95));
    tex.rgb = mix(tex.rgb, tex.rgb * vec3(1.05, 1.0, 0.97), 0.4);

    float vignette = smoothstep(0.6, 0.1, length(uv - 0.5));
    tex.rgb *= 0.78 + vignette * 0.22;

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

const mouse3D = new THREE.Vector3(9999, 9999, 9999);
const mouse3DSmooth = new THREE.Vector3(9999, 9999, 9999);
let hoverStrength = 0;

imageElements.forEach((img, index) => {
  const texture = textureLoader.load(img.src);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const geometry = new THREE.PlaneGeometry(CARD_W, CARD_H, 80, 20);
  const angleOffset = (index / TOTAL) * Math.PI * 2;

  const material = new THREE.ShaderMaterial({
    transparent: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
    uniforms: {
      uTexture: { value: texture },
      uTime: { value: 0 },
      uNoiseStrength: { value: 0.022 },
      uAlpha: { value: 1.0 },
      uArcAngle: { value: ARC_PER_CARD },
      uRadius: { value: ORBIT_RADIUS },
      uAngleOffset: { value: angleOffset },
      uMouse3D: { value: mouse3DSmooth },
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
  mouse3DSmooth.lerp(mouse3D, 0.08);

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

const cylinderPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -ORBIT_RADIUS);

container.addEventListener('mousemove', (event) => {
  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const point = new THREE.Vector3();
  raycaster.ray.intersectPlane(planeMouse, point);
  cursorLight.position.copy(point);

  const cylinderPoint = new THREE.Vector3();
  raycaster.ray.intersectPlane(cylinderPlane, cylinderPoint);
  if (cylinderPoint) {
    mouse3D.copy(cylinderPoint);
    mouse3D.y -= 3.0;
  }

  gsap.to({ v: hoverStrength }, {
    v: 1.0,
    duration: 0.4,
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
  mouse3D.set(9999, 9999, 9999);
  gsap.to({ v: hoverStrength }, {
    v: 0.0,
    duration: 0.6,
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
    // El callback de GLTFLoader llega en el main thread justo
    // entre frames. Diferimos 2 rAF para que no pise una animación
    // GSAP activa — el parse ya terminó, solo queda el scene.add
    // que dispara el shader compile + upload a GPU.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        glbModel = gltf.scene;
        glbModel.position.set(0, 0, -2);

        glbModel.traverse(child => {
          if (child.isMesh) {
            child.renderOrder = 10;
          }
        });

        scene.add(glbModel);

        // Compila shaders en este frame "vacío" antes de que
        // el usuario interactúe — evita el hitch en el primer hover.
        renderer.compile(scene, camera);
      });
    });
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
gsap.set([".bg-color-courting", ".heading-2", ".courting-wrapper"], {
    force3D: true,
    willChange: "transform",
  });
  
  const tl = gsap.timeline({
    defaults: {
      ease: "power3.inOut",
    },
    onComplete: () => {
      const loading = document.querySelector(".loading-wrapper");
      if (loading) {
        loading.style.pointerEvents = "none";
        loading.style.visibility = "hidden";
      }
    },
  });
  
  tl.to(".bg-color-courting", {
    xPercent: 100,
    duration: 2.4,
    stagger: {
      each: 0.18,
      ease: "power2.out",
    },
  });
  
  tl.to(
    ".heading-2",
    {
      xPercent: 100,
      duration: 2.2,
      ease: "expo.inOut",
      stagger: {
        each: 0.16,
      },
    },
    "-=2.1"
  );
  
  tl.to(".courting-wrapper", {
    yPercent: 100,
    duration: 1.8,
    ease: "expo.inOut",
    stagger: {
      amount: 0.45,
      from: "end",
    },
  });