import { describe, expect, it, vi } from "vitest";
import { createHoldConfirmation } from "./holdConfirmation";

describe("hold confirmation", () => {
  it("confirms only after an uninterrupted one-second hold", () => {
    const confirm = vi.fn();
    const clear = vi.fn();
    let finish: (() => void) | null = null;
    const hold = createHoldConfirmation(confirm, {
      schedule: (callback, milliseconds) => {
        expect(milliseconds).toBe(1_000);
        finish = callback;
        return 7;
      },
      cancel: clear
    });

    hold.begin();
    hold.cancel();
    expect(clear).toHaveBeenCalledWith(7);
    expect(confirm).not.toHaveBeenCalled();

    hold.begin();
    expect(finish).not.toBeNull();
    (finish as unknown as () => void)();
    expect(confirm).toHaveBeenCalledOnce();
  });
});
