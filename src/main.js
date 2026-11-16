import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { initPhysics, Sim, PIECES, W, H, MARBLE_R } from './sim.js';
import { LEVELS } from './levels.js';

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x12151f, 1);
renderer.xr.enabled = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 20);
camera.position.set(0, 0.25, 0.85);
camera.lookAt(0, 0.12, 0);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 0.85));
const sun = new THREE.DirectionalLight(0xfff5e6, 1.4);
sun.position.set(0.4, 1.2, 0.6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

// diorama root
const diorama = new THREE.Group();
scene.add(diorama);
const levelGroup = new THREE.Group();
const piecesGroup = new THREE.Group();
const trayGroup = new THREE.Group();
const uiGroup = new THREE.Group();
diorama.add(levelGroup, piecesGroup, trayGroup, uiGroup);

// desktop virtual table
const table = new THREE.Mesh(
  new THREE.CylinderGeometry(1.1, 1.1, 0.02, 64),
  new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.75, metalness: 0.05 }));
table.position.y = -0.011;
table.receiveShadow = true;
scene.add(table);

// contact shadow under diorama for desk grounding
const contactShadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.32, 32),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
contactShadow.rotation.x = -Math.PI / 2;
contactShadow.position.y = 0.001;
diorama.add(contactShadow);

// ---------------------------------------------------------------- helpers
function textPlane(w, h, px = 512) {
  const c = document.createElement('canvas');
  c.width = px; c.height = Math.round(px * h / w);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  mesh.userData.set = (lines, opts = {}) => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    if (opts.bg) { g.fillStyle = opts.bg; g.beginPath(); g.roundRect(6, 6, c.width - 12, c.height - 12, 24); g.fill(); }
    g.fillStyle = opts.color || '#ffffff';
    g.textAlign = opts.align || 'center';
    g.textBaseline = 'middle';
    const arr = Array.isArray(lines) ? lines : [lines];
    const maxWidth = c.width - 40;
    const wrapped = [];
    arr.forEach((ln, i) => {
      const fontSize = opts.size || Math.floor(c.height / (arr.length + 1.2));
      g.font = `${i === 0 && opts.boldFirst ? '700 ' : '500 '}${fontSize}px system-ui, sans-serif`;
      const words = String(ln).split(' ');
      let line = '';
      for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (g.measureText(test).width > maxWidth && line) {
          wrapped.push({ text: line, bold: i === 0 && opts.boldFirst, size: fontSize });
          line = word;
        } else line = test;
      }
      if (line) wrapped.push({ text: line, bold: i === 0 && opts.boldFirst, size: fontSize });
    });
    const lineH = Math.min(c.height / (wrapped.length + 1), (opts.size || 40) * 1.15);
    wrapped.forEach((item, i) => {
      g.font = `${item.bold ? '700 ' : '500 '}${item.size}px system-ui, sans-serif`;
      const x = g.textAlign === 'left' ? 24 : c.width / 2;
      g.fillText(item.text, x, (c.height / (wrapped.length + 1)) * (i + 1));
    });
    tex.needsUpdate = true;
  };
  return mesh;
}

function makePieceMesh(type, opts = {}) {
  const def = PIECES[type];
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: opts.ghostColor ?? def.color, roughness: 0.35, metalness: 0.25,
    emissive: def.color, emissiveIntensity: opts.ghost ? 0.4 : 0.25,
    transparent: !!opts.ghost, opacity: opts.ghost ? 0.45 : 1,
  });
  if (type === 'bumper') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(def.radius, def.radius, 0.045, 32), mat);
    m.rotation.x = Math.PI / 2;
    m.castShadow = true;
    g.add(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(def.radius * 0.7, 0.004, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: !!opts.ghost, opacity: opts.ghost ? 0.5 : 1 }));
    ring.position.z = 0.024;
    g.add(ring);
  } else if (type === 'fan') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(def.half[0] * 2, def.half[1] * 2, def.half[2] * 2), mat));
    if (!opts.icon) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.17, 0.035),
        new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.15, depthWrite: false }));
      col.position.y = 0.09;
      g.add(col);
    }
    g.userData.arrows = [];
    for (let i = 0; i < 3; i++) {
      const a = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.018, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
      a.userData.phase = i / 3;
      a.userData.x = (i - 1) * 0.015;
      a.position.set(a.userData.x, 0.022, 0);
      g.add(a);
      g.userData.arrows.push(a);
    }
  } else {
    const m = new THREE.Mesh(new THREE.BoxGeometry(def.half[0] * 2, def.half[1] * 2, def.half[2] * 2), mat);
    m.rotation.z = def.angle;
    m.castShadow = true;
    g.add(m);
  }
  g.userData.type = type;
  return g;
}

