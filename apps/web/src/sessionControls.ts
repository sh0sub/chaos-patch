export function overlaySourceUrl(origin: string, key: string): string {
  return `${origin.replace(/\/$/, "")}/overlay#k=${encodeURIComponent(key)}`;
}

export function overlaySocketUrl(protocol: string, host: string, pathname: string, hash: string): string {
  const surface = pathname === "/overlay" ? "overlay" : "dashboard";
  const token = surface === "overlay" ? new URLSearchParams(hash.replace(/^#/, "")).get("k") : null;
  const authorization = token ? `&token=${encodeURIComponent(token)}` : "";
  return `${protocol}//${host}/ws?surface=${surface}${authorization}`;
}

export function parseBlockedTerms(input: string): string[] {
  const unique = new Map<string, string>();
  for (const term of input.split(",")) {
    const trimmed = term.trim();
    const key = trimmed.toLocaleLowerCase();
    if (trimmed && !unique.has(key)) unique.set(key, trimmed);
  }
  return Array.from(unique.values()).slice(0, 5);
}
