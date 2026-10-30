export function overlayConnectionLabel(clientCount: number) {
  const count = Math.max(0, Math.floor(clientCount));
  if (count === 0) return "Overlay: waiting…";
  return `Overlay: live (${count} ${count === 1 ? "client" : "clients"})`;
}
