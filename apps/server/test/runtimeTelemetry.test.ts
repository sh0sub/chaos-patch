import { describe, expect, it } from "vitest";
import { RuntimeTelemetry } from "../src/runtimeTelemetry";

describe("RuntimeTelemetry", () => {
  it("reports chat messages from the last minute and the latest compile latency", () => {
    const telemetry = new RuntimeTelemetry();
    telemetry.recordChat(1_000);
    telemetry.recordChat(45_000);
    telemetry.recordChat(70_000);
    telemetry.recordCompile(842.7);

    expect(telemetry.snapshot(70_000)).toEqual({ chatMessagesPerMinute: 2, lastCompileMs: 843 });
    expect(telemetry.snapshot(131_000)).toEqual({ chatMessagesPerMinute: 0, lastCompileMs: 843 });
  });
});
