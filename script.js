import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';


export function startGameScene() {
  
  // Perlin Noise Implementation 
  class PerlinNoise {
  constructor() {
    this.grad3 = [
      [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
      [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
      [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
    ];
    this.p = [];
    for (let i = 0; i < 256; i++) this.p[i] = Math.floor(Math.random() * 256);
    this.perm = [];
    for (let i = 0; i < 512; i++) this.perm[i] = this.p[i & 255];
  }
  dot(g, x, y) {
    return g[0] * x + g[1] * y;
  }
  mix(a, b, t) {
    return (1.0 - t) * a + t * b;
  }
  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  noise(x, y) {
    let X = Math.floor(x) & 255;
    let Y = Math.floor(y) & 255;
    let xf = x - Math.floor(x);
    let yf = y - Math.floor(y);
    let topRight = this.perm[X + 1 + this.perm[Y + 1]] % 12;
    let topLeft = this.perm[X + this.perm[Y + 1]] % 12;
    let bottomRight = this.perm[X + 1 + this.perm[Y]] % 12;
    let bottomLeft = this.perm[X + this.perm[Y]] % 12;
    let dotTopRight = this.dot(this.grad3[topRight], xf - 1, yf - 1);
    let dotTopLeft = this.dot(this.grad3[topLeft], xf, yf - 1);
    let dotBottomRight = this.dot(this.grad3[bottomRight], xf - 1, yf);
    let dotBottomLeft = this.dot(this.grad3[bottomLeft], xf, yf);
    let u = this.fade(xf);
    let v = this.fade(yf);
    let lerpTop = this.mix(dotTopLeft, dotTopRight, u);
    let lerpBottom = this.mix(dotBottomLeft, dotBottomRight, u);
    return this.mix(lerpBottom, lerpTop, v);
  }
}

// Three.js setup
const container = document.getElementById('container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xcce0ff, 0.0025);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87ceeb);
container.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(100, 200, 100);
scene.add(directionalLight);
const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
directionalLight2.position.set(-100, 50, -100);
/*scene.add(directionalLight2);*/

// Terrain chunk parameters
const chunkSize = 50;
const segments = 32;
const amplitude = 7;
const frequency = 0.08;

const noiseGen = new PerlinNoise();

// Material Setup
const terrainMaterial = new THREE.MeshStandardMaterial({
  color: 0x354f1f,
  roughness: 1,
  metalness: 0,
  flatShading: false
});

const roadMaterial = new THREE.MeshStandardMaterial({
  color: 0x222222,
  roughness: 0.8,
  metalness: 0.3
});

const laneLineMaterial = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 3, gapSize: 3, linewidth: 3 });

const terrainChunks = new Map();
const chunkRenderDistance = 3;
const waterChunks = new Map(); // To track water meshes
// Race Track Creation
const roadWidth = 18;

const trackPoints = [];
const trackPointCount = 40;
const trackLength = 10000;

for (let i = 0; i < trackPointCount; i++) {
  const z = (i / (trackPointCount - 1)) * trackLength;
  const x = 0;
  const y = 0;
  /*trackPoints.push(new THREE.Vector3(x, y, z));*/
  trackPoints.push(new THREE.Vector3(0, 0, z));
}
const trackCurve = new THREE.CatmullRomCurve3(trackPoints, false, 'catmullrom', 0.5);

function distanceToTrack(x, z) {
  const samples = 64;
  let minDist = Infinity;
  for (let s = 0; s <= samples; s++) {
    const pt = trackCurve.getPoint(s / samples);
    const dx = pt.x - x;
    const dz = pt.z - z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

function createChunk(cx, cz) {
  const geom = new THREE.PlaneGeometry(chunkSize, chunkSize, segments, segments);
  geom.rotateX(-Math.PI / 2);

  // Level-based terrain color
  let terrainColor = 0x354f1f; // Level 1 - grass
  if (currentLevel === 2) {
    terrainColor = 0x2e8b57; // Level 2 - lusher green
  } else if (currentLevel === 3) {
    terrainColor = 0x3b5323; // Level 3 - dense grass
  } else if (currentLevel >= 4) {
    terrainColor = 0x6b4f3f; // Level 4 - dry land
  }

  const terrainMat = new THREE.MeshStandardMaterial({
    color: terrainColor,
    roughness: 1,
    metalness: 0,
    flatShading: false
  });

  for (let i = 0; i < geom.attributes.position.count; i++) {
    const v = new THREE.Vector3();
    v.fromBufferAttribute(geom.attributes.position, i);
    const worldX = v.x + cx * chunkSize;
    const worldZ = v.z + cz * chunkSize;

    const dist = distanceToTrack(worldX, worldZ);
    let height = 0;

    height += noiseGen.noise(worldX * frequency, worldZ * frequency) * amplitude;
    height += noiseGen.noise(worldX * frequency * 2, worldZ * frequency * 2) * (amplitude * 0.5);
    height += noiseGen.noise(worldX * frequency * 4, worldZ * frequency * 4) * (amplitude * 0.25);

    if (dist < roadWidth / 2 + 4) {
      let heightReduction = 1.0;
      if (dist < roadWidth / 2) {
        heightReduction = 0.0;
      } else {
        heightReduction = (dist - roadWidth / 2) / 4;
      }
      height *= heightReduction;
    }

    // Flatten low terrain for water effect (Level 2+)
    if (currentLevel >= 2 && height < 1.5) {
      height = 0.5;
    }

    geom.attributes.position.setY(i, height);
  }

  geom.computeVertexNormals();

  const mesh = new THREE.Mesh(geom, terrainMat);
  mesh.position.set(cx * chunkSize, 0, cz * chunkSize);
  mesh.receiveShadow = true;
  terrainChunks.set(`${cx}_${cz}`, mesh);

  // Optional: Add water plane for low terrain in level 2+
  /*if (currentLevel >= 2) {
    const waterPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(chunkSize, chunkSize),
      new THREE.MeshStandardMaterial({
        color: 0x3399ff,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
      })
    );
    waterPlane.rotation.x = -Math.PI / 2;
    waterPlane.position.set(cx * chunkSize, 0.5, cz * chunkSize); // Y = water level
    scene.add(waterPlane);
    waterChunks.set(`${cx}_${cz}`, waterPlane);
  }*/

  scene.add(mesh);
}


function loadChunks(centerX, centerZ) {
  const newChunks = new Set();
  for (let cz = centerZ - chunkRenderDistance; cz <= centerZ + chunkRenderDistance; cz++) {
    for (let cx = centerX - chunkRenderDistance; cx <= centerX + chunkRenderDistance; cx++) {
      newChunks.add(`${cx}_${cz}`);
      if (!terrainChunks.has(`${cx}_${cz}`)) {
        createChunk(cx, cz);
      }
    }
  }
  for (const key of terrainChunks.keys()) {
    if (!newChunks.has(key)) {
      const chunk = terrainChunks.get(key);
      scene.remove(chunk);
      chunk.geometry.dispose();
      terrainChunks.delete(key);
    }
  }
}

let roadMesh = null;
let laneLines = [];

function generateRoadMesh() {
  const roadGeometry = new THREE.BufferGeometry();

  const divisions = 200;
  const vertices = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= divisions; i++) {
    const t = i / divisions;
    let centerPoint = trackCurve.getPointAt(t);
    const tangent = trackCurve.getTangentAt(t);
    const normal = new THREE.Vector3(0, 1, 0);
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();

    const leftPoint = centerPoint.clone().add(binormal.clone().multiplyScalar(roadWidth / 2));
    const rightPoint = centerPoint.clone().add(binormal.clone().multiplyScalar(-roadWidth / 2));

    /*const leftY = getApproxTerrainHeight(leftPoint.x, leftPoint.z);
    if (leftY !== null) leftPoint.y = leftY + 0.4;
    const rightY = getApproxTerrainHeight(rightPoint.x, rightPoint.z);
    if (rightY !== null) rightPoint.y = rightY + 0.4;*/
    const roadHeight = 5;
    leftPoint.y = roadHeight;
    rightPoint.y = roadHeight;

    vertices.push(leftPoint.x, leftPoint.y, leftPoint.z);
    vertices.push(rightPoint.x, rightPoint.y, rightPoint.z);

    normals.push(0, 1, 0);
    normals.push(0, 1, 0);

    uvs.push(0, t * 10);
    uvs.push(1, t * 10);
  }

  for (let i = 0; i < divisions; i++) {
    const idx = i * 2;
    indices.push(idx, idx + 1, idx + 2);
    indices.push(idx + 2, idx + 1, idx + 3);
  }

  roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  roadGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  roadGeometry.setIndex(indices);
  roadGeometry.computeVertexNormals();

  if (roadMesh) {
    scene.remove(roadMesh);
    roadMesh.geometry.dispose();
  }
  roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
  roadMesh.receiveShadow = true;
  scene.add(roadMesh);

  laneLines.forEach(line => {
    scene.remove(line);
    line.geometry.dispose();
  });
  laneLines.length = 0;

  const laneLineDivisions = 400;
  const laneCount = 3;
  const laneWidthLocal = roadWidth / laneCount;

  for (let laneIndex = 1; laneIndex < laneCount; laneIndex++) {
    const offset = laneWidthLocal * (laneCount / 2 - laneIndex);
    const points = [];

    for (let i = 0; i <= laneLineDivisions; i++) {
      const t = i / laneLineDivisions;
      let p = trackCurve.getPointAt(t);
      let tangent = trackCurve.getTangentAt(t);
      const axis = new THREE.Vector3(0, 1, 0);
      const binormal = new THREE.Vector3().crossVectors(tangent, axis).normalize();

      p.add(binormal.multiplyScalar(offset));
      const h = getApproxTerrainHeight(p.x, p.z);
      if (h !== null) p.y = h + 0.55;

      points.push(p.clone());
    }
    const laneLineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const laneLineMesh = new THREE.Line(laneLineGeometry, laneLineMaterial);
    laneLineMesh.computeLineDistances();
    scene.add(laneLineMesh);
    laneLines.push(laneLineMesh);
  }
}

// Terrain height detect raycast
const downRaycaster = new THREE.Raycaster();
const downVector = new THREE.Vector3(0, -1, 0);
/*function getTerrainHeight(x, z) {
  const rayOrigin = new THREE.Vector3(x, 1000, z);
  downRaycaster.set(rayOrigin, downVector);

  const intersects = [];
  terrainChunks.forEach(chunk => {
    const ints = downRaycaster.intersectObject(chunk);
    if (ints.length) intersects.push(...ints);
  });

  if (intersects.length === 0) return null;
  intersects.sort((a, b) => a.distance - b.distance);
  return intersects[0].point.y;
}*/

function getApproxTerrainHeight(x, z) {
  let height = 0;
  height += noiseGen.noise(x * frequency, z * frequency) * amplitude;
  height += noiseGen.noise(x * frequency * 2, z * frequency * 2) * (amplitude * 0.5);
  height += noiseGen.noise(x * frequency * 4, z * frequency * 4) * (amplitude * 0.25);

  // Untuk Level 2 ke atas, kalau terrain terlalu rendah, adjust supaya ada air
  //if (currentLevel >= 2 && height < 1.5) {
  //  height = 0.5;
  //}

  return height;
}

function loadPlayerCar(callback) {
  const loader = new GLTFLoader();
  loader.load('public/Models/mesh/car2.glb', (gltf) => {
    const model = gltf.scene;
    model.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    callback(model);
  }, undefined, error => {
    console.error('Error loading player car GLB:', error);
  });
}

// Car creation function untuk npc juga
function createCar(color = 0xff2200) {
  const car = new THREE.Group();

  const chassisWidth = 8;
  const chassisHeight = 3;
  const chassisLength = 14;
  const wheelRadius = 2.5;

  const chassisGeometry = new THREE.BoxGeometry(chassisWidth, chassisHeight, chassisLength);
  const chassisMaterial = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4 });
  const chassis = new THREE.Mesh(chassisGeometry, chassisMaterial);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  car.add(chassis);

  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 2, 24);
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.3, roughness: 0.8 });
  function createWheel() {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    wheel.receiveShadow = true;
    return wheel;
  }

  const wheelPositions = [
    [-chassisWidth / 2 - 0.5, -chassisHeight / 2, chassisLength / 2 - 3],
    [chassisWidth / 2 + 0.5, -chassisHeight / 2, chassisLength / 2 - 3],
    [-chassisWidth / 2 - 0.5, -chassisHeight / 2, -chassisLength / 2 + 3],
    [chassisWidth / 2 + 0.5, -chassisHeight / 2, -chassisLength / 2 + 3],
  ];

  wheelPositions.forEach(pos => {
    const w = createWheel();
    w.position.set(...pos);
    car.add(w);
  });

  return car;
}

