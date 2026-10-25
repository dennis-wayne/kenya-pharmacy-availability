/**
 * Catalogue — faceted exploration of 43,606 resolved products.
 *
 * Layout is a three-column instrument: facets, grid, detail. The facet rail
 * carries live cross-filtered counts, the grid is windowed so the full result
 * set scrolls continuously, and selecting a row opens the per-source detail
 * without losing your place.
 */

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Modal from '../components/Modal.tsx';
import { useToast } from '../components/Toast';
import CatalogueToolbar from '../components/CatalogueToolbar';
import { catalogueContext } from '../lib/catalogue-context';
import CatalogueResultRow from '../components/CatalogueResultRow';
import CatalogueFilterWorkspace from '../components/CatalogueFilterWorkspace';
import './product-reader.css';
import CataloguePagination from '../components/CataloguePagination';
import CatalogueMatrix from '../components/CatalogueMatrix';
import CatalogueSelectionStats from '../components/CatalogueSelectionStats';
import PharmacyGlyph, { PharmacyStack } from '../components/PharmacyGlyph';
import { useCatalogueDesktop } from '../components/useCatalogueDesktop';
const CatalogueAnalytics = lazy(() => import('../components/CatalogueAnalytics'));
const ReferenceLibrary = import.meta.env.DEV ? lazy(() => import('../components/ReferenceLibrary')) : null;
import { EvidenceBadge } from '../components/EvidenceControls';
import ClinicalReader from '../components/ClinicalReader.tsx';
import { useSmallScreen } from '../components/useSmallScreen.ts';
import {
  runFilter, facetCounts, shopCounts, summarise, sourceBreakdown,
  activeChips, EMPTY,
} from '../lib/filters.js';
import { loadListings, listingsFor, popcount } from '../lib/store.js';
import {
  Icon, Tag, Strip, Empty, Facet, Check, RangePair,
  n0, kes, compact, useVirtual,
} from '../components/ui.jsx';
import { useTip, useMeasure } from '../components/charts.jsx';

const ROW_H = 72;
const EMPTY_STATS = {clinical:0,oosAny:0,avgListed:0,withMono:0,price:{p10:null,p50:null,p90:null},prices:[],byType:[],byBand:[]};

/**
 * `minmax(0, …)` on the flexible column is what stops the grid pushing past
 * its container: a bare `3fr` track refuses to shrink below its content, so
 * long product names silently shove the right-hand columns out of view.
 * Fixed tracks are sized to their widest real value, not to their header.
 */
/**
 * Columns in order of what you give up first.
 *
 * The grid is the third column of a three-column shell, so at 1180px it gets
 * about 684px once the nav and facet rails are paid for — and 544px of fixed
 * tracks left the product name 45px wide, which is useless. Rather than pick
 * breakpoints against the viewport (which knows nothing about whether the
 * facet rail is open), each column declares the grid width it needs and the
 * set is chosen from the measured container.
 *
 * Product and Availability never drop: the name is the row's identity and the
 * strip is the reason the row is interesting.
 */
const COLUMNS = [
  { key: 'name', label: 'Product', sort: 'name', w: 'minmax(0, 3fr)', needs: 0 },
  { key: 'type', label: 'Class', sort: null, w: 'minmax(0, 96px)', needs: 820 },
  { key: 'strip', label: 'Availability', sort: null, w: '142px', needs: 0 },
  { key: 'listed', label: 'Listed', sort: 'listed', w: '52px', r: true, needs: 470 },
  { key: 'oos', label: 'Out', sort: 'oos', w: '48px', r: true, needs: 0 },
  { key: 'band', label: 'Band', sort: null, w: '72px', needs: 745 },
  { key: 'price', label: 'Median', sort: 'price', w: '78px', r: true, needs: 560 },
  { key: 'conf', label: 'Match', sort: 'conf', w: '56px', r: true, needs: 660 },
];

