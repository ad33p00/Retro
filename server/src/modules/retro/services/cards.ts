import { nanoid } from "nanoid";
import { dbAll, dbGet, dbRun } from "../../../../db/index.js";
import { BoardRow, CardRow, ColumnRow, GroupRow, ParticipantRow } from "../types.js";

const MAX_CARD_LENGTH = 280;

export class CardError extends Error {
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
  if (!board) throw new CardError(404, "board not found");
  if (board.completed_at) throw new CardError(403, "this retro has been closed");
  return board;
}

async function getColumn(columnId: string, boardId: string): Promise<ColumnRow | undefined> {
  return dbGet<ColumnRow>(`SELECT * FROM columns WHERE id = ? AND board_id = ?`, [columnId, boardId]);
}

export async function getCardInBoard(cardId: string, boardId: string): Promise<CardRow | undefined> {
  return dbGet<CardRow>(
    `SELECT cards.* FROM cards
     JOIN columns ON columns.id = cards.column_id
     WHERE cards.id = ? AND columns.board_id = ?`,
    [cardId, boardId]
  );
}

async function getParticipant(participantId: string, boardId: string): Promise<ParticipantRow | undefined> {
  return dbGet<ParticipantRow>(`SELECT * FROM participants WHERE id = ? AND board_id = ?`, [participantId, boardId]);
}

function canModify(card: CardRow, participant: ParticipantRow): boolean {
  return card.author_participant_id === participant.id || Boolean(participant.is_facilitator);
}

export async function addCard(
  boardId: string,
  columnId: string,
  participantId: string,
  text: string
): Promise<CardRow> {
  const board = await requireOpenBoard(boardId);
  if (board.locked) throw new CardError(403, "adding cards is locked for this board");

  const column = await getColumn(columnId, boardId);
  if (!column) throw new CardError(404, "column not found");

  const participant = await getParticipant(participantId, boardId);
  if (!participant) throw new CardError(404, "participant not found");

  const trimmed = text.trim().slice(0, MAX_CARD_LENGTH);
  if (!trimmed) throw new CardError(400, "text is required");

  const id = nanoid();
  await dbRun(
    `INSERT INTO cards (id, column_id, author_participant_id, text, group_id, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)`,
    [id, columnId, participantId, trimmed, Date.now()]
  );

  return (await dbGet<CardRow>(`SELECT * FROM cards WHERE id = ?`, [id]))!;
}

export async function editCard(
  boardId: string,
  cardId: string,
  participantId: string,
  text: string
): Promise<CardRow> {
  await requireOpenBoard(boardId);
  const card = await getCardInBoard(cardId, boardId);
  if (!card) throw new CardError(404, "card not found");

  const participant = await getParticipant(participantId, boardId);
  if (!participant) throw new CardError(404, "participant not found");

  if (!canModify(card, participant)) throw new CardError(403, "not allowed to edit this card");

  const trimmed = text.trim().slice(0, MAX_CARD_LENGTH);
  if (!trimmed) throw new CardError(400, "text is required");

  await dbRun(`UPDATE cards SET text = ? WHERE id = ?`, [trimmed, cardId]);
  return (await dbGet<CardRow>(`SELECT * FROM cards WHERE id = ?`, [cardId]))!;
}

export async function deleteCard(boardId: string, cardId: string, participantId: string): Promise<void> {
  await requireOpenBoard(boardId);
  const card = await getCardInBoard(cardId, boardId);
  if (!card) throw new CardError(404, "card not found");

  const participant = await getParticipant(participantId, boardId);
  if (!participant) throw new CardError(404, "participant not found");

  if (!canModify(card, participant)) throw new CardError(403, "not allowed to delete this card");

  await dbRun(`DELETE FROM cards WHERE id = ?`, [cardId]);
}

export async function moveCard(boardId: string, cardId: string, columnId: string): Promise<CardRow> {
  await requireOpenBoard(boardId);
  const card = await getCardInBoard(cardId, boardId);
  if (!card) throw new CardError(404, "card not found");

  const column = await getColumn(columnId, boardId);
  if (!column) throw new CardError(404, "column not found");

  await dbRun(`UPDATE cards SET column_id = ? WHERE id = ?`, [columnId, cardId]);
  return (await dbGet<CardRow>(`SELECT * FROM cards WHERE id = ?`, [cardId]))!;
}

