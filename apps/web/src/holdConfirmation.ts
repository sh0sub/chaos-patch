type HoldTimers = {
  schedule: (callback: () => void, milliseconds: number) => number;
  cancel: (timer: number) => void;
};

const browserTimers: HoldTimers = {
  schedule: (callback, milliseconds) => window.setTimeout(callback, milliseconds),
  cancel: (timer) => window.clearTimeout(timer)
};

export function createHoldConfirmation(confirm: () => void, timers: HoldTimers = browserTimers) {
  let timer: number | null = null;
  return {
    begin() {
      if (timer !== null) return;
      timer = timers.schedule(() => {
        timer = null;
        confirm();
      }, 1_000);
    },
    cancel() {
      if (timer === null) return;
      timers.cancel(timer);
      timer = null;
    }
  };
}
