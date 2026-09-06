import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createBoard, fetchTemplates } from "../lib/api";
import { recordBoardVisit } from "../lib/boardHistory";
import type { TemplateDef } from "../lib/types";

export function CreateBoard() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateDef[]>([]);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTemplates().then((data) => {
      setTemplates(data);
      setTemplateId((current) => current || data[0]?.id || "");
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const board = await createBoard({ name, template: templateId });
      recordBoardVisit(board.id, board.name);
      navigate(`/retro/b/${board.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create board");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page page-narrow">
      <Link to="/retro" className="dashboard-link">
        ← Back to dashboard
      </Link>
      <h1>Sprint Retro</h1>
      <p className="subtitle">Create a board and share the link with your team.</p>

      <form onSubmit={handleSubmit} className="card-form">
        <label>
          Board name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sprint 42 Retro"
            required
          />
        </label>

        <label>
          Template
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={submitting || !templateId}>
          {submitting ? "Creating..." : "Create board"}
        </button>
      </form>
    </div>
  );
}
