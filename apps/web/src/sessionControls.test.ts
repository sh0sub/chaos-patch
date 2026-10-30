import { describe, expect, it } from "vitest";
import { overlaySourceUrl, parseBlockedTerms } from "./sessionControls";

describe("session controls", () => {
  it("builds the OBS source URL and normalizes up to five blocked terms", () => {
    expect(overlaySourceUrl("http://localhost:5173")).toBe("http://localhost:5173/overlay");
    expect(parseBlockedTerms(" private data, gambling, private data, self-harm, adult, hate, extra ")).toEqual([
      "private data",
      "gambling",
      "self-harm",
      "adult",
      "hate"
    ]);
  });
});