export default function Catalogue({ store, filters, setFilters, tipHost, controlsDock, controlsDocked, onDockChange }) {
  const { P, D, shops } = store;
  const [sort, setSort] = useState({ key: 'relevance', dir: 'desc' });
  const [selected, setSelected] = useState(null);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [view, setView] = useState('grid');
  const mobile = useSmallScreen();
  const rowHeight = mobile ? 104 : ROW_H;
  const desktop = useCatalogueDesktop();
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const showFacets = desktop ? controlsDocked : mobileControlsOpen;
  const setShowFacets = (open) => desktop ? onDockChange(open) : setMobileControlsOpen(open);
  const [analysisColumns, setAnalysisColumns] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const viewportRef = useRef(null);
  const scrollHeaderRef = useRef(null);
  const tip = useTip();

  const patch = (p) => setFilters({ ...filters, ...p });

  const { rows } = useMemo(() => runFilter(store, filters, sort), [store, filters, sort]);
  const [paging, setPaging] = useState({ rowSet: null, page: 0, size: 100 });
  const pageCount = paging.size ? Math.max(1, Math.ceil(rows.length / paging.size)) : 1;
  const page = paging.rowSet === rows ? Math.min(paging.page, pageCount - 1) : 0;
  const visibleRows = paging.size ? rows.slice(page * paging.size, (page + 1) * paging.size) : rows;
  const [showTop, setShowTop] = useState(false);
  useEffect(() => { viewportRef.current?.scrollTo({top:0}); }, [rows, page, paging.size, view]);
  const goPage = next => {
    setPaging({rowSet:rows,page:Math.max(0,Math.min(pageCount - 1,next)),size:paging.size});
    requestAnimationFrame(() => requestAnimationFrame(() => viewportRef.current?.querySelector('[data-product-index]')?.focus({preventScroll:true})));
  };
  const setPageSize = size => setPaging({rowSet:rows,page:0,size});
  const stats = useMemo(() => showFacets || summaryOpen || view==='charts' ? summarise(store, rows) : EMPTY_STATS, [store, rows,showFacets,summaryOpen,view]);
  const sources = useMemo(() => view==='charts' ? sourceBreakdown(store, rows) : [], [store, rows,view]);

  const typeN = useMemo(
    () => showFacets ? facetCounts(store, filters, 'types', D.type.length, (i) => P.type[i]) : [],
    [store, filters,showFacets],
  );
  const bandN = useMemo(
    () => showFacets ? facetCounts(store, filters, 'bands', D.band.length, (i) => P.band[i]) : [],
    [store, filters,showFacets],
  );
  const formN = useMemo(
    () => showFacets ? facetCounts(store, filters, 'forms', D.form.length, (i) => P.form[i]) : [],
    [store, filters,showFacets],
  );
  const matchN = useMemo(
    () => showFacets ? facetCounts(store, filters, 'matchBands', D.matchBand.length, (i) => P.matchBand[i]) : [],
    [store, filters,showFacets],
  );
  const gapN = useMemo(
    () => showFacets ? facetCounts(store, filters, 'gaps', D.gap.length, (i) => P.gap[i]) : [],
    [store, filters,showFacets],
  );
  const catN = useMemo(
    () => showFacets ? facetCounts(store, filters, 'categories', D.category.length, (i) => P.categories[i]) : [],
    [store, filters,showFacets],
  );
  const therN = useMemo(
    () => showFacets ? facetCounts(store, filters, 'therapeutic', D.therapeutic.length, (i) => P.therapeutic[i]) : [],
    [store, filters,showFacets],
  );
  const shopN = useMemo(() => showFacets ? shopCounts(store, filters, 'shopsAny') : {listed:[],inStock:[],oos:[]}, [store, filters,showFacets]);

  const chips = activeChips(filters, store);
  const range = useVirtual({ count: visibleRows.length, rowHeight, viewportRef, offsetRef: scrollHeaderRef });

  const toggle = (key, value) => {
    const cur = filters[key];
    patch({ [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] });
  };

  const topCategories = useMemo(() => (
    D.category
      .map((label, i) => ({ label, i, n: catN[i] }))
      .filter((c) => c.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 22)
  ), [D.category, catN]);

  const [gridRef, gridWidth] = useMeasure();
  // Until the container reports a width, assume it is wide: showing every
  // column then dropping some is far less jarring than the reverse.
  const columns = useMemo(
    () => mobile ? [COLUMNS[0], { ...COLUMNS[2], label: 'Stock / price', w: '118px' }] : analysisColumns ? COLUMNS.filter((c) => !c.needs || gridWidth === 0 || gridWidth >= c.needs) : [COLUMNS[0], { ...COLUMNS[2], label: 'Stock reports', w: '172px' }, ...(gridWidth > 820 ? [{ ...COLUMNS[3], label: 'Pharmacies', w: '112px' }] : []), { ...COLUMNS[6], label: 'Listed median', w: '132px' }],
    [gridWidth, mobile, analysisColumns],
  );
  const gridTemplate = columns.map((c) => c.w).join(' ');

  const reportingBits = shops.filter(shop => shop.publishes_oos).map(shop => shop.bit);
  const sameBits = (bits) => bits.length === reportingBits.length && reportingBits.every(bit => bits.includes(bit));
  const stockChoice = !filters.stockIn.length && !filters.stockOut.length ? 'all'
    : sameBits(filters.stockIn) && !filters.stockOut.length ? 'in'
    : sameBits(filters.stockOut) && !filters.stockIn.length ? 'out' : 'custom';

  const facetPanel = (
    <div className="catalogue-facets">
          <div className="facets">
            <div className="facet-body"><Check label="Show analysis columns" on={analysisColumns} onChange={() => setAnalysisColumns(!analysisColumns)} /></div>
            <Facet title="Product type" count={filters.types.length || null} defaultOpen>
              <label className="facet-opt" data-on={filters.clinicalOnly}
                style={{ marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--line-faint)' }}>
                <input type="checkbox" checked={filters.clinicalOnly}
                  onChange={(e) => patch({ clinicalOnly: e.target.checked })} />
                <span style={{ fontWeight: 500 }}>Medicines &amp; devices only</span>
                <span className="n">{compact(stats.clinical)}</span>
              </label>
              {D.type.map((label, i) => (
                <Check key={label} label={label.replace(/_/g, ' ')} n={typeN[i]}
                  on={filters.types.includes(i)} onChange={() => toggle('types', i)} />
              ))}
            </Facet>

            <Facet title="Therapeutic class" count={filters.therapeutic.length || null}>
              <div className="micro dim" style={{ marginBottom: 6 }}>
                From the drug register. Null where no ingredient matched — filtering here
                drops every unclassed product.
              </div>
              {D.therapeutic
                .map((label, i) => ({ label, i, n: therN[i] }))
                .filter((t) => t.n > 0)
                .sort((a, b) => b.n - a.n)
                .map((t) => (
                  <Check key={t.label} label={t.label} n={t.n}
                    on={filters.therapeutic.includes(t.i)} onChange={() => toggle('therapeutic', t.i)} />
                ))}
            </Facet>

            <Facet title="Stockout extent" count={filters.bands.length || null}>
              {['isolated', 'local', 'cluster', 'systemic', 'national', 'total', 'none']
                .map((name) => D.band.indexOf(name))
                .filter((i) => i >= 0)
                .map((i) => (
                  <Check key={D.band[i]} label={D.band[i]} n={bandN[i]}
                    on={filters.bands.includes(i)} onChange={() => toggle('bands', i)} />
                ))}
            </Facet>

            <Facet title="Pharmacies" count={
              (filters.shopsAny.length + filters.shopsAll.length + filters.stockIn.length + filters.stockOut.length) || null
            }>
              <div className="micro dim" style={{ marginBottom: 5 }}>Listed in any of</div>
              {shops.map((s) => (
                <Check key={s.pharmacy_id} label={<span className="catalogue-source-choice"><PharmacyGlyph id={s.pharmacy_id} size={26}/>{s.name}</span>} ariaLabel={`Listed at ${s.name}`} n={shopN.listed[s.bit]}
                  on={filters.shopsAny.includes(s.bit)} onChange={() => toggle('shopsAny', s.bit)} />
              ))}
              <details className="source-filter-group"><summary>Listed in every selected pharmacy</summary>
                {shops.map(shop => <Check key={shop.pharmacy_id} label={`All of · ${shop.name}`} on={filters.shopsAll.includes(shop.bit)} onChange={() => toggle('shopsAll', shop.bit)} />)}
              </details>
              <details className="source-filter-group"><summary>In stock at any selected pharmacy</summary>
                {shops.filter(shop => shop.publishes_oos).map(shop => <Check key={shop.pharmacy_id} label={`In stock · ${shop.name}`} on={filters.stockIn.includes(shop.bit)} onChange={() => toggle('stockIn', shop.bit)} />)}
              </details>
              <div className="micro dim" style={{ margin: '10px 0 5px' }}>Out of stock at</div>
              {shops.filter((s) => s.publishes_oos).map((s) => (
                <Check key={s.pharmacy_id} label={s.name} ariaLabel={`Out of stock at ${s.name}`} n={shopN.oos[s.bit]}
                  on={filters.stockOut.includes(s.bit)} onChange={() => toggle('stockOut', s.bit)} />
              ))}
            </Facet>

            <Facet title="Advanced · source counts" count={(filters.listedMin || filters.oosMin) ? 1 : null}>
              <div className="micro dim" style={{ marginBottom: 4 }}>Pharmacies listing</div>
              <RangePair label="pharmacies listing" min={filters.listedMin || null} max={filters.listedMax || null}
                onMin={(v) => patch({ listedMin: v ?? 0 })} onMax={(v) => patch({ listedMax: v ?? 0 })} />
              <div className="micro dim" style={{ margin: '10px 0 4px' }}>Pharmacies out of stock</div>
              <RangePair label="pharmacies out of stock" min={filters.oosMin || null} max={filters.oosMax || null}
                onMin={(v) => patch({ oosMin: v ?? 0 })} onMax={(v) => patch({ oosMax: v ?? 0 })} />
            </Facet>

            <Facet title="Listed price · KES" count={(filters.priceMin != null || filters.priceMax != null) ? 1 : null}>
              <RangePair label="listed median price in KES" min={filters.priceMin} max={filters.priceMax}
                onMin={(v) => patch({ priceMin: v })} onMax={(v) => patch({ priceMax: v })}
                placeholderMin="KES min" placeholderMax="KES max" />
              <div className="micro dim" style={{ marginTop: 8 }}>
                p10 {kes(stats.price.p10)} · median {kes(stats.price.p50)} · p90 {kes(stats.price.p90)}
              </div>
            </Facet>

            <Facet title="Form · tablet, cream and more" count={filters.forms.length || null}>
              {D.form.map((label, i) => (formN[i] ? (
                <Check key={label} label={label} n={formN[i]}
                  on={filters.forms.includes(i)} onChange={() => toggle('forms', i)} />
              ) : null))}
            </Facet>

            <Facet title="Pack format" count={filters.packKinds.length || null}>
              {D.packKind.map((label, index) => <Check key={label} label={label.replaceAll('_', ' ')} on={filters.packKinds.includes(index)} onChange={() => toggle('packKinds', index)} />)}
            </Facet>

            <Facet title="Advanced · source categories" count={filters.categories.length || null}>
              {topCategories.map((c) => (
                <Check key={c.label} label={c.label} n={c.n}
                  on={filters.categories.includes(c.i)} onChange={() => toggle('categories', c.i)} />
              ))}
            </Facet>

            <Facet title="Advanced · match confidence" count={filters.matchBands.length || null}>
              {D.matchBand.map((label, i) => (
                <Check key={label} label={label} n={matchN[i]}
                  on={filters.matchBands.includes(i)} onChange={() => toggle('matchBands', i)} />
              ))}
              <div className="micro dim" style={{ margin: '9px 0 3px' }}>
                Minimum confidence · {filters.confMin.toFixed(2)}
              </div>
              <input type="range" min="0" max="1" step="0.05" value={filters.confMin} aria-label="Minimum match confidence"
                onChange={(e) => patch({ confMin: Number(e.target.value) })} />
            </Facet>

            <Facet title="Advanced · reference coverage" count={
              (filters.gaps.length + (filters.monograph !== 'all' ? 1 : 0)) || null
            }>
              <div className="micro dim" style={{ marginBottom: 4 }}>DrugIndex reference link</div>
              <div className="seg" style={{ width: '100%', marginBottom: 9 }}>
                {[['all', 'Any'], ['with', 'Has'], ['without', 'None']].map(([v, l]) => (
                  <button key={v} style={{ flex: 1 }} aria-pressed={filters.monograph === v}
                    onClick={() => patch({ monograph: v })}>{l}</button>
                ))}
              </div>
              <div className="micro dim" style={{ marginBottom: 4 }}>Classification gap</div>
              {D.gap.map((label, i) => (gapN[i] ? (
                <Check key={label} label={label} n={gapN[i]}
                  on={filters.gaps.includes(i)} onChange={() => toggle('gaps', i)} />
              ) : null))}
            </Facet>

            <Facet title="Advanced · review status" count={filters.review !== 'all' ? 1 : null}>
              <div className="seg" style={{ width: '100%' }}>
                {[['all', 'All'], ['auto', 'Automatic'], ['needs_review', 'In review']].map(([v, l]) => (
                  <button key={v} style={{ flex: 1 }} aria-pressed={filters.review === v}
                    onClick={() => patch({ review: v })}>{l}</button>
                ))}
              </div>
              <label className="facet-opt" style={{ marginTop: 8 }} data-on={filters.contested}>
                <input type="checkbox" checked={filters.contested}
                  onChange={(e) => patch({ contested: e.target.checked })} />
                <span>Contested classification</span>
              </label>
            </Facet>
          </div>
        </div>
  );

  const catalogueHeading = catalogueContext(filters, store.D, shops);
  const resultHeader = (<CatalogueToolbar title={catalogueHeading.title} description={catalogueHeading.description} filters={filters} shops={shops} count={rows.length} total={P.n} stockChoice={stockChoice} sort={sort} onSort={setSort} pageSize={paging.size} onPageSize={setPageSize} view={view} onView={setView} onPatch={patch} onRefine={() => setShowFacets(!showFacets)} controlsOpen={showFacets} onReset={() => setFilters({ ...EMPTY })} chips={chips}/>);

  return (
    <div className="catalogue-shell">
      {tip.node}

      {showFacets && desktop && controlsDock && createPortal(<aside className="catalogue-control-extension" id="catalogue-controls" aria-label="Catalogue controls">
        <header className="catalogue-extension-head"><div><h2>Refine catalogue.</h2><p>Scope &amp; evidence</p></div><button aria-label="Collapse catalogue controls" onClick={() => setShowFacets(false)}><Icon name="x" size={18}/></button></header>
        <div className="catalogue-extension-scroll">
          <CatalogueToolbar mode="controls" onReference={ReferenceLibrary ? () => setReferenceOpen(true) : undefined} tone={desktop ? "inverse" : "light"} filters={filters} shops={shops} count={rows.length} total={P.n} stockChoice={stockChoice} sort={sort} onSort={setSort} pageSize={paging.size} onPageSize={setPageSize} view={view} onView={setView} onPatch={patch} onRefine={() => setShowFacets(false)} onReset={() => setFilters({ ...EMPTY })} chips={chips}/>
          <CatalogueSelectionStats stats={stats} onToggle={setSummaryOpen}/>{facetPanel}
        </div>
      </aside>, controlsDock)}
      {showFacets && !desktop && <CatalogueFilterWorkspace count={rows.length} activeCount={chips.length} onClose={() => setShowFacets(false)} onReset={() => setFilters({ ...EMPTY })}>
        <div id="catalogue-controls"><CatalogueToolbar mode="controls" onReference={ReferenceLibrary ? () => setReferenceOpen(true) : undefined} tone={desktop ? "inverse" : "light"} filters={filters} shops={shops} count={rows.length} total={P.n} stockChoice={stockChoice} sort={sort} onSort={setSort} pageSize={paging.size} onPageSize={setPageSize} view={view} onView={setView} onPatch={patch} onRefine={() => setShowFacets(false)} onReset={() => setFilters({ ...EMPTY })} chips={chips}/><CatalogueSelectionStats stats={stats} onToggle={setSummaryOpen}/>{facetPanel}</div>
      </CatalogueFilterWorkspace>}
      <div className="catalogue-main" ref={gridRef} onScrollCapture={e => { if(e.target === viewportRef.current) setShowTop(e.target.scrollTop > 360); }}>


        {/* body */}
        {rows.length === 0 ? (
          <div ref={viewportRef} className="scroll">{resultHeader}<Empty
            title="Nothing matches those filters"
            note="Try a shorter product name, another ingredient, or clear a pharmacy or price filter."
            action={<button className="btn" onClick={() => setFilters({ ...EMPTY })}>Reset filters</button>}
          /></div>
        ) : view === 'charts' ? (
          <div ref={viewportRef} className="scroll">{resultHeader}<Suspense fallback={<p className="catalogue-analysis-loading" role="status">Loading selection charts…</p>}><CatalogueAnalytics stats={stats} sources={sources} total={rows.length} types={D.type} bandLabels={D.band} selectedTypes={filters.types} selectedBands={filters.bands} selectedSources={filters.shopsAny} onType={index => toggle('types',index)} onBand={index => toggle('bands',index)} onSource={bit => toggle('shopsAny',bit)}/></Suspense></div>
        ) : view === 'matrix' ? (
          <div ref={viewportRef} className="scroll">{resultHeader}<CatalogueMatrix store={store} rows={rows} onPick={setSelected}/></div>
        ) : (
          <div ref={viewportRef} className="scroll catalogue-grid-scroll" role="region" aria-label="Product results" tabIndex={0}>
            <div ref={scrollHeaderRef} className="catalogue-scroll-header">{resultHeader}
            <div className="catalogue-grid-head" style={{ gridTemplateColumns: gridTemplate }}>
              {columns.map((c) => (
                <button key={c.key}
                  className="eyebrow trunc"
                  style={{
                    textAlign: c.r ? 'right' : 'left',
                    cursor: c.sort ? 'pointer' : 'default',
                    color: sort.key === c.sort ? 'var(--ink)' : undefined,
                  }}
                  onClick={() => c.sort && setSort({
                    key: c.sort,
                    dir: sort.key === c.sort && sort.dir === 'desc' ? 'asc' : 'desc',
                  })}
                >
                  {c.label}
                  {sort.key === c.sort && (
                    <span style={{ color: 'var(--accent)', marginLeft: 3 }}>
                      {sort.dir === 'desc' ? '↓' : '↑'}
                    </span>
                  )}
                </button>
              ))}
            </div>

            </div>
              <div style={{ height: visibleRows.length * rowHeight, position: 'relative' }}>
                <div style={{ transform: `translateY(${range.start * rowHeight}px)` }}>
                  {visibleRows.slice(range.start, range.end).map((i) => (
                    <Row key={P.key[i]} store={store} i={i} tip={tip} analysis={analysisColumns && !mobile} mobile={mobile}
                      template={gridTemplate} columns={columns}
                      active={selected === i}
                      onSelect={() => setSelected(i)}
                      onMove={(direction) => { const index = Math.max(0, Math.min(visibleRows.length - 1, visibleRows.indexOf(i) + direction)); viewportRef.current.scrollTop = Math.max(0, index * rowHeight + (scrollHeaderRef.current?.offsetHeight ?? 0) - rowHeight); requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector(`[data-product-index="${visibleRows[index]}"]`)?.focus())); }} />
                  ))}
                </div>
              </div>
              <CataloguePagination page={page} size={paging.size} total={rows.length} onPage={goPage}/>
            </div>
        )}
        {showTop && <button className="catalogue-back-top" aria-label="Back to top" onClick={() => { viewportRef.current?.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}); viewportRef.current?.querySelector('h1')?.focus({preventScroll:true}); }}><Icon name="up-to-line" size={21}/></button>}
      </div>

      {selected != null && (
        <Detail store={store} i={selected} onClose={() => setSelected(null)}
          onPick={setSelected} tip={tip} />
      )}
      {referenceOpen && ReferenceLibrary && <Suspense fallback={<p role="status">Opening reference library…</p>}><ReferenceLibrary onClose={() => setReferenceOpen(false)}/></Suspense>}
    </div>
  );
}

