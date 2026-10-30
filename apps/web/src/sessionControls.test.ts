import { describe, expect, it } from "vitest";
import { overlaySocketUrl, overlaySourceUrl, parseBlockedTerms } from "./sessionControls";

describe("session controls", () => {
  it("builds the OBS source URL and normalizes up to five blocked terms", () => {
    expect(overlaySourceUrl("http://localhost:5173", "one time key")).toBe("http://localhost:5173/overlay#k=one%20time%20key");
    expect(overlaySocketUrl("ws:", "localhost:5173", "/overlay", "#k=one%20time%20key")).toBe(
      "ws://localhost:5173/ws?surface=overlay&token=one%20time%20key"
    );
    expect(overlaySocketUrl("ws:", "localhost:5173", "/", "")).toBe("ws://localhost:5173/ws?surface=dashboard");
    expect(parseBlockedTerms(" private data, gambling, private data, self-harm, adult, hate, extra ")).toEqual([
      "private data",
      "gambling",
      "self-harm",
      "adult",
      "hate"
    ]);
  });
});
