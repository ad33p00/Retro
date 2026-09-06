interface ExportMenuProps {
  boardId: string;
}

export function ExportMenu({ boardId }: ExportMenuProps) {
  return (
    <div className="export-menu">
      <a className="export-link" href={`/api/retro/boards/${boardId}/export?format=md`}>
        Export .md
      </a>
      <a className="export-link" href={`/api/retro/boards/${boardId}/export?format=csv`}>
        Export .csv
      </a>
    </div>
  );
}
