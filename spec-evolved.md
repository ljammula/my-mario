1. Target

Build a faithful clone in feel and structure, not necessarily a cycle-perfect ROM recreation. The goal is to preserve the game loop, player verbs, enemy set, power-up system, level structure, and progression that define the 1985 game. The original is a side-scrolling platformer released in 1985, and the referenced video shows a full playthrough of all levels.

2. Core game loop

Each area follows this loop:

Spawn Mario at the area start or midpoint checkpoint.
Move right through a horizontally scrolling level.
Jump across gaps, avoid hazards, defeat enemies, and collect coins/power-ups.
Reach the end sequence:
normal stages end at a flagpole and small castle,
castle stages end by crossing the axe/bridge trigger and defeating fake Bowser or the final Bowser.
Award remaining time as bonus except at the final castle.

Loss conditions:

Mario touches a damaging enemy or hazard while small.
Mario falls into a pit.
Timer reaches zero.
In lava/castle contexts, contact with lava/fire hazards is fatal unless downgraded logic applies first. The manual explicitly describes a ticking clock and restart behavior, and the game’s stage structure is evident in the playthrough.
3. Player states

Implement these player forms:

Small Mario

Baseline state.
1-hit death on damage.

Super Mario

Obtained from Mushroom.
2 tiles tall.
Can break brick blocks by jumping into them from below.

Fire Mario

Obtained by collecting Fire Flower while already Super.
Can shoot fireballs.

Invincible Mario

Temporary Starman state.
Immunity to normal enemy contact.
Kills enemies on touch. The manual explicitly shows Mushroom, Fire Flower, and Starman, and maps the form changes Mario → Super Mario → Fiery Mario → Invincible Mario.

Damage downgrade rules:

Fire Mario hit → Super Mario.
Super Mario hit → Small Mario.
Small Mario hit → death.
Invincibility does not replace size/fire state; it overlays temporarily.
4. Controls

Minimum controls:

Left / Right: horizontal movement.
A / Jump: variable-height jump.
B / Run-Fire: run when held; shoot fireballs if Fire Mario.
Start: pause/start.

Behavior goals:

Acceleration-based movement, not immediate full-speed movement.
Holding run increases max horizontal speed.
Jump height depends on button hold duration and current horizontal speed.
Releasing jump early cuts ascent.
5. Movement and feel

This is the most important part to get right.

Horizontal movement

Use:

ground acceleration,
ground deceleration,
turn braking,
lower air control than ground control,
max walk speed,
higher max run speed.

Recommended qualitative behavior:

Walking feels precise.
Running creates commitment and makes long jumps possible.
Changing direction while moving fast causes a brief skid.
Jumping

Jump should depend on:

current horizontal velocity,
whether jump is held,
current form does not change jump physics.

Behavior:

Standing jump is shorter and steeper.
Running jump is longer and slightly higher-feeling because of momentum.
Releasing jump early cuts the arc.
Hitting block undersides cancels upward motion immediately.
Gravity

Use:

lower gravity while rising with jump held,
higher gravity after jump release or on descent.
Friction and skidding

If opposite direction is pressed while moving quickly:

show skid animation,
preserve momentum briefly,
then reverse direction.
6. Camera
Side-on 2D camera.
Camera primarily follows Mario to the right.
Do not allow free scrolling back to the left in normal implementation; classic SMB is forward-committing in most situations.
Camera should look slightly ahead of Mario, not center him perfectly.
Vertical camera movement should be minimal and controlled; only adjust in special sections if needed.
7. HUD

Top HUD should include:

MARIO score
coin count
world number
time remaining

The manual screenshots show the standard HUD with score/world/time presentation, and the manual text explicitly notes the clock in the upper-right counting down.

8. World structure

Implement the classic structure:

8 worlds
4 areas per world
area types rotate among:
overworld
underground
underwater
athletic/platform
castle
World x-4 is a castle.
World 8 is the hardest and ends with the true Bowser encounter. The 32-area total is documented in strategy material, and the all-levels video shows the complete progression through every world.
9. Stage completion
Non-castle areas

At end of level:

staircase leads to flagpole,
Mario slides down pole,
bonus points depend on grab height,
walks into small castle,
remaining time converts to score bonus. The manual explicitly describes the flagpole bonus and time bonus.
Castle areas

At end of castle:

