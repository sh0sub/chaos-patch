export class RuntimeTelemetry {
  private chatTimestamps: number[] = [];
  private lastCompileMilliseconds: number | null = null;

  recordChat(atMilliseconds = Date.now()): void {
    this.chatTimestamps.push(atMilliseconds);
  }

  recordCompile(milliseconds: number): void {
    this.lastCompileMilliseconds = Math.max(0, Math.round(milliseconds));
  }

  snapshot(nowMilliseconds = Date.now()) {
    const cutoff = nowMilliseconds - 60_000;
    this.chatTimestamps = this.chatTimestamps.filter((timestamp) => timestamp >= cutoff);
    return {
      chatMessagesPerMinute: this.chatTimestamps.length,
      lastCompileMs: this.lastCompileMilliseconds
    };
  }
}
