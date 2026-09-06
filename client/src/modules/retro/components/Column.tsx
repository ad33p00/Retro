import { useDroppable } from "@dnd-kit/core";
import type { ReactElement } from "react";
import type { Card, Column as ColumnType, Group, Participant, Vote } from "../lib/types";
import { AddCardForm } from "./AddCardForm";
import { CardItem } from "./CardItem";
import { GroupHeader } from "./GroupHeader";

interface ColumnProps {
  column: ColumnType;
  cards: Card[];
  groups: Group[];
  votes: Vote[];
  participantsById: Map<string, Participant>;
  currentParticipantId: string;
  isFacilitator: boolean;
  locked: boolean;
  readOnly: boolean;
  onAdd: (text: string) => void;
  onEdit: (cardId: string, text: string) => void;
  onDelete: (cardId: string) => void;
  onVote: (cardId: string) => void;
  onUnvote: (cardId: string) => void;
  onUngroup: (cardId: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
}

export function Column({
  column,
  cards,
  groups,
  votes,
  participantsById,
  currentParticipantId,
  isFacilitator,
  locked,
  readOnly,
  onAdd,
  onEdit,
  onDelete,
  onVote,
  onUnvote,
  onUngroup,
  onRenameGroup,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  function renderCard(card: Card) {
    const cardVotes = votes.filter((v) => v.card_id === card.id);
    const hasVoted = cardVotes.some((v) => v.participant_id === currentParticipantId);
    const isAuthor = card.author_participant_id === currentParticipantId;
    const voterNames = cardVotes.map((v) => participantsById.get(v.participant_id)?.display_name ?? "Anonymous");
    return (
      <CardItem
        key={card.id}
        card={card}
        author={card.author_participant_id ? participantsById.get(card.author_participant_id) : undefined}
        canModify={!readOnly && (isFacilitator || card.author_participant_id === currentParticipantId)}
        voteCount={cardVotes.length}
        voterNames={voterNames}
        isAuthor={isAuthor}
        hasVoted={hasVoted}
        isGrouped={Boolean(card.group_id)}
        readOnly={readOnly}
        onEdit={(text) => onEdit(card.id, text)}
        onDelete={() => onDelete(card.id)}
        onVote={() => onVote(card.id)}
        onUnvote={() => onUnvote(card.id)}
        onUngroup={() => onUngroup(card.id)}
      />
    );
  }

  const rendered = new Set<string>();
  const items: ReactElement[] = [];

  for (const card of cards) {
    if (rendered.has(card.id)) continue;

    if (card.group_id) {
      const members = cards.filter((c) => c.group_id === card.group_id);
      members.forEach((m) => rendered.add(m.id));
      const combinedVotes = members.reduce((sum, m) => sum + votes.filter((v) => v.card_id === m.id).length, 0);
      const groupId = card.group_id;
      const groupName = groups.find((g) => g.id === groupId)?.name ?? "";
      items.push(
        <div key={groupId} className="card-group">
          <GroupHeader
            name={groupName}
            memberCount={members.length}
            combinedVotes={combinedVotes}
            readOnly={readOnly}
            onRename={(name) => onRenameGroup(groupId, name)}
          />
          {members.map((m) => renderCard(m))}
        </div>
      );
    } else {
      rendered.add(card.id);
      items.push(renderCard(card));
    }
  }

  return (
    <div ref={setNodeRef} className={`column${isOver ? " column-over" : ""}`}>
      <div className="column-head">
        <h3>{column.title}</h3>
        <span className="count">{cards.length}</span>
      </div>
      <div className="col-cards">
        {items}
        <AddCardForm onAdd={onAdd} disabled={locked || readOnly} />
      </div>
    </div>
  );
}
