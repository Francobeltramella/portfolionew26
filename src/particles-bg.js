import * as THREE from 'three';

// =====================
// SETUP
// =====================
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
const positions     = new Float32Array(particleCount * 3);
const origins       = new Float32Array(particleCount * 3);
const velocities    = [];

for (let i = 0; i < particleCount; i++) {
  const x = (Math.random() - 0.5) * 80;
  const y = (Math.random() - 0.5) * 50;
  const z = (Math.random() - 0.5) * 30 - 5;

  positions[i * 3]     = x;
  positions[i * 3 + 1] = y;
  positions[i * 3 + 2] = z;

  origins[i * 3]     = x;
  origins[i * 3 + 1] = y;
  origins[i * 3 + 2] = z;

  velocities.push({
    x:  (Math.random() - 0.5) * 0.007,
    y:  (Math.random() - 0.55) * 0.005,
    vx: 0,
    vy: 0,
  });
}

const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const particleMat = new THREE.PointsMaterial({
  color: 0xb8a99a,
  size: 0.11,
  transparent: true,
  opacity: 0.75,
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
const mouseWorld = new THREE.Vector3();
const raycaster  = new THREE.Raycaster();

window.addEventListener('mousemove', (e) => {
  mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  raycaster.ray.intersectPlane(mousePlane, mouseWorld);
});

window.addEventListener('mouseleave', () => {
  mouse.set(9999, 9999);
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
const REPULSION_RADIUS = 5.0;
const REPULSION_FORCE  = 0.18;
const RETURN_FORCE     = 0.012;
const DAMPING          = 0.88;

function animate() {
  requestAnimationFrame(animate);

  const pos = particles.geometry.attributes.position.array;

  for (let i = 0; i < particleCount; i++) {
    const ix = i * 3;
    const iy = i * 3 + 1;

    // Drift base
    velocities[i].vx += velocities[i].x * 0.1;
    velocities[i].vy += velocities[i].y * 0.1;

    // Repulsión del mouse
    const dx   = pos[ix] - mouseWorld.x;
    const dy   = pos[iy] - mouseWorld.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < REPULSION_RADIUS && dist > 0) {
      const force = (1 - dist / REPULSION_RADIUS) * REPULSION_FORCE;
      velocities[i].vx += (dx / dist) * force;
      velocities[i].vy += (dy / dist) * force;
    }

    // Retorno suave al origen
    velocities[i].vx += (origins[ix] - pos[ix]) * RETURN_FORCE;
    velocities[i].vy += (origins[iy] - pos[iy]) * RETURN_FORCE;

    // Damping
    velocities[i].vx *= DAMPING;
    velocities[i].vy *= DAMPING;

    // Aplicar velocidad
    pos[ix] += velocities[i].vx;
    pos[iy] += velocities[i].vy;

    // Wrap
    if (pos[ix] > 42)  pos[ix] = -42;
    if (pos[ix] < -42) pos[ix] =  42;
    if (pos[iy] > 27)  pos[iy] = -27;
    if (pos[iy] < -27) pos[iy] =  27;
  }

  particles.geometry.attributes.position.needsUpdate = true;
  renderer.render(scene, camera);
}

animate();