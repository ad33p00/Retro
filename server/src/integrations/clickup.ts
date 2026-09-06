const API_V2_BASE = "https://api.clickup.com/api/v2";
const API_V3_BASE = "https://api.clickup.com/api/v3";

export interface ClickupAuth {
  token: string;
  workspaceId: string;
}

let warnedMissingAuth = false;

export function getClickupAuth(): ClickupAuth | null {
  const token = process.env.CLICKUP_API_TOKEN;
  const workspaceId = process.env.CLICKUP_WORKSPACE_ID;

  if (!token || !workspaceId) {
    if (!warnedMissingAuth) {
      console.warn("[clickup] CLICKUP_API_TOKEN / CLICKUP_WORKSPACE_ID not set — ClickUp features are disabled.");
      warnedMissingAuth = true;
    }
    return null;
  }

  return { token, workspaceId };
}

async function clickupGet(path: string, token: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_V2_BASE}${path}`, { headers: { Authorization: token } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ClickUp API ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

async function clickupPost(path: string, token: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_V3_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ClickUp API ${path} failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<Record<string, unknown>>;
}

export interface SprintOption {
  id: string;
  name: string;
  startDate: number | null;
  dueDate: number | null;
  isCurrent: boolean;
}

export interface ListSprintsOptions {
  spaceName?: string;
  folderName?: string;
}

/** Lists dated Lists (sprints) inside a Space's Sprints folder. Reusable by any module. */
export async function listSprints(auth: ClickupAuth, opts: ListSprintsOptions = {}): Promise<SprintOption[]> {
  const spaceName = opts.spaceName ?? "btr.tech";
  const folderName = opts.folderName ?? "Sprints";

  try {
    const spacesRes = await clickupGet(`/team/${auth.workspaceId}/space?archived=false`, auth.token);
    const spaces = (spacesRes.spaces ?? []) as Array<{ id: string; name: string }>;
    const space = spaces.find((s) => s.name.toLowerCase() === spaceName.toLowerCase());
    if (!space) return [];

    const foldersRes = await clickupGet(`/space/${space.id}/folder?archived=false`, auth.token);
    const folders = (foldersRes.folders ?? []) as Array<{
      id: string;
      name: string;
      lists: Array<{ id: string; name: string; start_date: string | null; due_date: string | null }>;
    }>;
    const folder =
      folders.find((f) => f.name.toLowerCase() === folderName.toLowerCase()) ??
      folders.find((f) => f.lists.some((l) => l.start_date && l.due_date));
    if (!folder) return [];

    const now = Date.now();
    return folder.lists
      .filter((l) => l.start_date && l.due_date)
      .map((l) => {
        const startDate = Number(l.start_date);
        const dueDate = Number(l.due_date);
        return {
          id: l.id,
          name: l.name,
          startDate,
          dueDate,
          isCurrent: now >= startDate && now <= dueDate,
        };
      })
      .sort((a, b) => (a.startDate ?? 0) - (b.startDate ?? 0));
  } catch (err) {
    console.error("[clickup] failed to list sprints:", err instanceof Error ? err.message : err);
    return [];
  }
}

export interface DocParent {
  id: string;
  type: number;
}

/** Creates a ClickUp Doc (no content) under the given parent (Space/Folder/List/Workspace). */
export async function createDoc(auth: ClickupAuth, name: string, parent: DocParent): Promise<{ id: string }> {
  const doc = await clickupPost(`/workspaces/${auth.workspaceId}/docs`, auth.token, {
    name,
    parent,
    visibility: "PRIVATE",
    create_page: false,
  });
  return { id: String(doc.id) };
}

/** Adds a page with Markdown content to an existing Doc. */
export async function createDocPage(auth: ClickupAuth, docId: string, name: string, content: string): Promise<void> {
  await clickupPost(`/workspaces/${auth.workspaceId}/docs/${docId}/pages`, auth.token, {
    name,
    content,
    content_format: "text/md",
  });
}
