import { nanoid } from "nanoid";
import { db } from "../../../../db/index.js";
import { ActionItemRow, BoardRow } from "../types.js";

const MAX_TEXT_LENGTH = 280;
const MAX_ASSIGNEE_LENGTH = 60;

export class ActionItemError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getBoard(boardId: string): BoardRow | undefined {
  return db.prepare(`SELECT * FROM boards WHERE id = ?`).get(boardId) as BoardRow | undefined;
}

function requireOpenBoard(boardId: string): BoardRow {
  const board = getBoard(boardId);
  if (!board) throw new ActionItemError(404, "board not found");
  if (board.completed_at) throw new ActionItemError(403, "this retro has been closed");
  return board;
}

function getActionItem(boardId: string, itemId: string): ActionItemRow | undefined {
  return db
    .prepare(`SELECT * FROM action_items WHERE id = ? AND board_id = ?`)
    .get(itemId, boardId) as ActionItemRow | undefined;
}

export function addActionItem(boardId: string, text: string, assignee: string | null): ActionItemRow {
  requireOpenBoard(boardId);

  const trimmedText = text.trim().slice(0, MAX_TEXT_LENGTH);
  if (!trimmedText) throw new ActionItemError(400, "text is required");

  const trimmedAssignee = assignee && assignee.trim() ? assignee.trim().slice(0, MAX_ASSIGNEE_LENGTH) : null;

  const id = nanoid();
  db.prepare(
    `INSERT INTO action_items (id, board_id, text, assignee, status) VALUES (?, ?, ?, ?, 'todo')`
  ).run(id, boardId, trimmedText, trimmedAssignee);

  return db.prepare(`SELECT * FROM action_items WHERE id = ?`).get(id) as ActionItemRow;
}

export interface ActionItemUpdate {
  text?: string;
  assignee?: string | null;
  status?: "todo" | "done";
}

export function updateActionItem(boardId: string, itemId: string, update: ActionItemUpdate): ActionItemRow {
  requireOpenBoard(boardId);
  const item = getActionItem(boardId, itemId);
  if (!item) throw new ActionItemError(404, "action item not found");

  const text = update.text !== undefined ? update.text.trim().slice(0, MAX_TEXT_LENGTH) : item.text;
  if (!text) throw new ActionItemError(400, "text is required");

  const assignee =
    update.assignee !== undefined
      ? update.assignee && update.assignee.trim()
        ? update.assignee.trim().slice(0, MAX_ASSIGNEE_LENGTH)
        : null
      : item.assignee;

  const status = update.status !== undefined ? update.status : item.status;
  if (status !== "todo" && status !== "done") throw new ActionItemError(400, "invalid status");

  db.prepare(`UPDATE action_items SET text = ?, assignee = ?, status = ? WHERE id = ?`).run(
    text,
    assignee,
    status,
    itemId
  );

  return db.prepare(`SELECT * FROM action_items WHERE id = ?`).get(itemId) as ActionItemRow;
}

export function deleteActionItem(boardId: string, itemId: string): void {
  requireOpenBoard(boardId);
  const item = getActionItem(boardId, itemId);
  if (!item) throw new ActionItemError(404, "action item not found");

  db.prepare(`DELETE FROM action_items WHERE id = ?`).run(itemId);
}
