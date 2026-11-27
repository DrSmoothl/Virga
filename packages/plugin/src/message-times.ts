import { messageBubble } from "./chat-dom.ts";

export const sentTimeMark = "data-virga-sent-at";
export const sentTimePlacementMark = "data-virga-sent-at-placement";

const outgoingMessage =
  ".container--self, .message-content--self, .message-self, .message-container--self, .message--self";

interface MessageComponent {
  isUnmounted?: boolean;
  props?: {
    msgRecord?: {
      msgTime?: unknown;
      elements?: readonly ({ arkElement?: unknown } | null)[];
    };
  };
  vnode?: VNode;
  subTree?: VNode;
}

interface VNode {
  type?: unknown;
  el?: Node | null;
  component?: MessageComponent | null;
  children?: unknown;
  dynamicChildren?: VNode[] | null;
  suspense?: { activeBranch?: VNode };
}

function formatSentTime(value: unknown) {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    !/^\d{10}$/.test(String(value))
  ) return;
  const date = new Date(Number(value) * 1000);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return hours + ":" + minutes;
}

function ownerOf(component: MessageComponent) {
  const element = component.vnode?.el;
  if (!component.isUnmounted && element instanceof Element) return element;
}

export function messageTimes() {
  // Virtual rows may keep their component while its message props change.
  const components = new WeakMap<Element, MessageComponent>();
  return function collect(host: Element, rows: readonly Element[]) {
    const times = new Map<Element, string>();
    const placements = new Map<Element, string>();
    const pending = new Map<Element, Element>();
    const recordTime = (bubble: Element, component: MessageComponent) => {
      const record = component.props?.msgRecord;
      const parts = record?.elements;
      if (Array.isArray(parts) && parts.length && parts.every(part => part?.arkElement))
        return;
      const time = formatSentTime(record?.msgTime);
      if (!time) return;
      times.set(bubble, time);
      const outgoing =
        !bubble.classList.contains("container--others") &&
        !!bubble.closest(outgoingMessage);
      const { display, flexDirection } = getComputedStyle(bubble);
      const beforeContent =
        (display === "flex" || display === "inline-flex") &&
        flexDirection === (outgoing ? "row" : "row-reverse");
      const placement = ((outgoing ? "start" : "") + (beforeContent ? " first" : "")).trim();
      if (placement) placements.set(bubble, placement);
    };

    for (const row of rows) {
      const bubble = messageBubble(row);
      if (
        !bubble ||
        bubble.closest(".ark-msg-content-container") ||
        bubble.querySelector(":scope > .msg-time, :scope > time[datetime]")
      )
        continue;
      const component = components.get(row);
      if (component && ownerOf(component)?.contains(bubble))
        recordTime(bubble, component);
      else pending.set(row, bubble);
    }

    // Read the attached Vue tree once for the rows that don't have a live owner.
    const seen = new Set<VNode>();
    for (let ancestor: Element | null = host; ancestor && pending.size; ancestor = ancestor.parentElement) {
      const root = (ancestor as Element & { _vnode?: VNode })._vnode;
      if (!root) continue;
      const stack: VNode[] = [root];
      while (stack.length && pending.size) {
        const node = stack.pop()!;
        if (!node || typeof node !== "object" || seen.has(node)) continue;
        seen.add(node);
        if (
          typeof node.type === "string" &&
          node.el instanceof Element &&
          !node.el.contains(host) &&
          !host.contains(node.el)
        ) continue;
        const component = node.component;
        if (component?.props?.msgRecord) {
          const owner = ownerOf(component);
          let row: Element | undefined | null = owner;
          while (row && row !== host && row.parentElement !== host)
            row = row.parentElement;
          const bubble = row && pending.get(row);
          if (row && bubble && owner?.contains(bubble)) {
            components.set(row, component);
            recordTime(bubble, component);
            pending.delete(row);
          }
        }
        if (Array.isArray(node.children)) stack.push(...node.children);
        if (node.dynamicChildren) stack.push(...node.dynamicChildren);
        if (node.suspense?.activeBranch) stack.push(node.suspense.activeBranch);
        if (component?.subTree) stack.push(component.subTree);
      }
    }
    return { times, placements };
  };
}
