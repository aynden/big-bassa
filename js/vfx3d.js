/**
 * Big Bass Splash™ — Real-Time Three.js 3D Casino VFX & Lighting Engine
 *
 * Layered transparently over the PixiJS v7 WebGL reel engine to provide genuine AAA 3D effects:
 *  1. PBR Studio Environment Map (PMREM) + ACES Filmic Tone Mapping for realistic metallic gold reflections.
 *  2. InstancedMesh 3D Embossed Gold Casino Coins (custom bass-emblem bump & diffuse maps) with full
 *     3D gravity & tumble physics for Fisherman catches, big line hits, and sustained Big/Mega/Superb Win fountains.
 *  3. Real-Time 3D Rotating Golden Starburst Trophy Crest & Floating Crown during Big Win / Level-Up celebrations.
 *  4. Real-Time 3D Tumbling Dynamite Bundles (with live sparkling fuse) & 3D Bazooka Rockets with plasma exhaust.
 *  5. 3D Expanding Shockwave Torus Rings, Glowing Ember Bursts & Parallax Underwater Glass Bubbles.
 */

import * as THREE from './vendor/three.module.min.js';

const MAX_COINS = 180;
const MAX_SPARKS = 140;

export class ThreeVFXEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.enabled = true;
    this.isFreeSpins = false;
    this.isDisposed = false;

    // Mouse parallax target
    this.mouseX = 0;
    this.mouseY = 0;
    this.camOffsetX = 0;
    this.camOffsetY = 0;

    // Continuous coin fountain state (for Big Win / Mega Win / Bonus Summary)
    this.fountainActive = false;
    this.fountainIntensity = 1.0;
    this.fountainAccumulator = 0;

    // Celebration 3D Trophy state
    this.trophyActive = false;
    this.trophyScale = 0;
    this.trophyTargetScale = 0;

    // Dynamic 3D projectiles & shockwaves
    this.activeProjectiles = [];
    this.activeShockwaves = [];

    try {
      this._initRenderer();
      this._initLightingAndEnv();
      this._initAmbient3DBubbles();
      this._initCoinPool();
      this._initSparkPool();
      this._initCelebrationTrophy();
      this._bindResizeAndParallax();
      this._startLoop();
    } catch (err) {
      console.warn('ThreeVFXEngine WebGL fallback (disabled gracefully):', err);
      this.enabled = false;
    }
  }

  _initRenderer() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 18);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.28;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.clock = new THREE.Clock();
  }

  /**
   * Build a procedural warm 24K Gold Studio PMREM Environment Map so 3D gold coins & crown gleam pure molten gold
   */
  _initLightingAndEnv() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x241504);

    // Pure warm studio softboxes (white, champagne, amber, rich bronze) -> zero greenish cyan reflection on gold!
    const panelConfigs = [
      { pos: [0, 12, 8],   rot: [Math.PI / 2, 0, 0],  size: [22, 10], color: 0xfff8df, intensity: 4.8 },
      { pos: [-13, 5, 8],  rot: [0, Math.PI / 3, 0],  size: [12, 12], color: 0xffd86b, intensity: 3.6 },
      { pos: [13, 5, 8],   rot: [0, -Math.PI / 3, 0], size: [12, 12], color: 0xfff0b8, intensity: 3.4 },
      { pos: [0, -10, 6],  rot: [-Math.PI / 2, 0, 0], size: [22, 10], color: 0xc97b12, intensity: 2.2 },
      { pos: [0, 2, -12],  rot: [0, 0, 0],            size: [18, 12], color: 0xffb833, intensity: 2.8 }
    ];

    for (const cfg of panelConfigs) {
      const geo = new THREE.PlaneGeometry(cfg.size[0], cfg.size[1]);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(cfg.color).multiplyScalar(cfg.intensity),
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...cfg.pos);
      mesh.rotation.set(...cfg.rot);
      envScene.add(mesh);
    }

    this.envRenderTarget = pmrem.fromScene(envScene, 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    pmrem.dispose();

    // Warm golden key & rim lights
    this.ambientLight = new THREE.AmbientLight(0xfff1cc, 0.72);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5d6, 2.6);
    this.sunLight.position.set(6, 12, 14);
    this.scene.add(this.sunLight);

    this.warmRimLight = new THREE.DirectionalLight(0xffb838, 1.5);
    this.warmRimLight.position.set(-10, -4, 9);
    this.scene.add(this.warmRimLight);

    this.goldPointLight = new THREE.PointLight(0xffcb3d, 3.2, 30);
    this.goldPointLight.position.set(0, 2, 9);
    this.scene.add(this.goldPointLight);
  }

  /**
   * Generate crisp embossed 3D Gold Coin diffuse + bump canvas textures
   */
  _createGoldCoinTextures() {
    const size = 256;
    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = size;
    diffCanvas.height = size;
    const ctx = diffCanvas.getContext('2d');

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bctx = bumpCanvas.getContext('2d');

    const cx = size / 2;
    const cy = size / 2;

    // Diffuse: Radiant brushed casino gold
    const grad = ctx.createRadialGradient(cx - 28, cy - 28, 12, cx, cy, size / 2);
    grad.addColorStop(0, '#FFF8C4');
    grad.addColorStop(0.35, '#FFD740');
    grad.addColorStop(0.78, '#D9910B');
    grad.addColorStop(1, '#8C5200');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Bump base
    bctx.fillStyle = '#707070';
    bctx.fillRect(0, 0, size, size);

    // Outer raised coin rim & notched milled teeth
    ctx.strokeStyle = '#FFF099';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, 114, 0, Math.PI * 2);
    ctx.stroke();

    bctx.strokeStyle = '#FFFFFF';
    bctx.lineWidth = 16;
    bctx.beginPath();
    bctx.arc(cx, cy, 114, 0, Math.PI * 2);
    bctx.stroke();

    // Inner recessed ring
    ctx.strokeStyle = '#9E5D00';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, 92, 0, Math.PI * 2);
    ctx.stroke();

    bctx.strokeStyle = '#303030';
    bctx.lineWidth = 6;
    bctx.beginPath();
    bctx.arc(cx, cy, 92, 0, Math.PI * 2);
    bctx.stroke();

    // Ornamental dots around inner rim
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const dx = cx + Math.cos(a) * 103;
      const dy = cy + Math.sin(a) * 103;
      ctx.fillStyle = '#FFF6B8';
      ctx.beginPath();
      ctx.arc(dx, dy, 3.5, 0, Math.PI * 2);
      ctx.fill();

      bctx.fillStyle = '#FFFFFF';
      bctx.beginPath();
      bctx.arc(dx, dy, 4, 0, Math.PI * 2);
      bctx.fill();
    }

    // Center embossed "$" + Crowned Bass Star Emblem
    const drawEmblem = (c, fill, stroke) => {
      c.save();
      c.font = '900 116px "Bungee", Impact, Arial Black, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 8;
      c.strokeStyle = stroke;
      c.strokeText('$', cx, cy + 6);
      c.fillStyle = fill;
      c.fillText('$', cx, cy + 6);
      c.restore();
    };

    drawEmblem(ctx, '#FFF4B0', '#9A5B00');
    drawEmblem(bctx, '#FFFFFF', '#E0E0E0');

    const map = new THREE.CanvasTexture(diffCanvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    return { map, bumpMap };
  }

  _initCoinPool() {
    const { map, bumpMap } = this._createGoldCoinTextures();

    // Chamfered casino coin (flat faces + ribbed gold rim edge)
    const coinGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.11, 24, 1);
    coinGeo.rotateX(Math.PI / 2); // Face camera when rotation is 0

    const faceMat = new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: 0.04,
      color: 0xffe27a,
      metalness: 0.92,
      roughness: 0.17
    });

    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xffb71c,
      metalness: 0.96,
      roughness: 0.22
    });

    // Materials: [side, topCap, bottomCap]
    this.coinMesh = new THREE.InstancedMesh(coinGeo, [edgeMat, faceMat, faceMat], MAX_COINS);
    this.coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coinMesh.frustumCulled = false;
    this.scene.add(this.coinMesh);

    this.coins = [];
    this._dummy = new THREE.Object3D();

    for (let i = 0; i < MAX_COINS; i++) {
      this.coins.push({
        active: false,
        x: 0, y: -99, z: 0,
        vx: 0, vy: 0, vz: 0,
        rx: 0, ry: 0, rz: 0,
        vrx: 0, vry: 0, vrz: 0,
        scale: 1,
        life: 0,
        maxLife: 2.5
      });
      this._dummy.position.set(0, -99, 0);
      this._dummy.scale.set(0, 0, 0);
      this._dummy.updateMatrix();
      this.coinMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.coinMesh.instanceMatrix.needsUpdate = true;
  }

  _initSparkPool() {
    // 3D Octahedron golden sparkle gems / fiery embers
    const sparkGeo = new THREE.OctahedronGeometry(0.14, 0);
    const sparkMat = new THREE.MeshStandardMaterial({
      color: 0xffe46b,
      emissive: 0xffa600,
      emissiveIntensity: 1.6,
      metalness: 0.6,
      roughness: 0.15
    });

    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, MAX_SPARKS);
    this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparkMesh.frustumCulled = false;
    this.scene.add(this.sparkMesh);

    this.sparks = [];
    for (let i = 0; i < MAX_SPARKS; i++) {
      this.sparks.push({
        active: false,
        x: 0, y: -99, z: 0,
        vx: 0, vy: 0, vz: 0,
        scale: 1,
        life: 0,
        maxLife: 1.0,
        gravity: -12
      });
      this._dummy.position.set(0, -99, 0);
      this._dummy.scale.set(0, 0, 0);
      this._dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Subtle 3D glossy glass bubbles floating in perspective depth across the lake stage
   */
  _initAmbient3DBubbles() {
    this.ambientBubblesGroup = new THREE.Group();
    this.scene.add(this.ambientBubblesGroup);
    this.ambientBubbles = [];

    const bubbleGeo = new THREE.SphereGeometry(1, 16, 16);
    const bubbleMat = new THREE.MeshPhysicalMaterial({
      color: 0xa6f7ff,
      metalness: 0.08,
      roughness: 0.06,
      transmission: 0.45,
      transparent: true,
      opacity: 0.34,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05
    });

    const goldOrbMat = new THREE.MeshStandardMaterial({
      color: 0xffdf70,
      emissive: 0xffaa00,
      emissiveIntensity: 0.9,
      metalness: 0.85,
      roughness: 0.15,
      transparent: true,
      opacity: 0.0
    });
    this.goldAmbientMat = goldOrbMat;

    for (let i = 0; i < 34; i++) {
      const isGoldSpark = i >= 22;
      const mesh = new THREE.Mesh(bubbleGeo, isGoldSpark ? goldOrbMat : bubbleMat);
      const rad = isGoldSpark ? 0.06 + Math.random() * 0.08 : 0.07 + Math.random() * 0.17;
      mesh.scale.setScalar(rad);

      const b = {
        mesh,
        isGoldSpark,
        baseX: (Math.random() - 0.5) * 26,
        y: (Math.random() - 0.5) * 16,
        z: -4 + Math.random() * 7.5,
        speed: 0.8 + Math.random() * 1.9,
        wobbleSpeed: 1.1 + Math.random() * 2.0,
        wobbleAmp: 0.25 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2
      };
      mesh.position.set(b.baseX, b.y, b.z);
      this.ambientBubblesGroup.add(mesh);
      this.ambientBubbles.push(b);
    }
  }

  /**
   * Real-time 3D Rotating Golden Starburst Trophy & Floating Casino Crown for Big/Mega/Superb Wins
   */
  _initCelebrationTrophy() {
    this.trophyGroup = new THREE.Group();
    this.trophyGroup.position.set(0, 0.3, 1.5);
    this.trophyGroup.scale.setScalar(0.0001);
    this.trophyGroup.visible = false;
    this.scene.add(this.trophyGroup);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      emissive: 0x703e00,
      emissiveIntensity: 0.45,
      metalness: 0.95,
      roughness: 0.14
    });

    const brightGoldMat = new THREE.MeshStandardMaterial({
      color: 0xfff0a3,
      emissive: 0xffb300,
      emissiveIntensity: 0.65,
      metalness: 0.92,
      roughness: 0.1
    });

    const rubyMat = new THREE.MeshStandardMaterial({
      color: 0xff2244,
      emissive: 0xaa0018,
      emissiveIntensity: 0.7,
      metalness: 0.35,
      roughness: 0.12
    });

    // 0. Sculpted Deep Royal-Navy Metallic Medallion Core behind the text for 10/10 contrast
    const medallionMat = new THREE.MeshStandardMaterial({
      color: 0x051c33,
      emissive: 0x020d1a,
      emissiveIntensity: 0.5,
      metalness: 0.65,
      roughness: 0.3,
      transparent: true,
      opacity: 0.88
    });
    const medallionDisc = new THREE.Mesh(new THREE.CircleGeometry(3.15, 64), medallionMat);
    medallionDisc.position.z = -1.25;
    this.trophyGroup.add(medallionDisc);

    // 1. Outer 14-point rotating golden sun-rays halo
    this.outerStarGroup = new THREE.Group();
    const rayGeo = new THREE.ConeGeometry(0.45, 5.2, 4);
    for (let i = 0; i < 14; i++) {
      const ray = new THREE.Mesh(rayGeo, i % 2 === 0 ? goldMat : brightGoldMat);
      const angle = (i / 14) * Math.PI * 2;
      ray.position.set(Math.cos(angle) * 2.55, Math.sin(angle) * 2.55, -1.6);
      ray.rotation.z = angle - Math.PI / 2;
      this.outerStarGroup.add(ray);
    }
    this.trophyGroup.add(this.outerStarGroup);

    // 2. Counter-rotating beveled double trophy rings
    this.innerRingGroup = new THREE.Group();
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(3.22, 0.14, 16, 64), goldMat);
    ring1.position.z = -1.18;
    this.innerRingGroup.add(ring1);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.68, 0.08, 12, 64), brightGoldMat);
    ring2.position.z = -1.35;
    this.innerRingGroup.add(ring2);

    // 12 studded gems around the outer gold ring
    const studGeo = new THREE.OctahedronGeometry(0.18, 0);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const stud = new THREE.Mesh(studGeo, i % 2 === 0 ? rubyMat : brightGoldMat);
      stud.position.set(Math.cos(a) * 3.22, Math.sin(a) * 3.22, -1.08);
      this.innerRingGroup.add(stud);
    }
    this.trophyGroup.add(this.innerRingGroup);

    // 3. Sculpted 3D Royal Crown hovering above the win title
    this.crownGroup = new THREE.Group();
    this.crownGroup.position.set(0, 3.25, 0.25);

    const crownBand = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.88, 0.52, 24, 1, true), goldMat);
    crownBand.material.side = THREE.DoubleSide;
    this.crownGroup.add(crownBand);

    const crownRim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.09, 12, 28), brightGoldMat);
    crownRim.rotation.x = Math.PI / 2;
    crownRim.position.y = -0.24;
    this.crownGroup.add(crownRim);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.72, 5), goldMat);
      spike.position.set(Math.cos(a) * 0.92, 0.52, Math.sin(a) * 0.92);
      spike.rotation.z = -Math.cos(a) * 0.2;
      spike.rotation.x = Math.sin(a) * 0.2;
      this.crownGroup.add(spike);

      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), i % 2 === 0 ? rubyMat : brightGoldMat);
      orb.position.set(Math.cos(a) * 1.0, 0.9, Math.sin(a) * 1.0);
      this.crownGroup.add(orb);
    }

    this.trophyGroup.add(this.crownGroup);
  }

  _bindResizeAndParallax() {
    window.addEventListener('resize', () => {
      if (!this.enabled || this.isDisposed) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
    });

    window.addEventListener('pointermove', e => {
      if (!this.enabled) return;
      this.mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      this.mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
    });
  }

  /**
   * Convert normalized viewport coordinates (0..1, 0..1 from top-left) to Three.js world space at depth targetZ
   */
  screenNormToWorld(nx, ny, targetZ = 0) {
    const ndcX = nx * 2 - 1;
    const ndcY = -(ny * 2 - 1);
    const vec = new THREE.Vector3(ndcX, ndcY, 0.5);
    vec.unproject(this.camera);
    const dir = vec.sub(this.camera.position).normalize();
    const dist = (targetZ - this.camera.position.z) / dir.z;
    return this.camera.position.clone().add(dir.multiplyScalar(dist));
  }

  /**
   * Convert a PixiJS canvas coordinate (0..1200, 0..690) into normalized viewport coordinates (0..1)
   */
  canvasCoordsToScreenNorm(slotCanvas, px, py) {
    if (!slotCanvas) return { nx: 0.5, ny: 0.5 };
    const rect = slotCanvas.getBoundingClientRect();
    const screenX = rect.left + (px / 1200) * rect.width;
    const screenY = rect.top + (py / 690) * rect.height;
    return {
      nx: screenX / window.innerWidth,
      ny: screenY / window.innerHeight
    };
  }

  setFreeSpinsMode(active) {
    this.isFreeSpins = active;
    if (!this.enabled) return;
    if (this.goldPointLight) {
      this.goldPointLight.color.setHex(active ? 0xff9d00 : 0xffd24d);
      this.goldPointLight.intensity = active ? 4.4 : 2.8;
    }
  }

  /**
   * Spawn a burst of physically-simulated 3D tumbling Gold Coins from any normalized screen position
   */
  burstCoins(nx = 0.5, ny = 0.55, count = 24, power = 1.0) {
    if (!this.enabled) return;
    const origin = this.screenNormToWorld(nx, ny, 2.0);
    let spawned = 0;

    for (let i = 0; i < MAX_COINS && spawned < count; i++) {
      const c = this.coins[i];
      if (!c.active) {
        c.active = true;
        c.x = origin.x + (Math.random() - 0.5) * 0.8;
        c.y = origin.y + (Math.random() - 0.5) * 0.5;
        c.z = origin.z + (Math.random() - 0.5) * 1.4;

        const angle = (Math.random() - 0.5) * Math.PI * 0.95;
        const upSpeed = (7.2 + Math.random() * 6.8) * power;
        c.vx = Math.sin(angle) * (4.5 + Math.random() * 5.0) * power;
        c.vy = upSpeed;
        c.vz = (1.5 + Math.random() * 4.5) * power;

        c.rx = Math.random() * Math.PI * 2;
        c.ry = Math.random() * Math.PI * 2;
        c.rz = Math.random() * Math.PI * 2;
        c.vrx = (Math.random() - 0.5) * 14;
        c.vry = (Math.random() - 0.5) * 16;
        c.vrz = (Math.random() - 0.5) * 10;

        c.scale = 0.72 + Math.random() * 0.45;
        c.life = 0;
        c.maxLife = 1.8 + Math.random() * 1.1;
        spawned++;
      }
    }

    // Layer crisp 3D sparkles on coin launch
    this.burstSparks(nx, ny, Math.min(24, Math.ceil(count * 0.7)), power);
  }

  burstSparks(nx = 0.5, ny = 0.5, count = 18, power = 1.0) {
    if (!this.enabled) return;
    const origin = this.screenNormToWorld(nx, ny, 2.5);
    let spawned = 0;

    for (let i = 0; i < MAX_SPARKS && spawned < count; i++) {
      const s = this.sparks[i];
      if (!s.active) {
        s.active = true;
        s.x = origin.x;
        s.y = origin.y;
        s.z = origin.z;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const spd = (4 + Math.random() * 8) * power;
        s.vx = Math.sin(phi) * Math.cos(theta) * spd;
        s.vy = Math.abs(Math.cos(phi)) * spd + 2.5;
        s.vz = Math.sin(phi) * Math.sin(theta) * spd * 0.6;
        s.scale = 0.6 + Math.random() * 0.9;
        s.life = 0;
        s.maxLife = 0.6 + Math.random() * 0.55;
        s.gravity = -11;
        spawned++;
      }
    }
  }

  /**
   * Expanding 3D luminous shockwave ring (for Dynamite, Bazooka, Hook impact, Level-Up!)
   */
  spawnShockwave(nx = 0.5, ny = 0.5, colorHex = 0xffae00, maxScale = 4.2) {
    if (!this.enabled) return;
    const pos = this.screenNormToWorld(nx, ny, 2.2);
    const geo = new THREE.TorusGeometry(0.85, 0.024, 12, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.85
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    this.scene.add(mesh);

    this.activeShockwaves.push({
      mesh,
      life: 0,
      maxLife: 0.45,
      maxScale
    });
  }

  /**
   * Launch a real 3D tumbling Dynamite Bundle or 3D Bazooka Rocket across the screen!
   */
  launch3DProjectile(type, startNx, startNy, endNx, endNy, durationMs = 430) {
    if (!this.enabled) return Promise.resolve();

    const startPos = this.screenNormToWorld(startNx, startNy, 5.5);
    const endPos = this.screenNormToWorld(endNx, endNy, 1.5);
    const group = new THREE.Group();

    if (type === 'DYNAMITE') {
      // 3-stick 3D Red Dynamite Bundle wrapped with dark tape + burning yellow spark fuse
      const stickGeo = new THREE.CylinderGeometry(0.14, 0.14, 1.15, 14);
      const redMat = new THREE.MeshStandardMaterial({ color: 0xe62018, roughness: 0.35, metalness: 0.1 });
      const tapeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.2 });

      const offsets = [
        [-0.12, 0, -0.06],
        [0.12, 0, -0.06],
        [0, 0, 0.13]
      ];
      for (const off of offsets) {
        const stick = new THREE.Mesh(stickGeo, redMat);
        stick.position.set(...off);
        group.add(stick);
      }

      const band1 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 18), tapeMat);
      band1.position.y = 0.25;
      const band2 = band1.clone();
      band2.position.y = -0.25;
      group.add(band1, band2);

      // Glowing spark tip
      const sparkBall = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.24, 0),
        new THREE.MeshBasicMaterial({ color: 0xfff36b })
      );
      sparkBall.position.set(0.15, 0.85, 0);
      group.add(sparkBall);
      group._sparkBall = sparkBall;
    } else {
      // 3D Bazooka Warhead with metallic olive body, red cone, 4 tail fins & glowing plasma thrust
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3b4d3e, metalness: 0.72, roughness: 0.28 });
      const noseMat = new THREE.MeshStandardMaterial({ color: 0xff2820, metalness: 0.55, roughness: 0.22 });
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8c00 });

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.3, 16), bodyMat);
      body.rotation.z = -Math.PI / 2;
      group.add(body);

      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.58, 16), noseMat);
      nose.rotation.z = -Math.PI / 2;
      nose.position.x = 0.94;
      group.add(nose);

      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.95, 10), flameMat);
      flame.rotation.z = Math.PI / 2;
      flame.position.x = -1.1;
      group.add(flame);
      group._flame = flame;
    }

    group.position.copy(startPos);
    this.scene.add(group);

    return new Promise(resolve => {
      this.activeProjectiles.push({
        type,
        group,
        startPos,
        endPos,
        endNx,
        endNy,
        elapsed: 0,
        duration: durationMs / 1000,
        resolve
      });
    });
  }

  /**
   * Show the dramatic 3D Golden Starburst Trophy + Twin 3D Coin Fountains for Big / Mega / Superb Wins
   */
  startCelebration(intensity = 1.0) {
    if (!this.enabled) return;
    this.fountainActive = true;
    this.fountainIntensity = intensity;
    this.trophyActive = true;
    this.trophyTargetScale = 1.0;
    if (this.trophyGroup) {
      this.trophyGroup.visible = true;
    }
    // Raise canvas z-index slightly while keeping celebration text clearly above it
    this.canvas.classList.add('celebration-active');

    // Immediate opening twin-side blasts of pure 24K 3D gold coins framing the center trophy medallion!
    this.burstCoins(0.22, 0.78, 22, 1.25);
    this.burstCoins(0.78, 0.78, 22, 1.25);
    this.spawnShockwave(0.5, 0.5, 0xffd700, 5.2);
  }

  stopCelebration() {
    this.fountainActive = false;
    this.trophyActive = false;
    this.trophyTargetScale = 0;
    this.canvas.classList.remove('celebration-active');
  }

  _startLoop() {
    const animate = () => {
      if (this.isDisposed) return;
      requestAnimationFrame(animate);
      if (!this.enabled) return;

      const dt = Math.min(0.05, this.clock.getDelta());
      const now = this.clock.elapsedTime;
      this._update(dt, now);
      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(animate);
  }

  _update(dt, now) {
    // 1. Subtle 3D camera parallax
    this.camOffsetX += (this.mouseX * 0.45 - this.camOffsetX) * Math.min(1, dt * 4);
    this.camOffsetY += (this.mouseY * 0.30 - this.camOffsetY) * Math.min(1, dt * 4);
    this.camera.position.x = this.camOffsetX;
    this.camera.position.y = this.camOffsetY;
    this.camera.lookAt(0, 0, 0);

    // 2. Ambient 3D underwater bubbles & Free Spins golden bokeh sparks
    const targetGoldAlpha = this.isFreeSpins ? 0.65 : 0.0;
    this.goldAmbientMat.opacity += (targetGoldAlpha - this.goldAmbientMat.opacity) * Math.min(1, dt * 3);

    for (const b of this.ambientBubbles) {
      b.y += b.speed * dt;
      if (b.y > 9.5) {
        b.y = -9.5;
        b.baseX = (Math.random() - 0.5) * 26;
      }
      b.mesh.position.x = b.baseX + Math.sin(now * b.wobbleSpeed + b.phase) * b.wobbleAmp;
      b.mesh.position.y = b.y;
    }

    // 3. Continuous Twin 3D Coin Fountain during Big/Mega/Superb Win celebration
    if (this.fountainActive) {
      this.fountainAccumulator += dt * 36 * this.fountainIntensity;
      while (this.fountainAccumulator >= 1) {
        this.fountainAccumulator -= 1;
        const fromLeft = Math.random() < 0.5;
        this.burstCoins(
          fromLeft ? 0.14 + Math.random() * 0.12 : 0.74 + Math.random() * 0.12,
          0.96,
          2,
          1.22 + Math.random() * 0.28
        );
      }
    }

    // 4. Update 3D Celebration Starburst Trophy & Floating Crown
    if (this.trophyGroup && (this.trophyActive || this.trophyScale > 0.005)) {
      this.trophyScale += (this.trophyTargetScale - this.trophyScale) * Math.min(1, dt * 6.5);
      this.trophyGroup.scale.setScalar(Math.max(0.0001, this.trophyScale));
      this.outerStarGroup.rotation.z = now * 0.45;
      this.innerRingGroup.rotation.z = -now * 0.65;
      this.innerRingGroup.rotation.x = Math.sin(now * 1.4) * 0.15;
      this.crownGroup.rotation.y = now * 1.8;
      this.crownGroup.position.y = 3.25 + Math.sin(now * 3.2) * 0.16;
      if (!this.trophyActive && this.trophyScale <= 0.01) {
        this.trophyGroup.visible = false;
      }
    }

    // 5. Update 3D Instanced Gold Coins
    let coinsDirty = false;
    for (let i = 0; i < MAX_COINS; i++) {
      const c = this.coins[i];
      if (!c.active) continue;
      coinsDirty = true;

      c.life += dt;
      c.vy -= 17.5 * dt; // Gravity
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;
      c.rx += c.vrx * dt;
      c.ry += c.vry * dt;
      c.rz += c.vrz * dt;

      const fade = c.life > c.maxLife - 0.35 ? Math.max(0, (c.maxLife - c.life) / 0.35) : 1;
      const sc = c.scale * fade;

      if (c.life >= c.maxLife || c.y < -12) {
        c.active = false;
        this._dummy.position.set(0, -99, 0);
        this._dummy.scale.set(0, 0, 0);
      } else {
        this._dummy.position.set(c.x, c.y, c.z);
        this._dummy.rotation.set(c.rx, c.ry, c.rz);
        this._dummy.scale.set(sc, sc, sc);
      }
      this._dummy.updateMatrix();
      this.coinMesh.setMatrixAt(i, this._dummy.matrix);
    }
    if (coinsDirty) {
      this.coinMesh.instanceMatrix.needsUpdate = true;
    }

    // 6. Update 3D Instanced Sparkles / Embers
    let sparksDirty = false;
    for (let i = 0; i < MAX_SPARKS; i++) {
      const s = this.sparks[i];
      if (!s.active) continue;
      sparksDirty = true;

      s.life += dt;
      s.vy += s.gravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;

      const fade = Math.max(0, 1 - s.life / s.maxLife);
      if (s.life >= s.maxLife) {
        s.active = false;
        this._dummy.position.set(0, -99, 0);
        this._dummy.scale.set(0, 0, 0);
      } else {
        this._dummy.position.set(s.x, s.y, s.z);
        this._dummy.rotation.set(now * 6 + i, now * 5, 0);
        this._dummy.scale.setScalar(s.scale * fade);
      }
      this._dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, this._dummy.matrix);
    }
    if (sparksDirty) {
      this.sparkMesh.instanceMatrix.needsUpdate = true;
    }

    // 7. Update 3D Dynamite / Bazooka Projectiles
    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const p = this.activeProjectiles[i];
      p.elapsed += dt;
      const t = Math.min(1, p.elapsed / p.duration);

      const pos = new THREE.Vector3().lerpVectors(p.startPos, p.endPos, t);
      if (p.type === 'DYNAMITE') {
        pos.y += Math.sin(t * Math.PI) * 3.8;
        pos.z += Math.sin(t * Math.PI) * 3.2;
        p.group.rotation.x = t * Math.PI * 3.5;
        p.group.rotation.z = t * Math.PI * 5.0;
        if (p.group._sparkBall) {
          p.group._sparkBall.scale.setScalar(0.8 + Math.sin(now * 50) * 0.45);
        }
      } else {
        pos.z += Math.sin(t * Math.PI) * 2.0;
        p.group.rotation.x = t * Math.PI * 4.0;
        if (p.group._flame) {
          p.group._flame.scale.set(1, 0.8 + Math.sin(now * 60) * 0.35, 1);
        }
      }
      p.group.position.copy(pos);

      if (t >= 1) {
        this.scene.remove(p.group);
        this.spawnShockwave(p.endNx, p.endNy, 0xff6a00, 4.4);
        this.burstSparks(p.endNx, p.endNy, 28, 1.35);
        this.activeProjectiles.splice(i, 1);
        p.resolve();
      }
    }

    // 8. Update 3D Impact Shockwaves
    for (let i = this.activeShockwaves.length - 1; i >= 0; i--) {
      const sw = this.activeShockwaves[i];
      sw.life += dt;
      const p = Math.min(1, sw.life / sw.maxLife);
      const easeOut = 1 - Math.pow(1 - p, 3);
      sw.mesh.scale.setScalar(0.4 + easeOut * sw.maxScale);
      sw.mesh.material.opacity = Math.max(0, 1 - p);
      if (sw.life >= sw.maxLife) {
        this.scene.remove(sw.mesh);
        sw.mesh.geometry.dispose();
        sw.mesh.material.dispose();
        this.activeShockwaves.splice(i, 1);
      }
    }
  }
}