/* ------------------------------------------------------------------ row - */

/**
 * Cells are keyed by column so the row renders exactly the set the header
 * chose. Positional children would silently shift into the wrong tracks the
 * moment a column drops out at a narrow width.
 */
const CELL = {
  name: ({ P, D, i }) => (
    <span className="product-cell">
      <span className="product-name">{P.name[i]}</span>
      {P.ingredient[i] >= 0 && <span className="product-ingredient">{D.ingredient[P.ingredient[i]]}</span>}
    </span>
  ),
  type: ({ P, D, i }) => (
    <div className="trunc tiny" style={{ color: P.clinical[i] ? 'var(--ink)' : 'var(--ink-3)' }}>
      {D.type[P.type[i]].replace(/_/g, ' ')}
    </div>
  ),
  strip: ({ store, P, i, tip }) => (
    <span><span className="compact-evidence"><b>{popcount(P.inMask[i])} in · {popcount(P.oosMask[i])} out</b><span className="num">{kes(P.priceMed[i])}</span><span>{P.nListed[i]} sources listing</span></span><span className="desktop-evidence">{popcount(P.inMask[i])} in stock · {popcount(P.oosMask[i])} out</span><Strip store={store} listedMask={P.listedMask[i]} inMask={P.inMask[i]} oosMask={P.oosMask[i]}
      onHover={(e, s, cls) => tip.show(e, (
        <><b>{s.name}</b><br />{
          cls === 'cell-none' ? 'not listed'
            : cls === 'cell-out' ? 'out of stock'
              : cls === 'cell-in' ? 'in stock' : 'no stock signal'
        }</>
      ))}
      onLeave={tip.hide}
    /></span>
  ),
  listed: ({ P, i }) => <div className="num tiny" style={{ textAlign: 'right' }}>{P.nListed[i]}</div>,
  oos: ({ P, i }) => (
    <div className="num tiny" style={{ textAlign: 'right', color: P.nOos[i] ? 'var(--out)' : 'var(--ink-4)' }}>
      {P.nOos[i] || '—'}
    </div>
  ),
  band: ({ P, D, i }) => {
    const band = D.band[P.band[i]];
    return (
      <div className="tiny trunc">
        {band !== 'none' && <Tag tone={P.nOos[i] >= 3 ? 'out' : 'plain'}>{band}</Tag>}
      </div>
    );
  },
  price: ({ P, i }) => (
    <div className="num tiny" style={{ textAlign: 'right' }}>
      {kes(P.priceMed[i])}
    </div>
  ),
  conf: ({ P, i }) => {
    const c = P.matchConf[i];
    return (
      <div className="num tiny" style={{
        textAlign: 'right',
        color: c >= 0.8 ? 'var(--ink-2)' : c >= 0.55 ? 'var(--warn)' : 'var(--out)',
      }}>{c.toFixed(2)}</div>
    );
  },
};

