import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as api from "../lib/api";
import { getBoardHistory, removeBoardFromHistory } from "../lib/boardHistory";
import type { BoardState, TemplateDef } from "../lib/types";

const PAGE_SIZE = 8;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type Phase = "closed" | "voting" | "open";

interface Row {
  id: string;
  name: string;
  templateLabel: string;
  teamSize: number;
  cardCount: number;
  phase: Phase;
  lastUpdated: number;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) {
    const n = Math.floor(diff / MINUTE);
    return `${n} minute${n === 1 ? "" : "s"} ago`;
  }
  if (diff < DAY) {
    const n = Math.floor(diff / HOUR);
    return `${n} hour${n === 1 ? "" : "s"} ago`;
  }
  if (diff < 30 * DAY) {
    const n = Math.floor(diff / DAY);
    return `${n} day${n === 1 ? "" : "s"} ago`;
  }
  return formatDate(ts);
}

function phaseLabel(phase: Phase): string {
  if (phase === "closed") return "Closed";
  if (phase === "voting") return "Voting";
  return "Open";
}

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("ellipsis");
    result.push(p);
    prev = p;
  }
  return result;
}

function TeamIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="6" cy="5" r="2.25" />
      <path d="M1.75 13c.4-2.4 2.1-3.75 4.25-3.75S9.85 10.6 10.25 13" />
      <circle cx="11.5" cy="5.5" r="1.75" />
      <path d="M10.75 9.5c1.8.1 3.1 1.3 3.5 3.5" />
    </svg>
  );
}

function CardsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2" />
      <path d="M1.75 6.25h12.5" />
      <path d="M6 6.25v7" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M13.5 13.5 10.6 10.6" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3 5 8l5 5" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 2.5v11M2.5 8h11" />
    </svg>
  );
}

function LogoMark() {
  return <img src="/logo.png" alt="" className="brand-logo-img" />;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<BoardState[] | null>(null);
  const [templates, setTemplates] = useState<TemplateDef[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.fetchTemplates().then(setTemplates);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const history = getBoardHistory();
      const results = await Promise.all(
        history.map(async (entry) => ({
          id: entry.id,
          visitedAt: entry.visitedAt,
          state: await api.fetchBoardState(entry.id).catch(() => null),
        }))
      );
      if (cancelled) return;

      const valid: (BoardState & { visitedAt: number })[] = [];
      for (const result of results) {
        if (result.state) valid.push({ ...result.state, visitedAt: result.visitedAt });
        else removeBoardFromHistory(result.id);
      }
      setEntries(valid);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo<Row[]>(() => {
    if (!entries) return [];
    return (entries as (BoardState & { visitedAt?: number })[]).map((state) => {
      const { board, cards, participants } = state;
      const phase: Phase = board.completed_at ? "closed" : board.locked ? "voting" : "open";
      const lastUpdated = board.completed_at ?? state.visitedAt ?? board.created_at;
      return {
        id: board.id,
        name: board.name,
        templateLabel: templates.find((t) => t.id === board.template)?.name ?? board.template,
        teamSize: participants.length,
        cardCount: cards.length,
        phase,
        lastUpdated,
      };
    });
  }, [entries, templates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.templateLabel.toLowerCase().includes(q))
      : rows;
    return [...base].sort((a, b) => b.lastUpdated - a.lastUpdated);
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  if (entries === null) {
    return (
      <div className="page">
        <div className="loading-state">Loading your sprints...</div>
      </div>
    );
  }

  return (
    <div className="page dashboard-page">
      <div className="dashboard-topbar">
        <div className="brand">
          <div className="brand-logo">
            <LogoMark />
          </div>
          <div className="brand-copy">
            <span className="brand-eyebrow">BTR.TECH</span>
            <h1 className="brand-title">Sprint Retrospectives</h1>
            <p className="brand-subtitle">Organized view of all team retrospectives</p>
          </div>
        </div>
        <Link to="/retro/new" className="btn-primary">
          <PlusIcon /> New Retro
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="dashboard-empty">
          <p>You haven't created or joined any boards on this browser yet.</p>
          <Link to="/retro/new" className="dashboard-link">
            Create your first board →
          </Link>
        </div>
      ) : (
        <>
          <div className="search-bar">
            <SearchIcon />
            <input
              className="search-input"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search boards or teams"
            />
          </div>

          <div className="table-card">
            <table className="retro-table">
              <thead>
                <tr>
                  <th>Board Name</th>
                  <th>Team Size</th>
                  <th>Cards</th>
                  <th>Current Phase</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="table-empty">
                      No boards match "{query}".
                    </td>
                  </tr>
                ) : (
                  pageItems.map((row) => (
                    <tr
                      key={row.id}
                      className={`table-row${row.phase === "voting" ? " row-highlight" : ""}`}
                      role="link"
                      tabIndex={0}
                      onClick={() => navigate(`/retro/b/${row.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") navigate(`/retro/b/${row.id}`);
                      }}
                    >
                      <td>
                        <div className="row-name">{row.name}</div>
                        <div className="row-sub">{row.templateLabel}</div>
                      </td>
                      <td>
                        <span className="stat-chip stat-chip-team">
                          <span className="stat-chip-icon">
                            <TeamIcon />
                          </span>
                          {row.teamSize}
                        </span>
                      </td>
                      <td>
                        <span className="stat-chip stat-chip-cards">
                          <span className="stat-chip-icon">
                            <CardsIcon />
                          </span>
                          {row.cardCount}
                        </span>
                      </td>
                      <td>
                        <span className={`phase-badge phase-${row.phase}`}>
                          <span className="phase-dot" />
                          {phaseLabel(row.phase)}
                        </span>
                      </td>
                      <td className="row-updated">{formatRelative(row.lastUpdated)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="table-footer">
              <span className="table-count">
                {filtered.length === 0
                  ? "No boards"
                  : `Showing ${start + 1}-${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length}`}
              </span>
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="page-btn"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    aria-label="Previous page"
                  >
                    <ChevronLeftIcon />
                  </button>
                  {getPageNumbers(safePage, totalPages).map((p, i) =>
                    p === "ellipsis" ? (
                      <span key={`e${i}`} className="page-ellipsis">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        className={`page-btn${p === safePage ? " active" : ""}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    className="page-btn"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label="Next page"
                  >
                    <ChevronRightIcon />
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
