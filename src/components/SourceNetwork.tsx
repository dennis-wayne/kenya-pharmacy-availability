import { useState } from "react";
import PharmacyGlyph from "./PharmacyGlyph";
import { Icon, n0, n1 } from "./ui.jsx";
import { PillToggle } from "./EvidenceControls.tsx";
import "./source-network.css";
import type {
  OverviewMeta,
  OverviewModel,
  OverviewPharmacy,
} from "../lib/overview-types";
export default function SourceNetwork({
  model,
  meta,
  absent,
  onBrowse,
}: {
  model: OverviewModel;
  meta: OverviewMeta;
  absent: OverviewPharmacy[];
  onBrowse: (bit: number) => void;
}) {
  const [order, setOrder] = useState("share");
  const reporting = [...model.reporting].sort((a, b) =>
    order === "volume" ? b.rated - a.rated : (b.rate ?? -1) - (a.rate ?? -1),
  );
  const dominant = [...reporting].sort(
    (a, b) => b.out_of_stock - a.out_of_stock,
  )[0];
  const dominantShare =
    dominant && meta.headline.out_of_stock
      ? (100 * dominant.out_of_stock) / meta.headline.out_of_stock
      : null;
  const headline = model.scenarios[0];
  return (
    <div className="source-network">
      <header className="source-network-tools">
        <div className="source-network-scope">
          <span className="source-network-status">
            <i />
            {reporting.length} stock-reporting sources
          </span>
          <span>
            <b className="num">{n0(headline.total)}</b> rated listings
          </span>
        </div>
        <PillToggle
          label="Order stock-reporting pharmacies"
          value={order}
          options={[
            { value: "share", label: "Stock share" },
            { value: "volume", label: "Report volume" },
          ]}
          onChange={setOrder}
        />
      </header>
      <div className="source-network-legend">
        <span>
          <i data-state="in" />
          In stock
        </span>
        <span>
          <i data-state="out" />
          Out of stock
        </span>
        <span>Share of each source’s rated listings</span>
      </div>
      <div
        className="source-comparison"
        role="list"
        aria-label="Pharmacy stock reports"
      >
        <div className="source-comparison-labels" aria-hidden="true">
          <span>Pharmacy / rated listings</span>
          <span>Reported stock mix</span>
          <span>In stock</span>
          <span>Out</span>
          <span>In-stock rate</span>
          <span />
        </div>
        {reporting.map((source) => (
          <div
            className="source-comparison-row"
            role="listitem"
            key={source.pharmacy_id}
          >
            <button
              className="source-comparison-name"
              onClick={() => onBrowse(source.bit)}
              aria-label={`Browse ${source.name} products`}
            >
              <strong>
                <PharmacyGlyph id={source.pharmacy_id} size={28} />
                {source.name}
              </strong>
              <small>
                <b className="num">{n0(source.rated)}</b> rated listings
              </small>
            </button>
            <div
              className="source-comparison-mix"
              role="img"
              aria-label={`${source.name}: ${n1(source.rate)} percent of rated listings in stock, ${n0(source.in_stock)} in stock and ${n0(source.out_of_stock)} out of stock.`}
            >
              <span data-state="in" style={{ width: `${source.rate ?? 0}%` }} />
              <span
                data-state="out"
                style={{
                  width: `${source.rate == null ? 0 : 100 - source.rate}%`,
                }}
              />
            </div>
            <span className="source-comparison-count" data-state="in">
              <small>In stock</small>
              <b className="num">{n0(source.in_stock)}</b>
            </span>
            <span className="source-comparison-count" data-state="out">
              <small>Out</small>
              <b className="num">{n0(source.out_of_stock)}</b>
            </span>
            <span className="source-comparison-rate num">
              {source.rate == null ? "Unknown" : `${n1(source.rate)}%`}
            </span>
            <button
              className="source-comparison-open"
              aria-label={`Inspect ${source.name} catalogue`}
              onClick={() => onBrowse(source.bit)}
            >
              <Icon name="right" size={16} />
            </button>
          </div>
        ))}
        {!reporting.length && (
          <p className="source-network-empty">
            No stock-reporting sources are present.
          </p>
        )}
      </div>
      <aside className="source-network-context">
        <span>
          Combined reported rate{" "}
          <b className="num">
            {headline.rate == null ? "Unknown" : `${n1(headline.rate)}%`}
          </b>
        </span>
        <p>
          {dominant ? (
            <>
              <b>{dominant.name}</b> accounts for{" "}
              <b className="num">{n1(dominantShare)}%</b> of captured stockout
              listings. Larger catalogues carry more weight.
            </>
          ) : (
            "No combined rate can be calculated."
          )}
        </p>
      </aside>
      <p className="source-network-method">
        Rates use in-stock ÷ rated listings. Different catalogues and collection
        coverage mean these figures do not measure pharmacy quality.
      </p>
      {model.listedOnly.length > 0 && (
        <div className="source-listing-only">
          <header>
            <h3>Listed, without a stock signal</h3>
            <span className="num">
              {model.listedOnly.length} sources ·{" "}
              {n0(model.listedOnly.reduce((sum, s) => sum + s.listings, 0))}{" "}
              listings
            </span>
          </header>
          <p>
            Excluded from stock rates. Their captured products remain
            searchable.
          </p>
          <div className="source-listing-links">
            {model.listedOnly.map((source) => (
              <button
                key={source.pharmacy_id}
                onClick={() => onBrowse(source.bit)}
                aria-label={`Browse ${source.name}, ${n0(source.listings)} captured listings without usable stock reports`}
              >
                <PharmacyGlyph id={source.pharmacy_id} size={26} />
                <span>{source.name}</span>
                <b className="num">{n0(source.listings)}</b>
                <Icon name="right" size={13} />
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="source-network-absent">
        Absent from this snapshot:{" "}
        {absent.map((source) => source.name).join(", ") || "none"}. Absence does
        not establish closure or product unavailability.
      </p>
    </div>
  );
}