// Coin creation and management
function createCoin() {
  const geometry = new THREE.CylinderGeometry(1.2, 1.2, 0.3, 32);
  const material = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.8, roughness: 0.2 });
  const coin = new THREE.Mesh(geometry, material);
  coin.rotation.x = Math.PI / 2;
  coin.castShadow = true;
  coin.receiveShadow = true;
  return coin;
}

function getMaxTerrainHeightNear(x, z, sampleRadius = 3, sampleCount = 8) {
  let maxH = -Infinity;
  for (let i = 0; i < sampleCount; i++) {
    const angle = (i / sampleCount) * Math.PI * 2;
    const sampleX = x + Math.cos(angle) * sampleRadius;
    const sampleZ = z + Math.sin(angle) * sampleRadius;
    const h = getApproxTerrainHeight(sampleX, sampleZ);
    if (h !== null && h > maxH) maxH = h;
  }
  return maxH === -Infinity ? null : maxH;
}

// Obstacle globals
const baseObstacleSize = 1.5;
const obstacleGeometry = new THREE.ConeGeometry(baseObstacleSize, baseObstacleSize * 2, 8);
const obstacleMaterial = new THREE.MeshStandardMaterial({color: 0xff6600, metalness: 0.3, roughness: 0.7});

// Globals
const laneCount = 3;
const laneWidth = roadWidth / laneCount;
const laneOffsets = [laneWidth, 0, -laneWidth];

