# Level 3 Playtest Script

## Purpose
Validate Level 3 for progression, secrets, enemy behavior, platforming difficulty, and softlock safety.

## Setup
1. Run `python3 -m http.server 8080` from repo root.
2. Open `http://localhost:8080/index.html`.
3. Press `Enter` to start.
4. If needed, force Level 3 from DevTools console:
   - `currentLevel = 3; resetLevel(); gameState = STATE.PLAYING;`

## Route A: Full Clear (Difficulty + Feel)
1. Play Level 3 from spawn to flagpole without pausing.
2. Confirm every required gap is jumpable with a normal running jump.
3. Confirm there is no forced damage from unseen enemies.
4. Confirm timer pressure feels similar to Level 1/2 pacing.
5. Confirm castle and level clear transition works.

Expected:
- No impossible jumps.
- No camera or collision jitter that breaks timing.
- Win transition advances to Level 1 after clearing Level 3.

## Route B: Secrets Validation
1. Hit all Level 3 `Q` blocks on upper platform routes.
2. Verify at least one mushroom and one star are obtainable.
3. Verify collected items can be reached safely (no trapped pickups).

Expected:
- `Q` blocks produce configured rewards.
- Secret pickups do not spawn inside solids or pits.

## Route C: Enemy Logic + Softlocks
1. Stand near the Level 3 piranha pipe and wait 2+ seconds.
2. Move away ~4 tiles and wait.
3. Trigger piranha contact while vulnerable and while star-invincible.
4. Test Koopa shell kick near other enemies.
5. Attempt edge cases:
   - Enter narrow pits between platforms.
   - Get under/around pipes and platform edges.
   - Backtrack left and right through multiple segments.

Expected:
- Piranha stays hidden when Mario is near pipe top, rises when far.
- Enemy collisions follow existing Level 1/2 rules.
- No unrecoverable position (softlock) without intentional death.

## Pass/Fail Gates
- PASS: Level can be cleared consistently, secrets work, no softlocks found.
- FAIL: Any progression block, impossible platform segment, or unrecoverable trap.
