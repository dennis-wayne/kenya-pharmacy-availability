import { Icon, n0, n1, kes, fmtDate } from "./ui.jsx";
import type {
  OverviewChart,
  OverviewMeta,
  OverviewModel,
} from "../lib/overview-types";

export default function OverviewHero({
  Chart,
  meta,
  model,
  onFind,
  onQuality,
  onStock,
  onSources,
}: {
  Chart: OverviewChart;
  meta: OverviewMeta;
  model: OverviewModel;
  onFind: () => void;
  onQuality: () => void;
  onStock: (state: "in" | "out") => void;
  onSources: () => void;
}) {
  const h = meta.headline;
  const headline = model.scenarios[0];
  const ring = [
    {
      label: "In stock",
      count: headline.inStock,
      fill: "var(--in-on-inverse)",
    },
    {
      label: "Out of stock",
      count: headline.total - headline.inStock,
      fill: "var(--out-on-inverse)",
    },
  ];
  const states = [
    {
      name: "In stock",
      value: h.in_stock,
      tone: "in",
      icon: "package-check",
      description: "Listings explicitly reported as available.",
      action: "Browse in-stock products",
      go: () => onStock("in"),
    },
    {
      name: "Out of stock",
      value: h.out_of_stock,
      tone: "out",
      icon: "package-minus",
      description: "Listings explicitly reported as unavailable.",
      action: "Browse stockout reports",
      go: () => onStock("out"),
    },
    {
      name: "Stock unknown",
      value: h.not_published,
      tone: "unknown",
      icon: "signal-slash",
      description: "Listings without a usable stock signal.",
      action: "Inspect reporting coverage",
      go: onSources,
    },
  ];
  return (
    <section
      className="availability-hero"
      aria-labelledby="availability-hero-title"
    >
      <div className="availability-summary">
        <div className="availability-summary-main">
          <div className="availability-summary-label">
            <h2 id="availability-hero-title">Product stock, as reported.</h2>
          </div>
          <div className="availability-rate">
            <div className="availability-rate-ring">
              <Chart
                kind="availability-ring"
                data={ring}
                label={`Rated listing stock mix: ${n0(headline.inStock)} in stock; ${n0(headline.total - headline.inStock)} out of stock. Unrated listings are excluded.`}
                className="availability-ring"
              />
              <b className="availability-ring-value num">
                {n1(headline.rate)}
                <span>%</span>
              </b>
            </div>
            <div className="availability-rate-copy">
              <span>
                of rated product listings
                <br />
                report in stock
              </span>
              <div className="availability-ring-legend" aria-hidden="true">
                <span>
                  <i data-state="in" />
                  In stock
                </span>
                <span>
                  <i data-state="out" />
                  Out of stock
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="availability-summary-context">
          <p>
            <b className="num">{n0(headline.inStock)}</b> of{" "}
            <b className="num">{n0(headline.total)}</b> listings with stock
            reports.
          </p>
          <p>
            Medicines, devices and other pharmacy retail products. Unrated
            listings are excluded.
          </p>
          <button onClick={onQuality}>
            How the rate is calculated <Icon name="right" size={17} />
          </button>
        </div>
        <div className="availability-summary-action">
          <button onClick={onFind}>
            <Icon name="search" size={20} />
            Find a product
            <Icon name="right" size={17} />
          </button>
          <span>
            <Icon name="pharmacy" size={17} />
            {model.reporting.length} sources report stock
          </span>
        </div>
      </div>
      <div className="availability-evidence-head">
        <span>
          Across all <b className="num">{n0(h.listings)}</b> captured pharmacy
          listings
        </span>
        <span>
          {h.pharmacies} captured sources · {n0(h.not_published)} unknown-stock
          listings
        </span>
      </div>
      <div className="availability-states">
        {states.map((state) => (
          <article key={state.name} data-state={state.tone}>
            <header>
              <span className="availability-state-icon">
                <Icon name={state.icon} size={25} />
              </span>
              <h3>{state.name}</h3>
              <span className="availability-share num">
                {state.value > 0 && (100 * state.value) / h.listings < 0.1
                  ? "<0.1"
                  : n1((100 * state.value) / h.listings)}
                %
              </span>
            </header>
            <b className="availability-state-value num">{n0(state.value)}</b>
            <p>{state.description}</p>
            <button className="brief-link" onClick={state.go}>
              {state.action}
              <Icon name="right" size={17} />
            </button>
          </article>
        ))}
      </div>
      <dl className="availability-footprint">
        {[
          ["Resolved products", n0(h.products)],
          ["Medicines & devices", n0(model.stats.clinical)],
          ["Median product price", kes(model.stats.price.p50)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="num">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="availability-caption">
        Price median uses {n0(model.stats.price.n)} products with a positive
        median listed price. Stock status describes captured listings; it does
        not establish national medicine availability.
      </p>
      <p className="availability-date">
        <Icon name="clock" size={18} />
        <span>
          {fmtDate(h.snapshot_at)}
          {meta.run.snapshot_at_inferred &&
            " · Date inferred from file timestamps; collection date unverified."}{" "}
          Confirm current stock and price with the pharmacy.
        </span>
      </p>
    </section>
  );
}
