import { Link } from "react-router-dom";

function LogoMark() {
  return <img src="/logo.png" alt="" className="brand-logo-img" />;
}

interface ModuleDef {
  key: string;
  name: string;
  description: string;
  href: string | null;
}

const MODULES: ModuleDef[] = [
  {
    key: "retro",
    name: "Sprint Retro",
    description: "Run live sprint retrospectives — cards, dot-voting, grouping, and action items.",
    href: "/retro",
  },
  {
    key: "rca",
    name: "RCA",
    description: "Root-cause analysis write-ups for incidents.",
    href: null,
  },
  {
    key: "release-notes",
    name: "Release Notes",
    description: "Draft and publish release notes per sprint.",
    href: null,
  },
  {
    key: "sprint-planning",
    name: "Sprint Planning",
    description: "Plan capacity and scope for the next sprint.",
    href: null,
  },
];

export function Home() {
  return (
    <div className="page dashboard-page">
      <div className="dashboard-topbar">
        <div className="brand">
          <div className="brand-logo">
            <LogoMark />
          </div>
          <div className="brand-copy">
            <span className="brand-eyebrow">BTR.TECH</span>
            <h1 className="brand-title">Team Tools</h1>
            <p className="brand-subtitle">Pick a module to get started.</p>
          </div>
        </div>
      </div>

      <div className="module-grid">
        {MODULES.map((mod) =>
          mod.href ? (
            <Link key={mod.key} to={mod.href} className="module-card">
              <h2>{mod.name}</h2>
              <p>{mod.description}</p>
            </Link>
          ) : (
            <div key={mod.key} className="module-card module-card-disabled">
              <span className="module-card-badge">Coming soon</span>
              <h2>{mod.name}</h2>
              <p>{mod.description}</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
