import { describe, expect, it } from "vitest";
import config from "../vite.config";

describe("Vite development host access", () => {
  it("allows only the project Tailnet hostname in addition to local hosts", () => {
    expect(typeof config).toBe("object");
    if (typeof config !== "object") throw new Error("Expected a static Vite config");

    expect(config.server?.allowedHosts).toEqual(["home.tail5cbec7.ts.net"]);
  });
});
