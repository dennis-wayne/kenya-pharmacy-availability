import { Icon } from "./ui.jsx";
import PharmacyGlyph from "./PharmacyGlyph";
import { pharmacyEvidence } from "../lib/stock-patterns";
import type { EvidenceState } from "../lib/stock-patterns";
import type { OverviewStore } from "../lib/overview-types";

const states: { id: EvidenceState; label: string; description: string }[] = [
  { id: "out", label: "Out", description: "Out of stock" },
  {
    id: "conflict",
    label: "Mixed",
    description: "Both in- and out-of-stock listings",
  },
  { id: "in", label: "In stock", description: "In stock" },
  { id: "unknown", label: "Unknown", description: "Stock not reported" },
];

/** A named source preview. Conflicting source listings stay visible as mixed. */
export default function StockSignalPreview({
  store,
  rows,
  onChoose,
}: {
  store: OverviewStore;
  rows: number[];
  onChoose: (index: number) => void;
}) {
  const samples = rows
    .slice(0, 3)
    .map((index) => ({ index, evidence: pharmacyEvidence(store, index) }));
  const hasMixed = samples.some(({ evidence }) => evidence.conflict.length > 0);
  return (
    <figure className="attention-signals">
      <figcaption>
        Sample pharmacy reports<span>Open a product to read its listings</span>
      </figcaption>
      <div className="attention-signal-rows">
        {samples.map(({ index, evidence }) => {
          const summary = states
            .filter(({ id }) => evidence[id].length)
            .map(
              ({ id, description }) =>
                `${description}: ${evidence[id].map((s) => s.name).join(", ")}`,
            )
            .join(". ");
          return (
            <button
              key={store.P.key[index]}
              onClick={() => onChoose(index)}
              aria-label={`Read pharmacy reports for ${store.P.name[index]}. ${summary}.`}
            >
              <span className="attention-signal-product">
                <span className="attention-signal-name">
                  {store.P.name[index]}
                </span>
                <Icon name="right" size={14} />
              </span>
              <span className="attention-pharmacy-groups" aria-hidden="true">
                {states
                  .filter(({ id }) => evidence[id].length > 0)
                  .map(({ id, label, description }) => (
                    <span
                      className="attention-pharmacy-group"
                      data-state={id}
                      key={id}
                    >
                      <span className="attention-pharmacy-state">{label}</span>
                      <span
                        className="attention-pharmacy-identities"
                        title={`${description}: ${evidence[id].map((s) => s.name).join(", ")}`}
                      >
                        {evidence[id].slice(0, 4).map((shop) => (
                          <span
                            className="attention-pharmacy-identity"
                            title={`${shop.name}: ${description}`}
                            key={shop.pharmacy_id}
                          >
                            <PharmacyGlyph id={shop.pharmacy_id} size={28} />
                          </span>
                        ))}
                        {evidence[id].length > 4 && (
                          <span className="attention-pharmacy-more">
                            +{evidence[id].length - 4}
                          </span>
                        )}
                      </span>
                    </span>
                  ))}
              </span>
            </button>
          );
        })}
      </div>
      {!samples.length && <p>No clinical products qualify in this snapshot.</p>}
      <p className="attention-signal-note">
        Only listed pharmacies are shown.
        {hasMixed &&
          " Mixed means a pharmacy has both in- and out-of-stock listings."}
      </p>
    </figure>
  );
}
