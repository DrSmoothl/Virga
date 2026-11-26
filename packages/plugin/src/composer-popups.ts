import { lists, rows } from "./chat-dom.ts";

const commands = ".bot-panel-wrapper";

function addedCommands({ target, addedNodes }: MutationRecord) {
  if (!addedNodes.length) return false;
  const parent = target instanceof Element ? target : undefined;
  const track = parent?.closest(lists);
  const insideRow = track && parent?.closest(rows);
  for (const node of addedNodes) {
    if (!(node instanceof Element)) continue;
    if (node.matches(commands)) return true;
    if (track && (insideRow || node.matches(rows))) continue;
    if (node.querySelector(commands)) return true;
  }
  return false;
}

export function anchorCommandPanel(win: Window, composer: HTMLElement) {
  const doc = win.document;
  const events = new AbortController();
  let content = doc.querySelector<HTMLElement>(commands);
  let panel: HTMLElement | undefined;
  let frame = 0;
  function clear() {
    if (!panel) return;
    panel.removeAttribute("data-virga-command-panel");
    for (const property of ["left", "below", "width", "space"])
      panel.style.removeProperty("--virga-command-" + property);
    panel = undefined;
  }
  function place() {
    frame = 0;
    const next = content?.closest<HTMLElement>(".q-popup__main") ?? content ?? undefined;
    if (next !== panel) {
      clear();
      panel = next;
    }
    if (!panel || !composer.hasAttribute("data-virga-composer")) {
      clear();
      return;
    }
    const rect = composer.getBoundingClientRect();
    panel.style.setProperty("--virga-command-left", rect.left + "px");
    panel.style.setProperty("--virga-command-below", (win.innerHeight - rect.top + 6) + "px");
    panel.style.setProperty("--virga-command-width", rect.width + "px");
    panel.style.setProperty("--virga-command-space", Math.max(100, rect.top - 12) + "px");
    panel.dataset.virgaCommandPanel = "";
  }
  function schedule() {
    if (!frame && (content || panel)) frame = win.requestAnimationFrame(place);
  }
  const resize = new ResizeObserver(schedule);
  resize.observe(composer);
  win.addEventListener("resize", schedule, { signal: events.signal });
  const observer = new MutationObserver((records) => {
    if ((content && !content.isConnected) || records.some(addedCommands)) {
      content = doc.querySelector<HTMLElement>(commands);
      schedule();
    }
  });
  observer.observe(doc.body, { subtree: true, childList: true });
  place();
  return {
    reconcile: schedule,
    dispose() {
      events.abort();
      observer.disconnect();
      resize.disconnect();
      if (frame) win.cancelAnimationFrame(frame);
      clear();
    },
  };
}
