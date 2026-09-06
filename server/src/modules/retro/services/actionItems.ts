import { nanoid } from "nanoid";
import { dbGet, dbRun } from "../../../../db/index.js";
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

async function getBoard(boardId: string): Promise<BoardRow | undefined> {
  return dbGet<BoardRow>(`SELECT * FROM boards WHERE id = ?`, [boardId]);
}

async function requireOpenBoard(boardId: string): Promise<BoardRow> {
  const board = await getBoard(boardId);
  if (!board) throw new ActionItemError(404, "board not found");
  if (board.completed_at) throw new ActionItemError(403, "this retro has been closed");
  return board;
}

async function getActionItem(boardId: string, itemId: string): Promise<ActionItemRow | undefined> {
  return dbGet<ActionItemRow>(`SELECT * FROM action_items WHERE id = ? AND board_id = ?`, [itemId, boardId]);
}

export async function addActionItem(
  boardId: string,
  text: string,
  assignee: string | null
): Promise<ActionItemRow> {
  await requireOpenBoard(boardId);

  const trimmedText = text.trim().slice(0, MAX_TEXT_LENGTH);
  if (!trimmedText) throw new ActionItemError(400, "text is required");

  const trimmedAssignee = assignee && assignee.trim() ? assignee.trim().slice(0, MAX_ASSIGNEE_LENGTH) : null;

  const id = nanoid();
  await dbRun(`INSERT INTO action_items (id, board_id, text, assignee, status) VALUES (?, ?, ?, ?, 'todo')`, [
    id,
    boardId,
    trimmedText,
    trimmedAssignee,
  ]);

  return (await dbGet<ActionItemRow>(`SELECT * FROM action_items WHERE id = ?`, [id]))!;
}

export interface ActionItemUpdate {
  text?: string;
  assignee?: string | null;
  status?: "todo" | "done";
}

export async function updateActionItem(
  boardId: string,
  itemId: string,
  update: ActionItemUpdate
): Promise<ActionItemRow> {
  await requireOpenBoard(boardId);
  const item = await getActionItem(boardId, itemId);
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

  await dbRun(`UPDATE action_items SET text = ?, assignee = ?, status = ? WHERE id = ?`, [
    text,
    assignee,
    status,
    itemId,
  ]);

  return (await dbGet<ActionItemRow>(`SELECT * FROM action_items WHERE id = ?`, [itemId]))!;
}

export async function deleteActionItem(boardId: string, itemId: string): Promise<void> {
  await requireOpenBoard(boardId);
  const item = await getActionItem(boardId, itemId);
  if (!item) throw new ActionItemError(404, "action item not found");

  await dbRun(`DELETE FROM action_items WHERE id = ?`, [itemId]);
}
