export type ChatWireLine = { userName: string; text: string; filtered?: boolean };

export function chatLinePresentation(line: ChatWireLine) {
  return {
    userName: line.userName,
    text: line.filtered ? "[filtered]" : line.text,
    muted: Boolean(line.filtered)
  };
}
