import { describe, expect, it } from "vitest";
import { markerStatus } from "./marker";

describe("markerStatus", () => {
  it("formats a Twitch marker position for the control room", () => {
    expect(markerStatus({ positionSeconds: 125 })).toBe("Marker saved · 02:05");
  });
});