// ✅ Cache terrain height supaya tak ulang kira
const terrainHeightCache = new Map();

function getCachedTerrainHeight(x, z) {
  const key = `${Math.floor(x)}_${Math.floor(z)}`;
  if (terrainHeightCache.has(key)) return terrainHeightCache.get(key);
  const h = getApproxTerrainHeight(x, z);
  terrainHeightCache.set(key, h);
  return h;
}

let playerLane = 1; // Middle lane

const coins = [];
//const maxCoins = 30;
function getMaxCoinsByLevel() {
  return 30 + (currentLevel - 1) * 10; 
}
let collectedCoins = 0;

let lastObstacleProgress = 0;

const coinCounterDiv = document.getElementById('coinCounter');
coinCounterDiv.style.display = 'none';

const gameOverOverlay = document.getElementById('gameOverOverlay');
const restartBtn = document.getElementById('restartBtn');

restartBtn.addEventListener('click', () => {
  localStorage.clear(); // kalau ada cache
  window.location.reload();
});

function showGameOver() {
  raceStarted = false;
  gameOverOverlay.style.visibility = 'visible';
  const loseText = document.getElementById('loseText');
  loseText.style.display = 'block'; // bila kalah, baru tunjuk teks
}

let playerCar;
loadPlayerCar((model) => {
  playerCar = model;
  scene.add(playerCar);
  playerCar.position.set(trackPoints[0].x, 0, trackPoints[0].z);
});

