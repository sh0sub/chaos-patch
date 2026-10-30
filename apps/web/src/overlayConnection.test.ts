import { describe, expect, it } from "vitest";
import { overlayConnectionLabel } from "./overlayConnection";

describe("overlay connection label", () => {
  it("distinguishes waiting from one or more live OBS clients", () => {
    expect(overlayConnectionLabel(0)).toBe("Overlay: waiting…");
    expect(overlayConnectionLabel(1)).toBe("Overlay: live (1 client)");
    expect(overlayConnectionLabel(3)).toBe("Overlay: live (3 clients)");
  });
});
