/** Source directory and evidence, preserving captured-listing and product grains. */
import { useMemo, useState } from "react";
import { runFilter, sourceBreakdown, EMPTY } from "../lib/filters.js";
import { Icon, n0 } from "../components/ui.jsx";
import PharmacyGlyph, { PharmacyStack } from "../components/PharmacyGlyph";
import SourceDirectory from "../components/SourceDirectory";
import SourceProductEvidence from "../components/SourceProductEvidence";
import "./sources-overhaul.css";
import { useSmallScreen } from "../components/useSmallScreen.ts";

export default function Sources({ store, onNavigate, setFilters }) {
  const { meta } = store;
  const small = useSmallScreen();
  const [group, setGroup] = useState("all");
  const all = useMemo(
    () =>
      store.allRows ??
      runFilter(store, EMPTY, { key: "oos", dir: "desc" }).rows,
    [store],
  );
  const counts = useMemo(
    () => store.allSources ?? sourceBreakdown(store, all),
    [store, all],
  );
  const reporting = store.shops.filter((source) => source.publishes_oos);
  const listingOnly = store.shops.filter((source) => !source.publishes_oos);
  const topThree = [...store.shops]
    .sort((a, b) => b.listings - a.listings)
    .slice(0, 3);
  const topThreeShare =
    (100 * topThree.reduce((sum, source) => sum + source.listings, 0)) /
    Math.max(1, meta.headline.listings);
  const browse = (source) => {
    setFilters({ ...EMPTY, shopsAny: [source.bit] });
    onNavigate("catalogue");
  };
  const inspectGroup = (value) => {
    setGroup(value);
    requestAnimationFrame(() => {
      const title = document.getElementById("source-directory-title");
      title?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion:reduce)").matches
          ? "auto"
          : "smooth",
      });
      title?.focus({ preventScroll: true });
    });
  };
  return (
    <div className="sources-overhaul">
      <section
        className="source-snapshot"
        aria-label="Source reporting summary"
      >
        <div className="source-snapshot-identity">
          <span>Captured network</span>
          <div>
            <strong className="num">{store.shops.length}</strong>
            <h2>
              Pharmacy catalogues
              <br />
              in one workspace.
            </h2>
          </div>
          <p>
            <b className="num">{n0(meta.headline.listings)}</b> collected
            listings · <span className="num">{meta.run.snapshot_id}</span>
          </p>
          <small>
            {meta.run.snapshot_at_inferred ? 'Collection dates are inferred. ' : 'Capture times are recorded. '}This is a captured snapshot, not live
            shelf inventory.
          </small>
        </div>
        <div className="source-snapshot-groups">
          <button onClick={() => inspectGroup("reporting")}>
            <div>
              <span>Reporting stock</span>
              <b className="num">{reporting.length}</b>
            </div>
            <PharmacyStack shops={reporting} limit={small ? 3 : 5} />
            <p>Use explicit stock reports.</p>
            <Icon name="right" size={17} />
          </button>
          <button onClick={() => inspectGroup("listings")}>
            <div>
              <span>Listing only</span>
              <b className="num">{listingOnly.length}</b>
            </div>
            <PharmacyStack shops={listingOnly} limit={small ? 3 : 5} />
            <p>Stock remains unknown.</p>
            <Icon name="right" size={17} />
          </button>
        </div>
      </section>
      <SourceDirectory
        sources={store.shops}
        onBrowse={browse}
        group={group}
        onGroupChange={setGroup}
      />
      <SourceProductEvidence
        counts={counts}
        onBrowse={browse}
        topThreeShare={topThreeShare}
        topThree={topThree}
        listings={meta.headline.listings}
        unknown={meta.headline.not_published}
        onLimits={() => onNavigate("quality")}
      />
      {store.absent.length > 0 && (
        <section className="source-gap-section">
          <header className="source-section-heading" data-align="right">
            <div>
              <h2>Keep the missing captures visible.</h2>
              <p>
                {store.absent.length} sources were not captured in this
                snapshot. Absence does not establish closure or unavailable
                products.
              </p>
            </div>
          </header>
          <div className="source-gap-ledger">
            {store.absent.map((source) => (
              <article key={source.pharmacy_id}>
                <PharmacyGlyph id={source.pharmacy_id} size={36} />
                <div className="source-gap-content">
                  <header><h3>{source.name}</h3><span className="source-gap-state">Absent</span></header>
                  <p>No listings captured.</p>
                  <details>
                    <summary>
                      Capture details
                      <Icon name="down" size={13} />
                    </summary>
                    <p>
                      {source.absent_reason || "No capture reason supplied."}
                    </p>
                  </details>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