const obstacles = [];
const movingNPCs = [];

// Level variables
let currentLevel = 1;
const npcCountByLevel = {
  1: 4,
  2: 6,
  3: 8,
  4: 10
};
let carSpeed = 0.2;       // Initial speed
let obstacleSizeMultiplier = 1;

function showLevelPopup(text) {
  const popup = document.createElement('div');
  popup.style.position = 'fixed';
  popup.style.top = '30%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';
  popup.style.padding = '20px 40px';
  popup.style.background = 'rgba(0,0,0,0.8)';
  popup.style.color = 'white';
  popup.style.fontSize = '36px';
  popup.style.fontWeight = 'bold';
  popup.style.borderRadius = '12px';
  popup.style.zIndex = '10000';
  popup.style.userSelect = 'none';
  popup.textContent = text;
  document.body.appendChild(popup);
  setTimeout(() => {
    popup.remove();
  }, 2000);
}



function spawnObstacle(progress, lane) {
  // Remove old obstacle at this progress/lane if exists
  // (Optional: clear obstacles on level up)
  
  // Create new obstacle with size based on level multiplier
  const size = baseObstacleSize * obstacleSizeMultiplier;
  const geom = new THREE.ConeGeometry(size, size * 2, 8);
  const mat = new THREE.MeshStandardMaterial({color: 0xff6600, metalness: 0.3, roughness: 0.7});
  const cone = new THREE.Mesh(geom, mat);
  cone.userData = {progress: progress, lane: lane};
  scene.add(cone);
  obstacles.push(cone);
  positionObstacle(cone);
}



function positionObstacle(obstacle) {
  let pos = trackCurve.getPointAt(obstacle.userData.progress);
  let tangent = trackCurve.getTangentAt(obstacle.userData.progress);
  let axis = new THREE.Vector3(0, 1, 0);
  let binormal = new THREE.Vector3().crossVectors(tangent, axis).normalize();

  pos.add(binormal.multiplyScalar(laneOffsets[obstacle.userData.lane]));

  const terrainY = getCachedTerrainHeight(pos.x, pos.z);
  /*if (terrainY !== null) pos.y = terrainY + (1.5 * obstacleSizeMultiplier);*/
  pos.y = 5 + (1.5 * obstacleSizeMultiplier);

  obstacle.position.copy(pos);

  const angle = Math.atan2(-tangent.x, -tangent.z);
  obstacle.quaternion.setFromAxisAngle(axis, angle);
}

function positionNPC(npc) {
  let pos = trackCurve.getPointAt(npc.userData.progress);
  let tangent = trackCurve.getTangentAt(npc.userData.progress);
  let axis = new THREE.Vector3(0, 1, 0);
  let binormal = new THREE.Vector3().crossVectors(tangent, axis).normalize();

  pos.add(binormal.multiplyScalar(laneOffsets[npc.userData.lane]));

  const terrainY = getCachedTerrainHeight(pos.x, pos.z);
  /*if (terrainY !== null) pos.y = terrainY + 3.9;*/ // Sama tinggi macam player
  pos.y = 5 + 3.9;
  npc.position.copy(pos);

  const angle = Math.atan2(-tangent.x, -tangent.z);
  npc.quaternion.setFromAxisAngle(axis, angle);
}


function createCoin() {
  const geometry = new THREE.CylinderGeometry(1.2, 1.2, 0.3, 32);
  const material = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.8, roughness: 0.2 });
  const coin = new THREE.Mesh(geometry, material);
  coin.rotation.x = Math.PI / 2;
  coin.castShadow = true;
  coin.receiveShadow = true;
  return coin;
}

function getMaxTerrainHeightNear(x, z, sampleRadius = 3, sampleCount = 8) {
  let maxH = -Infinity;
  for (let i = 0; i < sampleCount; i++) {
    const angle = (i / sampleCount) * Math.PI * 2;
    const sampleX = x + Math.cos(angle) * sampleRadius;
    const sampleZ = z + Math.sin(angle) * sampleRadius;
    const h = getApproxTerrainHeight(sampleX, sampleZ);
    if (h !== null && h > maxH) maxH = h;
  }
  return maxH === -Infinity ? null : maxH;
}

