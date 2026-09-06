import { nanoid } from "nanoid";
import { db } from "../../../../db/index.js";
import { BoardRow, CardRow, ColumnRow, GroupRow, ParticipantRow } from "../types.js";

const MAX_CARD_LENGTH = 280;

export class CardError extends Error {
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
  if (!board) throw new CardError(404, "board not found");
  if (board.completed_at) throw new CardError(403, "this retro has been closed");
  return board;
}

function getColumn(columnId: string, boardId: string): ColumnRow | undefined {
  return db
    .prepare(`SELECT * FROM columns WHERE id = ? AND board_id = ?`)
    .get(columnId, boardId) as ColumnRow | undefined;
}

export function getCardInBoard(cardId: string, boardId: string): CardRow | undefined {
  return db
    .prepare(
      `SELECT cards.* FROM cards
       JOIN columns ON columns.id = cards.column_id
       WHERE cards.id = ? AND columns.board_id = ?`
    )
    .get(cardId, boardId) as CardRow | undefined;
}

function getParticipant(participantId: string, boardId: string): ParticipantRow | undefined {
  return db
    .prepare(`SELECT * FROM participants WHERE id = ? AND board_id = ?`)
    .get(participantId, boardId) as ParticipantRow | undefined;
}

function canModify(card: CardRow, participant: ParticipantRow): boolean {
  return card.author_participant_id === participant.id || Boolean(participant.is_facilitator);
}

export function addCard(boardId: string, columnId: string, participantId: string, text: string): CardRow {
  const board = requireOpenBoard(boardId);
  if (board.locked) throw new CardError(403, "adding cards is locked for this board");

  const column = getColumn(columnId, boardId);
  if (!column) throw new CardError(404, "column not found");

  const participant = getParticipant(participantId, boardId);
  if (!participant) throw new CardError(404, "participant not found");

  const trimmed = text.trim().slice(0, MAX_CARD_LENGTH);
  if (!trimmed) throw new CardError(400, "text is required");

  const id = nanoid();
  db.prepare(
    `INSERT INTO cards (id, column_id, author_participant_id, text, group_id, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)`
  ).run(id, columnId, participantId, trimmed, Date.now());

  return db.prepare(`SELECT * FROM cards WHERE id = ?`).get(id) as CardRow;
}

export function editCard(boardId: string, cardId: string, participantId: string, text: string): CardRow {
  requireOpenBoard(boardId);
  const card = getCardInBoard(cardId, boardId);
  if (!card) throw new CardError(404, "card not found");

  const participant = getParticipant(participantId, boardId);
  if (!participant) throw new CardError(404, "participant not found");

  if (!canModify(card, participant)) throw new CardError(403, "not allowed to edit this card");

  const trimmed = text.trim().slice(0, MAX_CARD_LENGTH);
  if (!trimmed) throw new CardError(400, "text is required");

  db.prepare(`UPDATE cards SET text = ? WHERE id = ?`).run(trimmed, cardId);
  return db.prepare(`SELECT * FROM cards WHERE id = ?`).get(cardId) as CardRow;
}

export function deleteCard(boardId: string, cardId: string, participantId: string): void {
  requireOpenBoard(boardId);
  const card = getCardInBoard(cardId, boardId);
  if (!card) throw new CardError(404, "card not found");

  const participant = getParticipant(participantId, boardId);
  if (!participant) throw new CardError(404, "participant not found");

  if (!canModify(card, participant)) throw new CardError(403, "not allowed to delete this card");

  db.prepare(`DELETE FROM cards WHERE id = ?`).run(cardId);
}

export function moveCard(boardId: string, cardId: string, columnId: string): CardRow {
  requireOpenBoard(boardId);
  const card = getCardInBoard(cardId, boardId);
  if (!card) throw new CardError(404, "card not found");

  const column = getColumn(columnId, boardId);
  if (!column) throw new CardError(404, "column not found");

  db.prepare(`UPDATE cards SET column_id = ? WHERE id = ?`).run(columnId, cardId);
  return db.prepare(`SELECT * FROM cards WHERE id = ?`).get(cardId) as CardRow;
}

function dissolveIfSingleton(groupId: string): CardRow | undefined {
  const remaining = db.prepare(`SELECT * FROM cards WHERE group_id = ?`).all(groupId) as CardRow[];
  if (remaining.length !== 1) return undefined;
  db.prepare(`UPDATE cards SET group_id = NULL WHERE id = ?`).run(remaining[0].id);
  db.prepare(`DELETE FROM groups WHERE id = ?`).run(groupId);
  return db.prepare(`SELECT * FROM cards WHERE id = ?`).get(remaining[0].id) as CardRow;
}

export function groupCards(boardId: string, sourceCardId: string, targetCardId: string): CardRow[] {
  requireOpenBoard(boardId);
  if (sourceCardId === targetCardId) throw new CardError(400, "cannot group a card with itself");

  const source = getCardInBoard(sourceCardId, boardId);
  if (!source) throw new CardError(404, "card not found");
  const target = getCardInBoard(targetCardId, boardId);
  if (!target) throw new CardError(404, "target card not found");

  if (source.group_id && source.group_id === target.group_id) {
    return [source, target];
  }

  const previousSourceGroupId = source.group_id;
  const isNewGroup = !target.group_id && !source.group_id;
  const groupId = target.group_id ?? source.group_id ?? nanoid();

  if (isNewGroup) {
    db.prepare(`INSERT INTO groups (id, board_id, name) VALUES (?, ?, '')`).run(groupId, boardId);
  }

  const affectedIds = new Set<string>();

  db.prepare(`UPDATE cards SET group_id = ?, column_id = ? WHERE id = ?`).run(groupId, target.column_id, sourceCardId);
  affectedIds.add(sourceCardId);

  if (target.group_id !== groupId) {
    db.prepare(`UPDATE cards SET group_id = ? WHERE id = ?`).run(groupId, targetCardId);
    affectedIds.add(targetCardId);
  }

  if (previousSourceGroupId && previousSourceGroupId !== groupId) {
    const dissolved = dissolveIfSingleton(previousSourceGroupId);
    if (dissolved) affectedIds.add(dissolved.id);
  }

  return [...affectedIds].map((id) => db.prepare(`SELECT * FROM cards WHERE id = ?`).get(id) as CardRow);
}

export function renameGroup(boardId: string, groupId: string, name: string): GroupRow {
  requireOpenBoard(boardId);
  const group = db
    .prepare(`SELECT * FROM groups WHERE id = ? AND board_id = ?`)
    .get(groupId, boardId) as GroupRow | undefined;
  if (!group) throw new CardError(404, "group not found");

  const trimmed = name.trim().slice(0, 60);
  db.prepare(`UPDATE groups SET name = ? WHERE id = ?`).run(trimmed, groupId);
  return db.prepare(`SELECT * FROM groups WHERE id = ?`).get(groupId) as GroupRow;
}

export function ungroupCard(boardId: string, cardId: string): CardRow[] {
  requireOpenBoard(boardId);
  const card = getCardInBoard(cardId, boardId);
  if (!card) throw new CardError(404, "card not found");
  if (!card.group_id) return [card];

  const groupId = card.group_id;
  db.prepare(`UPDATE cards SET group_id = NULL WHERE id = ?`).run(cardId);

  const affectedIds = new Set<string>([cardId]);
  const dissolved = dissolveIfSingleton(groupId);
  if (dissolved) affectedIds.add(dissolved.id);

  return [...affectedIds].map((id) => db.prepare(`SELECT * FROM cards WHERE id = ?`).get(id) as CardRow);
}