let audio = null;
function beep(freq, dur = 0.08, type = 'sine', gain = 0.07, delay = 0) {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const t = audio.currentTime + delay;
    const o = audio.createOscillator(); const gn = audio.createGain();
    o.type = type; o.frequency.value = freq;
    gn.gain.setValueAtTime(gain, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(audio.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch { /* optional */ }
}
const sfx = {
  grab: () => beep(480, 0.05, 'triangle'),
  place: () => { beep(320, 0.06, 'triangle'); beep(420, 0.07, 'triangle', 0.07, 0.05); },
  bad: () => beep(130, 0.16, 'sawtooth', 0.04),
  drop: () => beep(620, 0.09, 'square', 0.035),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, 0.2, 'triangle', 0.08, i * 0.09)),
  lose: () => { beep(280, 0.1, 'sine'); beep(200, 0.22, 'sine', 0.06, 0.08); },
  placeDiorama: () => { beep(440, 0.1, 'triangle'); beep(660, 0.12, 'triangle', 0.07, 0.08); },
};

// ---------------------------------------------------------------- static scenery
(function buildFrame() {
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H),
    new THREE.MeshStandardMaterial({ color: 0x0e1424, roughness: 0.85, transparent: true, opacity: 0.75 }));
  back.position.set(0, H / 2, -0.03);
  diorama.add(back);

  const pts = [];
  for (let x = -W / 2; x <= W / 2 + 1e-6; x += 0.025) pts.push(x, 0, -0.029, x, H, -0.029);
  for (let y = 0; y <= H + 1e-6; y += 0.025) pts.push(-W / 2, y, -0.029, W / 2, y, -0.029);
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  diorama.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x3a4a70 })));

  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xa8b4d8, metalness: 0.7, roughness: 0.25 });
  const mk = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), edgeMat);
    m.position.set(x, y, z); m.castShadow = true; diorama.add(m);
  };
  mk(W + 0.022, 0.012, 0.075, 0, -0.006, 0);
  mk(0.01, H, 0.01, -W / 2 - 0.005, H / 2, 0.03);
  mk(0.01, H, 0.01, W / 2 + 0.005, H / 2, 0.03);
  mk(0.01, H, 0.01, -W / 2 - 0.005, H / 2, -0.03);
  mk(0.01, H, 0.01, W / 2 + 0.005, H / 2, -0.03);
  mk(W + 0.022, 0.01, 0.01, 0, H, 0.03);
  mk(W + 0.022, 0.01, 0.01, 0, H, -0.03);
})();

const marbleMesh = new THREE.Mesh(
  new THREE.SphereGeometry(MARBLE_R, 32, 20),
  new THREE.MeshStandardMaterial({ color: 0xf0f4ff, metalness: 0.95, roughness: 0.08 }));
marbleMesh.castShadow = true;
marbleMesh.visible = false;
diorama.add(marbleMesh);

const hud = textPlane(0.42, 0.12, 1024);
hud.position.set(0, H + 0.065, 0);
uiGroup.add(hud);

// win particles
const winParticles = new THREE.Group();
diorama.add(winParticles);
function spawnWinParticles(pos) {
  for (let i = 0; i < 18; i++) {
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.004, 8, 6),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0x57ffb0 : 0xffd166, transparent: true }));
    p.position.set(pos.x, pos.y, 0);
    p.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.5 + 0.2, (Math.random() - 0.5) * 0.3);
    p.userData.life = 1.2;
    winParticles.add(p);
  }
}

