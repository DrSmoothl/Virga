import { sizeComposer } from "./composer-sizing.ts";
import { anchorCommandPanel } from "./composer-popups.ts";

const nativePopup =
  '.q-context-menu, .q-context-sub-menu__container, .bar-more-menu-inner, .q-popup, .q-pulldown-menu-wrapper, .expression-panel, .bot-panel-wrapper, [role="menu"], [role="dialog"]';

const toolItem =
  'button, [role="button"], [role="menuitem"], .icon-item, .q-context-menu-item';
const popupTrigger =
  '.arrow, [aria-haspopup="menu"], [aria-haspopup="true"], .q-context-menu-item--submenu';
const disabledTool =
  ':disabled, [aria-disabled="true"], .disable, .disabled, .q-context-menu-item--disabled';
const attachments = /^(?:(?:发送|选择|上传)?(?:图片|文件)|(?:send |choose |upload )?(?:images?|files?))$/i;
const nativeModes = /^(?:语音消息|voice message|机器人.*指令|bot commands?)$/i;
const voicePane = ":scope > .audio-msg-input";

function nativeVoiceExit(voice: Element | null) {
  const exit = voice?.querySelector<HTMLElement>(".key-desc .link-btn");
  return exit?.getClientRects().length && !exit.matches(disabledTool) &&
    getComputedStyle(exit).visibility === "visible" ? exit : undefined;
}

