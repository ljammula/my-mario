# SPEC: Bugfix – Mario should not die when stomping enemies

FILE: core/gameplay/collision.go (and related enemy collision/logic files)
CONTEXT: Enemy collision handler, stomp detection logic, player state update

TASK: Fix bug where Mario is killed when stomping on enemies. Ensure that Mario survives and enemies are defeated by stomping, across all levels and enemy types. The "stomp" event should always prioritize Mario's survival if his vertical velocity is downward and overlaps with an enemy's hitbox top.

EXPECTED BEHAVIOR:
- When Mario lands on any enemy from above (stomp), Mario remains alive, enemy is defeated, and player state is updated accordingly (score, etc.).
- If Mario hits an enemy from the side or below, normal enemy logic applies (Mario may be killed depending on power state).
- Works across every level and all enemy types, including edge cases (e.g., stacked enemies, moving platforms).

TESTS:
- Unit test: Mario stomps on Goomba, survives, enemy dies.
- Unit test: Mario stomps on Koopa, survives, shell appears, Mario can interact.
- Multi-level integration test: Mario can stomp on enemies in every level—verify function in all 10 levels.
- Edge case: Mario stomps two enemies in a row without touching ground.
- Negative case: Mario runs into enemy from side—should still trigger death (if not powered up).

NOTES:
- Identify and update affected files (collision handlers, enemy logic, test cases).
- Back up any original files before major changes.

---
Place this file in:
code/my-mario/.specs/queue/mario-stomp-enemy-bugfix.spec.md
