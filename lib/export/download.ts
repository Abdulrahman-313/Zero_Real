/** Triggers a client-side file download from in-memory content. Browser only. */
export function downloadFile(filename: string, content: string | Blob, mimeType: string): void {
  const blob = typeof content === "string" ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next tick so every browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Safe file-name stem: lowercase, dash-separated, ASCII only. */
export function fileStem(...parts: Array<string | number>): string {
  return parts
    .map((p) => String(p))
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
