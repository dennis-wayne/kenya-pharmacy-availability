import {
  lazy,
  Suspense,
  useMemo,
  useRef,
  useState,
  Component,
  type ReactNode,
} from "react";
import type { OverviewStore } from "../lib/overview-types";
import {
  pharmacyEvidence,
  productPattern,
  stockPatternPoints,
  type StockPattern,
  type EvidenceState,
} from "../lib/stock-patterns";
import { Icon } from "./icons";
import { n0, kes } from "./ui.jsx";
import PharmacyGlyph from "./PharmacyGlyph";
import "./catalogue-comparison.css";
const EvidenceMap = lazy(() => import("./CatalogueEvidenceMap"));
const patterns: { id: StockPattern; label: string; description: string }[] = [
  {
    id: "in",
    label: "In-stock reports only",
    description: "At least one in-stock report; no out-of-stock report.",
  },
  {
    id: "mixed",
    label: "Mixed stock reports",
    description: "Both in-stock and out-of-stock evidence.",
  },
  {
    id: "out",
    label: "Out-of-stock reports only",
    description: "At least one out-of-stock report; no in-stock report.",
  },
  {
    id: "unknown",
    label: "Stock unknown",
    description: "Listed, with no usable stock report.",
  },
];
const states: {
  id: EvidenceState;
  label: string;
  note: string;
  icon: string;
}[] = [
  {
    id: "in",
    label: "In stock",
    note: "Sources explicitly reporting available stock.",
    icon: "package-check",
  },
  {
    id: "out",
    label: "Out of stock",
    note: "Sources explicitly reporting unavailable stock.",
    icon: "package-minus",
  },
  {
    id: "conflict",
    label: "Conflicting reports",
    note: "The same source has listings with both stock states. Inspect its individual listings.",
    icon: "alert",
  },
  {
    id: "unknown",
    label: "Stock not reported",
    note: "A listing exists, but it supplies no usable stock state.",
    icon: "signal-slash",
  },
  {
    id: "unlisted",
    label: "Not listed",
    note: "No captured listing at these sources; this does not establish unavailability.",
    icon: "search",
  },
];
class MapBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="stock-map-fallback">
        Visual unavailable. Use the stock pattern controls and named reports
        below.
      </p>
    ) : (
      this.props.children
    );
  }
}
export default function CatalogueMatrix({
  store,
  rows,
  onPick,
}: {
  store: OverviewStore;
  rows: number[];
  onPick: (index: number) => void;
}) {
  const sample = useMemo(() => rows.slice(0, 40), [rows]);
  const products = useMemo(
    () => sample.map((index) => productPattern(store, index)),
    [sample, store],
  );
  const points = useMemo(
    () => stockPatternPoints(store, sample),
    [sample, store],
  );
  const [saved, setSaved] = useState<{
    rows: number[];
    kind: StockPattern | "all";
    point: string | null;
    selected: number | null;
  }>({ rows, kind: "all", point: null, selected: null });
  const current =
    saved.rows === rows
      ? saved
      : { rows, kind: "all" as const, point: null, selected: null };
  const candidates = products.filter(
    (row) =>
      (current.kind === "all" || row.kind === current.kind) &&
      (!current.point || `${row.inStock}:${row.out}` === current.point),
  );
  const selected = candidates.some((row) => row.index === current.selected)
    ? current.selected
    : (candidates[0]?.index ?? null);
  const chosen = selected == null ? null : productPattern(store, selected),
    evidence = selected == null ? null : pharmacyEvidence(store, selected);
  const options = useRef<Map<number, HTMLButtonElement>>(new Map());
  const update = (patch: Partial<typeof saved>) =>
    setSaved({ ...current, ...patch, rows });
  return (
    <section
      className="stock-comparison"
      aria-label="Visual pharmacy comparison"
    >
      <header className="stock-comparison-heading">
        <div>
          <h2>See the pattern. Read the reports.</h2>
          <p>
            Compare the first <b className="num">{sample.length}</b> of{" "}
            <b className="num">{n0(rows.length)}</b> filtered products. Choose a
            pattern or a product to see the named evidence behind it.
          </p>
        </div>
        <button
          onClick={() => update({ kind: "all", point: null, selected: null })}
          disabled={current.kind === "all" && !current.point}
        >
          Show all patterns
          <Icon name="grid" size={15} />
        </button>
      </header>
      <div
        className="stock-pattern-nav"
        role="group"
        aria-label="Stock report pattern"
      >
        {patterns.map((pattern) => {
          const count = products.filter(
            (row) => row.kind === pattern.id,
          ).length;
          return (
            <button
              key={pattern.id}
              data-pattern={pattern.id}
              aria-pressed={current.kind === pattern.id}
              disabled={!count}
              onClick={() =>
                update({
                  kind: current.kind === pattern.id ? "all" : pattern.id,
                  point: null,
                  selected: null,
                })
              }
              title={pattern.description}
            >
              <span>{pattern.label}</span>
              <strong className="num">{count}</strong>
              <span className="stock-pattern-meter" aria-hidden="true">
                <i
                  style={{
                    width: `${(100 * count) / Math.max(1, sample.length)}%`,
                  }}
                />
              </span>
            </button>
          );
        })}
      </div>
      <div className="stock-comparison-overview">
        <article className="stock-map-panel">
          <header>
            <h3>Stock pattern map</h3>
            <span>↑ Out-of-stock sources</span>
          </header>
          <div
            className="stock-pattern-chart"
            role="group"
            aria-label={`Stock report patterns for ${sample.length} ${sample.length === 1 ? "product" : "products"}. ${points.map((point) => `${point.count} ${point.count === 1 ? "product has" : "products have"} ${point.inStock} in-stock and ${point.out} out-of-stock source reports`).join("; ")}`}
          >
            <MapBoundary>
              <Suspense
                fallback={
                  <p className="stock-map-fallback">
                    Preparing stock patterns…
                  </p>
                }
              >
                <EvidenceMap
                  data={points}
                  selected={current.point}
                  onSelect={(inStock, out) =>
                    update({
                      kind: "all",
                      point: `${inStock}:${out}`,
                      selected: null,
                    })
                  }
                />
              </Suspense>
            </MapBoundary>
          </div>
          <p className="stock-map-axis">Sources reporting in stock →</p>
          <p className="stock-map-note">
            Each circle groups products with the same report counts. Its number
            and size show how many products share that pattern.
          </p>
        </article>
        <div className="stock-product-picker">
          <header>
            <h3>Choose a product</h3>
            <span className="num">{candidates.length} shown</span>
          </header>
          {current.point && (
            <button
              className="stock-pattern-reset"
              onClick={() => update({ point: null })}
            >
              {current.point.split(":")[0]} in-stock ·{" "}
              {current.point.split(":")[1]} out-of-stock sources
              <Icon name="x" size={13} />
            </button>
          )}
          <div
            className="stock-product-options"
            role="listbox"
            aria-label="Products to compare"
          >
            {candidates.map((product, position) => (
              <button
                key={product.index}
                ref={(element) => {
                  if (element) options.current.set(product.index, element);
                  else options.current.delete(product.index);
                }}
                role="option"
                aria-selected={selected === product.index}
                tabIndex={selected === product.index ? 0 : -1}
                onClick={() => update({ selected: product.index })}
                onKeyDown={(event) => {
                  const next =
                    event.key === "ArrowDown"
                      ? Math.min(candidates.length - 1, position + 1)
                      : event.key === "ArrowUp"
                        ? Math.max(0, position - 1)
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? candidates.length - 1
                            : null;
                  if (next != null) {
                    event.preventDefault();
                    const index = candidates[next].index;
                    update({ selected: index });
                    options.current.get(index)?.focus();
                  }
                }}
              >
                <span>{store.P.name[product.index]}</span>
                <small>
                  <b data-state="in">{product.inStock} in stock</b>
                  <b data-state="out">{product.out} out</b>
                </small>
              </button>
            ))}
          </div>
          <p>
            Counts refer to captured pharmacy reports, not quantities on the
            shelf.
          </p>
        </div>
      </div>
      {selected != null && chosen && evidence && (
        <article
          className="stock-product-evidence"
          aria-label="Selected product pharmacy evidence"
          aria-live="polite"
        >
          <header>
            <div>
              <span>Selected product</span>
              <h3>{store.P.name[selected]}</h3>
              <p>
                {store.P.ingredient[selected] >= 0
                  ? store.D.ingredient[store.P.ingredient[selected]]
                  : "Active ingredient not linked"}
              </p>
            </div>
            <button onClick={() => onPick(selected)}>
              Inspect product
              <Icon name="right" size={16} />
            </button>
          </header>
          <div className="stock-evidence-summary">
            <span>
              <b className="num">{chosen.inStock}</b> in-stock sources
            </span>
            <span>
              <b className="num">{chosen.out}</b> out-of-stock sources
            </span>
            <span>
              Listed median{" "}
              <b className="num">{kes(store.P.priceMed[selected])}</b>
            </span>
          </div>
          <div className="stock-evidence-flow">
            {states
              .filter(
                (state) =>
                  state.id !== "conflict" || evidence.conflict.length > 0,
              )
              .map((state) => (
                <section
                  key={state.id}
                  data-state={state.id}
                  className="stock-evidence-lane"
                >
                  <header>
                    <Icon name={state.icon} size={19} />
                    <h4>{state.label}</h4>
                    <b className="num">{evidence[state.id].length}</b>
                    <p>{state.note}</p>
                  </header>
                  <div className="stock-evidence-sources">
                    {evidence[state.id].length ? (
                      evidence[state.id].map((shop) => (
                        <span key={shop.bit} className="stock-source-node">
                          <PharmacyGlyph id={shop.pharmacy_id} size={30} />
                          <span>{shop.name}</span>
                        </span>
                      ))
                    ) : (
                      <p className="stock-evidence-empty">
                        No sources in this state.
                      </p>
                    )}
                  </div>
                </section>
              ))}
          </div>
          <footer>
            <Icon name="clock" size={16} />
            <p>
              Captured snapshot. Confirm current stock and price with the
              pharmacy. Source groups cover all {store.shops.length} captured
              pharmacies.
            </p>
          </footer>
        </article>
      )}
    </section>
  );
}
