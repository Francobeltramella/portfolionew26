import * as THREE from 'three';

// =====================
// SETUP
// =====================
const container = document.querySelector(".spline-bg");

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(0, 0, 28);

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
renderer.domElement.style.pointerEvents = 'none';
renderer.domElement.style.zIndex = '0';
document.body.appendChild(renderer.domElement);

// =====================
// PARTICLES
// =====================
const particleCount = 3500;
const positions = new Float32Array(particleCount * 3);
const velocities = [];

for (let i = 0; i < particleCount; i++) {
  positions[i * 3]     = (Math.random() - 0.5) * 80;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 30 - 5;

  velocities.push({
    x: (Math.random() - 0.5) * 0.007,
    y: (Math.random() - 0.55) * 0.005, // drift leve hacia arriba
  });
}

const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const particleMat = new THREE.PointsMaterial({
  color: 0xb8a99a,   // beige/arena — ajustá si querés más frío o más cálido
  size: 0.07,
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
  sizeAttenuation: true,
});

const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

// =====================
// RESIZE
// =====================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// =====================
// LOOP
// =====================
function animate() {
  requestAnimationFrame(animate);

  const pos = particles.geometry.attributes.position.array;

  for (let i = 0; i < particleCount; i++) {
    pos[i * 3]     += velocities[i].x;
    pos[i * 3 + 1] += velocities[i].y;

    // Wrap horizontal
    if (pos[i * 3] > 40)  pos[i * 3] = -40;
    if (pos[i * 3] < -40) pos[i * 3] = 40;

    // Wrap vertical
    if (pos[i * 3 + 1] > 25)  pos[i * 3 + 1] = -25;
    if (pos[i * 3 + 1] < -25) pos[i * 3 + 1] = 25;
  }

  particles.geometry.attributes.position.needsUpdate = true;

  renderer.render(scene, camera);
}

animate();