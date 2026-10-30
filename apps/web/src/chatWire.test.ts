import { describe, expect, it } from "vitest";
import { chatLinePresentation } from "./chatWire";

describe("chat wire", () => {
  it("hides blocked proposal text behind a muted placeholder", () => {
    expect(chatLinePresentation({ userName: "viewer", text: "private idea", filtered: true })).toEqual({
      userName: "viewer",
      text: "[filtered]",
      muted: true
    });
  });
});
