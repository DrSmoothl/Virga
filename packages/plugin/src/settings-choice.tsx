import { h } from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";

type ChoiceProps<T extends string> = {
  label: string;
  value: T;
  options: Partial<Record<T, string>>;
  onChange: (value: T) => void;
};

function HostChoice<T extends string>({ label, value, options, onChange }: ChoiceProps<T>) {
  const select = useRef<HTMLElement>(null);
  const latest = useRef({ options, onChange });
  latest.current = { options, onChange };
  useEffect(() => {
    const el = select.current!;
    const trigger = el.shadowRoot?.querySelector<HTMLElement>(".menu-button");
    const menu = el.shadowRoot?.querySelector<HTMLElement>("ul");
    const hostKeyboard = trigger?.getAttribute("role") === "combobox";
    const close = () => {
      if (menu && !menu.classList.contains("hidden")) trigger?.click();
    };
    if (trigger) {
      trigger.setAttribute("aria-label", label);
      if (!hostKeyboard) {
        trigger.tabIndex = 0;
        trigger.setAttribute("role", "combobox");
        trigger.setAttribute("aria-haspopup", "listbox");
        trigger.setAttribute("aria-expanded", "false");
        menu?.setAttribute("role", "listbox");
        const input = trigger.querySelector("input");
        if (input) input.tabIndex = -1;
      }
    }
    const events = new AbortController(), { signal } = events;
    // Settings are inside a shadow root. At window level the select's pointer
    // event is retargeted to that host, where the widget treats it as outside.
    el.addEventListener("pointerup", (e) => e.stopPropagation(), { signal });
    el.addEventListener("selected", (event) => {
      const next = (event as CustomEvent<{value: T}>).detail.value;
      if (Object.hasOwn(latest.current.options, next)) latest.current.onChange(next);
      close();
      trigger?.focus({ preventScroll: true });
    }, { signal });
    if (!hostKeyboard && trigger && menu) {
      const reflect = () => trigger.setAttribute("aria-expanded", String(!menu.classList.contains("hidden")));
      const observer = new MutationObserver(reflect);
      observer.observe(menu, { attributes: true, attributeFilter: ["class"] });
      el.addEventListener("keydown", (e) => {
        const rows = [...el.querySelectorAll<HTMLElement>("setting-option")];
        const index = rows.indexOf(e.target as HTMLElement);
        if (e.key === "Escape" && !menu.classList.contains("hidden")) {
          e.preventDefault();
          close();
          trigger.focus();
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (menu.classList.contains("hidden")) trigger.click();
          const next = index < 0 ? rows.findIndex((r) => r.hasAttribute("is-selected"))
            : (index + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length;
          rows[next]?.focus();
        } else if ((e.key === "Enter" || e.key === " ") && index < 0) {
          e.preventDefault();
          trigger.click();
        } else if ((e.key === "Enter" || e.key === " ") && index >= 0) {
          e.preventDefault();
          rows[index]?.click();
          close();
          trigger.focus();
        }
      }, { signal });
      signal.addEventListener("abort", () => observer.disconnect(), { once: true });
    }
    return () => { close(); events.abort(); };
  }, [label]);
  useEffect(() => {
    // The parent widget reads the options after their selected attributes change.
    select.current?.setAttribute("data-value", value);
  }, [value]);
  return h("setting-select", { ref: select, class: "host-choice", "aria-label": label },
    Object.entries(options).map(([key, name]) =>
      h("setting-option", {
        key, "data-value": key, "is-selected": key === value ? "" : undefined,
        role: "option", tabIndex: 0, "aria-selected": key === value,
      }, name as string),
    ),
  );
}

function ListChoice<T extends string>({ label, value, options, onChange }: ChoiceProps<T>) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const items = Object.entries(options) as [T, string][];
  const selected = items.findIndex(([key]) => key === value);
  const [active, setActive] = useState(-1);
  const open = active >= 0;
  const close = () => setActive(-1);
  function choose(key: T) {
    close();
    onChange(key);
  }
  useEffect(() => {
    if (!open || !menu.current || !trigger.current) return;
    const list = menu.current, anchor = trigger.current;
    const events = new AbortController(), { signal } = events;
    if (typeof list.showPopover === "function") {
      list.showPopover();
      const place = () => {
        const rect = anchor.getBoundingClientRect();
        const width = Math.min(innerWidth - 16, Math.max(142, rect.width));
        const below = innerHeight - rect.bottom - 12;
        const above = rect.top - 12;
        const upward = below < list.scrollHeight && above > below;
        list.style.width = width + "px";
        list.style.left = Math.max(8, Math.min(rect.right - width, innerWidth - 8 - width)) + "px";
        list.style.maxHeight = (upward ? above : below) + "px";
        list.style.top = (upward ? rect.top - list.offsetHeight - 4 : rect.bottom + 4) + "px";
      };
      place();
      window.addEventListener("scroll", place, { capture: true, signal });
      window.addEventListener("resize", place, { signal });
    }
    window.addEventListener("pointerdown", (e) => {
      const path = e.composedPath();
      if (!path.includes(list) && !path.includes(anchor)) close();
    }, { capture: true, signal });
    return () => {
      events.abort();
      if (typeof list.hidePopover === "function") list.hidePopover();
    };
  }, [open]);
  return (
    <div class="choice-control">
      <button ref={trigger} type="button" class="choice-trigger" role="combobox"
        aria-label={label} aria-controls={id} aria-haspopup="listbox"
        aria-expanded={open} aria-activedescendant={open ? id + "-" + active : undefined}
        onClick={() => setActive(open ? -1 : selected)}
        onBlur={close}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActive(open ? (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length : selected);
          } else if (open && (e.key === "Home" || e.key === "End")) {
            e.preventDefault();
            setActive(e.key === "Home" ? 0 : items.length - 1);
          } else if (open && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            choose(items[active]![0]);
          } else if (open && e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            close();
          }
        }}
      >{options[value]}</button>
      <div ref={menu} id={id} class="choice-list" hidden={!open} popover="manual" role="listbox" aria-label={label}>
        {items.map(([key, name], index) => (
          <button type="button" key={key} tabIndex={-1} id={id + "-" + index} role="option"
            data-active={active === index ? "" : undefined}
            aria-selected={key === value}
            onMouseDown={(e) => e.preventDefault()} onClick={() => choose(key)}
          >{name}</button>
        ))}
      </div>
    </div>
  );
}

export function Choices<T extends string>(props: ChoiceProps<T>) {
  const host = customElements.get("setting-select") && customElements.get("setting-option");
  return (
    <div class="row choice-row">
      <span>{props.label}</span>
      {host ? <HostChoice {...props} /> : <ListChoice {...props} />}
    </div>
  );
}
