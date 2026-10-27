export function markerStatus(marker: { positionSeconds: number }): string {
  const minutes = Math.floor(marker.positionSeconds / 60);
  const seconds = marker.positionSeconds % 60;
  return `Marker saved · ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