function Row({ store, i, template, columns, active, onSelect, onMove, tip, analysis, mobile }) {
  const { P, D } = store;
  if (!analysis) return <CatalogueResultRow pharmacies={store.shops.filter(s => P.listedMask[i] & (1 << s.bit))} index={i} name={P.name[i]} ingredient={P.ingredient[i] >= 0 ? D.ingredient[P.ingredient[i]] : null} sourceCount={P.nListed[i]} inStock={popcount(P.inMask[i])} out={popcount(P.oosMask[i])} price={P.priceMed[i]} active={active} onSelect={onSelect} onMove={onMove} template={mobile ? undefined : template} showSources={!mobile && columns.some(c => c.key === 'listed')} />;
  return (
    <button
      type="button"
      aria-label={`${P.name[i]}; ${popcount(P.inMask[i])} sources report in stock; ${popcount(P.oosMask[i])} out of ${P.nEligible[i]} reporting sources out of stock; median ${kes(P.priceMed[i])}`}
      data-product-index={i}
      onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); onMove(event.key === 'ArrowDown' ? 1 : -1); } }}
      onClick={onSelect}
      className="catalogue-row"
      data-active={active}
      style={{ gridTemplateColumns: template }}
    >
      {columns.map((c) => {
        const Cell = CELL[c.key];
        return Cell ? <Cell key={c.key} store={store} P={P} D={D} i={i} tip={tip} /> : null;
      })}
    </button>
  );
}

