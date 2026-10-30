export function overlaySourceUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/overlay`;
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