Mario reaches bridge with axe,
touching the end trigger causes bridge collapse,
Bowser falls if present,
rescue chamber appears after final boss logic,
in early castles, Bowser is a fake and turns into another enemy when defeated by fireballs or bridge drop.
final castle ends game.
10. Spawn / checkpoint rules

At the beginning of an area, Mario starts from the beginning. The manual also notes that after Mario gets about halfway through an area, he restarts from there after dying, except for certain endgame cases.

Implement:

one midpoint checkpoint per eligible level,
checkpoint activates when Mario crosses a hidden x-coordinate trigger,
on death, respawn at area start or midpoint,
castle/world exceptions can follow original rules later if you want higher fidelity.
11. Tiles and terrain

Use a grid-based tilemap.

Essential solid tile types:

ground blocks
brick blocks
question blocks
unbreakable blocks
pipes
stair blocks
moving platform rails/logic anchors
coin tiles
hidden blocks
flagpole tiles
castle/axe bridge tiles

Collision categories:

fully solid
top-solid platform
climb/slide pole
damaging
non-solid trigger
12. Blocks and interactions
Brick block
Small Mario: bump only.
Super/Fire Mario: break block into debris pieces.
Question block

Can spawn one item:

coin
mushroom
fire flower
starman
1-up
vine

After use, becomes inert “used block.”

Hidden block
Invisible until hit from below.
Often contains coin or 1-up.
Used for secrets and shortcut access.
Coin
Collect increments coin counter and score.
100 coins grants 1 life.
13. Pipes

Implement multiple pipe behaviors:

Decorative/solid pipe.
Enemy-spawn pipe (e.g. Piranha Plant).
Enterable pipe downward.
Exit pipe upward.
Warp-zone pipe.

Pipe travel:

require correct directional input at pipe mouth,
temporarily disable player control,
play transition animation,
transfer to linked destination room/area.
14. Enemies

Start with this required set.

Goomba
Walks horizontally.
Reverses on walls/edges only if your engine needs it; classic behavior is tile-obstacle reversal.
Dies when stomped or hit by fireball/starman/shell.
Koopa Troopa
Walks horizontally.
Stomp once → retract into shell.
Kick shell by touching from side after stomp.
Moving shell kills enemies and can damage Mario.
Piranha Plant
Emerges from pipes.
Retracts after cycle.
Should generally avoid emerging when Mario is standing too near pipe top.
Hammer Bro
Patrols short platform range.
Throws hammer arcs.
Hard enemy; use sparingly.
Lakitu
Moves near top of screen.
Throws Spinies downward.
Spiny
Hazardous to stomp.
Normal defeat methods: fireball/invincibility/shell depending on your fidelity target.
Buzzy Beetle
Like tougher Koopa variant.
Resistant to fireballs in the original behavior set.
Blooper
Underwater enemy.
Swims in drifting pursuit patterns.
Cheep-Cheep
Underwater swimming or jumping fish variant depending on level.
Podoboo
Lava fireball leaper in castles.
Bullet Bill
Horizontal projectile enemy from cannons.
Bowser
Castle boss.
Walks, jumps, breathes fire, throws hammers in later worlds.
Falls when bridge is cut.
Early-world versions are decoys.
15. Enemy collision rules

Player vs enemy:

Top-down contact during falling/stomping window defeats stompable enemy and bounces player.
Side/bottom contact damages player unless invincible.
Some enemies are not stompable.

Enemy vs shell:

Shell defeats most enemies.
Can chain multiple defeats.

Enemy vs fireball:

Many enemies die in one hit.
Some resist.

Enemy vs terrain:

Reverse on solid collision.
Fall off only if emulating specific enemy type that should.
16. Power-ups
Mushroom
If Mario is small, question block spawns Mushroom.
Mushroom slides horizontally along surfaces, reversing at obstacles.
Collect → Super Mario.
Fire Flower
If Mario is already Super, the same upgrade block spawns Fire Flower instead of Mushroom.
Flower rises from block and stays in place.
Collect → Fire Mario.
Starman
Bounces and moves quickly.
Collect → temporary invincibility.
1-Up Mushroom
Grants extra life.
Often hidden or reward-based.

The original manual explicitly lists Mushroom, Fire Flower, and Starman and shows their effects on Mario’s form progression.

17. Fireball behavior

For Fire Mario:

