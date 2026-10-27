export type StateSocket = Pick<WebSocket, "onmessage" | "onclose" | "close">;

type StateSocketOptions = {
  createSocket?: (url: string) => StateSocket;
  schedule?: (callback: () => void, delay: number) => number;
  cancel?: (timer: number) => void;
};

export function connectStateSocket(
  url: string,
  onMessage: (data: string) => void,
  options: StateSocketOptions = {}
): () => void {
  const createSocket = options.createSocket ?? ((socketUrl) => new WebSocket(socketUrl));
  const schedule = options.schedule ?? ((callback, delay) => window.setTimeout(callback, delay));
  const cancel = options.cancel ?? ((timer) => window.clearTimeout(timer));
  let socket: StateSocket | null = null;
  let retryTimer = 0;
  let disposed = false;

  const connect = () => {
    const nextSocket = createSocket(url);
    socket = nextSocket;
    nextSocket.onmessage = (event) => onMessage(String(event.data));
    nextSocket.onclose = () => {
      if (!disposed) retryTimer = schedule(connect, 1_000);
    };
  };

  connect();
  return () => {
    disposed = true;
    cancel(retryTimer);
    socket?.close();
  };
}
