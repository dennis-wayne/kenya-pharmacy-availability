import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type {
  OverviewStore,
  OverviewFilters,
  OverviewModel,
  OverviewChartProps,
} from "../lib/overview-types";
import { EMPTY } from "../lib/filters.js";
import { buildOverviewModel } from "../lib/overview-model.js";
import { Icon, n0, kes, fmtDate } from "../components/ui.jsx";
import OverviewHero from "../components/OverviewHero.tsx";
import StockSignalPreview from "../components/StockSignalPreview.tsx";
import WatchlistLedger from "../components/WatchlistLedger.tsx";
import SourceNetwork from "../components/SourceNetwork.tsx";
import CatalogueLandscape from "../components/CatalogueLandscape.tsx";
import StockoutGroups from "../components/StockoutGroups.tsx";
import PriceConfidence from "../components/PriceConfidence.tsx";
import { PillToggle } from "../components/EvidenceControls.tsx";
import "./overview.css";
import "./overview-surfaces.css";
import "./availability-hero.css";
import "./overview-bento.css";
import "./overview-spacing.css";
import "./overview-attention.css";
import "./overview-watchlist.css";

const OverviewVisuals = lazy(() => import("../components/OverviewVisuals.tsx"));
const typeNames: Readonly<Record<string, string>> = {
  medicine: "Medicines",
  device: "Medical devices",
  supplement: "Supplements",
  cosmetic: "Cosmetics",
  personal_care: "Personal care",
  food: "Food & nutrition",
  sexual_wellness: "Sexual wellness",
  unclassified: "Unclassified",
};
const bandNames: Readonly<Record<string, readonly [string, string]>> = {
  cluster: [
    "3+ stockout sources",
    "Reports across three or more reporting sources.",
  ],
  local: ["2 stockout sources", "Reports across two reporting sources."],
  isolated: ["1 stockout source", "One source reports out of stock."],
  none: [
    "No stockout report",
    "Includes products without a usable stock signal.",
  ],
};