// ---------------------------------------------------------------- game state
const S = {
  levelIndex: 0, sim: null, placed: new Map(), nextId: 1,
  hintUntil: 0, hintMeshes: [], placing: false, xr: false, opaque: false,
  advanceAt: 0, resetAt: 0, wonHandled: false, lostHandled: false, msg: '', msgUntil: 0,
  tray: [], buttons: [], goalGroup: null, firstPlaceDone: false,
};

const clearOfStatics = (level, p) => level.statics.every(
  (s) => !(Math.abs(p.x - s.x) < s.w / 2 + 0.05 && Math.abs(p.y - s.y) < s.h / 2 + 0.03));

function remaining() {
  const inv = LEVELS[S.levelIndex].inventory;
  const left = { ...inv };
  for (const { piece } of S.placed.values()) left[piece.type]--;
  for (const p of pointers.values()) if (p.held) left[p.held.type]--;
  return left;
}

function setHud(sub) {
  const lv = LEVELS[S.levelIndex];
  const title = lv.sandbox ? 'Sandbox  ·  Build freely' : `Level ${S.levelIndex + 1}/${LEVELS.length - 1}  ·  ${lv.name}`;
  hud.userData.set([title, sub ?? lv.hint], { bg: 'rgba(8,12,28,.82)', boldFirst: true, size: 42 });
}
function flash(text, ms = 2800) { S.msg = text; S.msgUntil = performance.now() + ms; setHud(text); }

function updateTrayLabels() {
  const left = remaining();
  for (const t of S.tray) {
    t.label.userData.set(`×${left[t.type]}`, { color: left[t.type] > 0 ? '#ffffff' : '#556', size: 72 });
    t.mesh.visible = left[t.type] > 0;
  }
}

function disposeTree(o) {
  o.traverse((c) => { c.geometry?.dispose?.(); if (c.material) { c.material.map?.dispose?.(); c.material.dispose?.(); } });
}
function clearGroup(g) { for (const c of [...g.children]) { g.remove(c); disposeTree(c); } }

function loadLevel(i) {
  S.levelIndex = (i + LEVELS.length) % LEVELS.length;
  const lv = LEVELS[S.levelIndex];
  S.sim?.world.free();
  S.sim = new Sim(lv);
  S.placed.clear();
  for (const p of pointers.values()) p.held = null;
  clearGroup(piecesGroup); clearGroup(levelGroup); clearGroup(trayGroup);
  S.wonHandled = S.lostHandled = false; S.advanceAt = S.resetAt = 0;
  marbleMesh.visible = false;
  clearHint();
  while (winParticles.children.length) winParticles.remove(winParticles.children[0]);

  for (const s of lv.statics) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, 0.042),
      new THREE.MeshStandardMaterial({ color: 0x3e4668, roughness: 0.55, metalness: 0.1 }));
    m.position.set(s.x, s.y, 0); m.rotation.z = s.rot || 0;
    m.castShadow = true; m.receiveShadow = true;
    levelGroup.add(m);
  }

  // start chute
  const chute = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.022, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xffd166, side: THREE.DoubleSide, emissive: 0xffaa44, emissiveIntensity: 0.3 }));
  chute.position.set(lv.start.x, lv.start.y + 0.015, 0);
  levelGroup.add(chute);

  // goal cup
  if (!lv.sandbox) {
    const gg = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.005, 12, 48),
      new THREE.MeshBasicMaterial({ color: 0x57ffb0 }));
    gg.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.028, 48),
      new THREE.MeshBasicMaterial({ color: 0x57ffb0, transparent: true, opacity: 0.22 }));
    gg.add(disc);
    gg.position.set(lv.goal.x, lv.goal.y, 0);
    levelGroup.add(gg);
    S.goalGroup = gg;
  } else S.goalGroup = null;

  // tray
  S.tray = [];
  const types = Object.keys(lv.inventory);
  types.forEach((type, k) => {
    const y = 0.26 - k * 0.072;
    const mesh = makePieceMesh(type, { icon: true });
    mesh.scale.setScalar(0.72);
    mesh.position.set(0.32, y, 0);
    trayGroup.add(mesh);
    const label = textPlane(0.055, 0.032, 128);
    label.position.set(0.32, y - 0.034, 0.02);
    trayGroup.add(label);
    S.tray.push({ type, mesh, label, pos: new THREE.Vector3(0.32, y, 0) });
  });

  updateTrayLabels();
  setHud();
}