function spawnCoins() {
  //while (coins.length < maxCoins)
    while (coins.length < getMaxCoinsByLevel()) {
    //let t = Math.random();
    let t = clampProgress(playerProgress + Math.random() * 0.2); // coin spawn depan player
    let pos = trackCurve.getPointAt(t);
    let tangent = trackCurve.getTangentAt(t);
    const axis = new THREE.Vector3(0, 1, 0);
    const binormal = new THREE.Vector3().crossVectors(tangent, axis).normalize();

    // Random lane for coin
    let lane = Math.floor(Math.random() * laneCount);
    pos.add(binormal.multiplyScalar(laneOffsets[lane]));

    // Set coin height at terrain peak + 1.5
    let peakHeight = getMaxTerrainHeightNear(pos.x, pos.z, 3, 12);
    if (peakHeight !== null) {
      /*pos.y = peakHeight + 1.5;*/
      pos.y = 5 + 1.5;
    } else {
      pos.y = getCachedTerrainHeight(pos.x, pos.z) + 2;
    }

    const coin = createCoin();
    coin.position.copy(pos);
    coin.userData = { progress: t, lane: lane };
    scene.add(coin);
    coins.push(coin);
  }
}

function clampProgress(p) {
  if (p > 1) return p - 1;
  if (p < 0) return 1 + p;
  return p;
}

// Player control vars and flag for race start
let playerProgress = 0;
let raceStarted = false;

// Add lane switch buttons (assumes buttons exist in HTML)
const btnLeft = document.getElementById('btnLeft');
btnLeft.style.display = 'none';
const btnRight = document.getElementById('btnRight');
btnRight.style.display = 'none';

btnLeft.addEventListener('click', () => {
  if (!raceStarted) return;
  if (playerLane > 0) {
    playerLane--;
    console.log("Moved Left to lane:", playerLane);
  }
});

btnRight.addEventListener('click', () => {
  if (!raceStarted) return;
  if (playerLane < laneCount - 1) {
    playerLane++;
    console.log("Moved Right to lane:", playerLane);
  }
});

// Mouse click on screen halves to switch lanes too
window.addEventListener('click', (event) => {
  if (!raceStarted) return;
  const clickX = event.clientX;
  const midX = window.innerWidth / 2;
  if (clickX < midX) {
    if (playerLane > 0) {
      playerLane--;
      console.log("Moved Left to lane:", playerLane);
    }
  } else {
    if (playerLane < laneCount - 1) {
      playerLane++;
      console.log("Moved Right to lane:", playerLane);
    }
  }
});

// Keyboard lane switching left/right (ArrowLeft/Right and A/D)
window.addEventListener('keydown', (e) => {
  if (!raceStarted) return;

  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    if (playerLane > 0) {
      playerLane--;
      console.log("Moved Left to lane:", playerLane);
    }
    e.preventDefault();
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    if (playerLane < laneCount - 1) {
      playerLane++;
      console.log("Moved Right to lane:", playerLane);
    }
    e.preventDefault();
  }
});

// Chunk management per player
let playerChunkX = 0;
let playerChunkZ = 0;
function updateChunks() {
  const cx = Math.floor(playerCar.position.x / chunkSize);
  const cz = Math.floor(playerCar.position.z / chunkSize);
  if (cx !== playerChunkX || cz !== playerChunkZ) {
    playerChunkX = cx;
    playerChunkZ = cz;
    loadChunks(cx, cz);
    /*generateRoadMesh();*/
  }
}
loadChunks(0, 0);
generateRoadMesh();
spawnCoins();

// Spawn a few obstacles
for (let i = 0; i < 15; i++) {
  const progress = clampProgress(playerProgress + Math.random() * 0.4);
  spawnObstacle(progress, Math.floor(Math.random() * laneCount));
}

function spawnMovingNPC(progress, lane) {
  const npc = createCar(0x0000ff); // Biru untuk bezakan dari player
  npc.scale.set(0.7, 0.9, 0.5); // Kecilkan kereta
  npc.userData = { progress, lane };
  scene.add(npc);
  movingNPCs.push(npc);
  positionNPC(npc);
  /*positionObstacle(npc); // Guna posisi lane dan track*/
}

function spawnNPCs(level) {
  movingNPCs.forEach(npc => scene.remove(npc));
  movingNPCs = [];

  const npcCount = npcCountByLevel[level] || 4;

  for (let i = 0; i < npcCount; i++) {
    const progress = clampProgress(playerProgress + 0.15 + Math.random() * 0.15);
    const lane = Math.floor(Math.random() * laneCount);
    spawnMovingNPC(progress, lane);
  }
}




//spawnnpc
setInterval(() => {
  if (raceStarted) {
    // Hanya kira NPC yang masih dekat depan player (dalam 20% progress)
    const activeNPCs = movingNPCs.filter(npc => npc.userData.progress > playerProgress - 0.1);
    if (activeNPCs.length < 4) {
      const randomLane = Math.floor(Math.random() * laneCount);
      const startProgress = clampProgress(playerProgress + 0.02);// spawn dekat player
      spawnMovingNPC(startProgress, randomLane);
    }
  }
}, 4000);


let levelTimer = 0;
const levelInterval = 30000; // 30 seconds

