/**
 * CoinPopup.ts
 * Non-physics coin animation — floats upward 32px over 30 frames then disappears.
 */

export class CoinPopup {
  x: number;
  y: number;
  startY: number;
  alive: boolean = true;
  timer: number = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.startY = y;
  }

  update(): void {
    this.y = this.startY - (this.timer / 30) * 32;
    this.timer++;
    if (this.timer >= 30) {
      this.alive = false;
    }
  }

  getSpriteKey(): string {
    return (Math.floor(this.timer / 8) % 2 === 0)
      ? 'coin_1'
      : 'coin_2';
  }
}
