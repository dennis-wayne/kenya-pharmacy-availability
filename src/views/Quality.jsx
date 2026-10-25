/** Evidence workbench: linkage, matching and stock reporting keep their own denominators. */
import { lazy, Suspense, useMemo, useState } from "react";
const ReferenceLibrary = import.meta.env.DEV ? lazy(() => import('../components/ReferenceLibrary')) : null;
import { runFilter, summarise, EMPTY } from "../lib/filters.js";
import { Icon, n0, n1 } from "../components/ui.jsx";
import { EvidenceBadge, PillToggle } from "../components/EvidenceControls";
import PharmacyGlyph from "../components/PharmacyGlyph";
import "./quality-overhaul.css";

function Heading({ title, description, right = false }) {
  return (
    <header className="quality-heading" data-align={right ? "right" : "left"}>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </header>
  );
}
function CoverageRow({ label, count, total, tone }) {
  const percent = (100 * count) / Math.max(1, total);
  return (
    <div className="quality-field-row" data-tone={tone}>
      <div>
        <strong>{label}</strong>
        <span className="num">{n1(percent)}%</span>
      </div>
      <meter
        min={0}
        max={total || 1}
        value={count}
        aria-label={`${label}: ${n0(count)} of ${n0(total)} records linked`}
      />
      <p>
        <span>
          <b className="num">{n0(count)}</b> of{" "}
          <span className="num">{n0(total)}</span> linked
        </span>
        <span>
          <span className="num">{n0(total - count)}</span> missing
        </span>
      </p>
    </div>
  );
}
export default function Quality({ store, onNavigate, setFilters }) {
  const [referenceOpen,setReferenceOpen]=useState(false);
  const { meta, P, D } = store,
    cov = meta.coverage,
    h = meta.headline;
  const [queue, setQueue] = useState("review"),
    [moreQueue, setMoreQueue] = useState(false),
    [moreClasses, setMoreClasses] = useState(false),
    [classQuery, setClassQuery] = useState("");
  const all = useMemo(
    () =>
      store.rowsByListed ??
      runFilter(store, EMPTY, { key: "listed", dir: "desc" }).rows,
    [store],
  );
  const stats = useMemo(
    () => store.allStats ?? summarise(store, all),
    [store, all],
  );
  const backlog = useMemo(
    () => all.filter((i) => D.gap[P.gap[i]] === "di_miss"),
    [all, D, P],
  );
  const review = useMemo(
    () =>
      all
        .filter((i) => D.review[P.review[i]] === "needs_review")
        .sort((a, b) => P.nListed[b] - P.nListed[a]),
    [all, D, P],
  );
  const classes = useMemo(() => {
    const counts = new Int32Array(D.therapeutic?.length ?? 0);
    let classed = 0;
    for (const i of all)
      if (P.therapeutic[i] >= 0) {
        counts[P.therapeutic[i]]++;
        classed++;
      }
    return {
      classed,
      rows: Array.from(counts)
        .map((n, index) => ({ n, index, name: D.therapeutic[index] }))
        .filter((r) => r.n > 0)
        .sort((a, b) => b.n - a.n),
    };
  }, [all, D, P]);
  const quarantined = meta.pharmacies.filter(
    (p) => p.present_in_snapshot && p.quarantined,
  );
  const unreported = meta.pharmacies.filter(source => source.present_in_snapshot)
    .map(source => ({ ...source, unreported: source.publishes_oos ? source.unknown_status : source.listings }))
    .filter(source => source.unreported > 0);
  const confidence = D.matchBand
    .map((label, index) => ({ label, index, n: stats.byMatch[index] ?? 0 }))
    .sort((a, b) => b.n - a.n);
  const activeQueue = queue === "review" ? review : backlog;
  const classRows = classes.rows.filter((row) =>
    row.name.toLowerCase().includes(classQuery.trim().toLowerCase()),
  );
  const jump = (patch) => {
    setFilters({ ...EMPTY, ...patch });
    onNavigate("catalogue");
  };
  const gaps = () =>
    jump({ gaps: [D.gap.indexOf("di_miss")].filter((i) => i >= 0) });
  const matched = cov.products_with_drugindex_match,
    unmatched = cov.products_total - matched;
  return (
    <div className="quality-workbench">
      {referenceOpen && ReferenceLibrary && <Suspense fallback={<p role="status">Opening reference library…</p>}><ReferenceLibrary onClose={()=>setReferenceOpen(false)}/></Suspense>}
      <section className="quality-summary" aria-label="Evidence overview">
        <div className="quality-summary-reference">
          <div className="quality-summary-top">
            <Icon name="book" size={22} />
            <span>Local reference linkage</span>
            <EvidenceBadge tone="neutral">Incomplete reference</EvidenceBadge>
          </div>
          <div className="quality-summary-main">
            <strong className="num">
              {n1((100 * matched) / Math.max(1, cov.products_total))}
              <small>%</small>
            </strong>
            <div>
              <h2>
                Products linked to a<br />
                reference record.
              </h2>
              <p>
                <b className="num">{n0(matched)}</b> of{" "}
                <span className="num">{n0(cov.products_total)}</span> captured
                products
              </p>
            </div>
          </div>
          <div
            className="quality-linkage-track"
            role="img"
            aria-label={`${n0(matched)} products linked; ${n0(unmatched)} without a reference match`}
          >
            <i
              style={{
                width: `${(100 * matched) / Math.max(1, cov.products_total)}%`,
              }}
            />
          </div>
          <p>
            Linkage measures the records held here. It does not establish
            complete prescribing information or current clinical guidance.
          </p>
        </div>
        <div className="quality-priority-list">
          <button
            onClick={() => jump({ review: "needs_review" })}
            aria-label="Review product matches"
          >
            <span className="section-glyph" data-tone="amber">
              <Icon name="scan" size={21} />
            </span>
            <div>
              <h3>Product matches to review</h3>
              <p>Doubtful identity or contested classification</p>
            </div>
            <strong className="num">{n0(review.length)}</strong>
            <Icon name="right" size={16} />
          </button>
          <button onClick={gaps} aria-label="Explore reference gaps">
            <span className="section-glyph" data-tone="cobalt">
              <Icon name="file-medical" size={21} />
            </span>
            <div>
              <h3>Awaiting reference evidence</h3>
              <p>No register match or usable source category</p>
            </div>
            <strong className="num">{n0(backlog.length)}</strong>
            <Icon name="right" size={16} />
          </button>
          <button
            onClick={() => onNavigate("sources")}
            aria-label="Inspect pharmacy sources"
          >
            <span className="section-glyph" data-tone="berry">
              <Icon name="signal-slash" size={21} />
            </span>
            <div>
              <h3>Sources without usable stock</h3>
              <p>Searchable listings, excluded from the rate</p>
            </div>
            <strong className="num">{quarantined.length}</strong>
            <Icon name="right" size={16} />
          </button>
        </div>
      </section>
      <div className="quality-register-note">
        <Icon name="info" size={17} />
        <p>
          The local DrugIndex export holds{" "}
          <b className="num">{n0(cov.brands_rows)}</b> brands and{" "}
          <b className="num">{n0(cov.ingredients_rows)}</b> ingredient records
          across {cov.distinct_scrape_days} record-date groups, through{" "}
          <span className="num">
            {String(cov.latest_updated_at ?? "").slice(0, 10) || "unknown"}
          </span>
          . These dates do not verify clinical revision dates.
        </p>
      </div>
      <section className="quality-section">
        <Heading
          title="Reference coverage, field by field."
          right
          description="A field is covered when the local record contains a link or value. The denominator changes with the record type; missing information stays unknown."
        />
        <div className="quality-field-grid">
          <article className="quality-field-panel">
            <header>
              <Icon name="link" size={21} />
              <div>
                <h3>Brand records</h3>
                <p>
                  <span className="num">{n0(cov.brands_rows)}</span> local
                  records
                </p>
              </div>
            </header>
            <CoverageRow
              label="Active ingredient"
              count={cov.brands_with_ingredient}
              total={cov.brands_rows}
              tone="teal"
            />
            <CoverageRow
              label="Manufacturer"
              count={cov.brands_with_manufacturer}
              total={cov.brands_rows}
              tone="teal"
            />
            <div className="quality-field-annotation">
              <h4>Reference matches are a starting point.</h4>
              {ReferenceLibrary && <button className="btn" onClick={()=>setReferenceOpen(true)}><Icon name="book" size={17}/>Browse Drug Index library</button>}
              <p>
                A product can reach the register without every clinical field
                being available. Ingredient, strength, form and pack still need
                inspection.
              </p>
              <dl>
                <div>
                  <dt>Active ingredient linked</dt>
                  <dd className="num">
                    {n0(cov.products_with_active_ingredient)} products
                  </dd>
                </div>
                <div>
                  <dt>Other unclassified</dt>
                  <dd className="num">
                    {n0(
                      cov.products_unclassified -
                        cov.products_awaiting_drugindex,
                    )}{" "}
                    products
                  </dd>
                </div>
              </dl>
            </div>
          </article>
          <article className="quality-field-panel">
            <header>
              <Icon name="medical-kit" size={21} />
              <div>
                <h3>Ingredient records</h3>
                <p>
                  <span className="num">{n0(cov.ingredients_rows)}</span> local
                  records
                </p>
              </div>
            </header>
            {[
              { label: "Indications", count: cov.ingredients_with_indications },
              { label: "Dosage", count: cov.ingredients_with_dosage },
              {
                label: "Contraindications",
                count: cov.ingredients_with_contraindications,
              },
              {
                label: "Therapeutic category",
                count: cov.ingredients_with_category,
              },
            ].map((row) => (
              <CoverageRow
                key={row.label}
                {...row}
                total={cov.ingredients_rows}
                tone="cobalt"
              />
            ))}
          </article>
        </div>
      </section>
      <section className="quality-section">
        <Heading
          title="How listings become product identities."
          description="Confidence describes agreement across listing evidence. It does not establish clinical suitability or interchangeability."
        />
        <div className="quality-matching">
          <div className="quality-match-lead">
            <span>High-confidence grouping</span>
            <strong className="num">
              {n1(
                (100 * (stats.byMatch[D.matchBand.indexOf("high")] ?? 0)) /
                  Math.max(1, all.length),
              )}
              <small>%</small>
            </strong>
            <p>
              of <span className="num">{n0(all.length)}</span> resolved products
            </p>
            <div
              className="quality-confidence-strip"
              role="img"
              aria-label={confidence
                .map((r) => `${r.label}: ${n0(r.n)} products`)
                .join("; ")}
            >
              {confidence.map((row) => (
                <i
                  key={row.label}
                  data-band={row.label}
                  style={{
                    width: `${(100 * row.n) / Math.max(1, all.length)}%`,
                  }}
                />
              ))}
            </div>
            <small>
              Matching version{" "}
              <span className="num">{meta.run.match_algo_version}</span>
            </small>
          </div>
          <div className="quality-confidence-ledger">
            {confidence.map((row) => (
              <button
                key={row.label}
                onClick={() => jump({ matchBands: [row.index] })}
              >
                <div>
                  <h3>
                    {row.label[0].toUpperCase() + row.label.slice(1)} confidence
                  </h3>
                  <p>
                    {row.label === "high"
                      ? "Stronger agreement across listing evidence"
                      : row.label === "medium"
                        ? "Inspect identity, strength, form and pack"
                        : "Limited or conflicting matching evidence"}
                  </p>
                </div>
                <div>
                  <strong className="num">{n0(row.n)}</strong>
                  <small className="num">
                    {n1((100 * row.n) / Math.max(1, all.length))}%
                  </small>
                </div>
                <Icon name="right" size={16} />
              </button>
            ))}
          </div>
          <p className="quality-matching-note">
            <Icon name="shield" size={18} />
            Low-confidence matches and products awaiting review are excluded
            from the repeated clinical stockout signal.
          </p>
        </div>
      </section>
      {classes.rows.length > 0 && (
        <section className="quality-section">
          <Heading
            title="The therapeutic classes this reference reaches."
            right
            description="Classes reach products through a matched active ingredient. Browse a class to inspect its products; the remaining unclassed products are outside this breakdown."
          />
          <div className="quality-class-surface">
            <header>
              <div>
                <strong className="num">{n0(classes.classed)}</strong>
                <span>
                  products across {classes.rows.length} linked classes
                </span>
              </div>
              <label>
                <Icon name="search" size={17} />
                <input
                  aria-label="Find a therapeutic class"
                  placeholder="Find a therapeutic class"
                  value={classQuery}
                  onChange={(e) => setClassQuery(e.target.value)}
                />
              </label>
            </header>
            <div className="quality-class-explorer">
              {classRows
                .slice(0, moreClasses ? classRows.length : 8)
                .map((row) => (
                  <button
                    key={row.index}
                    onClick={() => jump({ therapeutic: [row.index] })}
                  >
                    <span>{row.name}</span>
                    <div className="quality-class-meter" aria-hidden="true">
                      <i
                        style={{
                          width: `${(100 * row.n) / Math.max(1, classes.rows[0].n)}%`,
                        }}
                      />
                    </div>
                    <strong className="num">{n0(row.n)}</strong>
                    <Icon name="right" size={14} />
                  </button>
                ))}
            </div>
            {classRows.length === 0 && (
              <p className="quality-empty">
                No matching therapeutic class.{" "}
                <button onClick={() => setClassQuery("")}>Clear search</button>
              </p>
            )}
            <footer>
              <p>
                <span className="num">{n0(all.length - classes.classed)}</span>{" "}
                products have no linked therapeutic class.
              </p>
              {classRows.length > 8 && (
                <button onClick={() => setMoreClasses(!moreClasses)}>
                  {moreClasses
                    ? "Show leading classes"
                    : `Show all ${classRows.length} classes`}
                  <Icon name={moreClasses ? "up" : "down"} size={15} />
                </button>
              )}
            </footer>
          </div>
        </section>
      )}
      <section className="quality-section">
        <Heading
          title="Put the next review within reach."
          description="Start with products listed by more pharmacies. These are evidence queues for investigation, not a diagnosis of shortage or clinical equivalence."
        />
        <div className="quality-queue-surface">
          <header>
            <PillToggle
              label="Evidence review queue"
              value={queue}
              onChange={(value) => {
                setQueue(value);
                setMoreQueue(false);
              }}
              options={[
                {
                  value: "review",
                  label: "Product matches",
                  count: n0(review.length),
                },
                {
                  value: "reference",
                  label: "Reference gaps",
                  count: n0(backlog.length),
                },
              ]}
            />
            <button
              onClick={() =>
                queue === "review" ? jump({ review: "needs_review" }) : gaps()
              }
            >
              {queue === "review"
                ? "Review all matches"
                : "Explore all reference gaps"}
              <Icon name="right" size={15} />
            </button>
          </header>
          <p className="quality-queue-description">
            {queue === "review"
              ? "Doubtful matches and contested classifications are excluded from the repeated clinical stockout signal."
              : "Unclassified products with no register match and no usable source category."}
          </p>
          <div className="quality-queue-columns" aria-hidden="true">
            <span>Product</span>
            <span>Evidence</span>
            <span>Sources</span>
            <span>Match</span>
          </div>
          <ul
            aria-label={
              queue === "review"
                ? "Product match review sample"
                : "Reference gap sample"
            }
          >
            {activeQueue.slice(0, moreQueue ? 12 : 6).map((i) => (
              <li key={P.key[i]}>
                <button
                  className="quality-queue-product"
                  onClick={() => jump({ q: P.name[i] })}
                >
                  {P.name[i]}
                  <Icon name="right" size={14} />
                </button>
                <EvidenceBadge tone={queue === "review" ? "amber" : "cobalt"}>
                  {queue === "reference"
                    ? "No reference"
                    : P.contested[i]
                      ? "Class contested"
                      : "Match review"}
                </EvidenceBadge>
                <span className="num quality-queue-sources">
                  {P.nListed[i]}
                  <small> listing</small>
                </span>
                <span className="num quality-queue-match">
                  {P.matchConf[i].toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
          <footer>
            <span>
              Showing {Math.min(activeQueue.length, moreQueue ? 12 : 6)} of{" "}
              <b className="num">{n0(activeQueue.length)}</b> products
            </span>
            {activeQueue.length > 6 && (
              <button onClick={() => setMoreQueue(!moreQueue)}>
                {moreQueue ? "Show fewer" : "Show 12 examples"}
                <Icon name={moreQueue ? "up" : "down"} size={15} />
              </button>
            )}
          </footer>
        </div>
      </section>
      <section className="quality-section">
        <Heading
          title="Unknown stock stays outside the rate."
          right
          description="Stock can be missing for individual listings within an otherwise reporting pharmacy. Listing presence alone is not evidence of availability."
        />
        <div className="quality-stock-boundary">
          <aside>
            <span>Used in the headline</span>
            <strong className="num">
              {n1(h.in_stock_rate_gated)}
              <small>%</small>
            </strong>
            <p>
              <b className="num">{n0(h.in_stock)}</b> in-stock listings ÷{" "}
              <b className="num">{n0(h.in_stock + h.out_of_stock)}</b> rated
              listings
            </p>
            <div>
              <Icon name="signal-slash" size={20} />
              <p>
                <b className="num">{n0(h.not_published)}</b> unknown listings
                are excluded.
              </p>
            </div>
            <details>
              <summary>
                What if unknown were counted as available?
                <Icon name="down" size={14} />
              </summary>
              <p>
                The rate would become{" "}
                <b className="num">{n1(100 * (h.in_stock + h.not_published) / Math.max(1,h.listings))}%</b>. This
                assumption adds positive evidence that the sources did not
                provide.
              </p>
            </details>
          </aside>
          <div className="quality-excluded-ledger">
            <header>
              <h3>{unreported.length} sources with unknown stock</h3>
              <button onClick={() => onNavigate("sources")}>
                Inspect sources
                <Icon name="right" size={14} />
              </button>
            </header>
            {unreported.map((source) => (
              <details key={source.pharmacy_id}>
                <summary>
                  <PharmacyGlyph id={source.pharmacy_id} size={30} />
                  <span>{source.name}</span>
                  <strong className="num">{n0(source.unreported)}</strong>
                  <Icon name="down" size={14} />
                </summary>
                <div>
                  <EvidenceBadge tone="neutral">
                    {source.publishes_oos ? 'Partially reported' : 'Stock not reported'}
                  </EvidenceBadge>
                  <p>{n0(source.unreported)} of {n0(source.listings)} captured listings lack usable stock evidence and are excluded from the rate.</p>
                  <button onClick={() => jump({ shopsAny: [source.bit] })}>
                    Browse {source.name} listings
                    <Icon name="right" size={14} />
                  </button>
                </div>
              </details>
            ))}
            {!unreported.length && <p>Every captured listing has a usable stock state in this snapshot.</p>}
          </div>
        </div>
      </section>
      <details className="quality-reading-guide">
        <summary>
          How to interpret this evidence
          <Icon name="down" size={17} />
        </summary>
        <dl>
          <div>
            <dt>Stock</dt>
            <dd>
              Only reporting sources contribute to availability. Confirm current
              stock and price with the pharmacy.
            </dd>
          </div>
          <div>
            <dt>Matching</dt>
            <dd>
              Listings are grouped into product identities. Check ingredient,
              strength, form and pack before comparing products.
            </dd>
          </div>
          <div>
            <dt>Reference</dt>
            <dd>
              The local reference is incomplete. A linked ingredient does not
              establish complete or current clinical guidance.
            </dd>
          </div>
        </dl>
      </details>
    </div>
  );
}
