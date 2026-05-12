import * as THREE from 'three';

// =====================
// SETUP
// =====================
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 0, 28);

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.domElement.classList.add('spline-bg');
document.body.appendChild(renderer.domElement);

// =====================
// PARTICLES
// =====================
const particleCount = 8000;
const positions     = new Float32Array(particleCount * 3);
const velocities    = [];

for (let i = 0; i < particleCount; i++) {
  const x = (Math.random() - 0.5) * 100;
  const y = (Math.random() - 0.5) * 60;
  const z = (Math.random() - 0.5) * 20 - 5;

  positions[i * 3]     = x;
  positions[i * 3 + 1] = y;
  positions[i * 3 + 2] = z;

  // Movimiento libre — dirección y velocidad aleatoria suave
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.008 + Math.random() * 0.012;

  velocities.push({
    bx: Math.cos(angle) * speed,  // velocidad base x
    by: Math.sin(angle) * speed,  // velocidad base y
    vx: 0,                         // velocidad acumulada x
    vy: 0,                         // velocidad acumulada y
  });
}

const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const particleMat = new THREE.PointsMaterial({
  color: 0x8a7a6a,
  size: 1.095,
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
  sizeAttenuation: true,
});

const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

// =====================
// MOUSE EN WORLD SPACE
// =====================
const mouse      = new THREE.Vector2(9999, 9999);
const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 5);
const mouseWorld = new THREE.Vector3(9999, 9999, 9999);
const raycaster  = new THREE.Raycaster();

window.addEventListener('mousemove', (e) => {
  mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  raycaster.ray.intersectPlane(mousePlane, mouseWorld);
});

window.addEventListener('mouseleave', () => {
  mouseWorld.set(9999, 9999, 9999);
});

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
const REPULSION_RADIUS = 5.5;
const REPULSION_FORCE  = 0.14;   // suave
const DAMPING          = 0.94;   // más flotante, más premium
const BASE_WEIGHT      = 0.96;   // cuánto peso tiene la vel base vs la perturbación

function animate() {
  requestAnimationFrame(animate);

  const pos = particles.geometry.attributes.position.array;

  for (let i = 0; i < particleCount; i++) {
    const ix = i * 3;
    const iy = i * 3 + 1;

    // Movimiento base continuo — siempre se mueven
    velocities[i].vx = velocities[i].vx * BASE_WEIGHT + velocities[i].bx * (1 - BASE_WEIGHT);
    velocities[i].vy = velocities[i].vy * BASE_WEIGHT + velocities[i].by * (1 - BASE_WEIGHT);

    // Repulsión suave del mouse
    const dx   = pos[ix] - mouseWorld.x;
    const dy   = pos[iy] - mouseWorld.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < REPULSION_RADIUS && dist > 0) {
      const force = (1 - dist / REPULSION_RADIUS) * REPULSION_FORCE;
      velocities[i].vx += (dx / dist) * force;
      velocities[i].vy += (dy / dist) * force;
    }

    // Damping
    velocities[i].vx *= DAMPING;
    velocities[i].vy *= DAMPING;

    // Aplicar
    pos[ix] += velocities[i].vx;
    pos[iy] += velocities[i].vy;

    // Wrap infinito — reaparecen del otro lado
    if (pos[ix] > 50)  pos[ix] = -50;
    if (pos[ix] < -50) pos[ix] =  50;
    if (pos[iy] > 30)  pos[iy] = -30;
    if (pos[iy] < -30) pos[iy] =  30;
  }

  particles.geometry.attributes.position.needsUpdate = true;
  renderer.render(scene, camera);
}

animate();