/*function updateLevelByTime(deltaTime) {
  levelTimer += deltaTime;
  if (levelTimer >= levelInterval) {
    levelTimer = 0;
    if (currentLevel < 4) {
      currentLevel++;
      carSpeed += 0.2;
      obstacleSizeMultiplier += 0.5;
      showLevelPopup(`Level ${currentLevel}`);
      reloadChunks(); // Untuk tukar warna terrain
    } else if (currentLevel === 4) {
      // Dah habis Level 4, tamat game
      //showLevelPopup(`🎉 You Win! 🎉,🚗You’ve successfully navigated the terrain and made it home safely!`);
      raceStarted = false;
      // Buat container kekal
        const resultPopup = document.createElement('div');
        resultPopup.style.position = 'fixed';
        resultPopup.style.top = '30%';
        resultPopup.style.left = '50%';
        resultPopup.style.transform = 'translate(-50%, -50%)';
        resultPopup.style.fontSize = '32px';
        resultPopup.style.color = 'white';
        resultPopup.style.padding = '30px';
        resultPopup.style.backgroundColor = 'rgba(0,0,0,0.85)';
        resultPopup.style.borderRadius = '16px';
        resultPopup.style.zIndex = '2000';
        resultPopup.style.textAlign = 'center';

        // Teks utama menang
        const winText = document.createElement('div');
        winText.textContent = "🎉 You Win! 🎉\n🚗 You’ve successfully navigated the terrain and made it home safely!";
        winText.style.marginBottom = '20px';
        resultPopup.appendChild(winText);

        // Teks coin
        const coinText = document.createElement('div');
        coinText.textContent = `Coins collected: ${collectedCoins}`;
        coinText.style.marginBottom = '30px';
        resultPopup.appendChild(coinText);

        // Butang ke menu
        const backButton = document.createElement('button');
        backButton.textContent = "Back to Main Menu";
        backButton.style.padding = '10px 20px';
        backButton.style.fontSize = '20px';
        backButton.style.cursor = 'pointer';
        backButton.onclick = () => window.location.href = 'index.html';

        resultPopup.appendChild(backButton);
        document.body.appendChild(resultPopup);
    }
  }
}*/


