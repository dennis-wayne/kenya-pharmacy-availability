/**
 * Application shell.
 *
 * Filter state lives here and is mirrored into the URL, so any view of the
 * data is a link. That is not a nicety for an analyst tool -- it is how a
 * finding gets sent to someone else.
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { buildCsv } from './lib/export.js';
import { loadStore } from './lib/store-loader.js';
import { installAdaptiveFavicon } from './lib/favicon';
import { catalogueContext } from './lib/catalogue-context';
import { encodeFilters, decodeFilters } from './lib/filters.js';
import { Icon, fmtDate } from './components/ui.jsx';
import WorkspaceFooter from "./components/WorkspaceFooter.tsx";
import { useToast } from './components/Toast';




import './workspace.css';
import './console.css';
import './sections.css';
import './views/catalogue-overhaul.css';
import { ConsoleSidebar, ConsoleTopbar, destinations as NAV } from './components/ConsoleShell.tsx';
import OfflineNotice from './components/OfflineNotice.tsx';
import WorkspaceIntro from './components/WorkspaceIntro';
import WorkspaceView from './components/WorkspaceView';
const DesignSystem = import.meta.env.DEV ? lazy(() => import('./views/DesignSystem.tsx')) : null;
const DevAudit = import.meta.env.DEV ? lazy(() => import('./components/DevAudit.tsx')) : null;

function readUrl() {
  const p = new URLSearchParams(window.location.search);
  return { view: [...NAV.map(n => n.id), ...(import.meta.env.DEV ? ['design'] : [])].includes(p.get('v')) ? p.get('v') : 'overview', filters: decodeFilters(p), audit: import.meta.env.DEV && p.has('audit') };
}

const viewLoaders = {overview: () => import('./views/Overview.tsx'), catalogue: () => import('./views/Catalogue.jsx'), sources: () => import('./views/Sources.jsx'), quality: () => import('./views/Quality.jsx')};
const Overview = lazy(viewLoaders.overview);
const Catalogue = lazy(viewLoaders.catalogue);
const Sources = lazy(viewLoaders.sources);
const Quality = lazy(viewLoaders.quality);

export default function App() {
  const notify = useToast();
  const [exporting, setExporting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(installAdaptiveFavicon, []);
  const [store, setStore] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ stage: 'meta', progress: 0 });

  const initial = useMemo(readUrl, []);
  const [view, setView] = useState(initial.view);
  // Prepare only the active presentation alongside the verified data read.
  useEffect(() => { void viewLoaders[view]?.().catch(() => {}); }, [view]);
  const [filters, setFilters] = useState(initial.filters);
  const [controlsDock, setControlsDock] = useState(null);
  const [controlsDocked, setControlsDocked] = useState(true);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    loadStore((s) => { if(alive){setProgress(s);if(s.meta)setLoadingMeta(s.meta);} },controller.signal)
      .then((s) => {
        if (!alive) return;
        setStore(s);
        if (attempt > 0) notify({ title: 'Catalogue ready', description: 'Snapshot data verified and loaded.', key: 'load' });

      })
      .catch((e) => alive && setError(e));
    return () => { alive = false; controller.abort(); };
  }, [attempt, notify]);
  const navigate = useCallback((target) => {
    if (target !== view) {
      const params = encodeFilters(filters);
      if (target !== 'overview') params.set('v', target);
      if (import.meta.env.DEV && initial.audit) params.set('audit', '1');
      const query = params.toString();
      window.history.pushState(null, '', query ? `?${query}` : window.location.pathname);
    }
    setView(target);
  }, [view, filters, initial.audit]);

  // Mirror view and filters into the URL without stacking history entries.
  useEffect(() => {
    const p = encodeFilters(filters);
    if (view !== 'overview') p.set('v', view);
    if (import.meta.env.DEV && initial.audit) p.set('audit', '1');
    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [filters, view]);

  useEffect(() => {
    const onPop = () => { const u = readUrl(); setView(u.view); setFilters(u.filters); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // "/" focuses search from anywhere, as in every serious data tool.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing && !/input|textarea|select/i.test(e.target.tagName) && !e.target.isContentEditable && !document.querySelector('dialog[open]')) {
        e.preventDefault();
        navigate('catalogue');
        requestAnimationFrame(() => document.querySelector('[data-search] input')?.focus());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  useEffect(() => { document.title = view === 'catalogue' ? catalogueContext(filters, store?.D, store?.shops).title + ' · Catalogue · Praesto' : (NAV.find(n => n.id === view)?.label || 'Design system') + ' · Praesto'; }, [view, filters, store]);

  const copyLink = async () => {
    try { const url = new URL(window.location.href); const params = view === 'catalogue' ? encodeFilters(filters) : new URLSearchParams(); if (view !== 'overview') params.set('v', view); url.search = params.toString(); await navigator.clipboard.writeText(url.toString()); notify({ title: 'View link copied', description: view === 'catalogue' ? 'The link includes your current catalogue filters.' : 'The link opens this snapshot page.', key: 'copy' }); }
    catch { notify({ tone: 'error', title: 'Link could not be copied', description: 'Copy this view’s address from your browser bar.', key: 'copy' }); }
  };
  const handleExport = async () => {
    if (!store || exporting) return;
    setExporting(true);
    try { await new Promise(resolve => setTimeout(resolve, 0)); const count = exportCsv(store, view === 'catalogue' ? filters : decodeFilters(new URLSearchParams())); notify(count ? { title: 'CSV prepared', description: `${count.toLocaleString('en-KE')} products included in the download.`, key: 'export' } : { tone: 'info', title: 'No products to export', description: 'Adjust the filters to include some products.', key: 'export' }); }
    catch { notify({ tone: 'error', title: 'CSV could not be prepared', description: 'Try Export again.', key: 'export' }); }
    finally { setExporting(false); }
  };

  if (error) {
    const inconsistent = /Read-model (size|identity) mismatch/.test(error.message);
    return (
      <div className="empty" style={{ height: '100vh' }}>
        <Icon name="alert" size={22} />
        <div className="h2">{inconsistent ? 'This snapshot could not be verified' : 'The catalogue could not load'}</div>
        <p className="sub">{inconsistent ? 'Reload to get a consistent set of catalogue data.' : 'Check your connection, then try again.'}</p>
        <button className="btn btn-primary" onClick={() => { if (inconsistent) window.location.reload(); else { setError(null); setAttempt(value => value + 1); } }}>Retry loading</button>
      </div>
    );
  }

  const meta = store?.meta ?? loadingMeta;
  const snapshotDate = meta ? fmtDate(meta.headline.snapshot_at, { day: '2-digit', month: 'short', year: 'numeric' }) : 'Loading snapshot…';
  const snapshot = { id: meta?.run.snapshot_id ?? 'Loading…', date: snapshotDate, inferred: meta?.run.snapshot_at_inferred ?? false, contract: meta?.contract_version ?? '—', match: meta?.run.match_algo_version ?? '—', loading:!meta };

  return (
    <div className="app" data-ready={!!store} data-catalogue-controls={view === 'catalogue' && controlsDocked}>
      <a className="skip-link" href="#workspace">Skip to workspace</a>
      <ConsoleSidebar view={view} onNavigate={navigate} productCount={meta?.headline.products ?? null} sourceCount={meta?.headline.pharmacies ?? null} snapshot={snapshot} catalogueControlsOpen={controlsDocked} onToggleCatalogueControls={() => setControlsDocked(open => !open)} />

      <div className="console-control-dock" ref={setControlsDock} hidden={view !== 'catalogue' || !controlsDocked} />
      <main className="main" id="workspace" tabIndex={-1}>
        <OfflineNotice />
        <ConsoleTopbar view={view} query={filters.q} onHome={() => navigate('overview')} onSearch={(query) => { setFilters({ ...filters, q: query }); navigate('catalogue'); }} onExport={handleExport} onCopyLink={copyLink} exporting={exporting} exportReady={!!store && !exporting} snapshot={snapshot} />

        {view === 'catalogue' ? (
          <div className="catalogue-workspace">{store ? <WorkspaceView name="catalogue"><Catalogue store={store} filters={filters} setFilters={setFilters} controlsDock={controlsDock} controlsDocked={controlsDocked} onDockChange={setControlsDocked} /></WorkspaceView> : <Loading progress={progress} />}</div>
        ) : (
          <div className="scroll" key={view}>
            <WorkspaceIntro view={view} />
            {!store && <Loading progress={progress} />}
            {store && view === 'overview' && <WorkspaceView name="overview"><Overview store={store} onNavigate={navigate} setFilters={setFilters} /><WorkspaceFooter /></WorkspaceView>}
            {store && view === 'sources' && <WorkspaceView name="sources"><Sources store={store} onNavigate={navigate} setFilters={setFilters} /><WorkspaceFooter /></WorkspaceView>}
            {store && view === 'quality' && <WorkspaceView name="quality"><Quality store={store} onNavigate={navigate} setFilters={setFilters} /><WorkspaceFooter /></WorkspaceView>}
            {view === 'design' && DesignSystem && <Suspense fallback={<p>Loading component catalogue…</p>}><DesignSystem /></Suspense>}
            {store && view === 'design' && <WorkspaceFooter />}
          </div>
        )}
      </main>
      {DevAudit && new URLSearchParams(location.search).has('audit') && <Suspense fallback={null}><DevAudit /></Suspense>}
    </div>
  );
}

/* ------------------------------------------------------------- loading -- */

function Loading({ progress }) {
  const pct = Math.round(progress.progress * 100);
  return (
    <div className="empty app-loading" role="status" aria-live="polite">
      <p>Preparing catalogue data…</p>
      <div role="progressbar" aria-label="Loading catalogue" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ width: 200, height: 2, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${Math.max(6, pct)}%`, background: 'var(--accent)',
          transition: 'width .2s ease',
        }} />
      </div>
      <div className="micro faint mono">
        {progress.stage === 'meta' ? 'reading snapshot…' : `products ${pct}%`}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- export -- */

/** Exports exactly what is on screen, filters included, as CSV. */
function exportCsv(store, filters) {
    const result = buildCsv(store, filters);
    if (!result.count) return 0;
    const blob = new Blob([result.text], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kenya-pharmacy-${store.meta.run.snapshot_id}-${result.count}-products.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    return result.count;
}
