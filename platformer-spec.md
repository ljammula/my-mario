# 🍄 Browser-Based Platformer — SMB 1985-Inspired

> One-line summary: Phaser 3 + TypeScript + Vite + Tiled + Aseprite + original SMB-style character roster

---

## 🧱 Tech stack

### Core

| Tool | Role |
|------|------|
| Phaser 3 | Game engine |
| TypeScript | Language |
| Vite | Build tool |

### Content creation

| Tool | Role |
|------|------|
| Aseprite | Pixel art, sprite sheets, tilesets |
| Tiled | Tilemaps + object layers |
| WAV | Sound effects |
| OGG | Music |

### Hosting / deployment

GitHub Pages / Vercel / Netlify (static hosting)

### Version control

Git + GitHub

---

## 🗂️ Project structure

```
src/
  scenes/
  entities/
    player/
    enemies/
    items/
  systems/
  types/           ← shared interfaces (EnemyConfig, TileData, PlayerState)
  config/          ← constants: gravity, jump velocity, tile size, world defs
  data/
    levels/
    worlds/
  assets/
    sprites/
    tilesets/
    audio/
```

---

## 🧠 Architecture

### Scenes

| Scene | Role | Notes |
|-------|------|-------|
| `BootScene` | Setup | — |
| `PreloadScene` | Load assets | — |
| `WorldScene` | Gameplay | — |
| `UIScene` | HUD (score, coins, timer) | Runs in parallel with WorldScene |
| `WorldMapScene` | Level select between worlds | Add before multi-world implementation |

### Core systems

#### Validated

- Player controller (movement, jump physics)
- Tile collision system (custom, not physics-heavy)
- Enemy AI + state machines
- Power-up system
- Pipe / warp system
- Level triggers (checkpoint, flagpole, castle)
- Game state (score, lives, timer)

#### Required — add before implementing

- **Camera system** — deadzone, lerp, y-lock, screen shake on stomp; shapes level geometry decisions
- **Object pooling** — required for projectiles, particles, dropped items; use `this.add.group({ classType, maxSize })`
- **Input manager** — jump buffer, coyote time, key remapping, optional gamepad support (add early, painful to bolt on later)
- **VFX / particle system** — stomp puffs, coin sparkles, star trail
- **Save / persistence** — `localStorage` for score, current world/level, and lives

---

## 📦 Asset pipeline spec

### Sprite sheets (Aseprite → Phaser 3)

- Export format: **JSON hash** (compatible with `this.load.atlas()`)
- Commit export settings to repo: scale, padding, trim
- Consistent settings across machines = consistent atlases

### Tiled layer convention

| Layer | Type | Collision |
|-------|------|-----------|
| `background` | Tile layer | None — decoration only |
| `midground` | Tile layer | Yes — platforms, walls, pipes |
| `foreground` | Tile layer | None — overlapping decoration |
| `objects` | Object layer | Spawn points for enemies, items, warps |

Phaser reads tile layers as `TilemapLayer` and object layers as `ObjectLayer` — define this before building any level.

---

## 🎮 Character roster

### Player characters

#### Milo (main)

| Form | Size | Description |
|------|------|-------------|
| Small Milo | 16×16 | Default form |
| Super Milo | 16×32 | Growth Orb upgrade |
| Ember Milo | 16×32 | Projectile attack enabled |
| Star Milo | 16×32 | Temporary invincibility |

**Traits:** round silhouette, strong color contrast, readable at low resolution

#### Luma (optional player 2)

- Same mechanics as Milo
- Palette swap + slightly different silhouette
- **Palette swap strategy:** use a GLSL shader (Phaser custom pipeline) OR pre-bake alternate sprites in Aseprite and export both Milo and Luma variants in the same atlas — decide before building the atlas

### NPCs

| Character | Role |
|-----------|------|
| Princess Solara | End-goal rescue character |
| Sprout Folk | Mushroom-like villagers; used in castles and endings |

---

## 👾 Enemies

Enemies are organized into implementation tiers. Build Tier 1 first, ship a playable build, then expand.

### Tier 1 — ship with

