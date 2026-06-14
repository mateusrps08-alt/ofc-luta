// Conta toques rápidos: 1, 2 ou 3. Dispara onTap quando a janela fecha.
// Desacoplado do DOM pra reuso (toque na tela + teclado).
export class TapCounter {
  private count = 0;
  private timer = 0 as unknown as ReturnType<typeof setTimeout>;

  constructor(private onTap: (count: 1 | 2 | 3) => void, private window = 150) {}

  hit() {
    this.count = Math.min(this.count + 1, 3);
    clearTimeout(this.timer);
    if (this.count === 3) { this.fire(); return; }
    this.timer = setTimeout(() => this.fire(), this.window);
  }

  private fire() {
    const c = this.count as 1 | 2 | 3;
    this.count = 0;
    this.onTap(c);
  }
}

// Liga um TapCounter a um elemento (pointerdown).
export class MultiTap {
  private tc: TapCounter;
  constructor(el: HTMLElement, onTap: (count: 1 | 2 | 3) => void) {
    this.tc = new TapCounter(onTap);
    el.addEventListener("pointerdown", (e) => { e.preventDefault(); this.tc.hit(); });
  }
}