function animate() {

  
  requestAnimationFrame(animate);

  if (!playerCar) return; // Tunggu kereta load dulu
  if (isPaused || !raceStarted || !playerCar) return;
  if (raceStarted) {
    playerProgress += carSpeed * 0.0005;
    const deltaTime = 16.67; // Anggaran ms setiap frame (~60fps)
    //updateLevelByTime(deltaTime);

    playerProgress = clampProgress(playerProgress);

    // Auto-spawn obstacle ikut jarak player
      /*if (playerProgress - lastObstacleProgress > 0.03) { // setiap 5% progress
        const lane = Math.floor(Math.random() * laneCount);
        const obsProgress = clampProgress(playerProgress + Math.random() * 0.2);
        spawnObstacle(obsProgress, lane);
        lastObstacleProgress = playerProgress;
      }*/

      let obstacleGap = 0.03 - (currentLevel - 1) * 0.005;
      obstacleGap = Math.max(0.01, obstacleGap); // Minimum gap supaya tak terlalu rapat

      if (playerProgress - lastObstacleProgress > obstacleGap) {
        const lane = Math.floor(Math.random() * laneCount);
        const obsProgress = clampProgress(playerProgress + Math.random() * 0.2);
        spawnObstacle(obsProgress, lane);
        lastObstacleProgress = playerProgress;
      }


      


        // === LEVEL BASED ON DISTANCE ===
        const actualDistance = playerProgress * trackLength;

      if (actualDistance >= 9500 && currentLevel < 5) {
      currentLevel = 5;
      raceStarted = false;

      const resultPopup = document.createElement('div');
      resultPopup.style.position = 'fixed';
      resultPopup.style.top = '30%';
      resultPopup.style.left = '50%';
      resultPopup.style.transform = 'translate(-50%, -50%)';
      resultPopup.style.fontSize = '32px';
      resultPopup.style.color = 'white';
      resultPopup.style.padding = '30px';
      resultPopup.style.backgroundColor = 'rgba(0,0,0,0.85)';
      resultPopup.style.borderRadius = '16px';
      resultPopup.style.zIndex = '2000';
      resultPopup.style.textAlign = 'center';

      const winText = document.createElement('div');
      winText.textContent = "🎉 You Win! 🎉\n🚗 You’ve successfully navigated the terrain and made it home safely!";
      winText.style.marginBottom = '20px';
      resultPopup.appendChild(winText);

      const coinText = document.createElement('div');
      coinText.textContent = `Coins collected: ${collectedCoins}`;
      coinText.style.marginBottom = '30px';
      resultPopup.appendChild(coinText);

      const backButton = document.createElement('button');
      backButton.textContent = "Back to Main Menu";
      backButton.style.padding = '10px 20px';
      backButton.style.fontSize = '20px';
      backButton.style.cursor = 'pointer';
      backButton.onclick = () => window.location.href = 'index.html';
      resultPopup.appendChild(backButton);

      document.body.appendChild(resultPopup);

    } else if (actualDistance >= 7500 && currentLevel < 4) {
      currentLevel = 4;
      carSpeed = 0.5;
      obstacleSizeMultiplier = 2.5;
      showLevelPopup("Final Level");
      spawnNPCs(4);
      //reloadChunks();

    } else if (actualDistance >= 5000 && currentLevel < 3) {
      currentLevel = 3;
      carSpeed = 0.4;
      obstacleSizeMultiplier = 2;
      showLevelPopup("3rd Level");
      spawnNPCs(3);
      //reloadChunks();

    } else if (actualDistance >= 2500 && currentLevel < 2) {
      currentLevel = 2;
      carSpeed = 0.3;
      obstacleSizeMultiplier = 1.5;
      showLevelPopup("2nd Level");
      spawnNPCs(2);
      //reloadChunks();
    }
  }

  // Player position and rotation on track
  const posOnTrack = trackCurve.getPointAt(playerProgress);
  const tangent = trackCurve.getTangentAt(playerProgress);

  const axis = new THREE.Vector3(0, 1, 0);
  const angle = Math.atan2(-tangent.x, -tangent.z);
  const rotation = new THREE.Quaternion().setFromAxisAngle(axis, angle);

  const offsetDir = new THREE.Vector3().crossVectors(axis, tangent).normalize();

  let sideOffset = laneOffsets[playerLane];

  const playerPosition = posOnTrack.clone().add(offsetDir.clone().multiplyScalar(sideOffset));

  const terrainY = getApproxTerrainHeight(playerPosition.x, playerPosition.z);
  playerPosition.y = 5 + 3.9; // ikut tinggi jalan + tinggi kereta
  //playerPosition.y = terrainY + 3.9;//ini keret ikut ketinggian terrain

  playerCar.position.copy(playerPosition);
  // Auto spawn coin sepanjang game
  if (coins.length < getMaxCoinsByLevel()) {
    spawnCoins();
  }
  playerCar.quaternion.slerp(rotation, 0.25);

  updateChunks();

  // Obstacles stay stationary but reposition in case terrain moves
  obstacles.forEach(obstacle => {
    positionObstacle(obstacle);
  });

  // Coins rotate and check collection
  for (let i = coins.length - 1; i >= 0; i--) {
    const coin = coins[i];
    const dist = coin.position.distanceTo(playerCar.position);
    if (dist < 5) {
      scene.remove(coin);
      coinSound.play();
      coins.splice(i, 1);
      collectedCoins++;
      coinCounterDiv.textContent = `Coins: ${collectedCoins}`;
      spawnCoins();

      // Check level-up on coin collection
      //checkLevelUp();
    } else {
      coin.rotation.z += 0.05;
    }
  }

// Gerakkan NPC ke arah depan (ikut laluan sama mcm player)
for (let i = movingNPCs.length - 1; i >= 0; i--) {
  const npc = movingNPCs[i];
  npc.userData.progress += carSpeed * 0.0004; // Gerak ke depan
  npc.userData.progress = clampProgress(npc.userData.progress);
  positionNPC(npc);

  // Remove kalau dah terlalu jauh dari player
  if (npc.userData.progress > playerProgress + 0.2) {
    scene.remove(npc);
    movingNPCs.splice(i, 1);
  }
}

  // Collision detection
  let collisionDetected = false;
  const collisionDistObs = 3;

  obstacles.forEach(obstacle => {
    if (playerCar.position.distanceTo(obstacle.position) < collisionDistObs) {
      collisionDetected = true;
    }
  });

  movingNPCs.forEach(npc => {
  if (playerCar.position.distanceTo(npc.position) < 4) {
    collisionDetected = true;
  }
  });

  if (collisionDetected) {
    showGameOver();
  }

  if (!raceStarted) {
    return; // Game paused or over, don't update camera or render
  }
  
  // Camera follow
  const camOffset = new THREE.Vector3(0, 18, 32);
  const camPos = playerCar.position.clone().add(camOffset.applyQuaternion(playerCar.quaternion));
  camera.position.lerp(camPos, 0.12);
  camera.lookAt(playerCar.position.x, playerCar.position.y + 4, playerCar.position.z);


  renderer.render(scene, camera);
}

// === PAUSE MENU SYSTEM ===

let isPaused = false;

// Create Pause Menu Container
const pauseMenu = document.createElement('div');
pauseMenu.id = 'pause-menu';
pauseMenu.style.position = 'absolute';
pauseMenu.style.top = '0';
pauseMenu.style.left = '0';
pauseMenu.style.width = '100%';
pauseMenu.style.height = '100%';
pauseMenu.style.display = 'none'; // Hidden by default
pauseMenu.style.flexDirection = 'column';
pauseMenu.style.justifyContent = 'center';
pauseMenu.style.alignItems = 'center';
pauseMenu.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
pauseMenu.style.zIndex = '2000';

// Helper to create styled buttons
function createPauseButton(text, id) {
  const btn = document.createElement('button');
  btn.id = id;
  btn.textContent = text;
  btn.style.margin = '10px';
  btn.style.padding = '15px 30px';
  btn.style.fontSize = '20px';
  btn.style.color = 'white';
  btn.style.backgroundColor = '#333';
  btn.style.border = '2px solid #666';
  btn.style.borderRadius = '5px';
  btn.style.cursor = 'pointer';
  btn.style.transition = 'background-color 0.3s';
  btn.addEventListener('mouseover', () => btn.style.backgroundColor = '#555');
  btn.addEventListener('mouseout', () => btn.style.backgroundColor = '#333');
  return btn;
}

