import { describe, expect, it, vi } from "vitest";
import { connectStateSocket, type StateSocket } from "./stateSocket";

class FakeSocket implements StateSocket {
  onmessage: WebSocket["onmessage"] = null;
  onclose: WebSocket["onclose"] = null;
  close = vi.fn();

  emitClose() {
    this.onclose?.call(this as unknown as WebSocket, {} as CloseEvent);
  }

  emitMessage(data: string) {
    this.onmessage?.call(this as unknown as WebSocket, new MessageEvent("message", { data }));
  }
}

describe("connectStateSocket", () => {
  it("reconnects after a server disconnect and stops cleanly", () => {
    const sockets: FakeSocket[] = [];
    const scheduled: Array<() => void> = [];
    const cancelled: number[] = [];
    const messages: string[] = [];

    const stop = connectStateSocket("ws://localhost/ws", (data) => messages.push(data), {
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      schedule: (callback, delay) => {
        expect(delay).toBe(1_000);
        scheduled.push(callback);
        return scheduled.length;
      },
      cancel: (timer) => { cancelled.push(timer); }
    });

    sockets[0]?.emitMessage("first");
    sockets[0]?.emitClose();
    expect(messages).toEqual(["first"]);
    expect(scheduled).toHaveLength(1);

    scheduled[0]?.();
    expect(sockets).toHaveLength(2);
    sockets[1]?.emitMessage("reconnected");
    expect(messages).toEqual(["first", "reconnected"]);

    stop();
    expect(cancelled).toEqual([1]);
    expect(sockets[1]?.close).toHaveBeenCalledOnce();
    sockets[1]?.emitClose();
    expect(scheduled).toHaveLength(1);
  });
});
