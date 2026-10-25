const intros: Record<
  string,
  { eyebrow: string; title: string; description?: string }
> = {
  overview: {
    eyebrow: "Snapshot overview",
    title: "Product availability, at a glance.",
    description: "Reported product stock across the captured pharmacy network.",
  },
  catalogue: { eyebrow: "Product catalogue", title: "Find & compare" },
  sources: {
    eyebrow: "Pharmacy network",
    title: "Know your sources.",
    description:
      "Explore captured pharmacy catalogues, see which report stock, and open their product listings.",
  },
  quality: {
    eyebrow: "Evidence & limitations",
    title: "Understand the confidence.",
    description:
      "Understand what the data can support before acting on it. Check capture dates, source evidence and the limits of product matching and reference coverage.",
  },
};
export default function WorkspaceIntro({ view }: { view: string }) {
  const intro = intros[view];
  if (!intro) return null;
  return (
    <header className={`workspace-intro workspace-intro-${view}`}>
      {view !== "overview" && <div className="eyebrow">{intro.eyebrow}</div>}
      <h1 className="h1">{intro.title}</h1>
      {intro.description && <p className="sub">{intro.description}</p>}
    </header>
  );
}
