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
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 20);
camera.position.set(0, 0.2, 0.7);
camera.lookAt(0, 0.14, 0);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(0.3, 1, 0.8);
scene.add(sun);

// diorama root: everything that lives on the desk. Local origin = bottom centre of the frame.
const diorama = new THREE.Group();
scene.add(diorama);
const levelGroup = new THREE.Group();   // statics, goal, start marker (rebuilt per level)
const piecesGroup = new THREE.Group();  // placed + held pieces
const trayGroup = new THREE.Group();
const uiGroup = new THREE.Group();
diorama.add(levelGroup, piecesGroup, trayGroup, uiGroup);

// desktop-only virtual table
const table = new THREE.Mesh(
  new THREE.CylinderGeometry(0.9, 0.9, 0.02, 64),
  new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: 0.8 }));
table.position.y = -0.011;
scene.add(table);

// ---------------------------------------------------------------- helpers
function textPlane(w, h, px = 256) {
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
    if (opts.bg) { g.fillStyle = opts.bg; g.beginPath(); g.roundRect(2, 2, c.width - 4, c.height - 4, 18); g.fill(); }
    g.fillStyle = opts.color || '#ffffff';
    g.textAlign = opts.align || 'center';
    g.textBaseline = 'middle';
    const arr = Array.isArray(lines) ? lines : [lines];
    const size = opts.size || Math.floor(c.height / (arr.length + 0.6));
    arr.forEach((ln, i) => {
      g.font = `${i === 0 && opts.boldFirst ? '700 ' : '500 '}${size}px system-ui, sans-serif`;
      const x = g.textAlign === 'left' ? 16 : c.width / 2;
      g.fillText(ln, x, (c.height / (arr.length + 1)) * (i + 1));
    });
    tex.needsUpdate = true;
  };
  return mesh;
}

function makePieceMesh(type, opts = {}) {
  const def = PIECES[type];
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: opts.ghostColor ?? def.color, roughness: 0.45, metalness: 0.1,
    emissive: def.color, emissiveIntensity: 0.18,
    transparent: !!opts.ghost, opacity: opts.ghost ? 0.4 : 1,
  });
  if (type === 'bumper') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(def.radius, def.radius, 0.04, 32), mat);
    m.rotation.x = Math.PI / 2;
    g.add(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(def.radius * 0.65, 0.003, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: !!opts.ghost, opacity: opts.ghost ? 0.4 : 1 }));
    ring.position.z = 0.021;
    g.add(ring);
  } else if (type === 'fan') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(def.half[0] * 2, def.half[1] * 2, def.half[2] * 2), mat));
    if (!opts.icon) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.03),
        new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.1, depthWrite: false }));
      col.position.y = 0.086;
      g.add(col);
    }
    g.userData.arrows = [];
    for (let i = 0; i < 3; i++) {
      const a = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.016, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
      a.userData.phase = i / 3;
      a.userData.x = (i - 1) * 0.014;
      a.position.set(a.userData.x, 0.02, 0);
      g.add(a);
      g.userData.arrows.push(a);
    }
  } else {
    const m = new THREE.Mesh(new THREE.BoxGeometry(def.half[0] * 2, def.half[1] * 2, def.half[2] * 2), mat);
    m.rotation.z = def.angle;
    g.add(m);
  }
  g.userData.type = type;
  return g;
}

let audio = null;
function beep(freq, dur = 0.08, type = 'sine', gain = 0.08, delay = 0) {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const t = audio.currentTime + delay;
    const o = audio.createOscillator(); const gn = audio.createGain();
    o.type = type; o.frequency.value = freq;
    gn.gain.setValueAtTime(gain, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(audio.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch { /* audio is optional */ }
}
const sfx = {
  grab: () => beep(520, 0.06),
  place: () => { beep(330, 0.07, 'triangle'); beep(440, 0.07, 'triangle', 0.08, 0.06); },
  bad: () => beep(140, 0.15, 'sawtooth', 0.05),
  drop: () => beep(660, 0.1, 'square', 0.04),
  win: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.18, 'triangle', 0.09, i * 0.1)),
  lose: () => { beep(300, 0.12, 'sine'); beep(220, 0.2, 'sine', 0.07, 0.1); },
};

