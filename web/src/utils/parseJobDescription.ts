export type DescriptionBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

const BULLET_PATTERN = /^[•\-*‣▪]\s+(.+)/;

// Job descriptions from every source (JSearch, Adzuna, USAJOBS, ...) come
// back as plain text with real structure — blank-line-separated paragraphs,
// short header lines ("Key Responsibilities", "Required"), and bullet lists
// — that was getting flattened into a single wall of text by rendering it
// with default (collapsing) whitespace. This reconstructs that structure
// instead of just preserving whitespace verbatim, since a raw "•" character
// mid-line still doesn't read as a real bullet.
export function parseJobDescription(raw: string): DescriptionBlock[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim());
  const blocks: DescriptionBlock[] = [];
  let currentList: string[] | null = null;

  const looksLikeHeading = (line: string) => line.length > 0 && line.length <= 50 && !/[.,;]$/.test(line);

  for (const line of lines) {
    if (!line) continue; // a blank line is just a separator, including between bullets — skip, don't close the list
    const bulletMatch = line.match(BULLET_PATTERN);
    if (bulletMatch) {
      if (!currentList) {
        currentList = [];
        blocks.push({ type: "list", items: currentList });
      }
      currentList.push(bulletMatch[1]);
      continue;
    }
    currentList = null;
    blocks.push({ type: looksLikeHeading(line) ? "heading" : "paragraph", text: line });
  }

  return blocks;
}
