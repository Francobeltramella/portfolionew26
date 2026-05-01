import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import gsap from "gsap";

const container = document.querySelector("._3d-element");

// Images from DOM
const imageElements = [...document.querySelectorAll(".image-project")];

// Scene
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.1,
  100
);

camera.position.set(0, 2.5, 18);

// Renderer
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
});

renderer.setClearColor(0x000000, 0);
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// Lights
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.4);
directionalLight.position.set(3, 4, 5);
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableZoom = false;

// Cursor Light
const cursorLight = new THREE.PointLight(0xffffff, 8, 500);
scene.add(cursorLight);

// Raycaster
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -8);

let glbModel = null;
let intersecting = false;

// Shader
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;

  uniform float uTime;
  uniform float uHover;

  void main() {
    vUv = uv;
    vPosition = position;

    vec3 pos = position;

    float wave = sin(pos.y * 8.0 + uTime * 2.0) * 0.035;
    pos.z += wave * uHover;

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

    float scanline = sin(uv.y * 120.0 + uTime * 8.0) * 0.015;
    uv.x += scanline;

    float glitch = step(0.985, random(vec2(floor(uv.y * 40.0), floor(uTime * 12.0))));
    uv.x += glitch * 0.05 * sin(uTime * 20.0);

    vec4 tex = texture2D(uTexture, uv);

    float noise = random(uv * vec2(900.0, 500.0) + uTime);
    tex.rgb += (noise - 0.5) * uNoiseStrength;

    float vignette = smoothstep(0.9, 0.25, distance(uv, vec2(0.5)));
    tex.rgb *= vignette;

    gl_FragColor = vec4(tex.rgb, tex.a * uAlpha);
  }
`;

// Hide DOM images
imageElements.forEach((img) => {
  img.style.opacity = "0";
  img.style.pointerEvents = "none";
});

// Image planes
const textureLoader = new THREE.TextureLoader();
const imagePlanes = [];

imageElements.forEach((img, index) => {
  const texture = textureLoader.load(img.src);
  texture.colorSpace = THREE.SRGBColorSpace;

  const geometry = new THREE.PlaneGeometry(3.2, 2.1, 32, 32);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTexture: { value: texture },
      uTime: { value: 0 },
      uNoiseStrength: { value: 0.18 },
      uAlpha: { value: 0.85 },
      uHover: { value: 1 },
    },
    vertexShader,
    fragmentShader,
  });

  const mesh = new THREE.Mesh(geometry, material);

  mesh.userData = {
    index,
    angle: (index / imageElements.length) * Math.PI * 2,
    radius: 6.5,
    yOffset: index * 0.65,
  };

  scene.add(mesh);
  imagePlanes.push(mesh);
});

// Load model
const loader = new GLTFLoader();

loader.load(
  "https://3dlive.netlify.app/portfolio.glb",
  (gltf) => {
    glbModel = gltf.scene;

    glbModel.scale.set(1, 1, 1);
    glbModel.position.set(0, 0, 0);

    scene.add(glbModel);
  },
  (xhr) => {
    console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
  },
  (error) => {
    console.error("An error happened", error);
  }
);

// Mouse move
container.addEventListener("mousemove", (event) => {
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

    gsap.to(document.body, {
      backgroundColor: "#000000",
      duration: 0.4,
    });

    gsap.to(".no-hover", {
      opacity: 0,
      duration: 0.4,
    });

    gsap.to(".hover", {
      opacity: 1,
      duration: 0.4,
    });

    gsap.to(".hover-black", {
      color: "#F4F1EA",
      duration: 0.4,
    });
  }

  if (intersects.length === 0 && intersecting) {
    intersecting = false;

    gsap.to(document.body, {
      backgroundColor: "#F4F1EA",
      duration: 0.4,
    });

    gsap.to(".no-hover", {
      opacity: 1,
      duration: 0.4,
    });

    gsap.to(".hover", {
      opacity: 0,
      duration: 0.4,
    });

    gsap.to(".hover-black", {
      color: "#000000",
      duration: 0.4,
    });
  }
});

// Animate image spiral
const clock = new THREE.Clock();

function animateImagePlanes(time) {
  imagePlanes.forEach((mesh, i) => {
    const angle = time * 0.35 + mesh.userData.angle;

    const radius = mesh.userData.radius;

    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const spiralY = Math.sin(time * 0.7 + i * 0.8) * 2.2;

    mesh.position.set(x, spiralY, z);

    mesh.lookAt(camera.position);

    const depth = (Math.sin(angle) + 1) / 2;

    const scale = THREE.MathUtils.lerp(0.65, 1.25, depth);
    mesh.scale.set(scale, scale, scale);

    mesh.material.uniforms.uTime.value = time;
    mesh.material.uniforms.uAlpha.value = THREE.MathUtils.lerp(0.25, 0.95, depth);
    mesh.material.uniforms.uNoiseStrength.value = THREE.MathUtils.lerp(0.32, 0.12, depth);

    mesh.renderOrder = Math.round(depth * 10);
  });
}

// Resize
window.addEventListener("resize", () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Loop
function animate() {
  requestAnimationFrame(animate);

  const time = clock.getElapsedTime();

  controls.update();

  animateImagePlanes(time);

  if (glbModel) {
    glbModel.rotation.y += 0.002;
  }

  renderer.render(scene, camera);
}

animate();