// ---------------------------------------------------------------- static scenery
(function buildFrame() {
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H),
    new THREE.MeshStandardMaterial({ color: 0x141a2e, roughness: 0.9, transparent: true, opacity: 0.82 }));
  back.position.set(0, H / 2, -0.03);
  diorama.add(back);

  const pts = [];
  for (let x = -W / 2; x <= W / 2 + 1e-6; x += 0.02) pts.push(x, 0, -0.0295, x, H, -0.0295);
  for (let y = 0; y <= H + 1e-6; y += 0.02) pts.push(-W / 2, y, -0.0295, W / 2, y, -0.0295);
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  diorama.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x2c375a })));

  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x9aa6d1, metalness: 0.6, roughness: 0.3 });
  const mk = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), edgeMat);
    m.position.set(x, y, z); diorama.add(m);
  };
  mk(W + 0.02, 0.01, 0.07, 0, -0.005, 0);
  mk(0.008, H, 0.008, -W / 2 - 0.004, H / 2, 0.03);
  mk(0.008, H, 0.008, W / 2 + 0.004, H / 2, 0.03);
  mk(0.008, H, 0.008, -W / 2 - 0.004, H / 2, -0.03);
  mk(0.008, H, 0.008, W / 2 + 0.004, H / 2, -0.03);
  mk(W + 0.02, 0.008, 0.008, 0, H, 0.03);
  mk(W + 0.02, 0.008, 0.008, 0, H, -0.03);
})();

const marbleMesh = new THREE.Mesh(
  new THREE.SphereGeometry(MARBLE_R, 24, 16),
  new THREE.MeshStandardMaterial({ color: 0xe8eeff, metalness: 1, roughness: 0.12 }));
marbleMesh.visible = false;
diorama.add(marbleMesh);

const hud = textPlane(0.34, 0.085, 1024);
hud.position.set(0, H + 0.06, 0);
uiGroup.add(hud);

// ---------------------------------------------------------------- game state
const S = {
  levelIndex: 0, sim: null, placed: new Map(), nextId: 1,
  hintUntil: 0, hintMeshes: [], placing: false, xr: false, opaque: false,
  advanceAt: 0, resetAt: 0, wonHandled: false, lostHandled: false, msg: '', msgUntil: 0,
  tray: [], buttons: [], goalGroup: null,
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
  const title = lv.sandbox ? 'Sandbox' : `Level ${S.levelIndex + 1}/${LEVELS.length - 1}  ·  ${lv.name}`;
  hud.userData.set([title, sub ?? lv.hint], { bg: 'rgba(10,14,30,.78)', boldFirst: true, size: 44 });
}
function flash(text, ms = 2500) { S.msg = text; S.msgUntil = performance.now() + ms; setHud(text); }

function updateTrayLabels() {
  const left = remaining();
  for (const t of S.tray) {
    t.label.userData.set(`×${left[t.type]}`, { color: left[t.type] > 0 ? '#ffffff' : '#667', size: 70 });
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

  for (const s of lv.statics) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x4a5078, roughness: 0.6 }));
    m.position.set(s.x, s.y, 0); m.rotation.z = s.rot || 0;
    levelGroup.add(m);
  }

  // start chute
  const chute = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xffd166, side: THREE.DoubleSide }));
  chute.position.set(lv.start.x, lv.start.y + 0.014, 0);
  levelGroup.add(chute);

  // goal cup
  if (!lv.sandbox) {
    const gg = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.004, 10, 40),
      new THREE.MeshBasicMaterial({ color: 0x57ffb0 }));
    gg.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.026, 40),
      new THREE.MeshBasicMaterial({ color: 0x57ffb0, transparent: true, opacity: 0.18 }));
    gg.add(disc);
    gg.position.set(lv.goal.x, lv.goal.y, 0);
    levelGroup.add(gg);
    S.goalGroup = gg;
  } else S.goalGroup = null;

  // tray (right column)
  S.tray = [];
  const types = Object.keys(lv.inventory);
  types.forEach((type, k) => {
    const y = 0.255 - k * 0.07;
    const mesh = makePieceMesh(type, { icon: true });
    mesh.scale.setScalar(0.75);
    mesh.position.set(0.3, y, 0);
    trayGroup.add(mesh);
    const label = textPlane(0.05, 0.03, 128);
    label.position.set(0.3, y - 0.032, 0.02);
    trayGroup.add(label);
    S.tray.push({ type, mesh, label, pos: new THREE.Vector3(0.3, y, 0) });
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
    ['Move', 0xb197fc, () => { S.placing = true; flash('Pinch on your desk to move the diorama'); }],
  ];
  defs.forEach(([name, color, action], i) => {
    const y = 0.27 - i * 0.05;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 28),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, roughness: 0.4 }));
    m.rotation.x = Math.PI / 2;
    m.position.set(-0.315, y, 0);
    uiGroup.add(m);
    const label = textPlane(0.07, 0.03, 160);
    label.userData.set(name, { size: 52, align: 'left' });
    label.position.set(-0.25, y, 0.01);
    uiGroup.add(label);
    S.buttons.push({ name, mesh: m, action, pos: new THREE.Vector3(-0.315, y, 0) });
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
  S.hintUntil = performance.now() + 5000;
  flash('Ghost pieces show one way to solve it', 5000);
}

