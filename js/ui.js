// ui.js — Score popups, particles, and UI overlay helpers

// ── Score Popup ───────────────────────────────────────────────────────────────

// A floating text popup that rises and fades over ~60 frames
export class ScorePopup {
  constructor(x, y, text, color = '#FFFFFF') {
    this.x = x;       // world-x (logical)
    this.y = y;       // world-y (logical)
    this.text = text;
    this.color = color;
    this.alpha = 1.0;
    this.vy = -0.5;   // rises 2 tiles over 60 frames (2*16/60 ≈ 0.53)
    this.lifetime = 60;
    this.age = 0;
    this.dead = false;
  }

  update() {
    if (this.dead) return;
    this.age++;
    this.y += this.vy;
    this.alpha = Math.max(0, 1 - this.age / this.lifetime);
    if (this.age >= this.lifetime) this.dead = true;
  }

  draw(ctx, cameraX, scale) {
    if (this.dead) return;
    const s = scale;
    const sx = (this.x - cameraX) * s;
    const sy = this.y * s;

    ctx.globalAlpha = this.alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${7 * s}px monospace`;

    // Black shadow
    ctx.fillStyle = '#000000';
    ctx.fillText(this.text, sx + 1, sy + 1);

    // Colored text
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, sx, sy);

    ctx.globalAlpha = 1.0;
  }
}

// ── Particle ──────────────────────────────────────────────────────────────────

// Generic particle with position, velocity, gravity, lifetime, and color
export class Particle {
  constructor({ x, y, vx, vy, gravity = 0.3, lifetime = 40, color = '#C84B0F', size = 4, fade = true }) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.gravity = gravity;
    this.lifetime = lifetime;
    this.age = 0;
    this.color = color;
    this.size = size;
    this.fade = fade;
    this.dead = false;
    this.alpha = 1.0;
  }

  update() {
    if (this.dead) return;
    this.age++;
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    if (this.fade) {
      this.alpha = Math.max(0, 1 - this.age / this.lifetime);
    }
    if (this.age >= this.lifetime) this.dead = true;
    // Despawn if fallen far off-screen
    if (this.y > 300) this.dead = true;
  }

  draw(ctx, cameraX, scale) {
    if (this.dead) return;
    const s = scale;
    const sx = (this.x - cameraX) * s;
    const sy = this.y * s;
    const sz = this.size * s;

    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
    ctx.globalAlpha = 1.0;
  }
}

// ── Particle emitters ─────────────────────────────────────────────────────────

// Brick break: 4 debris chunks arc outward
export function emitBrickBreak(x, y, particles) {
  const colors = ['#C84B0F', '#8B4513', '#7B2D00', '#FAB005'];
  const chunks = [
    { vx: -2.5, vy: -4.0 },
    { vx: -1.0, vy: -5.0 },
    { vx:  1.5, vy: -4.5 },
    { vx:  2.5, vy: -3.5 },
  ];
  chunks.forEach((vel, i) => {
    particles.push(new Particle({
      x, y,
      vx: vel.vx + (Math.random() - 0.5) * 0.5,
      vy: vel.vy + (Math.random() - 0.5) * 0.5,
      gravity: 0.4,
      lifetime: 50,
      color: colors[i % colors.length],
      size: 4,
      fade: false,
    }));
  });
}

// Coin sparkle when collected
export function emitCoinSparkle(x, y, particles) {
  const count = 6;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    particles.push(new Particle({
      x, y,
      vx: Math.cos(angle) * 1.5,
      vy: Math.sin(angle) * 1.5 - 1.5,
      gravity: 0.15,
      lifetime: 30,
      color: '#FAB005',
      size: 3,
      fade: true,
    }));
  }
}

// Enemy kill effect (star/fireball)
export function emitEnemyKill(x, y, particles) {
  const count = 5;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    particles.push(new Particle({
      x, y,
      vx: Math.cos(angle) * 2.0,
      vy: Math.sin(angle) * 2.0 - 1.0,
      gravity: 0.25,
      lifetime: 25,
      color: i % 2 === 0 ? '#FF6600' : '#FFFF00',
      size: 3,
      fade: true,
    }));
  }
}

// Stomp puff
export function emitStompPuff(x, y, particles) {
  for (let i = 0; i < 4; i++) {
    particles.push(new Particle({
      x: x + (Math.random() - 0.5) * 8,
      y,
      vx: (Math.random() - 0.5) * 2,
      vy: -(Math.random() * 1.5 + 0.5),
      gravity: 0.1,
      lifetime: 20,
      color: '#FFFFFF',
      size: 2,
      fade: true,
    }));
  }
}

// Power-up collect flash
export function emitPowerUpCollect(x, y, particles) {
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    particles.push(new Particle({
      x, y,
      vx: Math.cos(angle) * 2.5,
      vy: Math.sin(angle) * 2.5 - 1.0,
      gravity: 0.2,
      lifetime: 35,
      color: i % 2 === 0 ? '#FAB005' : '#FFFFFF',
      size: 3,
      fade: true,
    }));
  }
}

// ── UI Manager ────────────────────────────────────────────────────────────────

// Manages a list of active ScorePopups and Particles
export class UIManager {
  constructor() {
    this.popups = [];
    this.particles = [];
  }

  addScorePopup(x, y, points, color = '#FFFFFF') {
    this.popups.push(new ScorePopup(x, y, String(points), color));
  }

  addParticles(list) {
    this.particles.push(...list);
  }

  emitBrickBreak(x, y) {
    emitBrickBreak(x, y, this.particles);
  }

  emitCoinSparkle(x, y) {
    emitCoinSparkle(x, y, this.particles);
  }

  emitEnemyKill(x, y) {
    emitEnemyKill(x, y, this.particles);
  }

  emitStompPuff(x, y) {
    emitStompPuff(x, y, this.particles);
  }

  emitPowerUpCollect(x, y) {
    emitPowerUpCollect(x, y, this.particles);
  }

  update() {
    for (const p of this.popups) p.update();
    for (const p of this.particles) p.update();
    this.popups = this.popups.filter(p => !p.dead);
    this.particles = this.particles.filter(p => !p.dead);
  }

  draw(ctx, cameraX, scale) {
    for (const p of this.particles) p.draw(ctx, cameraX, scale);
    for (const p of this.popups) p.draw(ctx, cameraX, scale);
  }
}