// ---------------------------------------------------------------- buttons
function buildButtons() {
  const defs = [
    ['Drop', 0x3ddc84, () => dropMarble()],
    ['Reset', 0xffa94d, () => resetRun(true)],
    ['Hint', 0xffe066, () => showHint()],
    ['Prev', 0x74c0fc, () => loadLevel(S.levelIndex - 1)],
    ['Next', 0x74c0fc, () => loadLevel(S.levelIndex + 1)],
    ['Move', 0xb197fc, () => { S.placing = true; flash('Pinch on your desk to move the frame'); }],
  ];
  defs.forEach(([name, color, action], i) => {
    const y = 0.275 - i * 0.052;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.014, 28),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.35 }));
    m.rotation.x = Math.PI / 2;
    m.position.set(-0.33, y, 0);
    uiGroup.add(m);
    const label = textPlane(0.075, 0.032, 160);
    label.userData.set(name, { size: 50, align: 'left' });
    label.position.set(-0.26, y, 0.01);
    uiGroup.add(label);
    S.buttons.push({ name, mesh: m, action, pos: new THREE.Vector3(-0.33, y, 0) });
  });
}

function dropMarble() {
  if (S.sim.state !== 'idle') return;
  for (const p of pointers.values()) if (p.held) return;
  clearHint();
  S.sim.drop();
  S.wonHandled = S.lostHandled = false;
  marbleMesh.visible = true;
  sfx.drop();
  setHud('Rolling...');
}

function resetRun(user) {
  S.sim.reset();
  marbleMesh.visible = false;
  S.wonHandled = S.lostHandled = false; S.advanceAt = S.resetAt = 0;
  if (user) sfx.grab();
  setHud();
}

function clearHint() { for (const m of S.hintMeshes) { diorama.remove(m); disposeTree(m); } S.hintMeshes = []; S.hintUntil = 0; }
function showHint() {
  clearHint();
  const lv = LEVELS[S.levelIndex];
  if (!lv.solution?.length) { flash(lv.sandbox ? 'No hints in the sandbox' : lv.hint); return; }
  for (const p of lv.solution) {
    const m = makePieceMesh(p.type, { ghost: true, icon: true, ghostColor: 0xffffff });
    m.position.set(p.x, p.y, 0);
    diorama.add(m); S.hintMeshes.push(m);
  }
  S.hintUntil = performance.now() + 5500;
  flash('Ghost pieces show one working solution', 5500);
}

// ---------------------------------------------------------------- pointers
const pointers = new Map();
function getPtr(id) {
  if (!pointers.has(id)) pointers.set(id, { id, pos: new THREE.Vector3(), world: new THREE.Vector3(), pinching: false, was: false, held: null });
  return pointers.get(id);
}

