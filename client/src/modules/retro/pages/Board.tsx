import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as api from "../lib/api";
import { ActionItems } from "../components/ActionItems";
import { CloseRetroModal } from "../components/CloseRetroModal";
import { Column } from "../components/Column";
import { ExportMenu } from "../components/ExportMenu";
import { FacilitatorBar } from "../components/FacilitatorBar";
import { NamePrompt } from "../components/NamePrompt";
import { useBoardSocket } from "../hooks/useBoardSocket";
import { getStoredParticipantId, setStoredParticipantId } from "../lib/storage";
import type { BoardState, Participant, SprintOption } from "../lib/types";

type Status = "loading" | "not-found" | "needs-name" | "ready";

export function Board() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [board, setBoard] = useState<BoardState | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [sprints, setSprints] = useState<SprintOption[]>([]);
  const [sprintsLoading, setSprintsLoading] = useState(false);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  useEffect(() => {
    if (!boardId) return;
    let cancelled = false;

    async function load() {
      const boardState = await api.fetchBoardState(boardId!).catch(() => null);
      if (!boardState) {
        if (!cancelled) setStatus("not-found");
        return;
      }
      if (cancelled) return;
      setBoard(boardState);

      const storedId = getStoredParticipantId(boardId!);
      if (storedId) {
        const found = await api.fetchParticipant(boardId!, storedId).catch(() => null);
        if (found && !cancelled) {
          setParticipant(found);
          setStatus("ready");
          return;
        }
      }

      if (cancelled) return;
      // A closed retro is view-only for everyone, so skip the join prompt and let anyone browse it.
      setStatus(boardState.board.completed_at ? "ready" : "needs-name");
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  async function handleJoin(name: string) {
    if (!boardId) return;
    setJoining(true);
    try {
      const joined = await api.joinBoard(boardId, name);
      setStoredParticipantId(boardId, joined.id);
      setParticipant(joined);
      setStatus("ready");
    } finally {
      setJoining(false);
    }
  }

  const participantsById = useMemo(() => {
    const map = new Map<string, Participant>();
    board?.participants.forEach((p) => map.set(p.id, p));
    if (participant) map.set(participant.id, participant);
    return map;
  }, [board, participant]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useBoardSocket(boardId, participant?.id, {
    onCardAdded: (card) =>
      setBoard((prev) => (prev && !prev.cards.some((c) => c.id === card.id) ? { ...prev, cards: [...prev.cards, card] } : prev)),
    onCardEdited: (card) =>
      setBoard((prev) => (prev ? { ...prev, cards: prev.cards.map((c) => (c.id === card.id ? card : c)) } : prev)),
    onCardDeleted: (cardId) =>
      setBoard((prev) => (prev ? { ...prev, cards: prev.cards.filter((c) => c.id !== cardId) } : prev)),
    onCardMoved: (card) =>
      setBoard((prev) => (prev ? { ...prev, cards: prev.cards.map((c) => (c.id === card.id ? card : c)) } : prev)),
    onParticipantJoined: (p) =>
      setBoard((prev) =>
        prev && !prev.participants.some((x) => x.id === p.id) ? { ...prev, participants: [...prev.participants, p] } : prev
      ),
    onVoteCast: (vote) =>
      setBoard((prev) => (prev && !prev.votes.some((v) => v.id === vote.id) ? { ...prev, votes: [...prev.votes, vote] } : prev)),
    onVoteRetracted: (voteId) =>
      setBoard((prev) => (prev ? { ...prev, votes: prev.votes.filter((v) => v.id !== voteId) } : prev)),
    onGroupRenamed: (group) =>
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              groups: prev.groups.some((g) => g.id === group.id)
                ? prev.groups.map((g) => (g.id === group.id ? group : g))
                : [...prev.groups, group],
            }
          : prev
      ),
    onBoardUpdated: (updatedBoard) => setBoard((prev) => (prev ? { ...prev, board: updatedBoard } : prev)),
    onActionItemAdded: (item) =>
      setBoard((prev) =>
        prev && !prev.actionItems.some((i) => i.id === item.id) ? { ...prev, actionItems: [...prev.actionItems, item] } : prev
      ),
    onActionItemUpdated: (item) =>
      setBoard((prev) =>
        prev ? { ...prev, actionItems: prev.actionItems.map((i) => (i.id === item.id ? item : i)) } : prev
      ),
    onActionItemDeleted: (itemId) =>
      setBoard((prev) => (prev ? { ...prev, actionItems: prev.actionItems.filter((i) => i.id !== itemId) } : prev)),
  });

  async function handleAdd(columnId: string, text: string) {
    if (!boardId || !participant) return;
    try {
      const card = await api.addCard(boardId, columnId, participant.id, text);
      setBoard((prev) =>
        prev && !prev.cards.some((c) => c.id === card.id) ? { ...prev, cards: [...prev.cards, card] } : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add card");
    }
  }

  async function handleEdit(cardId: string, text: string) {
    if (!boardId || !participant) return;
    try {
      const card = await api.editCard(boardId, cardId, participant.id, text);
      setBoard((prev) => (prev ? { ...prev, cards: prev.cards.map((c) => (c.id === card.id ? card : c)) } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to edit card");
    }
  }

  async function handleDelete(cardId: string) {
    if (!boardId || !participant) return;
    try {
      await api.deleteCard(boardId, cardId, participant.id);
      setBoard((prev) => (prev ? { ...prev, cards: prev.cards.filter((c) => c.id !== cardId) } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete card");
    }
  }

  async function handleVote(cardId: string) {
    if (!boardId || !participant) return;
    try {
      const vote = await api.castVote(boardId, cardId, participant.id);
      setBoard((prev) =>
        prev && !prev.votes.some((v) => v.id === vote.id) ? { ...prev, votes: [...prev.votes, vote] } : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to vote");
    }
  }

  async function handleUnvote(cardId: string) {
    if (!boardId || !participant) return;
    try {
      const { id } = await api.retractVote(boardId, cardId, participant.id);
      setBoard((prev) => (prev ? { ...prev, votes: prev.votes.filter((v) => v.id !== id) } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retract vote");
    }
  }

  async function handleGroup(cardId: string, targetCardId: string) {
    if (!boardId) return;
    try {
      const updated = await api.groupCards(boardId, cardId, targetCardId);
      setBoard((prev) =>
        prev ? { ...prev, cards: prev.cards.map((c) => updated.find((u) => u.id === c.id) ?? c) } : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to group cards");
    }
  }

  async function handleUngroup(cardId: string) {
    if (!boardId) return;
    try {
      const updated = await api.ungroupCard(boardId, cardId);
      setBoard((prev) =>
        prev ? { ...prev, cards: prev.cards.map((c) => updated.find((u) => u.id === c.id) ?? c) } : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to ungroup card");
    }
  }

  async function handleRenameGroup(groupId: string, name: string) {
    if (!boardId) return;
    try {
      const group = await api.renameGroup(boardId, groupId, name);
      setBoard((prev) =>
        prev ? { ...prev, groups: prev.groups.map((g) => (g.id === group.id ? group : g)) } : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename group");
    }
  }

  async function handleToggleLock() {
    if (!boardId || !participant || !board) return;
    try {
      const updatedBoard = await api.setLocked(boardId, participant.id, !board.board.locked);
      setBoard((prev) => (prev ? { ...prev, board: updatedBoard } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update lock");
    }
  }

  async function handleStartTimer(minutes: number) {
    if (!boardId || !participant) return;
    try {
      const updatedBoard = await api.startTimer(boardId, participant.id, minutes * 60);
      setBoard((prev) => (prev ? { ...prev, board: updatedBoard } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start timer");
    }
  }

  async function handleStopTimer() {
    if (!boardId || !participant) return;
    try {
      const updatedBoard = await api.stopTimer(boardId, participant.id);
      setBoard((prev) => (prev ? { ...prev, board: updatedBoard } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop timer");
    }
  }

  function handleOpenCloseModal() {
    setCloseModalOpen(true);
    setCloseError(null);
    setSprintsLoading(true);
    api
      .fetchClickupSprints()
      .then((sprints) => {
        setSprints(sprints);
        setSelectedSprintId(sprints.find((s) => s.isCurrent)?.id ?? null);
      })
      .catch(() => setSprints([]))
      .finally(() => setSprintsLoading(false));
  }

  async function handleConfirmCloseBoard() {
    if (!boardId || !participant) return;
    setClosing(true);
    setCloseError(null);
    try {
      await api.closeBoard(boardId, participant.id, selectedSprintId ?? undefined);
      navigate("/retro");
    } catch (err) {
      setCloseError(err instanceof Error ? err.message : "Failed to close retro");
    } finally {
      setClosing(false);
    }
  }

  async function handleAddActionItem(text: string, assignee: string | null) {
    if (!boardId) return;
    try {
      const item = await api.addActionItem(boardId, text, assignee);
      setBoard((prev) =>
        prev && !prev.actionItems.some((i) => i.id === item.id)
          ? { ...prev, actionItems: [...prev.actionItems, item] }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add action item");
    }
  }

  async function handleUpdateActionItem(itemId: string, update: api.ActionItemUpdate) {
    if (!boardId) return;
    try {
      const item = await api.updateActionItem(boardId, itemId, update);
      setBoard((prev) =>
        prev ? { ...prev, actionItems: prev.actionItems.map((i) => (i.id === item.id ? item : i)) } : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update action item");
    }
  }

  async function handleDeleteActionItem(itemId: string) {
    if (!boardId) return;
    try {
      await api.deleteActionItem(boardId, itemId);
      setBoard((prev) => (prev ? { ...prev, actionItems: prev.actionItems.filter((i) => i.id !== itemId) } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete action item");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!boardId || !over || !board) return;
    const cardId = String(active.id);
    const overId = String(over.id);

    if (overId.startsWith("card:")) {
      const targetCardId = overId.slice("card:".length);
      if (targetCardId === cardId) return;
      await handleGroup(cardId, targetCardId);
      return;
    }

    const targetColumnId = overId;
    const card = board.cards.find((c) => c.id === cardId);
    if (!card || card.column_id === targetColumnId) return;

    setBoard((prev) =>
      prev ? { ...prev, cards: prev.cards.map((c) => (c.id === cardId ? { ...c, column_id: targetColumnId } : c)) } : prev
    );
    try {
      await api.moveCard(boardId, cardId, targetColumnId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move card");
      setBoard((prev) =>
        prev ? { ...prev, cards: prev.cards.map((c) => (c.id === cardId ? { ...c, column_id: card.column_id } : c)) } : prev
      );
    }
  }

  if (status === "not-found") {
    return (
      <div className="page">
        <h1>Board not found</h1>
        <p>Check the link and try again.</p>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="page">
        <div className="loading-state">Loading board...</div>
      </div>
    );
  }

  if (status === "needs-name") {
    return <NamePrompt boardName={board.board.name} onSubmit={handleJoin} submitting={joining} />;
  }

  const isClosed = Boolean(board.board.completed_at);

  return (
    <div className="page">
      <header className="board-header">
        <div>
          <Link to="/retro" className="dashboard-link" style={{ display: "block", marginBottom: 4 }}>
            ← Back to dashboard
          </Link>
          <h1>{board.board.name}</h1>
        </div>
        <div className="header-right">
          <ExportMenu boardId={board.board.id} />
          {participant && (
            <div className="participant-badge" style={{ backgroundColor: participant.color }}>
              {participant.display_name}
              {participant.is_facilitator ? " (Facilitator)" : ""}
            </div>
          )}
        </div>
      </header>

      <div className="participants-row">
        {board.participants.map((p) => (
          <span
            key={p.id}
            className="avatar-dot"
            style={{ backgroundColor: p.color }}
            title={p.display_name ?? "Anonymous"}
          />
        ))}
      </div>

      {error && (
        <p className="error" onClick={() => setError(null)}>
          {error}
        </p>
      )}

      <FacilitatorBar
        board={board.board}
        isFacilitator={Boolean(participant?.is_facilitator)}
        onToggleLock={handleToggleLock}
        onStartTimer={handleStartTimer}
        onStopTimer={handleStopTimer}
        onClose={handleOpenCloseModal}
      />

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="columns">
          {board.columns.map((col) => (
            <Column
              key={col.id}
              column={col}
              cards={board.cards.filter((c) => c.column_id === col.id)}
              groups={board.groups}
              votes={board.votes}
              participantsById={participantsById}
              currentParticipantId={participant?.id ?? ""}
              isFacilitator={Boolean(participant?.is_facilitator)}
              locked={Boolean(board.board.locked)}
              readOnly={isClosed}
              onAdd={(text) => handleAdd(col.id, text)}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onVote={handleVote}
              onUnvote={handleUnvote}
              onUngroup={handleUngroup}
              onRenameGroup={handleRenameGroup}
            />
          ))}
        </div>
      </DndContext>

      <ActionItems
        items={board.actionItems}
        readOnly={isClosed}
        onAdd={handleAddActionItem}
        onUpdateText={(id, text) => handleUpdateActionItem(id, { text })}
        onUpdateAssignee={(id, assignee) => handleUpdateActionItem(id, { assignee })}
        onToggleStatus={(id, status) => handleUpdateActionItem(id, { status })}
        onDelete={handleDeleteActionItem}
      />

      {closeModalOpen && (
        <CloseRetroModal
          sprints={sprints}
          loading={sprintsLoading}
          selectedId={selectedSprintId}
          onSelect={setSelectedSprintId}
          onConfirm={handleConfirmCloseBoard}
          onCancel={() => setCloseModalOpen(false)}
          closing={closing}
          error={closeError}
        />
      )}
    </div>
  );
}
