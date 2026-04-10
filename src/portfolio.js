import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from 'gsap';
import { GUI } from 'dat.gui';

const container = document.querySelector("._3d-element");

// Scene
const scene = new THREE.Scene(); // No le pongas background

// Camera
const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.1,
  100
);
camera.position.set(0, 3, 24);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setSize(container.clientWidth, container.clientHeight);
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

const lightHelper = new THREE.PointLightHelper(cursorLight, 2);
//scene.add(lightHelper);

// Raycaster y Mouse
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

// Plano XY a z = 7.3
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -8);
const planeHelper = new THREE.PlaneHelper(plane, 5, 0xff0000);
//scene.add(planeHelper);

// Modelo GLB
let glbModel = null;
let intersecting = false; // bandera para saber si estamos sobre el modelo

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
        opacity:0,
        duration: 0.4,
      });
      gsap.to(".hover", {
        opacity:1,
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
        opacity:1,
        duration: 0.4,
      });
      gsap.to(".hover", {
        opacity:0,
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
});

// Loop
const animate = () => {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
};

animate();
