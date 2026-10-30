import { describe, expect, it } from "vitest";
import { BrowserClientRegistry } from "../src/browserClients";

describe("BrowserClientRegistry", () => {
  it("counts overlay surfaces separately from dashboard clients", () => {
    const registry = new BrowserClientRegistry<object>();
    const dashboard = {};
    const firstOverlay = {};
    const secondOverlay = {};

    registry.add(dashboard, "/ws?surface=dashboard");
    registry.add(firstOverlay, "/ws?surface=overlay");
    registry.add(secondOverlay, "/ws?surface=overlay");
    expect(registry.overlayCount).toBe(2);
    expect(registry.clients).toHaveLength(3);

    registry.delete(firstOverlay);
    expect(registry.overlayCount).toBe(1);
    expect(registry.clients).toHaveLength(2);
  });
});