function BriefSection({
  number,
  title,
  description,
  children,
  action,
  align = "left",
}: {
  number: string;
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <section
      className="brief-section"
      data-align={align}
      aria-labelledby={`brief-${number}`}
    >
      <header className="brief-section-head">
        <div className="brief-section-titles">
          <h2 id={`brief-${number}`}>{title}</h2>
          <p>{description}</p>
        </div>
        {action && <div className="brief-section-action">{action}</div>}
      </header>
      {children}
    </section>
  );
}
class ChartBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed
      ? (this.props.fallback ?? (
          <div className="brief-chart-loading">
            Visual unavailable. Read the values in this section.
          </div>
        ))
      : this.props.children;
  }
}
function Visual({ kind, data, label, className = "" }: OverviewChartProps) {
  const ringPlaceholder = (
    <div className="availability-ring-placeholder" aria-hidden="true" />
  );
  const node = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(kind === "availability-ring");
  useEffect(() => {
    if (kind === "availability-ring") return;
    if (!window.IntersectionObserver) {
      setVisible(true);
      return;
    }
    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { root: node.current?.closest(".scroll"), rootMargin: "160px" },
    );
    if (node.current) observer.observe(node.current);
    return () => observer.disconnect();
  }, [kind]);
  return (
    <div
      ref={node}
      className={`brief-visual ${className}`}
      role="img"
      aria-label={label}
    >
      {visible && (
        <ChartBoundary
          fallback={kind === "availability-ring" ? ringPlaceholder : undefined}
        >
          <Suspense
            fallback={
              kind === "availability-ring" ? (
                ringPlaceholder
              ) : (
                <div className="brief-chart-loading">Preparing visual…</div>
              )
            }
          >
            <OverviewVisuals kind={kind} data={data} />
          </Suspense>
        </ChartBoundary>
      )}
    </div>
  );
}
export default function Overview({
  store,
  onNavigate,
  setFilters,
}: {
  store: OverviewStore;
  onNavigate: (view: string) => void;
  setFilters: (filters: OverviewFilters) => void;
}) {
  const model = useMemo<OverviewModel>(
    () => store.overviewModel ?? buildOverviewModel(store),
    [store],
  );
  const { meta, D } = store;
  const h = meta.headline;
  const { stats } = model;
  const [watch, setWatch] = useState("stockouts");
  const [showAll, setShowAll] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [basis, setBasis] = useState("reporting");
  const jump = (patch: Partial<OverviewFilters>) => {
    setFilters({ ...EMPTY, ...patch });
    onNavigate("catalogue");
  };
  const watchRows =
    watch === "stockouts" ? model.reportable : model.broadClinical;
  const visibleProducts = watchRows.slice(0, showAll ? 12 : 3);
  const selectedIndex =
    selectedProduct !== null && visibleProducts.includes(selectedProduct)
      ? selectedProduct
      : null;
  const chooseProduct = (index: number) => {
    const opening = selectedIndex !== index;
    setSelectedProduct(opening ? index : null);
    if (opening && window.matchMedia("(max-width:760px)").matches)
      requestAnimationFrame(() => {
        document
          .getElementById("watchlist-evidence")
          ?.scrollIntoView({ behavior: "instant", block: "start" });
        document
          .getElementById("watchlist-product-title")
          ?.focus({ preventScroll: true });
      });
  };
  const inspectSample = (index: number) => {
    setWatch("stockouts");
    setShowAll(false);
    setSelectedProduct(index);
    requestAnimationFrame(() => {
      document
        .getElementById("brief-watchlist")
        ?.scrollIntoView({ behavior: "instant", block: "start" });
      document
        .getElementById("watchlist-product-title")
        ?.focus({ preventScroll: true });
    });
  };
  const categories = D.type
    .map((name, index) => ({ name, index, count: stats.byType[index] }))
    .sort((a, b) => b.count - a.count);
  const priorities = [
    {
      tone: "coral",
      icon: "medical-alert",
      label: "Clinical stockout reports",
      count: model.reportable.length,
      title: "Repeated stockout reports.",
      text: "Medicines and devices reported out of stock by at least two sources, with high or medium matching confidence and no review flag.",
      action: "Review these products",
      go: () => jump(model.clinicalPatch),
    },
    {
      tone: "teal",
      icon: "network",
      label: "Broad in-stock coverage",
      count: model.broadClinical.length,
      title: "Available across more sources.",
      text: `Medicines and devices with in-stock reports at five or more sources. ${n0(model.broad.length)} products overall meet this threshold.`,
      action: "See named pharmacy reports",
      go: () => {
        setWatch("coverage");
        setShowAll(false);
        document
          .getElementById("brief-watchlist")
          ?.scrollIntoView({ behavior: "instant", block: "start" });
        document
          .getElementById("brief-watch-title")
          ?.focus({ preventScroll: true });
      },
    },
    {
      tone: "amber",
      icon: "clipboard-alert",
      label: "Product matches in review",
      count: model.reviewCount,
      title: "Product matches to check.",
      text: `${n0(meta.coverage.products_awaiting_drugindex)} products also await reference linkage. A confident product match does not establish clinical equivalence.`,
      action: "Open the review queue",
      go: () => jump({ review: "needs_review" }),
    },
  ];
  return (
    <div className="page overview-brief">
      <OverviewHero
        Chart={Visual}
        meta={meta}
        model={model}
        onQuality={() => onNavigate("quality")}
        onSources={() => onNavigate("sources")}
        onStock={(state) =>
          jump(
            state === "in"
              ? { stockIn: model.reporting.map((p) => p.bit) }
              : { stockOut: model.reporting.map((p) => p.bit) },
          )
        }
        onFind={() => {
          onNavigate("catalogue");
          requestAnimationFrame(() =>
            document
              .querySelector<HTMLInputElement>("[data-search] input")
              ?.focus(),
          );
        }}
      />
      <BriefSection
        number="02"
        align="right"
        title="Where attention belongs."
        description="Start with repeated clinical stockout reports, then explore broader coverage or unresolved matches."
      >
        <div className="attention-bento">
          {priorities.map((item) => (
            <article
              className={`attention-tile ${item.tone === "coral" ? "attention-primary" : "attention-support"}`}
              data-tone={item.tone}
              key={item.label}
            >
              <header>
                <span className="eyebrow">{item.label}</span>
                <span className="brief-glyph">
                  <Icon name={item.icon} size={24} />
                </span>
              </header>
              <div className="attention-heading">
                <b className="attention-value num">{n0(item.count)}</b>
                <h3>{item.title}</h3>
              </div>
              <p>{item.text}</p>
              {item.tone === "coral" && (
                <StockSignalPreview
                  store={store}
                  rows={model.reportable}
                  onChoose={inspectSample}
                />
              )}
              {item.tone === "coral" && (
                <p className="attention-context">
                  <span>
                    <b className="num">{n0(model.clinicalMulti)}</b> candidates
                  </span>
                  <span>
                    <b className="num">
                      {n0(model.clinicalMulti - model.reportable.length)}
                    </b>{" "}
                    held for matching review
                  </span>
                </p>
              )}
              <footer>
                <button className="brief-link" onClick={item.go}>
                  {item.action}
                  <Icon name="right" size={17} />
                </button>
              </footer>
            </article>
          ))}
        </div>
        <div className="brief-watchlist" id="brief-watchlist">
          <header className="brief-watch-head">
            <div>
              <span className="eyebrow">Product watchlist</span>
              <h3 id="brief-watch-title" tabIndex={-1}>
                {watch === "stockouts"
                  ? "Reported out at multiple pharmacies"
                  : "In stock at five or more pharmacies"}
              </h3>
            </div>
            <PillToggle
              label="Watchlist evidence"
              value={watch}
              options={[
                {
                  value: "stockouts",
                  label: "Stockouts",
                  count: n0(model.reportable.length),
                },
                {
                  value: "coverage",
                  label: "Broad coverage",
                  count: n0(model.broadClinical.length),
                },
              ]}
              onChange={(value) => {
                setWatch(value);
                setShowAll(false);
                setSelectedProduct(null);
              }}
            />
          </header>
          <p className="brief-caption">
            {watch === "stockouts"
              ? "Ordered by stockout source count. These are investigation leads, not a confirmed shortage diagnosis."
              : "Judged in-stock reports only. Confirm the exact product, strength and form before considering an alternative."}{" "}
            Select a product to read its named pharmacy reports.
          </p>
          {watchRows.length ? (
            <WatchlistLedger
              store={store}
              rows={visibleProducts}
              selected={selectedIndex}
              onChoose={chooseProduct}
              onOpen={(index) => jump({ q: store.P.name[index] })}
            />
          ) : (
            <div className="brief-empty">
              No medicines or devices meet this threshold in the snapshot.
            </div>
          )}
          <div className="brief-watch-foot">
            <span>
              Showing {n0(Math.min(watchRows.length, showAll ? 12 : 3))} of{" "}
              {n0(watchRows.length)} qualifying products
            </span>
            {watchRows.length > 3 && (
              <button
                className="brief-link"
                aria-expanded={showAll}
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? "Show fewer products" : "Show more products"}
                <Icon name={showAll ? "up" : "down"} size={14} />
              </button>
            )}
            {watch === "stockouts" && (
              <button
                className="brief-link"
                onClick={() => jump(model.clinicalPatch)}
              >
                All qualifying products <Icon name="right" size={17} />
              </button>
            )}
          </div>
        </div>
      </BriefSection>

      <BriefSection
        number="03"
        align="right"
        title="Different pharmacies. Different signals."
        description="Compare reported stock mixes and counts. Browse a pharmacy to inspect its captured products."
        action={
          <button className="btn" onClick={() => onNavigate("sources")}>
            Explore all sources <Icon name="right" size={17} />
          </button>
        }
      >
        <SourceNetwork
          model={model}
          meta={meta}
          absent={store.absent}
          onBrowse={(bit) => jump({ shopsAny: [bit] })}
        />
      </BriefSection>

      <BriefSection
        number="04"
        align="left"
        title="Understand the catalogue you’re reading."
        description="Classification tells you what is included. Coverage tells you how many independent sources list a product."
      >
        <CatalogueLandscape
          Chart={Visual}
          model={model}
          meta={meta}
          categories={categories}
          names={typeNames}
          onCategory={(index) => jump({ types: [index] })}
          onCoverage={(group) =>
            jump({ listedMin: group.min, listedMax: group.max })
          }
          onQuality={() => onNavigate("quality")}
        />
        <StockoutGroups
          bands={D.band}
          counts={stats.byBand}
          names={bandNames}
          onBrowse={(index) => jump({ bands: [index] })}
        />
      </BriefSection>

      <BriefSection
        number="05"
        align="right"
        title="Put price and confidence in context."
        description="A single snapshot can show a distribution. It cannot establish a price trend or the full clinical picture."
      >
        <PriceConfidence
          Chart={Visual}
          model={model}
          meta={meta}
          bands={D.matchBand}
          basis={basis}
          onBasis={setBasis}
          onConfidence={(index) => jump({ matchBands: [index] })}
          onQuality={() => onNavigate("quality")}
        />
      </BriefSection>
      <details className="brief-provenance">
        <summary>
          Snapshot provenance <Icon name="info" size={14} />
        </summary>
        <dl>
          {[
            ["Snapshot", meta.run.snapshot_id],
            [
              "Collection date",
              `${fmtDate(h.snapshot_at)}${meta.run.snapshot_at_inferred ? " · inferred from file timestamps" : ""}`,
            ],
            ["Match algorithm", meta.run.match_algo_version],
            ["Classifier", meta.run.classifier_version],
            ["Snapshot reported median price", kes(h.median_price_kes)],
            ["Reference fingerprint", meta.run.drugindex_fingerprint],
            ["Data contract", meta.contract_version],
          ].map(([name, value]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{value ?? "Not supplied"}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
