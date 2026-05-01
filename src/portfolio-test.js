import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from 'gsap';
import { GUI } from 'dat.gui';

const container = document.querySelector("._3d-element");

// Scene
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.1,
  100
);

camera.position.set(0, 3, 25);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// Light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(2, 2, 2);
scene.add(light);

const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableZoom = false;

// Cursor Light
const cursorLight = new THREE.PointLight(0xffffff, 10, 600);
cursorLight.position.set(0, 0, 0);
scene.add(cursorLight);

// Raycaster y Mouse
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

// Plano XY
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -8);

// Modelo GLB
let glbModel = null;
let intersecting = false;

// ===============================
// IMAGE PROJECTS WITH SHADER NOISE
// ===============================

const imageElements = [...document.querySelectorAll(".image-project")];

imageElements.forEach((img) => {
  img.style.opacity = "0";
  img.style.visibility = "hidden";
  img.style.pointerEvents = "none";
});

const imagePlanes = [];
const textureLoader = new THREE.TextureLoader();

const vertexShader = `
  varying vec2 vUv;
  uniform float uTime;

  void main() {
    vUv = uv;

    vec3 pos = position;

    pos.z += sin(pos.y * 8.0 + uTime * 2.0) * 0.04;
    pos.z += sin(pos.x * 10.0 + uTime * 1.5) * 0.025;

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

    float scanline = sin(uv.y * 140.0 + uTime * 8.0) * 0.012;
    uv.x += scanline;

    float glitchLine = step(0.985, random(vec2(floor(uv.y * 35.0), floor(uTime * 10.0))));
    uv.x += glitchLine * 0.04 * sin(uTime * 20.0);

    vec4 tex = texture2D(uTexture, uv);

    float noise = random(uv * vec2(900.0, 600.0) + uTime);
    tex.rgb += (noise - 0.5) * uNoiseStrength;

    float vignette = smoothstep(0.9, 0.25, distance(uv, vec2(0.5)));
    tex.rgb *= vignette;

    gl_FragColor = vec4(tex.rgb, tex.a * uAlpha);
  }
`;

imageElements.forEach((img, index) => {
  const texture = textureLoader.load(img.src);
  texture.colorSpace = THREE.SRGBColorSpace;

  const geometry = new THREE.PlaneGeometry(3.6, 2.3, 32, 32);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTexture: { value: texture },
      uTime: { value: 0 },
      uNoiseStrength: { value: 0.22 },
      uAlpha: { value: 0.85 },
    },
    vertexShader,
    fragmentShader,
  });

  const mesh = new THREE.Mesh(geometry, material);

  mesh.userData = {
    baseAngle: (index / imageElements.length) * Math.PI * 2,
    radius: 7.5,
    verticalOffset: index * 0.6,
  };

  scene.add(mesh);
  imagePlanes.push(mesh);
});

function animateImagePlanes(time) {
  imagePlanes.forEach((mesh, index) => {
    const angle = time * 0.35 + mesh.userData.baseAngle;

    const radius = mesh.userData.radius;

    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const y = Math.sin(time * 0.75 + index * 0.9) * 3.2;

    mesh.position.set(x, y, z);

    mesh.lookAt(camera.position);

    const depth = (Math.sin(angle) + 1) / 2;

    const scale = THREE.MathUtils.lerp(0.55, 1.15, depth);
    mesh.scale.set(scale, scale, scale);

    mesh.material.uniforms.uTime.value = time;
    mesh.material.uniforms.uAlpha.value = THREE.MathUtils.lerp(0.25, 0.95, depth);
    mesh.material.uniforms.uNoiseStrength.value = THREE.MathUtils.lerp(0.35, 0.12, depth);

    mesh.renderOrder = Math.round(depth * 10);
  });
}

// Mousemove general
container.addEventListener('mousemove', (event) => {
  const rect = container.getBoundingClientRect();

  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Movimiento de luz
  raycaster.setFromCamera(mouse, camera);

  const point = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, point);
  cursorLight.position.copy(point);

  // Detección sobre GLB
  if (glbModel) {
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
    } else if (intersects.length === 0 && intersecting) {
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
  }
});

// Cargar modelo
const loader = new GLTFLoader();

loader.load(
  "https://3dlive.netlify.app/portfolio.glb",
  (gltf) => {
    glbModel = gltf.scene;
    scene.add(glbModel);
  },
  (xhr) => {
    console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
  },
  (error) => {
    console.error("An error happened", error);
  }
);

// Responsive
window.addEventListener("resize", () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Loop
const clock = new THREE.Clock();

const animate = () => {
  requestAnimationFrame(animate);

  const time = clock.getElapsedTime();

  controls.update();

  animateImagePlanes(time);

  renderer.render(scene, camera);
};

animate();