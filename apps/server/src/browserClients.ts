type BrowserSurface = "dashboard" | "overlay";

export class BrowserClientRegistry<Client> {
  private readonly surfaces = new Map<Client, BrowserSurface>();

  add(client: Client, requestUrl: string | undefined): void {
    const url = new URL(requestUrl ?? "/ws", "http://localhost");
    this.surfaces.set(client, url.searchParams.get("surface") === "overlay" ? "overlay" : "dashboard");
  }

  delete(client: Client): void {
    this.surfaces.delete(client);
  }

  get clients(): Client[] {
    return [...this.surfaces.keys()];
  }

  get overlayCount(): number {
    return [...this.surfaces.values()].filter((surface) => surface === "overlay").length;
  }
}
