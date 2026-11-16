// Physics for Marble Desk. Shared by the browser game and the headless level solver.
import RAPIER from '@dimforge/rapier3d-compat';

export const W = 0.4;      // play frame width (m)
export const H = 0.3;      // play frame height (m)
export const G = 3.0;      // gravity (tuned for tiny-world feel)
export const MARBLE_R = 0.01;
export const DT = 1 / 120;

export const PIECES = {
  rampR:  { label: 'Ramp',   half: [0.05, 0.004, 0.02], angle: -0.38, color: 0x4cc9f0 },
  rampL:  { label: 'Ramp',   half: [0.05, 0.004, 0.02], angle: 0.38,  color: 0x4895ef },
  bumper: { label: 'Bumper', radius: 0.022,              color: 0xf72585 },
  fan:    { label: 'Fan',    half: [0.025, 0.006, 0.02], color: 0x80ed99 },
};

let ready = null;
export function initPhysics() {
  if (!ready) ready = RAPIER.init();
  return ready;
}

const qz = (a) => ({ x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) });
const qx = (a) => ({ x: Math.sin(a / 2), y: 0, z: 0, w: Math.cos(a / 2) });

export class Sim {
  constructor(level) {
    const R = RAPIER;
    this.R = R;
    this.level = level;
    this.world = new R.World({ x: 0, y: -G, z: 0 });
    this.world.timestep = DT;
    this.pieceBodies = new Map(); // id -> { body, piece }
    this.marble = null;
    this.state = 'idle'; // idle | running | won | lost
    this.time = 0;
    this.slowTime = 0;
    this.acc = 0;

    this._fixedBox(0, -0.01, W / 2 + 0.05, 0.01, 0.03, 0);
    this._fixedBox(-W / 2 - 0.01, H / 2, 0.01, H, 0.03, 0);
    this._fixedBox(W / 2 + 0.01, H / 2, 0.01, H, 0.03, 0);
    for (const s of level.statics || []) {
      this._fixedBox(s.x, s.y, s.w / 2, s.h / 2, 0.02, s.rot || 0);
    }
  }

  _fixedBox(x, y, hx, hy, hz, angle) {
    const R = this.R;
    const body = this.world.createRigidBody(
      R.RigidBodyDesc.fixed().setTranslation(x, y, 0).setRotation(qz(angle)));
    this.world.createCollider(
      R.ColliderDesc.cuboid(hx, hy, hz).setFriction(0.4).setRestitution(0.2), body);
    return body;
  }

  addPiece(p) {
    const R = this.R;
    const def = PIECES[p.type];
    let body;
    if (p.type === 'bumper') {
      body = this.world.createRigidBody(
        R.RigidBodyDesc.fixed().setTranslation(p.x, p.y, 0).setRotation(qx(Math.PI / 2)));
      this.world.createCollider(
        R.ColliderDesc.cylinder(0.02, def.radius)
          .setRestitution(1.1).setRestitutionCombineRule(R.CoefficientCombineRule.Max), body);
    } else if (p.type === 'fan') {
      body = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(p.x, p.y, 0));
      this.world.createCollider(
        R.ColliderDesc.cuboid(def.half[0], def.half[1], def.half[2]).setFriction(0.4), body);
    } else {
      body = this.world.createRigidBody(
        R.RigidBodyDesc.fixed().setTranslation(p.x, p.y, 0).setRotation(qz(def.angle)));
      this.world.createCollider(
        R.ColliderDesc.cuboid(def.half[0], def.half[1], def.half[2])
          .setFriction(0.25).setRestitution(0.25), body);
    }
    this.pieceBodies.set(p.id, { body, piece: p });
  }

  removePiece(id) {
    const e = this.pieceBodies.get(id);
    if (!e) return;
    this.world.removeRigidBody(e.body);
    this.pieceBodies.delete(id);
  }

  drop() {
    if (this.marble) this.world.removeRigidBody(this.marble);
    const R = this.R;
    const s = this.level.start;
    this.marble = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(s.x, s.y, 0)
        .enabledTranslations(true, true, false).setCcdEnabled(true).setLinearDamping(0.05));
    this.world.createCollider(
      R.ColliderDesc.ball(MARBLE_R).setDensity(2).setFriction(0.3).setRestitution(0.35), this.marble);
    this.state = 'running';
    this.time = 0;
    this.slowTime = 0;
  }

  reset() {
    if (this.marble) { this.world.removeRigidBody(this.marble); this.marble = null; }
    this.state = 'idle';
    this.time = 0;
  }

  marblePos() {
    if (!this.marble) return null;
    const t = this.marble.translation();
    return { x: t.x, y: t.y };
  }

  step(dt) {
    this.acc += dt;
    let n = 0;
    while (this.acc >= DT && n < 6) { this._tick(); this.acc -= DT; n++; }
    if (this.acc > DT * 6) this.acc = 0;
  }

  _tick() {
    if (this.state !== 'running' || !this.marble) return;
    const m = this.marble;
    // fans
    m.resetForces(true);
    const t = m.translation();
    for (const { piece } of this.pieceBodies.values()) {
      if (piece.type === 'fan' && Math.abs(t.x - piece.x) < 0.03 && t.y > piece.y && t.y < piece.y + 0.16) {
        m.addForce({ x: 0, y: m.mass() * G * 1.9, z: 0 }, true);
      }
    }
    this.world.step();
    this.time += DT;

    const p = m.translation();
    const g = this.level.goal;
    if (Math.abs(p.x - g.x) < 0.03 && Math.abs(p.y - g.y) < 0.03) { this.state = 'won'; return; }
    const v = m.linvel();
    const speed = Math.hypot(v.x, v.y);
    this.slowTime = speed < 0.01 ? this.slowTime + DT : 0;
    if (p.y < -0.1 || Math.abs(p.x) > W / 2 + 0.1 || this.time > 14 || this.slowTime > 1.5) {
      this.state = 'lost';
    }
  }
}

/** Headless: simulate a full attempt. Returns { won, time }. */
export function simulate(level, pieces, maxT = 14) {
  const sim = new Sim(level);
  pieces.forEach((p, i) => sim.addPiece({ id: i, ...p }));
  sim.drop();
  let steps = 0;
  while (sim.state === 'running' && steps < maxT / DT) { sim._tick(); steps++; }
  const out = { won: sim.state === 'won', time: sim.time };
  sim.world.free();
  return out;
}
