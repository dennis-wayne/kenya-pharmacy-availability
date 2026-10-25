import { useMemo, useState } from "react";
import { Icon } from "./icons";
import PharmacyGlyph from "./PharmacyGlyph";
import { EvidenceBadge, PillToggle } from "./EvidenceControls";
import SelectField from "./SelectField";

export type PharmacySource = {
  pharmacy_id: string;
  name: string;
  platform: string;
  listings: number;
  in_stock: number;
  out_of_stock: number;
  publishes_oos: boolean;
  scrape_method: string;
  listing_key_strategy: string;
  distinct_status_values: number;
  rows_skipped: number;
  urls_repaired: number;
  health_detail: string | null;
  health_flags: string | null;
  bit: number;
};
const number = new Intl.NumberFormat("en-KE");
const groups = [
  { id: "all", label: "All sources" },
  { id: "reporting", label: "Reporting stock" },
  { id: "listings", label: "Listings only" },
] as const;
export type SourceGroup = (typeof groups)[number]["id"];

export default function SourceDirectory({
  sources,
  onBrowse,
  group,
  onGroupChange: setGroup,
}: {
  sources: PharmacySource[];
  onBrowse: (source: PharmacySource) => void;
  group: SourceGroup;
  onGroupChange: (group: SourceGroup) => void;
}) {
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState("size");
  const [open, setOpen] = useState<string | null>(null);
  const rateOf = (source: PharmacySource) =>
    source.publishes_oos && source.in_stock + source.out_of_stock > 0
      ? (100 * source.in_stock) / (source.in_stock + source.out_of_stock)
      : null;
  const visible = useMemo(
    () =>
      sources
        .filter(
          (source) =>
            (group === "all" ||
              (group === "reporting"
                ? source.publishes_oos
                : !source.publishes_oos)) &&
            source.name
              .toLocaleLowerCase()
              .includes(query.trim().toLocaleLowerCase()),
        )
        .sort((a, b) =>
          order === "name"
            ? a.name.localeCompare(b.name)
            : order === "rate"
              ? (rateOf(b) ?? -1) - (rateOf(a) ?? -1)
              : b.listings - a.listings,
        ),
    [sources, group, query, order],
  );
  return (
    <section
      className="source-directory source-explorer"
      aria-labelledby="source-directory-title"
    >
      <header className="source-section-heading" data-align="right">
        <div>
          <h2 id="source-directory-title" tabIndex={-1}>
            Choose a pharmacy. Read its evidence.
          </h2>
          <p>
            Open a source to inspect its capture, or browse its products. A
            listed product is not automatically an in-stock product.
          </p>
        </div>
      </header>
      <div className="source-explorer-tools">
        <PillToggle
          label="Source reporting filter"
          value={group}
          onChange={(value) => setGroup(value as SourceGroup)}
          options={groups.map((item) => ({
            value: item.id,
            label: item.label,
            count: sources.filter(
              (source) =>
                item.id === "all" ||
                (item.id === "reporting"
                  ? source.publishes_oos
                  : !source.publishes_oos),
            ).length,
          }))}
        />
        <label className="source-search">
          <Icon name="search" size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a pharmacy"
            aria-label="Find a pharmacy source"
          />
          {query && (
            <button
              aria-label="Clear pharmacy search"
              onClick={() => setQuery("")}
            >
              <Icon name="x" size={16} />
            </button>
          )}
        </label>
        <div className="source-order">
          <SelectField
            label="Order pharmacy sources"
            value={order}
            onChange={setOrder}
            options={[
              { value: "size", label: "Largest capture first" },
              { value: "name", label: "Pharmacy name A–Z" },
              { value: "rate", label: "In-stock share first" },
            ]}
          />
        </div>
      </div>
      <div className="source-explorer-status">
        <span role="status">
          {visible.length} of {sources.length} sources
        </span>
        <span>Captured source listings</span>
      </div>
      <div className="source-explorer-surface">
        <div className="source-explorer-columns" aria-hidden="true">
          <span>Pharmacy & reporting</span>
          <span>Captured listings</span>
          <span>Listing stock reports</span>
          <span>In-stock share</span>
          <span />
        </div>
        <ul className="source-directory-list" aria-label="Pharmacy sources">
          {visible.map((source) => {
            const expanded = open === source.pharmacy_id;
            const rated = source.publishes_oos
              ? source.in_stock + source.out_of_stock
              : 0;
            const rate = rateOf(source);
            return (
              <li
                className="source-explorer-item"
                key={source.pharmacy_id}
                data-expanded={expanded}
              >
                <div className="source-explorer-row">
                  <div className="source-explorer-identity">
                    <PharmacyGlyph id={source.pharmacy_id} size={36} />
                    <div>
                      <button
                        className="source-name"
                        aria-expanded={expanded}
                        aria-controls={`source-${source.pharmacy_id}`}
                        onClick={() =>
                          setOpen(expanded ? null : source.pharmacy_id)
                        }
                      >
                        {source.name}
                        <Icon name={expanded ? "up" : "down"} size={14} />
                      </button>
                      <small>
                        {source.publishes_oos
                          ? "Stock-reporting source"
                          : "Listing-only source"}
                      </small>
                    </div>
                  </div>
                  <div className="source-explorer-volume">
                    <b className="num">{number.format(source.listings)}</b>
                    <small>listings captured</small>
                  </div>
                  <div className="source-explorer-stock">
                    {source.publishes_oos ? (
                      <>
                        <span data-state="in">
                          <b className="num">
                            {number.format(source.in_stock)}
                          </b>{" "}
                          in stock
                        </span>
                        <span data-state="out">
                          <b className="num">
                            {number.format(source.out_of_stock)}
                          </b>{" "}
                          out
                        </span>
                      </>
                    ) : (
                      <>
                        <EvidenceBadge>Stock unknown</EvidenceBadge>
                        <small>Listing presence only</small>
                      </>
                    )}
                  </div>
                  <div className="source-explorer-rate">
                    {rate != null ? (
                      <>
                        <b className="num">
                          {rate.toFixed(1)}
                          <small>%</small>
                        </b>
                        <small>of rated listings</small>
                      </>
                    ) : (
                      <>
                        <span className="source-no-rate">
                          No rate available
                        </span>
                        <small>Excluded from stock calculations</small>
                      </>
                    )}
                  </div>
                  <button
                    className="source-explorer-browse"
                    aria-label={`Browse ${source.name} listings`}
                    onClick={() => onBrowse(source)}
                  >
                    Browse
                    <Icon name="right" size={15} />
                  </button>
                </div>
                <div
                  id={`source-${source.pharmacy_id}`}
                  className="source-explorer-detail"
                  hidden={!expanded}
                >
                  <section>
                    <h3>Collection &amp; evidence</h3>
                    <p>
                      Read the snapshot capture date, then confirm current stock
                      and listed prices with the pharmacy.
                    </p>
                    <div className="source-evidence-totals">
                      <span>
                        <b className="num">{number.format(rated)}</b> rated
                        listings
                      </span>
                      <span>
                        <b className="num">
                          {number.format(Math.max(0, source.listings - rated))}
                        </b>{" "}
                        without usable stock evidence
                      </span>
                    </div>
                    {source.health_detail && (
                      <p className="source-health-note">
                        {source.health_flags === "implausible_row_count"
                          ? "Small capture: too few rows to support a reliable stock rate."
                          : "This feed has no usable out-of-stock signal. Its listings remain searchable."}
                      </p>
                    )}
                  </section>
                  <details className="source-capture-record">
                    <summary>
                      Collection record
                      <Icon name="down" size={14} />
                    </summary>
                    <dl>
                      <dt>Platform</dt>
                      <dd>{source.platform}</dd>
                      <dt>Collection method</dt>
                      <dd>{source.scrape_method}</dd>
                      <dt>Listing identity</dt>
                      <dd>{source.listing_key_strategy}</dd>
                      <dt>Distinct stock values</dt>
                      <dd className="num">{source.distinct_status_values}</dd>
                      {source.rows_skipped > 0 && (
                        <>
                          <dt>Rows skipped</dt>
                          <dd className="num">
                            {number.format(source.rows_skipped)}
                          </dd>
                        </>
                      )}
                      {source.urls_repaired > 0 && (
                        <>
                          <dt>URLs repaired</dt>
                          <dd className="num">
                            {number.format(source.urls_repaired)}
                          </dd>
                        </>
                      )}
                      {source.health_detail && (
                        <>
                          <dt>Source diagnostic</dt>
                          <dd>{source.health_detail}</dd>
                        </>
                      )}
                    </dl>
                  </details>
                </div>
              </li>
            );
          })}
        </ul>
        {!visible.length && (
          <div className="source-directory-empty">
            <Icon name="search" size={24} />
            <h3>No pharmacy sources found</h3>
            <p>Try a different name or reporting group.</p>
            <button
              className="btn"
              onClick={() => {
                setQuery("");
                setGroup("all");
              }}
            >
              Reset source filters
            </button>
          </div>
        )}
      </div>
      <p className="source-explorer-note">
        Rates describe captured listing reports. They do not measure shelf
        inventory or pharmacy service quality.
      </p>
    </section>
  );
}