max 2 active fireballs on screen at once,
fireballs travel horizontally,
bounce on ground with diminishing arc,
disappear on solid wall collision,
damage compatible enemies.
18. Underwater mode

Underwater stages need separate movement:

no running,
jump button becomes swim stroke,
each press gives upward impulse,
buoyant slow-fall between strokes,
reduced gravity and slower horizontal movement.

Also:

use underwater enemy set,
no standard flagpole ending unless emulating original stage-specific exits.
19. Moving platforms

Needed platform types:

horizontal moving platform
vertical moving platform
falling platform
lift pair / balance platform
short cycle platforms in athletic and castle levels

Player-platform rules:

standing on platform inherits platform velocity,
leaving platform removes carry cleanly,
crushing between platform and ceiling should be handled safely.
20. Secrets

To match the original style, support:

hidden blocks,
underground coin rooms,
vine to sky bonus area,
warp zones,
1-up secrets,
shortcut pipes.

The playthrough video title indicates all levels, and the original game is known for area-based secrets such as warp routes and bonus subareas; these are part of a faithful implementation target.

21. Scoring

Implement classic-style scoring, even if exact values are tuned later.

Recommended events:

coin collected
enemy stomped
enemy chain defeated by shell
block broken
power-up collected
flagpole height bonus
time remaining bonus at level end

Extra life:

100 coins = +1 life
optional enemy chain score escalation
22. Lives and game flow
Start with configurable lives count.
Death reduces lives by 1.
If lives remain, reload current area from start/checkpoint.
If no lives remain, game over.
After full completion, optionally unlock world select / hard mode.
23. Audio spec

Need these music/state groups:

title
overworld
underground
underwater
castle
invincibility
death
level clear
castle clear
game over
ending

SFX:

jump
stomp
bump
break block
coin
power-up spawn
power-up collect
fireball
pipe enter/exit
flagpole
Bowser bridge collapse
1-up
24. Recommended data model

Use data-driven content.

Entity base
Entity
- id
- type
- position
- velocity
- bbox
- facing
- state
- active
- despawnPolicy
Player
Player
- form: small | super | fire
- invincibleTimer
- onGround
- jumpHoldTimer
- runHeld
- facing
- score
- coins
- lives
- checkpointId
Level
Level
- world
- area
- theme
- widthTiles
- heightTiles
- timeLimit
- checkpointX
- tileLayers[]
- entities[]
- pipeLinks[]
- triggers[]
- endType: flagpole | castleAxe
Trigger
Trigger
- type: checkpoint | areaTransition | warpZone | spawn | cutscene
- bounds
- payload
25. Rendering rules
16x16 tile grid is the easiest faithful target.
Use sprite animations for:
idle
walk
skid
jump
swim
crouch
climb pole
death
power transition
Animate used blocks, coins, fireballs, enemy walk cycles.
26. Technical behaviors worth matching

These strongly affect feel:

coyote time: keep very small or none for authenticity
input buffering: minimal
enemy activation only when near camera
offscreen despawn to save performance
shell hazards persist long enough to matter
flagpole grab should snap player reliably
pipe entry should require intentional alignment
27. Minimal shippable version

Implement in this order:

Player movement and camera
Solid tiles, pits, and flagpole completion
Goomba + Koopa
Question blocks + Mushroom + Fire Flower
Super/Fire damage downgrade logic
Pipes + subareas
Castle level + Bowser bridge ending
Underwater movement
Moving platforms
Secrets, warp zones, polish
28. Acceptance checklist

Your clone is “good enough” when:

movement feels momentum-based, not floaty or instant,
running changes jump distance significantly,
Mario can finish flagpole stages and castle stages,
damage downgrades work correctly,
Mushroom/Flower/Starman logic is correct,
enemies interact with shells and fireballs,
timer, score, coins, lives, and checkpointing all function,
all 32 areas can be represented in data. The 32-area target and the timer/flagpole/checkpoint/power-up systems are all grounded in the original materials used here.
29. One important implementation note

Do not try to start by copying every quirk of the NES ROM. First build a clean, deterministic modern implementation that reproduces the player-facing behaviors above. Once it plays well, add fidelity details:

skid timing,
exact jump arcs,
enemy spawn windows,
shell bounce quirks,
Bowser patterns,
warp zone specifics.

If you want, I can turn this into a full engineering GDD next, with exact state machines, enemy tables, and a JSON level schema.