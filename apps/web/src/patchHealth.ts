export class PatchHealthGuard {
  private lowFpsSeconds = 0;

  constructor(
    private readonly minimumFps = 20,
    private readonly failureSeconds = 3
  ) {}

  observeFrame(deltaSeconds: number): boolean {
    const lowFps = deltaSeconds > 1 / this.minimumFps && deltaSeconds <= 0.25;
    this.lowFpsSeconds = lowFps ? this.lowFpsSeconds + deltaSeconds : 0;
    return this.lowFpsSeconds >= this.failureSeconds;
  }

  reset(): void {
    this.lowFpsSeconds = 0;
  }
}