const hands = [];
const handFactory = new XRHandModelFactory();
const controllers = [];
for (let i = 0; i < 2; i++) {
  const hand = renderer.xr.getHand(i);
  hand.add(handFactory.createHandModel(hand, 'spheres'));
  scene.add(hand);
  hands.push(hand);
  const ctrl = renderer.xr.getController(i);
  ctrl.userData = { selecting: false, isHand: false, connected: false };
  ctrl.addEventListener('connected', (e) => { ctrl.userData.isHand = !!e.data.hand; ctrl.userData.connected = true; });
  ctrl.addEventListener('disconnected', () => { ctrl.userData.connected = false; ctrl.userData.selecting = false; });
  ctrl.addEventListener('selectstart', () => { ctrl.userData.selecting = true; });
  ctrl.addEventListener('selectend', () => { ctrl.userData.selecting = false; });
  scene.add(ctrl);
  controllers.push(ctrl);
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function readXRPointers() {
  for (let i = 0; i < 2; i++) {
    const p = getPtr('xr' + i);
    const hand = hands[i], ctrl = controllers[i];
    const it = hand.joints?.['index-finger-tip'], tt = hand.joints?.['thumb-tip'];
    let ok = false;
    if (ctrl.userData.connected && ctrl.userData.isHand && it && tt) {
      it.getWorldPosition(_a); tt.getWorldPosition(_b);
      if (_a.lengthSq() > 1e-6 && _b.lengthSq() > 1e-6) {
        const d = _a.distanceTo(_b);
        p.world.copy(_a).add(_b).multiplyScalar(0.5);
        p.pinching = p.was ? d < 0.036 : d < 0.024;
        ok = true;
      }
    } else if (ctrl.userData.connected && !ctrl.userData.isHand) {
      ctrl.getWorldPosition(p.world);
      p.pinching = ctrl.userData.selecting;
      ok = true;
    }
    p.active = ok;
    if (!ok) p.pinching = false;
    if (ok) p.pos.copy(diorama.worldToLocal(p.world.clone()));
  }
}

// mouse preview
const mouse = getPtr('mouse');
mouse.active = true;
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
function mouseToLocal(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const inv = diorama.matrixWorld.clone().invert();
  const localRay = ray.ray.clone().applyMatrix4(inv);
  const hit = new THREE.Vector3();
  if (localRay.intersectPlane(plane, hit)) { mouse.pos.copy(hit); mouse.world.copy(hit); }
}
renderer.domElement.addEventListener('pointermove', (e) => { if (!S.xr) mouseToLocal(e); });
renderer.domElement.addEventListener('pointerdown', (e) => { if (!S.xr) { mouseToLocal(e); mouse.pinching = true; } });
window.addEventListener('pointerup', () => { mouse.pinching = false; });

// ---------------------------------------------------------------- interactions
function nearest(list, pos, maxD) {
  let best = null, bd = maxD;
  for (const it of list) {
    const d = Math.hypot(it.pos.x - pos.x, it.pos.y - pos.y) + Math.abs(pos.z) * 0.5;
    if (d < bd) { bd = d; best = it; }
  }
  return best;
}

function placeDiorama(p) {
  const head = new THREE.Vector3();
  renderer.xr.getCamera().getWorldPosition(head);
  diorama.position.set(p.world.x, p.world.y - 0.005, p.world.z);
  diorama.rotation.y = Math.atan2(head.x - p.world.x, head.z - p.world.z);
  diorama.updateMatrixWorld(true);
  diorama.visible = true;
  table.position.copy(diorama.position); table.position.y -= 0.011;
  table.visible = S.opaque;
  intro.visible = false;
  S.placing = false;
  S.firstPlaceDone = true;
  sfx.placeDiorama();
  flash('Frame placed on your desk. Pinch pieces from the right tray!', 3800);
}

function onPinchStart(p) {
  if (S.xr && S.placing) { placeDiorama(p); return; }
  const btn = nearest(S.buttons, p.pos, 0.045);
  if (btn) { btn.action(); sfx.grab(); return; }
  if (S.sim.state !== 'idle') return;

  const left = remaining();
  const ti = nearest(S.tray.filter((t) => t.mesh.visible && left[t.type] > 0), p.pos, 0.055);
  if (ti) { startHold(p, ti.type, null, null); return; }

  const cand = [...S.placed.values()].map((e) => ({ pos: e.piece, e }));
  const hit = nearest(cand, p.pos, 0.055);
  if (hit) {
    const { piece, mesh } = hit.e;
    S.sim.removePiece(piece.id);
    S.placed.delete(piece.id);
    startHold(p, piece.type, piece.id, mesh);
  }
}

function startHold(p, type, id, existingMesh) {
  const mesh = existingMesh || makePieceMesh(type);
  if (!existingMesh) piecesGroup.add(mesh);
  const ghost = makePieceMesh(type, { ghost: true, icon: true });
  piecesGroup.add(ghost);
  p.held = { type, id: id ?? S.nextId++, mesh, ghost };
  sfx.grab();
  updateTrayLabels();
}

function snapTarget(p) {
  return { x: Math.round(p.pos.x / 0.01) * 0.01, y: Math.round(p.pos.y / 0.01) * 0.01 };
}
function validPlacement(type, t, selfId) {
  const lv = LEVELS[S.levelIndex];
  if (Math.abs(t.x) > W / 2 + 0.02 || t.y < -0.02 || t.y > H + 0.05) return { ok: false, out: true };
  const q = { x: Math.max(-0.15, Math.min(0.15, t.x)), y: Math.max(0.03, Math.min(0.27, t.y)) };
  if (!clearOfStatics(lv, q)) return { ok: false, q };
  if (Math.hypot(q.x - lv.start.x, q.y - lv.start.y) < 0.03) return { ok: false, q };
  for (const { piece } of S.placed.values()) {
    if (piece.id !== selfId && Math.hypot(piece.x - q.x, piece.y - q.y) < 0.06) return { ok: false, q };
  }
  return { ok: true, q };
}

function onPinchEnd(p) {
  const h = p.held;
  if (!h) return;
  p.held = null;
  piecesGroup.remove(h.ghost); disposeTree(h.ghost);
  const v = validPlacement(h.type, snapTarget(p), h.id);
  if (v.ok && S.sim.state === 'idle') {
    const piece = { id: h.id, type: h.type, x: +v.q.x.toFixed(3), y: +v.q.y.toFixed(3) };
    h.mesh.position.set(piece.x, piece.y, 0);
    S.sim.addPiece(piece);
    S.placed.set(piece.id, { piece, mesh: h.mesh });
    sfx.place();
  } else {
    piecesGroup.remove(h.mesh); disposeTree(h.mesh);
    sfx.bad();
  }
  updateTrayLabels();
}

function updatePointers() {
  if (S.xr) readXRPointers();
  for (const p of pointers.values()) {
    if (!p.active) { if (p.held) { p.pinching = false; } }
    if (p.pinching && !p.was) onPinchStart(p);
    if (!p.pinching && p.was) onPinchEnd(p);
    if (p.held && p.pinching) {
      p.held.mesh.position.copy(p.pos);
      if (!S.xr) p.held.mesh.position.z = 0.02;
      const t = snapTarget(p);
      const v = validPlacement(p.held.type, t, p.held.id);
      p.held.ghost.visible = !v.out;
      const q = v.q || t;
      p.held.ghost.position.set(q.x, q.y, 0);
      p.held.ghost.traverse((c) => { if (c.material?.color && c.material.transparent) c.material.color.set(v.ok ? 0x7dffb0 : 0xff6b6b); });
    }
    p.was = p.pinching;
  }
  for (const b of S.buttons) {
    let hover = false;
    for (const p of pointers.values()) if (p.active && Math.hypot(p.pos.x - b.pos.x, p.pos.y - b.pos.y) < 0.045 && Math.abs(p.pos.z) < 0.12) hover = true;
    b.mesh.scale.setScalar(hover ? 1.3 : 1);
  }
}

// ---------------------------------------------------------------- XR session
const intro = new THREE.Group();
const introText = textPlane(0.55, 0.22, 1024);
introText.userData.set(['Pinch on your desk', 'to place the marble frame'], { bg: 'rgba(8,12,28,.88)', boldFirst: true, size: 52 });
intro.add(introText);
intro.visible = false;
scene.add(intro);

renderer.xr.addEventListener('sessionstart', () => {
  S.xr = true;
  const session = renderer.xr.getSession();
  S.opaque = session.environmentBlendMode === 'opaque';
  renderer.setClearColor(S.opaque ? 0x12151f : 0x000000, S.opaque ? 1 : 0);
  diorama.visible = false;
  table.visible = false;
  S.placing = true;
  audio ??= new (window.AudioContext || window.webkitAudioContext)();
  const head = new THREE.Vector3(); const dir = new THREE.Vector3();
  const cam = renderer.xr.getCamera();
  cam.getWorldPosition(head); cam.getWorldDirection(dir);
  dir.y = 0; dir.normalize();
  intro.position.copy(head).addScaledVector(dir, 0.55); intro.position.y = head.y - 0.12;
  intro.lookAt(head.x, intro.position.y, head.z);
  intro.visible = true;
  document.getElementById('info').style.display = 'none';
});
renderer.xr.addEventListener('sessionend', () => {
  S.xr = false; S.placing = false;
  diorama.position.set(0, 0, 0); diorama.rotation.set(0, 0, 0); diorama.visible = true; diorama.updateMatrixWorld(true);
  table.position.set(0, -0.011, 0); table.visible = true;
  intro.visible = false;
  renderer.setClearColor(0x12151f, 1);
  document.getElementById('info').style.display = '';
});

(async () => {
  const xr = navigator.xr;
  const features = ['hand-tracking', 'local-floor'];
  if (xr && await xr.isSessionSupported('immersive-ar').catch(() => false)) {
    document.body.appendChild(ARButton.createButton(renderer, { optionalFeatures: features }));
    document.getElementById('mode').textContent = 'Tap Enter AR, then pinch on your real desk to place the frame.';
  } else if (xr && await xr.isSessionSupported('immersive-vr').catch(() => false)) {
    document.body.appendChild(VRButton.createButton(renderer, { optionalFeatures: features }));
    document.getElementById('mode').textContent = 'Tap Enter VR. Hands work best; a virtual desk is shown.';
  }
})();

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();
  updatePointers();

  const sim = S.sim;
  if (sim) {
    if (sim.state === 'running') {
      sim.step(dt);
      const m = sim.marblePos();
      if (m) marbleMesh.position.set(m.x, m.y, 0);
    }
    if (sim.state === 'won' && !S.wonHandled) {
      S.wonHandled = true; sfx.win();
      const m = sim.marblePos();
      if (m) { marbleMesh.position.set(m.x, m.y, 0); spawnWinParticles(m); }
      const last = S.levelIndex === LEVELS.length - 2;
      setHud(last ? 'All levels complete! Sandbox unlocked.' : 'Solved! Next level...');
      S.advanceAt = now + 2400;
    }
    if (sim.state === 'lost' && !S.lostHandled) {
      S.lostHandled = true; sfx.lose();
      setHud('Missed. Adjust pieces and Drop again.');
      S.resetAt = now + 1400;
    }
    if (S.resetAt && now > S.resetAt) resetRun(false);
    if (S.advanceAt && now > S.advanceAt) loadLevel(S.levelIndex + 1);
  }
  if (S.hintUntil && now > S.hintUntil) { clearHint(); setHud(); }
  if (S.msgUntil && now > S.msgUntil && sim?.state === 'idle') { S.msgUntil = 0; setHud(); }

  // particles
  for (const p of [...winParticles.children]) {
    p.userData.life -= dt;
    if (p.userData.life <= 0) { winParticles.remove(p); continue; }
    p.position.addScaledVector(p.userData.vel, dt);
    p.userData.vel.y -= 0.8 * dt;
    p.material.opacity = Math.max(0, p.userData.life / 1.2);
  }

  const tsec = now / 1000;
  if (S.goalGroup) { const s = 1 + Math.sin(tsec * 3.2) * 0.07; S.goalGroup.scale.set(s, s, 1); }
  const animFans = (root) => root.traverse((o) => {
    if (o.userData.arrows) for (const a of o.userData.arrows) {
      const ph = (tsec * 0.9 + a.userData.phase) % 1;
      a.position.y = 0.022 + ph * 0.14; a.material.opacity = 0.85 * (1 - ph);
    }
  });
  animFans(piecesGroup); animFans(trayGroup);

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

await initPhysics();
buildButtons();
loadLevel(0);
renderer.setAnimationLoop(animate);
window.__game = { S, loadLevel, pointers, dropMarble, onPinchStart, onPinchEnd, LEVELS };