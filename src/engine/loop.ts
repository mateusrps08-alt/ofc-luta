// Fixed-step update, free render. dt em segundos.
export class Loop {
  private acc = 0;
  private last = 0;
  private readonly step = 1 / 60;
  private raf = 0;

  constructor(
    private update: (dt: number) => void,
    private render: (alpha: number) => void,
  ) {}

  start() {
    this.last = performance.now();
    const frame = (now: number) => {
      let frameTime = (now - this.last) / 1000;
      this.last = now;
      if (frameTime > 0.25) frameTime = 0.25; // evita espiral após travada
      this.acc += frameTime;
      while (this.acc >= this.step) {
        this.update(this.step);
        this.acc -= this.step;
      }
      this.render(this.acc / this.step);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }
}