| Enemy | Role | Behavior | Size | Complexity |
|-------|------|----------|------|------------|
| Chompcap | Basic walker | Walks left/right; stomp to defeat | 16×16 | Low |
| Thornbug | Unstompable | Damages on contact; spiked shell | 16×16 | Low |
| Snapvine | Pipe ambusher | Emerges from pipes; retracts on timer | 16×16 | Low |
| Cannonball | Projectile hazard | Straight-line movement; fired from cannons | 16×16 | Low |
| Lavaburst | Castle hazard | Jumps from lava periodically | 16×16 | Low |

> **Note:** Cannonball requires a **Cannon entity** (aim logic, fire rate, animation) — add it to the entity list.

### Tier 2 — add next

| Enemy | Role | Behavior | Size | Complexity |
|-------|------|----------|------|------------|
| Shellback | Armored walker | Stomp → shell; shell can be kicked | 16×24 | Medium |
| Wingback | Flying shell | Hops or flies; loses wings when stomped | 16×24 | Medium |
| Skydart | Flying fish / jumper | Leaps in arcs; appears in groups | 16×16 | Medium |

> **Shellback shell-kick** is deceptively complex: shell velocity, shell-hitting-enemy collision, shell bouncing off walls, shell-kills-Milo state. Budget 2–3× your estimate.

### Tier 3 — post-launch

| Enemy | Role | Behavior | Complexity |
|-------|------|----------|------------|
| Cloudlobber | Aerial | Floats above player; drops hazards | High |
| Hammerling | Projectile | Throws arcs of projectiles; jumps between platforms | High |
| Inkfloater | Underwater | Swims toward player in pulses | High (requires underwater subsystem) |

> **Inkfloater** implies a full **underwater physics mode** — buoyancy, gravity modifier, swim controls for Milo. This is a separate subsystem. Cut or defer unless underwater worlds are in scope from day one.

### Boss

**King Bramble**

- Patrols bridge
- Breathes fire / throws projectiles
- Defeated by: dropping bridge, or multiple hits

---

## 🍄 Power-ups

| Item | Effect |
|------|--------|
| Growth Orb | Small → Super |
| Ember Flower | Enables projectile attack |
| Star Core | Temporary invincibility |
| Life Seed | Grants extra life |

---

## 🎨 Art direction

### Resolution

- Base grid: 16×16 tiles
- Characters: 16×16 (small), 16×32 (tall)

### Color rules

- 3–5 colors per character
- High contrast
- Strong silhouette readability

### Animation minimum

| State | Frames |
|-------|--------|
| Idle | 1 |
| Walk | 2–4 |
| Jump | 1 |
| Defeat | 1–2 |

### Player form animation scope

- 4 forms × 1 character = 4 animation sets for Milo
- If Luma uses pre-baked sprites: 8 animation sets total
- **Recommendation:** start with Small + Super only; add Ember and Star forms after first playable build

---

## ⚡ Key design principles

- Prioritize tight movement feel above all else
- Use custom collision logic — not Phaser's physics engine
- Keep everything data-driven
- Optimize for fast iteration loop

---

## ✅ Validation summary

### Solid — keep as-is

- Tech stack (Phaser 3 / TS / Vite)
- Scene architecture pattern
- Custom tile collision decision
- UIScene as parallel scene
- Character roster cohesion
- Art direction spec

### Add before implementing

- [ ] Camera system spec
- [ ] Object pooling strategy
- [ ] Input manager (jump buffer, coyote time, gamepad)
- [ ] VFX / particle system
- [ ] Save / persistence (`localStorage`)
- [ ] WorldMapScene
- [ ] Tiled layer convention (document in `/data/levels/README.md`)
- [ ] Aseprite export settings (document in `/assets/sprites/README.md`)
- [ ] `types/` directory for shared interfaces
- [ ] `config/` directory for constants
- [ ] Cannon entity (required by Cannonball)

### Scope risks to manage

- [ ] Cut enemy list to Tier 1 for first playable build
- [ ] Defer Inkfloater until underwater world is in scope
- [ ] Defer Luma until Milo's full animation set is complete
- [ ] Defer Ember + Star forms until Small + Super are polished
- [ ] Shellback shell-kick mechanic: budget extra implementation time