async function dissolveIfSingleton(groupId: string): Promise<CardRow | undefined> {
  const remaining = await dbAll<CardRow>(`SELECT * FROM cards WHERE group_id = ?`, [groupId]);
  if (remaining.length !== 1) return undefined;
  await dbRun(`UPDATE cards SET group_id = NULL WHERE id = ?`, [remaining[0].id]);
  await dbRun(`DELETE FROM groups WHERE id = ?`, [groupId]);
  return dbGet<CardRow>(`SELECT * FROM cards WHERE id = ?`, [remaining[0].id]);
}

export async function groupCards(boardId: string, sourceCardId: string, targetCardId: string): Promise<CardRow[]> {
  await requireOpenBoard(boardId);
  if (sourceCardId === targetCardId) throw new CardError(400, "cannot group a card with itself");

  const source = await getCardInBoard(sourceCardId, boardId);
  if (!source) throw new CardError(404, "card not found");
  const target = await getCardInBoard(targetCardId, boardId);
  if (!target) throw new CardError(404, "target card not found");

  if (source.group_id && source.group_id === target.group_id) {
    return [source, target];
  }

  const previousSourceGroupId = source.group_id;
  const isNewGroup = !target.group_id && !source.group_id;
  const groupId = target.group_id ?? source.group_id ?? nanoid();

  if (isNewGroup) {
    await dbRun(`INSERT INTO groups (id, board_id, name) VALUES (?, ?, '')`, [groupId, boardId]);
  }

  const affectedIds = new Set<string>();

  await dbRun(`UPDATE cards SET group_id = ?, column_id = ? WHERE id = ?`, [groupId, target.column_id, sourceCardId]);
  affectedIds.add(sourceCardId);

  if (target.group_id !== groupId) {
    await dbRun(`UPDATE cards SET group_id = ? WHERE id = ?`, [groupId, targetCardId]);
    affectedIds.add(targetCardId);
  }

  if (previousSourceGroupId && previousSourceGroupId !== groupId) {
    const dissolved = await dissolveIfSingleton(previousSourceGroupId);
    if (dissolved) affectedIds.add(dissolved.id);
  }

  const cards = await Promise.all(
    [...affectedIds].map((id) => dbGet<CardRow>(`SELECT * FROM cards WHERE id = ?`, [id]))
  );
  return cards.filter((c): c is CardRow => Boolean(c));
}

export async function renameGroup(boardId: string, groupId: string, name: string): Promise<GroupRow> {
  await requireOpenBoard(boardId);
  const group = await dbGet<GroupRow>(`SELECT * FROM groups WHERE id = ? AND board_id = ?`, [groupId, boardId]);
  if (!group) throw new CardError(404, "group not found");

  const trimmed = name.trim().slice(0, 60);
  await dbRun(`UPDATE groups SET name = ? WHERE id = ?`, [trimmed, groupId]);
  return (await dbGet<GroupRow>(`SELECT * FROM groups WHERE id = ?`, [groupId]))!;
}

export async function ungroupCard(boardId: string, cardId: string): Promise<CardRow[]> {
  await requireOpenBoard(boardId);
  const card = await getCardInBoard(cardId, boardId);
  if (!card) throw new CardError(404, "card not found");
  if (!card.group_id) return [card];

  const groupId = card.group_id;
  await dbRun(`UPDATE cards SET group_id = NULL WHERE id = ?`, [cardId]);

  const affectedIds = new Set<string>([cardId]);
  const dissolved = await dissolveIfSingleton(groupId);
  if (dissolved) affectedIds.add(dissolved.id);

  const cards = await Promise.all(
    [...affectedIds].map((id) => dbGet<CardRow>(`SELECT * FROM cards WHERE id = ?`, [id]))
  );
  return cards.filter((c): c is CardRow => Boolean(c));
}
