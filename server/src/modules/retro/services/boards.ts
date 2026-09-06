import { nanoid } from "nanoid";
import { client, dbAll, dbGet, dbRun } from "../../../../db/index.js";
import { listRetroSprints, publishRetroToClickUp } from "./clickupExport.js";
import {
  ActionItemRow,
  BoardRow,
  BoardState,
  BoardSummaryRow,
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

export async function createBoard(input: CreateBoardInput): Promise<BoardRow> {
  const templateDef = TEMPLATES.find((t) => t.id === input.template);
  if (!templateDef) throw new Error(`Unknown template: ${input.template}`);

  const boardId = nanoid(10);
  const createdAt = Date.now();

  await client.batch(
    [
      {
        sql: `INSERT INTO boards (id, name, template, created_at, locked, pin_hash, timer_ends_at, completed_at)
              VALUES (?, ?, ?, ?, 0, NULL, NULL, NULL)`,
        args: [boardId, input.name, input.template, createdAt],
      },
      ...templateDef.columns.map((title, i) => ({
        sql: `INSERT INTO columns (id, board_id, title, order_index) VALUES (?, ?, ?, ?)`,
        args: [nanoid(), boardId, title, i],
      })),
    ],
    "write"
  );

  return (await getBoardRow(boardId))!;
}

export async function getBoardRow(id: string): Promise<BoardRow | undefined> {
  return dbGet<BoardRow>(`SELECT * FROM boards WHERE id = ?`, [id]);
}

export async function listBoardSummaries(): Promise<BoardSummaryRow[]> {
  return dbAll<BoardSummaryRow>(
    `SELECT b.*,
        (SELECT COUNT(*) FROM participants p WHERE p.board_id = b.id) as team_size,
        (SELECT COUNT(*) FROM cards c JOIN columns col ON c.column_id = col.id WHERE col.board_id = b.id) as card_count
     FROM boards b
     ORDER BY b.created_at DESC`
  );
}

export async function getBoardState(id: string): Promise<BoardState | undefined> {
  const board = await getBoardRow(id);
  if (!board) return undefined;

  const columns = await dbAll<ColumnRow>(`SELECT * FROM columns WHERE board_id = ? ORDER BY order_index`, [id]);

  const columnIds = columns.map((c) => c.id);
  const cards = columnIds.length
    ? await dbAll<CardRow>(
        `SELECT * FROM cards WHERE column_id IN (${columnIds.map(() => "?").join(",")}) ORDER BY created_at`,
        columnIds
      )
    : [];

  const cardIds = cards.map((c) => c.id);
  const votes = cardIds.length
    ? await dbAll<VoteRow>(`SELECT * FROM votes WHERE card_id IN (${cardIds.map(() => "?").join(",")})`, cardIds)
    : [];

  const actionItems = await dbAll<ActionItemRow>(`SELECT * FROM action_items WHERE board_id = ?`, [id]);
  const participants = await dbAll<ParticipantRow>(`SELECT * FROM participants WHERE board_id = ?`, [id]);
  const groups = await dbAll<GroupRow>(`SELECT * FROM groups WHERE board_id = ?`, [id]);

  return { board, columns, cards, groups, votes, actionItems, participants };
}

export async function joinBoard(boardId: string, displayName: string | null): Promise<ParticipantRow> {
  const board = await getBoardRow(boardId);
  if (!board) throw new Error("Board not found");

  const countRow = await dbGet<{ c: number }>(`SELECT COUNT(*) as c FROM participants WHERE board_id = ?`, [
    boardId,
  ]);
  const count = countRow?.c ?? 0;

  const id = nanoid();
  const color = PALETTE[count % PALETTE.length];
  const isFacilitator = count === 0 ? 1 : 0;

  await dbRun(`INSERT INTO participants (id, board_id, display_name, color, is_facilitator) VALUES (?, ?, ?, ?, ?)`, [
    id,
    boardId,
    displayName,
    color,
    isFacilitator,
  ]);

  return (await dbGet<ParticipantRow>(`SELECT * FROM participants WHERE id = ?`, [id]))!;
}

export async function getParticipant(boardId: string, participantId: string): Promise<ParticipantRow | undefined> {
  return dbGet<ParticipantRow>(`SELECT * FROM participants WHERE id = ? AND board_id = ?`, [participantId, boardId]);
}

async function requireFacilitator(boardId: string, participantId: string): Promise<void> {
  const participant = await getParticipant(boardId, participantId);
  if (!participant) throw new BoardError(404, "participant not found");
  if (!participant.is_facilitator) throw new BoardError(403, "only the facilitator can do this");
}

export function assertBoardOpen(board: BoardRow): void {
  if (board.completed_at) throw new BoardError(403, "this retro has been closed");
}

async function requireOpenBoard(boardId: string): Promise<BoardRow> {
  const board = await getBoardRow(boardId);
  if (!board) throw new BoardError(404, "board not found");
  assertBoardOpen(board);
  return board;
}

export async function setLocked(boardId: string, participantId: string, locked: boolean): Promise<BoardRow> {
  await requireFacilitator(boardId, participantId);
  await requireOpenBoard(boardId);

  await dbRun(`UPDATE boards SET locked = ? WHERE id = ?`, [locked ? 1 : 0, boardId]);
  return (await getBoardRow(boardId))!;
}

export async function startTimer(
  boardId: string,
  participantId: string,
  durationSeconds: number
): Promise<BoardRow> {
  await requireFacilitator(boardId, participantId);
  await requireOpenBoard(boardId);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new BoardError(400, "durationSeconds must be a positive number");
  }

  const endsAt = Date.now() + Math.min(durationSeconds, MAX_TIMER_SECONDS) * 1000;
  await dbRun(`UPDATE boards SET timer_ends_at = ? WHERE id = ?`, [endsAt, boardId]);
  return (await getBoardRow(boardId))!;
}

export async function stopTimer(boardId: string, participantId: string): Promise<BoardRow> {
  await requireFacilitator(boardId, participantId);
  await requireOpenBoard(boardId);

  await dbRun(`UPDATE boards SET timer_ends_at = NULL WHERE id = ?`, [boardId]);
  return (await getBoardRow(boardId))!;
}

export async function closeBoard(
  boardId: string,
  participantId: string,
  clickupListId?: string
): Promise<BoardRow> {
  await requireFacilitator(boardId, participantId);
  const board = await getBoardRow(boardId);
  if (!board) throw new BoardError(404, "board not found");
  if (board.completed_at) throw new BoardError(400, "this retro is already closed");

  const sprints = await listRetroSprints();
  if (sprints.length > 0 && !sprints.some((s) => s.id === clickupListId)) {
    throw new BoardError(400, "select a sprint to close this retro");
  }

  await dbRun(`UPDATE boards SET completed_at = ? WHERE id = ?`, [Date.now(), boardId]);
  const updated = (await getBoardRow(boardId))!;

  const state = await getBoardState(boardId);
  if (state) void publishRetroToClickUp(state, clickupListId ? { id: clickupListId, type: 6 } : undefined);

  return updated;
}