/* --------------------------------------------------------------- detail - */

function Detail({ store, i, onClose, onPick, tip }) {
  const notify = useToast();
  const { P, D } = store;

  // Same molecule, ranked by how many sources actually have it. Capped: a long
  // list of near-identical SKUs is noise, and the top few answer the question.
  const substitutes = useMemo(() => {
    const a = P.ingredient[i];
    if (a < 0) return [];
    return (store.byIngredient?.get(a) ?? [])
      .filter((j) => j !== i)
      .sort((x, y) => popcount(P.inMask[y]) - popcount(P.inMask[x]) || P.nListed[y] - P.nListed[x])
      .slice(0, 6);
  }, [store, P, i]);
  const [listings, setListings] = useState(() => (store.listings ? listingsFor(store, i) : null));
  const [loading, setLoading] = useState(!store.listings);
  const [listingError, setListingError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Listing detail is fetched lazily, so the drawer resolves it on open and
  // falls back to fetching if the background load has not landed yet.
  useEffect(() => {
    let alive = true;
    if (store.listings) {
      setListings(listingsFor(store, i));
      setLoading(false);
      return () => { alive = false; };
    }
    setLoading(true);
    setListingError(false);
    loadListings(store)
      .then(() => { if (alive) { setListings(listingsFor(store, i)); setLoading(false); if (attempt > 0) notify({ title: 'Pharmacy reports loaded', key: 'source-listings' }); } })
      .catch(() => { if (alive) { setLoading(false); setListingError(true); notify({ tone: 'error', title: 'Pharmacy reports could not load', description: 'Use Retry source listings in this panel.', key: 'source-listings' }); } });
    return () => { alive = false; };
  }, [store, i, attempt, notify]);

  const band = D.band[P.band[i]];
  const [section, setSection] = useState('product-listings');
  const jumpTo = id => {
    setSection(id);
    requestAnimationFrame(() => { const target=document.getElementById(id); if(!target)return; if(target.tagName==='DETAILS')target.open=true; target.focus({preventScroll:true}); });
  };
  const namedSources = store.shops.filter(shop => P.listedMask[i] & (1 << shop.bit));

  return (
    <Modal className="drawer product-reader" labelledBy="product-title" onClose={onClose}>
      <header className="product-reader-head">
        <div className="product-reader-heading"><h2 id="product-title">{P.name[i]}</h2><p>{P.ingredient[i]>=0 ? D.ingredient[P.ingredient[i]] : 'Active ingredient not linked in the local reference'}</p></div>
        <button className="product-reader-close" aria-label="Close" onClick={onClose}><Icon name="x" size={19}/></button>
        <div className="product-reader-badges"><EvidenceBadge tone={P.clinical[i] ? 'teal':'neutral'}>{D.type[P.type[i]].replaceAll('_',' ')}</EvidenceBadge>{band!=='none'&&<EvidenceBadge tone={P.nOos[i]>=3?'out':'neutral'}>{band}</EvidenceBadge>}{D.review[P.review[i]]==='needs_review'&&<EvidenceBadge tone="amber">Needs review</EvidenceBadge>}{P.contested[i]===1&&<EvidenceBadge tone="amber">Contested class</EvidenceBadge>}</div>
      </header>
      <nav className="product-reader-nav" aria-label="Product detail sections"><button aria-pressed={section==='product-listings'} onClick={()=>jumpTo('product-listings')}>Pharmacy listings</button>{P.ingredient[i]>=0&&<button aria-pressed={section==='product-reference'} onClick={()=>jumpTo('product-reference')}>Clinical reference</button>}<button aria-pressed={section==='product-identity'} onClick={()=>jumpTo('product-identity')}>Product identity</button></nav>
      <div className="product-reader-content">
        <div className="product-reader-main">
          <div hidden={section!=='product-listings'}>          <div className="product-evidence-panel" id="product-listings" tabIndex={-1}><h3>Pharmacy listings &amp; prices</h3>
          <p className="reader-intro">Each row is a collected listing. “Stock not reported” means the source does not provide a usable stock signal.</p>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[0, 1, 2].map((k) => <div key={k} className="sk" style={{ height: 34 }} />)}
            </div>
          ) : listingError ? <div className="feedback" role="alert"><p>Source listings could not load for this snapshot. Try loading them again.</p><button className="btn" onClick={() => setAttempt(a => a + 1)}>Retry source listings</button></div> : (
            <ul className="source-observations" aria-label="Pharmacy listings and prices">
              {listings?.map((listing, key) => <li className="source-observation" key={key}>
                <div className="observation-identity"><PharmacyGlyph id={listing.shop.pharmacy_id} size={36}/><div><h4>{listing.shop.name}</h4><span className="observation-name">{listing.rawName}</span></div></div>
                <div className="observation-evidence"><EvidenceBadge tone={listing.state === 'in_stock' ? 'in' : listing.state === 'out_of_stock' ? 'out' : 'neutral'}>{listing.state === 'in_stock' ? 'In stock' : listing.state === 'out_of_stock' ? 'Out of stock' : 'Stock not reported'}</EvidenceBadge><span className="observation-price num">{kes(listing.price)}</span></div>
                {listing.url && /^https?:\/\//i.test(listing.url) && <a className="btn observation-link" href={listing.url} target="_blank" rel="noopener noreferrer" aria-label={`View listing at ${listing.shop.name}`}>View listing <Icon name="external" size={14} /></a>}
              </li>)}
            </ul>
          )}

          </div>

</div>
          <div hidden={section!=='product-reference'}>          {P.ingredient[i] >= 0 && (
            <div className="drawer-section">
              <h3>Drug register extract</h3>
              <dl className="kv">
                <dt>Active ingredient</dt>
                <dd>{D.ingredient[P.ingredient[i]]}</dd>
                {P.indications[i] >= 0 && (
                  <><dt>Indications</dt><dd>{D.indications[P.indications[i]]}</dd></>
                )}
                <dt>Therapeutic class</dt>
                <dd>{P.therapeutic[i] >= 0
                  ? D.therapeutic[P.therapeutic[i]]
                  : <span className="faint">not filed under a class upstream</span>}</dd>
              </dl>
            </div>
          )}
          {P.ingredient[i] >= 0 && <ClinicalReader key={D.ingredient[P.ingredient[i]]} ingredient={D.ingredient[P.ingredient[i]]} />}
</div>
          <div hidden={section!=='product-identity'}>          <details className="product-identity-panel" id="product-identity" tabIndex={-1}>
            <summary>Product identity &amp; matching details</summary>
            <dl className="kv">
            <dt>Match key</dt>
            <dd className="mono micro" style={{ wordBreak: 'break-all' }}>{P.key[i]}</dd>
            <dt>Match confidence</dt>
            <dd className="num">{P.matchConf[i].toFixed(3)} · {D.matchBand[P.matchBand[i]]}</dd>
            {P.matchFlags[i] >= 0 && (<><dt>Match notes</dt><dd className="tiny dim">{D.matchFlags[P.matchFlags[i]]}</dd></>)}
            {Number.isFinite(P.priceCv[i]) && (<><dt>Price spread</dt><dd className="num">cv {P.priceCv[i].toFixed(2)}</dd></>)}
            <dt>Dose form</dt>
            <dd>{P.form[i] >= 0 ? D.form[P.form[i]] : <span className="faint">not detected</span>}</dd>
            <dt>Pack</dt>
            <dd className="mono micro">{P.packSig[i] || <span className="faint">—</span>}</dd>
            <dt>Class confidence</dt>
            <dd className="num">{P.classConf[i].toFixed(2)}</dd>
              {P.gap[i] >= 0 && (<><dt>Classification gap</dt><dd><EvidenceBadge tone="amber">{D.gap[P.gap[i]]}</EvidenceBadge></dd></>)}
            </dl>
          </details>

          {substitutes.length > 0 && (
            <details className="product-related">
              <summary>Other products with this ingredient</summary>
              <table className="tbl">
                <tbody>
                  {substitutes.map((s) => (
                    <tr key={P.key[s]}>
                      <td style={{ paddingLeft: 0 }}>
                        <button className="table-action" onClick={() => { onPick?.(s); setSection("product-listings"); }}>{P.name[s]}</button>
                        <div className="trunc drawer-source-raw">
                          {popcount(P.inMask[s])} of {P.nListed[s]} sources report in stock
                        </div>
                      </td>
                      <td className="r" style={{ width: 86 }}>
                        {popcount(P.inMask[s]) > 0
                          ? <EvidenceBadge tone="in">{popcount(P.inMask[s])} in stock</EvidenceBadge>
                          : <EvidenceBadge tone="out">no in-stock reports</EvidenceBadge>}
                      </td>
                      <td className="num r" style={{ width: 62, fontSize: 'var(--text-xs)' }}>
                        {Number.isFinite(P.priceMed[s]) ? n0(P.priceMed[s]) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="tiny dim" style={{ marginTop: 10, lineHeight: 1.5 }}>
                These products share an active ingredient; their strength, form and pack may differ.
                Same molecule is not the same product — check strength and form before
                treating one as a substitute for another.
              </div>
            </details>
          )}

</div>
        </div>
        <aside className="product-reader-context" aria-label="Product snapshot context">
          <div className="product-context-price"><span>Listed median price</span><strong className="num">{kes(P.priceMed[i])}</strong><small>{Number.isFinite(P.priceMin[i]) ? 'Range KES '+n0(P.priceMin[i])+'–'+n0(P.priceMax[i]) : 'No positive listed price supplied'}</small></div>
          <div className="product-context-sources"><span>{P.nListed[i]} pharmacies listing</span><PharmacyStack shops={namedSources}/><p>of {store.shops.length} captured sources</p></div>
          <dl className="product-context-stock"><div><dt>Report in stock</dt><dd className="num" data-state="in">{popcount(P.inMask[i])}</dd></div><div><dt>Report out of stock</dt><dd className="num" data-state="out">{popcount(P.oosMask[i])}</dd></div><div><dt>Stock-reporting sources</dt><dd className="num">{P.nEligible[i]}</dd></div></dl>
          <div className="product-context-match"><span>Product match</span><strong className="num">{P.matchConf[i].toFixed(3)}</strong><small>{D.matchBand[P.matchBand[i]]} confidence · inspect identity tab</small></div>
          <p className="product-context-note"><Icon name="clock" size={16}/>Captured snapshot evidence; confirm current stock and price with the pharmacy.</p>
        </aside>
      </div>
    </Modal>
  );
}
