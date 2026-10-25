import { Icon, n0, n1, kes } from "./ui.jsx";
import { EvidenceBadge } from "./EvidenceControls.tsx";
import "./price-confidence.css";
import type {
  OverviewChart,
  OverviewModel,
  OverviewMeta,
} from "../lib/overview-types";
const confidenceInfo: Readonly<
  Record<string, { label: string; tone: string; note: string }>
> = {
  high: {
    label: "High",
    tone: "teal",
    note: "Stronger agreement across listing evidence",
  },
  medium: {
    label: "Medium",
    tone: "cobalt",
    note: "Check identity, strength, form and pack",
  },
  low: {
    label: "Low",
    tone: "amber",
    note: "Limited or conflicting identity evidence",
  },
};
export default function PriceConfidence({
  Chart,
  model,
  meta,
  bands,
  basis,
  onBasis,
  onConfidence,
  onQuality,
}: {
  Chart: OverviewChart;
  model: OverviewModel;
  meta: OverviewMeta;
  bands: string[];
  basis: string;
  onBasis: (key: string) => void;
  onConfidence: (index: number) => void;
  onQuality: () => void;
}) {
  const { stats } = model;
  const selected =
    model.scenarios.find((s) => s.key === basis) ?? model.scenarios[0];
  const headline = model.scenarios[0];
  const delta =
    selected.rate != null && headline.rate != null
      ? selected.rate - headline.rate
      : null;
  const precise = delta != null && delta !== 0 && Math.abs(delta) < 0.1;
  const deltaLabel = (rate: number | null) => {
    if (rate == null || headline.rate == null) return "Unknown";
    const change = rate - headline.rate;
    return `${change > 0 ? "+" : ""}${change.toFixed(change !== 0 && Math.abs(change) < 0.1 ? 3 : 1)} pp`;
  };
  return (
    <div className="price-confidence">
      <article className="price-landscape">
        <header>
          <div className="price-panel-title">
            <span className="price-glyph">
              <Icon name="coins" size={21} />
            </span>
            <div>
              <span className="eyebrow">Listed prices · KES</span>
              <h3>The shape of captured prices</h3>
            </div>
          </div>
          <span className="price-sample">
            <b className="num">{n0(stats.price.n)}</b> products with a positive
            price
          </span>
        </header>
        <div className="price-landscape-body">
          <div className="price-anchor">
            <span>Median product price</span>
            <strong className="num">
              <small>KES</small> {n0(stats.price.p50)}
            </strong>
            <p>One positive median listed price per resolved product.</p>
            <dl>
              <div>
                <dt>10th percentile</dt>
                <dd className="num">{kes(stats.price.p10)}</dd>
              </div>
              <div>
                <dt>90th percentile</dt>
                <dd className="num">{kes(stats.price.p90)}</dd>
              </div>
            </dl>
            <small>
              Strengths, forms and pack sizes vary. These figures do not
              estimate treatment cost.
            </small>
          </div>
          <div className="price-distribution">
            <span className="price-chart-unit">
              Product count by price band · KES
            </span>
            <Chart
              kind="price"
              data={model.price}
              label={`Positive product median prices in KES: ${model.price.map((b) => `${b.label}, ${n0(b.count)} products`).join("; ")}.`}
              className="price-frequency-chart"
            />
            <details className="price-count-table">
              <summary>
                Read exact price counts <Icon name="down" size={14} />
              </summary>
              <table>
                <thead>
                  <tr>
                    <th>Price band · KES</th>
                    <th>Products</th>
                  </tr>
                </thead>
                <tbody>
                  {model.price.map((b) => (
                    <tr key={b.label}>
                      <th scope="row">{b.label}</th>
                      <td className="num">{n0(b.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                Each band excludes the preceding upper bound and includes its
                own upper bound. {n0(meta.headline.products - stats.price.n)}{" "}
                products have no positive median price and are excluded.
              </p>
            </details>
          </div>
        </div>
      </article>
      <div className="matching-bento">
        <article className="matching-confidence">
          <header className="price-panel-title">
            <span className="price-glyph">
              <Icon name="link-check" size={21} />
            </span>
            <div>
              <span className="eyebrow">Product identity</span>
              <h3>Confidence in the match</h3>
            </div>
          </header>
          <p>
            Source listings are grouped into product identities. Confidence does
            not establish clinical interchangeability.
          </p>
          <div className="matching-confidence-rows">
            {bands.map((name, index) => {
              const detail = confidenceInfo[name] ?? {
                label: name,
                tone: "neutral",
                note: "Matching evidence",
              };
              return (
                <button
                  key={name}
                  onClick={() => onConfidence(index)}
                  aria-label={`Browse ${detail.label.toLowerCase()} confidence products, ${n0(stats.byMatch[index])} products`}
                >
                  <span className="matching-band-identity">
                    <EvidenceBadge tone={detail.tone}>
                      {detail.label}
                    </EvidenceBadge>
                    <small>{detail.note}</small>
                  </span>
                  <span className="matching-band-amount">
                    <b className="num">{n0(stats.byMatch[index])}</b>
                    <small className="num">
                      {n1(
                        meta.headline.products
                          ? (100 * stats.byMatch[index]) /
                              meta.headline.products
                          : 0,
                      )}
                      %
                    </small>
                  </span>
                  <Icon name="right" size={15} />
                </button>
              );
            })}
          </div>
          <small className="matching-method">
            Matching uses key specificity, pack agreement, source overlap and
            price spread.
          </small>
        </article>
        <aside className="matching-reference">
          <header className="price-panel-title">
            <span className="price-glyph">
              <Icon name="file-medical" size={21} />
            </span>
            <span className="eyebrow">Ingredient linkage</span>
          </header>
          <strong className="matching-reference-count num">
            {n0(meta.coverage.products_with_active_ingredient)}
          </strong>
          <h3>Products with an ingredient linked</h3>
          <p>
            Linked identity is a starting point. Clinical fields vary by record;
            revision dates and complete prescribing coverage are unverified.
          </p>
          <button className="brief-link" onClick={onQuality}>
            Understand the data limits <Icon name="right" size={15} />
          </button>
        </aside>
      </div>
      <details className="calculation-sensitivity">
        <summary>
          <span>
            <strong>How assumptions change the headline</strong>
            <small>
              Compare calculation bases. The reported measure stays unchanged.
            </small>
          </span>
          <span className="sensitivity-tag">Sensitivity analysis</span>
          <Icon name="down" size={17} />
        </summary>
        <div
          className="sensitivity-result"
          aria-live="polite"
          aria-atomic="true"
        >
          <div>
            <span>
              {selected.key === "reporting"
                ? "Reported availability"
                : "Scenario estimate"}
            </span>
            <h3>{selected.label}</h3>
            <p>{selected.note}</p>
          </div>
          <div className="sensitivity-result-value">
            <strong className="num">
              {selected.rate == null
                ? "Unknown"
                : `${selected.rate.toFixed(precise ? 3 : 1)}%`}
            </strong>
            <span>
              {selected.key === "reporting"
                ? "Reported baseline"
                : `${deltaLabel(selected.rate)} versus reported`}
            </span>
          </div>
          <div
            className="sensitivity-result-mix"
            role="img"
            aria-label={`${n0(selected.inStock)} treated as in stock, ${n0(selected.total - selected.inStock)} out of stock, of ${n0(selected.total)} listings in this calculation`}
          >
            <span style={{ width: `${selected.rate ?? 0}%` }} />
          </div>
          <div className="sensitivity-result-counts">
            <span>
              <b className="num">{n0(selected.inStock)}</b>{" "}
              {selected.key === "all"
                ? "treated as in stock"
                : "reported in stock"}
            </span>
            <span>
              <b className="num">{n0(selected.total)}</b> listings in this
              calculation
            </span>
          </div>
          <div className="sensitivity-result-actions">
            <button className="brief-link" onClick={onQuality}>
              Inspect calculation limits <Icon name="right" size={14} />
            </button>
            {selected.key !== "reporting" && (
              <button
                className="brief-link"
                onClick={() => onBasis("reporting")}
              >
                Reset to reported basis
              </button>
            )}
          </div>
        </div>
        <div
          className="sensitivity-options"
          role="radiogroup"
          aria-label="Availability calculation comparison"
        >
          {model.scenarios.map((s) => (
            <label key={s.key}>
              <input
                className="sensitivity-selection"
                type="radio"
                name="availability-basis"
                value={s.key}
                checked={selected.key === s.key}
                onChange={() => onBasis(s.key)}
              />
              <span className="sensitivity-identity">
                <strong>{s.label}</strong>
                <small>
                  {s.key === "reporting" ? "Reported basis" : "Assumption only"}{" "}
                  · <b className="num">{n0(s.inStock)}</b> of{" "}
                  <b className="num">{n0(s.total)}</b> listings
                </small>
              </span>
              <span className="sensitivity-rate num">
                {s.rate == null ? "Unknown" : `${n1(s.rate)}%`}
              </span>
              <span className="sensitivity-delta num">
                {s.key === "reporting" ? "Baseline" : deltaLabel(s.rate)}
              </span>
            </label>
          ))}
        </div>
        <p className="sensitivity-note">
          pp means percentage points. Scenario estimates do not replace the
          reported headline or change captured stock records.
        </p>
      </details>
    </div>
  );
}
