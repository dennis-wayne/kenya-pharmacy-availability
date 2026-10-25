import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import "./toast.css";
type Notice = {
  title: string;
  description?: string;
  tone?: "success" | "error" | "info";
  key?: string;
};
type Entry = Notice & { id: number; origin: HTMLElement | null };
const Context = createContext<((notice: Notice) => void) | null>(null);
export function useToast() {
  const notify = useContext(Context);
  if (!notify) throw new Error("ToastProvider is required");
  return notify;
}
function ToastItem({
  entry,
  dismiss,
}: {
  entry: Entry;
  dismiss: (id: number) => void;
}) {
  const element = useRef<HTMLElement>(null);
  const remaining = useRef(entry.tone === "error" ? 0 : 5000);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const began = useRef(0);
  const pause = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      remaining.current = Math.max(
        0,
        remaining.current - (Date.now() - began.current),
      );
    }
  };
  const resume = () => {
    if (entry.tone !== "error" && !timer.current) {
      began.current = Date.now();
      timer.current = setTimeout(() => dismiss(entry.id), remaining.current);
    }
  };
  useEffect(() => {
    resume();
    return pause;
  }, []);
  const close = () => {
    const focused = element.current?.contains(document.activeElement);
    dismiss(entry.id);
    if (focused && entry.origin?.isConnected)
      entry.origin.focus({ preventScroll: true });
  };
  return (
    <article
      ref={element}
      className="toast"
      data-tone={entry.tone || "success"}
      role={entry.tone === "error" ? "alert" : "status"}
      aria-atomic="true"
      onPointerEnter={pause}
      onPointerLeave={() => {
        if (!element.current?.contains(document.activeElement)) resume();
      }}
      onFocusCapture={pause}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) resume();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <span className="toast-icon">
        <Icon
          name={
            entry.tone === "error"
              ? "alert"
              : entry.tone === "info"
                ? "info"
                : "check"
          }
          size={17}
        />
      </span>
      <div>
        <strong>{entry.title}</strong>
        {entry.description && <p>{entry.description}</p>}
      </div>
      <button
        type="button"
        className="toast-close"
        aria-label="Dismiss notification"
        onClick={close}
      >
        <Icon name="x" size={14} />
      </button>
    </article>
  );
}
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Entry[]>([]);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const sequence = useRef(0);
  const dismiss = useCallback(
    (id: number) => setItems((all) => all.filter((item) => item.id !== id)),
    [],
  );
  const notify = useCallback((notice: Notice) => {
    const entry = {
      ...notice,
      id: ++sequence.current,
      origin:
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
    };
    setItems((all) =>
      [
        ...all.filter((item) => !notice.key || item.key !== notice.key),
        entry,
      ].slice(-3),
    );
  }, []);
  useEffect(() => {
    if (!items.length) return;
    const sync = () =>
      setTarget(
        Array.from(
          document.querySelectorAll<HTMLDialogElement>("dialog[open]"),
        ).at(-1) ?? document.body,
      );
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    return () => observer.disconnect();
  }, [items.length]);
  const notices = useMemo(
    () =>
      items.map((entry) => (
        <ToastItem key={entry.id} entry={entry} dismiss={dismiss} />
      )),
    [items, dismiss],
  );
  return (
    <Context.Provider value={notify}>
      {children}
      {target &&
        items.length > 0 &&
        createPortal(
          <section className="toast-viewport" aria-label="Notifications">
            {notices}
          </section>,
          target,
        )}
    </Context.Provider>
  );
}
