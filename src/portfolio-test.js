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
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true
});

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

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

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
// SHADERS
// =====================
const vertexShader = `
  varying vec2 vUv;
  uniform float uTime;

  void main() {
    vUv = uv;

    vec3 pos = position;

    // curva horizontal
    float bend = sin(pos.x * 1.2) * 0.6;
    pos.z += bend;

    // leve wave
    pos.z += sin(pos.y * 6.0 + uTime * 2.0) * 0.05;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uNoiseStrength;
  uniform float uAlpha;

  varying vec2 vUv;

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  void main() {
    vec2 uv = vUv;

    vec4 tex = texture2D(uTexture, uv);

    float noise = random(uv * 800.0 + uTime);
    tex.rgb += (noise - 0.5) * uNoiseStrength;

    tex.rgb = mix(tex.rgb, tex.rgb * 1.15, 0.3);

    gl_FragColor = vec4(tex.rgb, tex.a * uAlpha);
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

imageElements.forEach((img, index) => {
  const texture = textureLoader.load(img.src);
  texture.colorSpace = THREE.SRGBColorSpace;

  const geometry = new THREE.PlaneGeometry(4.5, 2.8, 64, 64);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTexture: { value: texture },
      uTime: { value: 0 },
      uNoiseStrength: { value: 0.08 },
      uAlpha: { value: 0.9 }
    },
    vertexShader,
    fragmentShader
  });

  const mesh = new THREE.Mesh(geometry, material);

  mesh.userData = {
    baseAngle: (index / imageElements.length) * Math.PI * 2,
    radius: 10
  };

  scene.add(mesh);
  imagePlanes.push(mesh);
});

// =====================
// ANIMATION SPIRAL
// =====================
function animateImages(time) {
  imagePlanes.forEach((mesh, index) => {
    const angle = time * 0.35 + mesh.userData.baseAngle;

    const radius = mesh.userData.radius;

    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const y = index * 0.9 - 2 + Math.sin(time * 0.6 + index) * 0.5;

    mesh.position.set(x, y, z);

    mesh.lookAt(camera.position);

    const depth = (Math.sin(angle) + 1) / 2;

    const scale = THREE.MathUtils.lerp(0.6, 1.2, depth);
    mesh.scale.set(scale, scale, scale);

    mesh.material.uniforms.uTime.value = time;
    mesh.material.uniforms.uAlpha.value = THREE.MathUtils.lerp(0.3, 1.0, depth);

    mesh.renderOrder = Math.round(depth * 10);
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

loader.load(
  "https://3dlive.netlify.app/portfolio.glb",
  (gltf) => {
    glbModel = gltf.scene;
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