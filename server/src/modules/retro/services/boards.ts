import { nanoid } from "nanoid";
import { db } from "../../../../db/index.js";
import { listRetroSprints, publishRetroToClickUp } from "./clickupExport.js";
import {
  ActionItemRow,
  BoardRow,
  BoardState,
  CardRow,
  ColumnRow,
  GroupRow,
  ParticipantRow,
  TEMPLATES,
  TemplateId,
  VoteRow,
} from "../types.js";

export class BoardError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const MAX_TIMER_SECONDS = 60 * 60;

const PALETTE = [
  "#F94144",
  "#F3722C",
  "#F8961E",
  "#F9C74F",
  "#90BE6D",
  "#43AA8B",
  "#4D908E",
  "#577590",
  "#277DA1",
  "#9C6ADE",
];

export interface CreateBoardInput {
  name: string;
  template: TemplateId;
}

export function createBoard(input: CreateBoardInput): BoardRow {
  const templateDef = TEMPLATES.find((t) => t.id === input.template);
  if (!templateDef) throw new Error(`Unknown template: ${input.template}`);

  const boardId = nanoid(10);
  const createdAt = Date.now();

  const insertBoard = db.prepare(`
    INSERT INTO boards (id, name, template, created_at, locked, pin_hash, timer_ends_at, completed_at)
    VALUES (@id, @name, @template, @created_at, 0, NULL, NULL, NULL)
  `);
  const insertColumn = db.prepare(`
    INSERT INTO columns (id, board_id, title, order_index) VALUES (?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    insertBoard.run({
      id: boardId,
      name: input.name,
      template: input.template,
      created_at: createdAt,
    });
    templateDef.columns.forEach((title, i) => {
      insertColumn.run(nanoid(), boardId, title, i);
    });
  });
  tx();

  return getBoardRow(boardId)!;
}

export function getBoardRow(id: string): BoardRow | undefined {
  return db.prepare(`SELECT * FROM boards WHERE id = ?`).get(id) as BoardRow | undefined;
}

export function getBoardState(id: string): BoardState | undefined {
  const board = getBoardRow(id);
  if (!board) return undefined;

  const columns = db
    .prepare(`SELECT * FROM columns WHERE board_id = ? ORDER BY order_index`)
    .all(id) as ColumnRow[];

  const columnIds = columns.map((c) => c.id);
  const cards = columnIds.length
    ? (db
        .prepare(
          `SELECT * FROM cards WHERE column_id IN (${columnIds.map(() => "?").join(",")}) ORDER BY created_at`
        )
        .all(...columnIds) as CardRow[])
    : [];

  const cardIds = cards.map((c) => c.id);
  const votes = cardIds.length
    ? (db
        .prepare(`SELECT * FROM votes WHERE card_id IN (${cardIds.map(() => "?").join(",")})`)
        .all(...cardIds) as VoteRow[])
    : [];

  const actionItems = db
    .prepare(`SELECT * FROM action_items WHERE board_id = ?`)
    .all(id) as ActionItemRow[];

  const participants = db
    .prepare(`SELECT * FROM participants WHERE board_id = ?`)
    .all(id) as ParticipantRow[];

  const groups = db.prepare(`SELECT * FROM groups WHERE board_id = ?`).all(id) as GroupRow[];

  return { board, columns, cards, groups, votes, actionItems, participants };
}

export function joinBoard(boardId: string, displayName: string | null): ParticipantRow {
  const board = getBoardRow(boardId);
  if (!board) throw new Error("Board not found");

  const { c: count } = db
    .prepare(`SELECT COUNT(*) as c FROM participants WHERE board_id = ?`)
    .get(boardId) as { c: number };

  const id = nanoid();
  const color = PALETTE[count % PALETTE.length];
  const isFacilitator = count === 0 ? 1 : 0;

  db.prepare(
    `INSERT INTO participants (id, board_id, display_name, color, is_facilitator) VALUES (?, ?, ?, ?, ?)`
  ).run(id, boardId, displayName, color, isFacilitator);

  return db.prepare(`SELECT * FROM participants WHERE id = ?`).get(id) as ParticipantRow;
}

export function getParticipant(boardId: string, participantId: string): ParticipantRow | undefined {
  return db
    .prepare(`SELECT * FROM participants WHERE id = ? AND board_id = ?`)
    .get(participantId, boardId) as ParticipantRow | undefined;
}

function requireFacilitator(boardId: string, participantId: string): void {
  const participant = getParticipant(boardId, participantId);
  if (!participant) throw new BoardError(404, "participant not found");
  if (!participant.is_facilitator) throw new BoardError(403, "only the facilitator can do this");
}

export function assertBoardOpen(board: BoardRow): void {
  if (board.completed_at) throw new BoardError(403, "this retro has been closed");
}

function requireOpenBoard(boardId: string): BoardRow {
  const board = getBoardRow(boardId);
  if (!board) throw new BoardError(404, "board not found");
  assertBoardOpen(board);
  return board;
}

export function setLocked(boardId: string, participantId: string, locked: boolean): BoardRow {
  requireFacilitator(boardId, participantId);
  requireOpenBoard(boardId);

  db.prepare(`UPDATE boards SET locked = ? WHERE id = ?`).run(locked ? 1 : 0, boardId);
  return getBoardRow(boardId)!;
}

export function startTimer(boardId: string, participantId: string, durationSeconds: number): BoardRow {
  requireFacilitator(boardId, participantId);
  requireOpenBoard(boardId);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new BoardError(400, "durationSeconds must be a positive number");
  }

  const endsAt = Date.now() + Math.min(durationSeconds, MAX_TIMER_SECONDS) * 1000;
  db.prepare(`UPDATE boards SET timer_ends_at = ? WHERE id = ?`).run(endsAt, boardId);
  return getBoardRow(boardId)!;
}

export function stopTimer(boardId: string, participantId: string): BoardRow {
  requireFacilitator(boardId, participantId);
  requireOpenBoard(boardId);

  db.prepare(`UPDATE boards SET timer_ends_at = NULL WHERE id = ?`).run(boardId);
  return getBoardRow(boardId)!;
}

export async function closeBoard(
  boardId: string,
  participantId: string,
  clickupListId?: string
): Promise<BoardRow> {
  requireFacilitator(boardId, participantId);
  const board = getBoardRow(boardId);
  if (!board) throw new BoardError(404, "board not found");
  if (board.completed_at) throw new BoardError(400, "this retro is already closed");

  const sprints = await listRetroSprints();
  if (sprints.length > 0 && !sprints.some((s) => s.id === clickupListId)) {
    throw new BoardError(400, "select a sprint to close this retro");
  }

  db.prepare(`UPDATE boards SET completed_at = ? WHERE id = ?`).run(Date.now(), boardId);
  const updated = getBoardRow(boardId)!;

  const state = getBoardState(boardId);
  if (state) void publishRetroToClickUp(state, clickupListId ? { id: clickupListId, type: 6 } : undefined);

  return updated;
}
