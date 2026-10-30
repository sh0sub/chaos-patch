import { describe, expect, it } from "vitest";
import { twitchStatusPresentation } from "./twitchStatus";

describe("Twitch status presentation", () => {
  it("gives every operational state distinct user-facing copy", () => {
    expect(twitchStatusPresentation("disconnected", null)).toEqual({ label: "Twitch disconnected", reconnect: false });
    expect(twitchStatusPresentation("connecting", "Tester")).toEqual({ label: "Tester · connecting", reconnect: false });
    expect(twitchStatusPresentation("connected", "Tester")).toEqual({ label: "Tester · connected", reconnect: false });
    expect(twitchStatusPresentation("expired", "Tester")).toEqual({ label: "Tester · Re-connect needed", reconnect: true });
    expect(twitchStatusPresentation("error", "Tester")).toEqual({ label: "Tester · connection error", reconnect: false });
  });
});
