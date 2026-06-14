// Hitstop (congela mundo) + screen shake. Game feel central.
export class GameFeel {
  private hitstop = 0; // segundos restantes congelado
  private shakeAmt = 0;
  private shakeTime = 0;
  private shakeMax = 0;
  shakeX = 0;
  shakeY = 0;

  freeze(seconds: number) {
    this.hitstop = Math.max(this.hitstop, seconds);
  }

  shake(amount: number, seconds: number) {
    this.shakeAmt = amount;
    this.shakeMax = seconds;
    this.shakeTime = seconds;
  }

  // retorna true se mundo está congelado neste frame
  frozen() {
    return this.hitstop > 0;
  }

  update(dt: number) {
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return; // congelado: não atualiza shake
    }
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const k = this.shakeTime / this.shakeMax;
      const a = this.shakeAmt * k;
      this.shakeX = (Math.random() * 2 - 1) * a;
      this.shakeY = (Math.random() * 2 - 1) * a;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }
}