// Create Buttons
const resumeBtn = createPauseButton('Resume Game', 'resume-game-btn');
const mainMenuBtn = createPauseButton('Exit to Main Menu', 'main-menu-btn');
/*const exitBtn = createPauseButton('Exit Game', 'exit-game-btn');*/

pauseMenu.appendChild(resumeBtn);
pauseMenu.appendChild(mainMenuBtn);
/*pauseMenu.appendChild(exitBtn);*/

document.body.appendChild(pauseMenu);

// Create Pause Button (top-left corner)
const pauseBtn = document.createElement('button');
pauseBtn.textContent = 'Pause';
pauseBtn.style.position = 'absolute';
pauseBtn.style.top = '10px';
pauseBtn.style.left = '10px';
pauseBtn.style.padding = '10px 20px';
pauseBtn.style.fontSize = '16px';
pauseBtn.style.color = 'white';
pauseBtn.style.backgroundColor = '#333';
pauseBtn.style.border = '2px solid #666';
pauseBtn.style.borderRadius = '5px';
pauseBtn.style.cursor = 'pointer';
pauseBtn.style.zIndex = '999';
document.body.appendChild(pauseBtn);
pauseBtn.style.display = 'none'; // Sembunyi dulu masa awal

pauseBtn.addEventListener('click', () => {
  togglePause();
});

function togglePause() {
  isPaused = !isPaused;
  pauseMenu.style.display = isPaused ? 'flex' : 'none';
  if (isPaused) {
    backgroundMusic.pause();
  } else {
    backgroundMusic.play();
    animate();
  }
}
 // Resume Game Button
resumeBtn.addEventListener('click', () => {
  togglePause();
});

mainMenuBtn.addEventListener('click', () => {
    if (confirm("Exit game and return to menu?")) {
    window.location.replace('index.html');
  }
});

/*exitBtn.addEventListener('click', () => {
  alert('Thanks for playing!');
  /*window.close() //might not work on all browserss
});*/

function displaySceneText(message, duration = 5000) {
  const sceneText = document.createElement('div');
  sceneText.textContent = message;
  sceneText.style.position = 'absolute';
  sceneText.style.top = '20px';
  sceneText.style.left = '50%';
  sceneText.style.transform = 'translateX(-50%)';
  sceneText.style.color = 'white';
  sceneText.style.fontSize = '24px';
  sceneText.style.fontWeight = 'bold';
  sceneText.style.padding = '10px 20px';
  sceneText.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  sceneText.style.borderRadius = '10px';
  sceneText.style.zIndex = '200';

  document.body.appendChild(sceneText);

  setTimeout(() => {
    document.body.removeChild(sceneText);
  }, duration);
}

const countdownSound = new Audio('./public/Audio/Music/countdown.mp3');
countdownSound.volume = 1.0;

// Countdown and start
const countdownOverlay = document.createElement('div');
countdownOverlay.style.position = 'absolute';
countdownOverlay.style.top = '40%';
countdownOverlay.style.left = '50%';
countdownOverlay.style.transform = 'translate(-50%, -50%)';
countdownOverlay.style.fontSize = '96px';
countdownOverlay.style.fontWeight = 'bold';
countdownOverlay.style.color = '#ff2222';
countdownOverlay.style.textShadow = '2px 2px 6px black';
countdownOverlay.style.userSelect = 'none';
countdownOverlay.style.zIndex = '100';
document.body.appendChild(countdownOverlay);

const countdownTexts = ['3', '2', '1', 'GO!'];
let countdownIndex = 0;

const backgroundMusic = new Audio('./public/Audio/Music/Game Song.mp3');
backgroundMusic.loop = true; // repeat
backgroundMusic.volume = 0.5; // volume boleh adjust

const coinSound = new Audio('./public/Audio/SFX/coin.mp3');
coinSound.volume = 1.0; // boleh ubah volume kalau terlalu kuat


function showCountdown() {
  if (countdownIndex === 0) {
    countdownSound.play(); // 🎵 Mula main bunyi beep bila mula countdown
  }

  if (countdownIndex < countdownTexts.length) {
    countdownOverlay.textContent = countdownTexts[countdownIndex];
    countdownIndex++;

    if (countdownIndex === countdownTexts.length) {
      setTimeout(() => {
        countdownOverlay.style.display = 'none';
        countdownSound.pause();            // ⛔ stop countdown
        countdownSound.currentTime = 0;    // 🔁 reset
        raceStarted = true;
        backgroundMusic.play();  
        pauseBtn.style.display = 'block'; // Tunjuk pause button selepas GO!
        coinCounterDiv.style.display = 'block';
        btnLeft.style.display = 'block';
        btnRight.style.display = 'block';
        displaySceneText("You've repaired the car. Your journey through the terrain begins—get home safe", 6000);          // 🎵 main music game
      }, 1000);
    } else {
      setTimeout(showCountdown, 1000);
    }
  }
}


showCountdown();
animate();
}


