import { createDoc, createDocPage, getClickupAuth, listSprints, SprintOption } from "../../../integrations/clickup.js";
import { BoardState } from "../types.js";
import { exportMarkdown } from "./export.js";

function getRetroClickupConfig() {
  const auth = getClickupAuth();
  if (!auth) return null;

  return {
    auth,
    parentId: process.env.CLICKUP_PARENT_ID ?? auth.workspaceId,
    parentType: process.env.CLICKUP_PARENT_TYPE ? Number(process.env.CLICKUP_PARENT_TYPE) : 12,
    spaceName: process.env.CLICKUP_SPACE_NAME ?? "btr.tech",
    sprintsFolderName: process.env.CLICKUP_SPRINTS_FOLDER_NAME ?? "Sprints",
  };
}

export async function listRetroSprints(): Promise<SprintOption[]> {
  const config = getRetroClickupConfig();
  if (!config) return [];
  return listSprints(config.auth, { spaceName: config.spaceName, folderName: config.sprintsFolderName });
}

export async function publishRetroToClickUp(
  state: BoardState,
  overrideParent?: { id: string; type: number }
): Promise<void> {
  const config = getRetroClickupConfig();
  if (!config) return;

  const parent = overrideParent ?? { id: config.parentId, type: config.parentType };
  const closedAt = state.board.completed_at ? new Date(state.board.completed_at) : new Date();
  const dateLabel = closedAt.toISOString().slice(0, 10);

  try {
    const doc = await createDoc(config.auth, `${state.board.name} — Retro Export (${dateLabel})`, parent);
    await createDocPage(config.auth, doc.id, "Retro Export", exportMarkdown(state));
    console.log(`[clickup] published retro "${state.board.name}" as doc ${doc.id}`);
  } catch (err) {
    console.error("[clickup] failed to publish retro export:", err instanceof Error ? err.message : err);
  }
}