// ---------------------------------------------------------------- pointers (hands / controllers / mouse)
const pointers = new Map(); // id -> { id, pos(local Vector3), world, pinching, was, held }
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
        p.pinching = p.was ? d < 0.035 : d < 0.022;
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

// mouse (desktop preview)
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
  diorama.position.set(p.world.x, p.world.y - 0.004, p.world.z);
  diorama.rotation.y = Math.atan2(head.x - p.world.x, head.z - p.world.z);
  diorama.updateMatrixWorld(true);
  diorama.visible = true;
  table.position.copy(diorama.position); table.position.y -= 0.011;
  table.visible = S.opaque;
  intro.visible = false;
  S.placing = false;
  sfx.place();
  flash('Diorama placed. Build a path for the marble!', 3500);
}

function onPinchStart(p) {
  if (S.xr && S.placing) { placeDiorama(p); return; }
  const btn = nearest(S.buttons, p.pos, 0.04);
  if (btn) { btn.action(); sfx.grab(); return; }
  if (S.sim.state !== 'idle') return;

  // tray -> new piece
  const left = remaining();
  const ti = nearest(S.tray.filter((t) => t.mesh.visible && left[t.type] > 0), p.pos, 0.05);
  if (ti) { startHold(p, ti.type, null, null); return; }

  // pick up a placed piece
  const cand = [...S.placed.values()].map((e) => ({ pos: e.piece, e }));
  const hit = nearest(cand, p.pos, 0.05);
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
  // hover feedback on buttons
  for (const b of S.buttons) {
    let hover = false;
    for (const p of pointers.values()) if (p.active && Math.hypot(p.pos.x - b.pos.x, p.pos.y - b.pos.y) < 0.04 && Math.abs(p.pos.z) < 0.1) hover = true;
    b.mesh.scale.setScalar(hover ? 1.25 : 1);
  }
}

// ---------------------------------------------------------------- XR session
const intro = new THREE.Group();
const introText = textPlane(0.5, 0.2, 1024);
introText.userData.set(['Pinch your fingers on your desk', 'where you want the marble run'], { bg: 'rgba(10,14,30,.85)', boldFirst: true, size: 56 });
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
  intro.position.copy(head).addScaledVector(dir, 0.6); intro.position.y = head.y - 0.1;
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
    document.getElementById('mode').textContent = 'Tap Enter AR below, then pinch on your desk to place the diorama.';
  } else if (xr && await xr.isSessionSupported('immersive-vr').catch(() => false)) {
    document.body.appendChild(VRButton.createButton(renderer, { optionalFeatures: features }));
    document.getElementById('mode').textContent = 'Tap Enter VR below. Hands work best; a virtual desk is shown.';
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
      const m = sim.marblePos(); if (m) marbleMesh.position.set(m.x, m.y, 0);
      const last = S.levelIndex === LEVELS.length - 2;
      setHud(last ? 'All levels solved! Next opens the sandbox.' : 'Solved! Next level...');
      S.advanceAt = now + 2200;
    }
    if (sim.state === 'lost' && !S.lostHandled) {
      S.lostHandled = true; sfx.lose();
      setHud('Missed. Adjust your pieces and Drop again.');
      S.resetAt = now + 1300;
    }
    if (S.resetAt && now > S.resetAt) resetRun(false);
    if (S.advanceAt && now > S.advanceAt) loadLevel(S.levelIndex + 1);
  }
  if (S.hintUntil && now > S.hintUntil) { clearHint(); setHud(); }
  if (S.msgUntil && now > S.msgUntil && sim?.state === 'idle') { S.msgUntil = 0; setHud(); }

  // little animations
  const tsec = now / 1000;
  if (S.goalGroup) { const s = 1 + Math.sin(tsec * 3) * 0.06; S.goalGroup.scale.set(s, s, 1); }
  const animFans = (root) => root.traverse((o) => {
    if (o.userData.arrows) for (const a of o.userData.arrows) {
      const ph = (tsec * 0.8 + a.userData.phase) % 1;
      a.position.y = 0.02 + ph * 0.13; a.material.opacity = 0.8 * (1 - ph);
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
