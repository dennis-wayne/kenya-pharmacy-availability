import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { useSmallScreen } from "./useSmallScreen";
export const destinations = [
  {
    id: "overview",
    label: "Overview",
    icon: "workspace-overview",
    context: "The captured picture",
  },
  {
    id: "catalogue",
    label: "Catalogue",
    icon: "catalogue-compare",
    context: "Find & compare",
  },
  {
    id: "sources",
    label: "Sources",
    icon: "pharmacy",
    context: "Pharmacy coverage",
  },
  {
    id: "quality",
    label: "Data quality",
    icon: "quality-document",
    context: "Evidence & limitations",
  },
] as const;
type Snapshot = {
  id: string;
  date: string;
  inferred: boolean;
  contract: string;
  match: string;
  loading?: boolean;
};
const compactCount = (value: number | null) =>
  value == null
    ? "—"
    : value >= 10000
      ? `${(value / 1000).toFixed(1)}k`
      : new Intl.NumberFormat("en-KE").format(value);

export function ConsoleSidebar({
  view,
  onNavigate,
  productCount,
  sourceCount,
  snapshot,
  catalogueControlsOpen = false,
  onToggleCatalogueControls,
}: {
  view: string;
  onNavigate: (view: string) => void;
  productCount: number | null;
  sourceCount: number | null;
  snapshot: Snapshot;
  catalogueControlsOpen?: boolean;
  onToggleCatalogueControls?: () => void;
}) {
  const mobile = useSmallScreen();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mobile || !open) return;
    const frame = requestAnimationFrame(() =>
      menu.current
        ?.querySelector<HTMLButtonElement>('[aria-current="page"]')
        ?.focus(),
    );
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [mobile, open]);
  const navigate = (destination: string) => {
    onNavigate(destination);
    setOpen(false);
    if (mobile) trigger.current?.focus();
  };
  return (
    <nav
      ref={root}
      className="rail console-sidebar"
      aria-label="Main navigation"
      data-open={open}
      onBlurCapture={(event) => {
        if (
          mobile &&
          open &&
          event.relatedTarget instanceof Node &&
          !root.current?.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
    >
      <button
        className="console-brand"
        onClick={() => navigate("overview")}
        aria-label="Praesto, overview"
      >
        <img
          className="console-brand-lockup"
          src="/brand/praesto/praesto-b-horizontal-dark.svg"
          alt="Praesto"
          width={400}
          height={128}
        />
        <img
          className="console-brand-monogram"
          src="/brand/praesto/praesto-b-monogram-dark.svg"
          alt=""
          width={120}
          height={120}
        />
      </button>
      <div className="console-nav-heading">
        <span>Workspace</span>
        <span className="console-country">KE</span>
      </div>
      <div
        className="console-navigation"
        id="workspace-destinations"
        ref={menu}
        hidden={mobile && !open}
        onKeyDown={(event) => {
          if (
            !mobile ||
            !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
          )
            return;
          const buttons = [
            ...(menu.current?.querySelectorAll<HTMLButtonElement>("button") ||
              []),
          ];
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? buttons.length - 1
                : (index +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    buttons.length) %
                  buttons.length;
          event.preventDefault();
          buttons[next]?.focus();
        }}
      >
        {destinations.map((item) => (
          <button
            key={item.id}
            className="rail-item"
            aria-label={item.label}
            aria-current={view === item.id ? "page" : undefined}
            onClick={() => navigate(item.id)}
          >
            <span className="console-nav-symbol">
              <Icon name={item.icon} size={21} className="console-nav-icon" />
            </span>
            <span>{item.label}</span>
            {item.id === "catalogue" && (
              <span className="tail">{compactCount(productCount)}</span>
            )}
            {item.id === "sources" && (
              <span className="tail">{sourceCount ?? "—"}</span>
            )}
          </button>
        ))}
      </div>
      <button
        ref={trigger}
        className="mobile-nav-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="workspace-destinations"
        aria-label={open ? "Close workspace menu" : "Open workspace menu"}
        onClick={() => setOpen(!open)}
      >
        <Icon name={open ? "x" : "workspace-switch"} size={22} />
      </button>
      {view === "catalogue" && onToggleCatalogueControls && (
        <button
          className="console-catalogue-controls"
          aria-label="Toggle catalogue controls"
          aria-expanded={catalogueControlsOpen}
          aria-controls="catalogue-controls"
          onClick={onToggleCatalogueControls}
        >
          <Icon name="filter" size={17} />
          <span>Catalogue controls</span>
          <Icon name={catalogueControlsOpen ? "left" : "right"} size={14} />
        </button>
      )}
      <div className="console-sidebar-foot">
        <div className="console-snapshot-well">
          <div className="console-snapshot-line">
            <span className="eyebrow">Snapshot</span>
            <span className="mono">{snapshot.id}</span>
          </div>
          <p>Captured listings. Confirm current stock with the pharmacy.</p>
          <details>
            <summary>
              Snapshot details <Icon name="down" size={12} className="" />
            </summary>
            <dl>
              <dt>Collection date</dt>
              <dd>
                {snapshot.date}
                {snapshot.inferred && " · inferred"}
              </dd>
              <dt>Contract</dt>
              <dd>{snapshot.contract}</dd>
              <dt>Matching</dt>
              <dd>{snapshot.match}</dd>
            </dl>
          </details>
        </div>
        <button
          className="console-method-link"
          aria-label="How to read the evidence"
          onClick={() => onNavigate("quality")}
        >
          <Icon name="book" size={18} /> Reading guide{" "}
          <Icon name="right" size={13} className="" />
        </button>
      </div>
    </nav>
  );
}

export function ConsoleTopbar({
  view,
  query,
  onSearch,
  onHome,
  onExport,
  onCopyLink,
  exporting = false,
  exportReady = true,
  snapshot,
}: {
  view: string;
  query: string;
  onSearch: (query: string) => void;
  onHome: () => void;
  onExport: () => void;
  onCopyLink?: () => void;
  exporting?: boolean;
  exportReady?: boolean;
  snapshot: Snapshot;
}) {
  const active = destinations.find((item) => item.id === view);
  return (
    <header className="topbar console-topbar">
      <button
        className="console-mobile-brand"
        onClick={onHome}
        aria-label="Praesto, overview"
      >
        <img
          src="/brand/praesto/praesto-b-monogram-light.svg"
          width={32}
          height={32}
          alt="Praesto"
        />
      </button>
      <div className="console-context">
        <span>Workspace</span>
        <b>{active?.label || "Design system"}</b>
      </div>
      <div className="field global-search" data-search>
        <Icon name="search" size={18} className="" />
        <input
          value={query}
          onChange={(event) => onSearch(event.target.value)}
          aria-label="Search products and ingredients"
          placeholder="Search products or ingredients"
        />
        {query ? (
          <button
            className="search-clear"
            aria-label="Clear search"
            onClick={() => onSearch("")}
          >
            <Icon name="x" size={14} className="" />
          </button>
        ) : (
          <kbd>/</kbd>
        )}
      </div>
      <div className="header-actions">
        <span
          className="snapshot-label"
          title={
            snapshot.inferred
              ? "Date inferred from source file timestamps; collection date unverified"
              : "Source collection date"
          }
        >
          <span>{snapshot.date}</span>
          <small>
            {snapshot.loading
              ? "Preparing data files"
              : snapshot.inferred
                ? "Date inferred"
                : "Source collection date"}
          </small>
        </span>
        {onCopyLink && (
          <button
            className="console-copy-link"
            onClick={onCopyLink}
            aria-label="Copy link to this view"
            title="Copy link to this view"
          >
            <Icon name="link" size={17} />
          </button>
        )}
        <button
          className="btn console-export"
          onClick={onExport}
          disabled={!exportReady}
          aria-busy={exporting}
        >
          <Icon name="download" size={15} className="" />
          <span>{exporting ? "Preparing…" : "Export"}</span>
        </button>
      </div>
    </header>
  );
}
