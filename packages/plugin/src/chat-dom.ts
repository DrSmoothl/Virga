export const lists =
  '.chat-msg-area, .ml-list, [role="log"], [aria-label="消息列表"], [aria-label="Message list"]';
export const rows = '.ml-item, .message, [role="listitem"]';

export const messageCards = ".message-container, .message, [data-message-id]";

export function messageBubble(row: Element) {
  return (
    row.querySelector(".msg-content-container") ??
    row.querySelector(
      ".message-content__wrapper, .message-content, [data-message-bubble]",
    )
  );
}

export function timelineViewport(list: Element, host: Element) {
  let node: Element | null = host;
  for (; node; node = node.parentElement) {
    if (/^(auto|scroll|overlay)$/.test(getComputedStyle(node).overflowY))
      return node;
    if (node === list) break;
  }
  return list.querySelector(".chat-msg-area__vlist, .ml-root") ?? list;
}

export function findTimeline(pane: ParentNode): Element | undefined {
  const candidates = Array.from(pane.querySelectorAll(lists));
  if (pane instanceof Element && pane.matches(lists)) candidates.unshift(pane);
  const visible = candidates.filter((list) => list.getClientRects().length > 0);
  return visible.find((list) => list.querySelector(messageCards)) ?? visible[0];
}

export function rowHost(list: Element) {
  const tracks = list.querySelectorAll(".ml-list");
  const track =
    Array.from(tracks).find((node) => node.querySelector(messageCards)) ?? list;
  return (
    (
      track.querySelector(".ml-item") ??
      track.querySelector(messageCards + ', [role="listitem"]')
    )?.parentElement ?? track
  );
}