function bindComposer(area: HTMLElement, pane: Element, win: Window) {
  const doc = win.document;
  const events = new AbortController();
  const toolbarId = "virga-composer-tools";
  const toggle = doc.createElement("button");
  toggle.type = "button";
  toggle.dataset.virgaToolsToggle = "";
  toggle.setAttribute("aria-label", "聊天工具");
  toggle.title = "聊天工具";
  toggle.setAttribute("aria-expanded", "false");

  const voiceClose = doc.createElement("button");
  voiceClose.type = "button";
  voiceClose.dataset.virgaVoiceClose = "";
  voiceClose.setAttribute("aria-label", "退出语音消息");
  voiceClose.title = "退出语音消息";

  let toolbar: HTMLElement | undefined;
  let draft: HTMLElement | undefined;
  let editorViewport: HTMLElement | undefined;
  let ownsToolbarId = false;
  let ownsInert = false;
  let drag: AbortController | undefined;
  let sizing: ReturnType<typeof sizeComposer> | undefined;
  let popup: ReturnType<typeof anchorCommandPanel> | undefined;
  let closeFrame = 0;
  let waitingForPicker = false;
  let pickerLeftWindow = false;
  let returningFromVoice = false;
  const open = () => area.hasAttribute("data-virga-tools-open");
  function setOpen(expanded: boolean) {
    if (closeFrame) win.cancelAnimationFrame(closeFrame);
    closeFrame = 0;
    if (!expanded) waitingForPicker = pickerLeftWindow = false;
    if (expanded) area.dataset.virgaToolsInteracted = "";
    area.toggleAttribute("data-virga-tools-open", expanded);
    toggle.setAttribute("aria-expanded", String(expanded));
    if (!toolbar) return;
    if (!expanded && !toolbar.inert) {
      toolbar.inert = true;
      ownsInert = true;
    } else if (expanded && ownsInert) {
      toolbar.inert = false;
      ownsInert = false;
    }
  }
  function reset() {
    drag?.abort();
    sizing?.dispose();
    sizing = undefined;
    popup?.dispose();
    popup = undefined;
    setOpen(false);
    toggle.remove();
    area.removeAttribute("data-virga-composer");
    area.removeAttribute("data-virga-tools-interacted");
    area.style.removeProperty("--virga-composer-floor");
    draft?.removeAttribute("data-virga-draft");
    toolbar?.removeAttribute("data-virga-toolbar");
    if (ownsInert && toolbar) toolbar.inert = false;
    if (ownsToolbarId && toolbar?.id === toolbarId)
      toolbar.removeAttribute("id");
    ownsToolbarId = false;
    ownsInert = false;
    toolbar = undefined;
    draft = undefined;
    editorViewport = undefined;
  }

  const observer = new MutationObserver(reconcile);
  function reconcile() {
    observer.disconnect();
    observer.observe(area, { childList: true });
    const bar = area.querySelector<HTMLElement>(":scope > .chat-func-bar");
    const viewport = area.querySelector<HTMLElement>(":scope > .msg-input");
    const selection = area.querySelector<HTMLElement>(":scope > .forward-ops");
    const voice = area.querySelector<HTMLElement>(voicePane);
    const hint = voice?.querySelector(".key-desc");
    const editor = viewport?.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    );

    for (const node of [bar, selection, voice, hint, hint?.querySelector(".link-btn")]) {
      if (node)
        observer.observe(node, {
          childList: node === voice || node === hint,
          attributes: true,
          attributeFilter: ["class", "style", "hidden", "disabled", "aria-disabled"],
        });
    }
    for (
      let node = editor ?? viewport;
      node && node !== area;
      node = node.parentElement
    ) {
      observer.observe(node, {
        childList: node !== editor,
        attributes: true,
        attributeFilter: ["contenteditable", "style", "hidden"],
      });
    }

    const show = (el: HTMLElement | null | undefined) =>
      !!el && el.getClientRects().length > 0;
    const voiceActive = show(voice);
    if (voiceActive) returningFromVoice = true;
    if (voice && nativeVoiceExit(voice)) {
      if (voiceClose.parentElement !== voice) voice.append(voiceClose);
    } else {
      voiceClose.remove();
    }
    if (!bar || !viewport || !editor || !show(bar) || !show(editor) || show(selection) || voiceActive) {
      if (toolbar) reset();
      return;
    }
    if (toolbar !== bar || draft !== editor || editorViewport !== viewport) {
      reset();
      toolbar = bar;
      draft = editor;
      editorViewport = viewport;
      ownsToolbarId = !bar.id;
      if (ownsToolbarId) bar.id = toolbarId;
      toggle.setAttribute("aria-controls", bar.id);
      bar.dataset.virgaToolbar = "";
      editor.dataset.virgaDraft = "";
      area.dataset.virgaComposer = "";
      setOpen(false);
    }
    // QQ can replace the input area's immediate children during an update.
    if (toggle.parentElement !== area || toggle.nextElementSibling !== bar)
      area.insertBefore(toggle, bar);
    if (sizing) sizing.watch();
    else sizing = sizeComposer(win, pane, area, viewport, editor);
    if (popup) popup.reconcile();
    else popup = anchorCommandPanel(win, area);
    if (returningFromVoice) {
      returningFromVoice = false;
      // QQ unmounts the recorder with focus still inside it.
      if (doc.hasFocus() && doc.activeElement === doc.body)
        editor.focus({ preventScroll: true });
    }
  }

  function resize(event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary) return;
    drag?.abort();
    const handle =
      event.target instanceof Element &&
      event.target.closest(".resize-handler.ns");
    if (!toolbar || !handle || handle.parentElement !== area) return;
    drag = new AbortController();
    const { signal } = drag;
    const { clientY, pointerId } = event;
    const height = area.getBoundingClientRect().height;
    let moved = false;
    const finish = () => drag?.abort();
    const applyHeight = (y: number) => {
      moved = true;
      const next = height + clientY - y;
      if (next > 0)
        area.style.setProperty("--virga-composer-floor", next + "px");
      else area.style.removeProperty("--virga-composer-floor");
      sizing?.syncNow();
    };
    // Reflect the native drag in the automatic layout without taking its events.
    win.addEventListener(
      "pointermove",
      (move) => {
        if (move.pointerId === pointerId && (move.buttons & 1))
          applyHeight(move.clientY);
      },
      { capture: true, passive: true, signal },
    );
    for (const kind of ["pointerup", "pointercancel"] as const)
      win.addEventListener(
        kind,
        (change) => {
          if (change.pointerId !== pointerId) return;
          if (kind === "pointerup" && (moved || change.clientY !== clientY))
            applyHeight(change.clientY);
          finish();
        },
        { capture: true, signal },
      );
    win.addEventListener("blur", finish, { once: true, signal });
  }

  toggle.addEventListener(
    "mousedown",
    (event) => {
      if (event.button === 0 && draft?.contains(doc.activeElement))
        event.preventDefault();
    },
    { signal: events.signal },
  );
  toggle.addEventListener("click", () => setOpen(!open()), {
    signal: events.signal,
  });
  doc.addEventListener(
    "click",
    (event) => {
      if (!open() || !toolbar || !(event.target instanceof Element)) return;
      const action = event.target.closest(toolItem);
      if (
        !action || !toolbar.contains(action) ||
        action.matches(popupTrigger) || action.closest(disabledTool)
      )
        return;
      const label = (action.getAttribute("aria-label") ??
        action.getAttribute("title") ?? action.textContent ?? "").trim();
      if (attachments.test(label)) {
        // Leave the native attachment target usable until its picker has returned.
        waitingForPicker = true;
        pickerLeftWindow = false;
        return;
      }
      if (nativeModes.test(label)) return;
      if (closeFrame) win.cancelAnimationFrame(closeFrame);
      closeFrame = win.requestAnimationFrame(() => {
        closeFrame = 0;
        if (toolbar?.contains(doc.activeElement))
          toggle.focus({ preventScroll: true });
        setOpen(false);
      });
    },
    { capture: true, signal: events.signal },
  );
  win.addEventListener("blur", () => {
    if (waitingForPicker) pickerLeftWindow = true;
  }, { signal: events.signal });
  win.addEventListener("focus", () => {
    if (waitingForPicker && pickerLeftWindow) setOpen(false);
  }, { signal: events.signal });
  for (const type of ["change", "cancel"])
    doc.addEventListener(type, (event) => {
      if (waitingForPicker && event.target instanceof HTMLInputElement && event.target.type === "file")
        setOpen(false);
    }, { capture: true, signal: events.signal });
  voiceClose.addEventListener("click", (event) => {
    event.stopPropagation();
    nativeVoiceExit(voiceClose.parentElement)?.click();
  }, { signal: events.signal });
  for (const type of ["keydown", "keyup"] as const) {
    voiceClose.addEventListener(type, (event) => {
      // The recorder also uses Space to start recording.
      if (event.key === " " || event.key === "Enter") event.stopPropagation();
    }, { signal: events.signal });
  }
  doc.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.isComposing || event.defaultPrevented) return;
    const exit = nativeVoiceExit(area.querySelector(voicePane));
    if (!exit) return;
    event.preventDefault();
    event.stopPropagation();
    exit.click();
  }, { capture: true, signal: events.signal });
  doc.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target;
      if (
        open() &&
        target instanceof Element &&
        !toggle.contains(target) &&
        !toolbar?.contains(target) &&
        !target.closest(nativePopup)
      )
        setOpen(false);
      resize(event);
    },
    { capture: true, passive: true, signal: events.signal },
  );
  doc.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape" || event.defaultPrevented || !open()) return;
      const target = event.target;
      if (!(target instanceof Element) || target.closest(nativePopup)) return;
      if (draft?.contains(target)) {
        setOpen(false);
        return;
      }
      if (toggle.contains(target) || toolbar?.contains(target)) {
        setOpen(false);
        toggle.focus({ preventScroll: true });
      }
    },
    { signal: events.signal },
  );

  reconcile();
  return {
    reconcile,
    dispose() {
      events.abort();
      observer.disconnect();
      voiceClose.remove();
      reset();
    },
  };
}

export function chatComposer(win: Window) {
  let area: HTMLElement | undefined;
  let attachedPane: Element | undefined;
  let binding: ReturnType<typeof bindComposer> | undefined;
  return {
    attach(pane: Element | undefined) {
      const next = pane &&
        Array.from(pane.querySelectorAll<HTMLElement>(".chat-input-area"))
          .find((candidate) => candidate.getClientRects().length > 0);
      if (area === next && attachedPane === pane) {
        binding?.reconcile();
        return;
      }
      binding?.dispose();
      area = next;
      attachedPane = pane;
      binding = next && pane ? bindComposer(next, pane, win) : undefined;
    },
    dispose() {
      binding?.dispose();
      binding = undefined;
      area = undefined;
      attachedPane = undefined;
    },
  };
}
