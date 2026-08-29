export type NotesFeedSource = 'guardian' | 'coach' | 'checkin' | 'profile';

export interface NotesFeedEntry {
  id: string;
  sourceType: NotesFeedSource;
  sourceId: string;
  body: string;
  title?: string | null;
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: string | Date;
  updatedAt?: string | Date | null;
  linked?: boolean;
  noteType?: string | null;
}

export function buildNotesFeed(entries: NotesFeedEntry[]): NotesFeedEntry[] {
  return [...entries]
    .filter(entry => entry.body.trim().length > 0)
    .sort((a, b) => {
      const timeDifference = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (timeDifference !== 0) return timeDifference;
      return b.id.localeCompare(a.id);
    });
}

export function plainTextFromRichContent(content: string): string {
  if (!content) return '';

  try {
    const parsed = JSON.parse(content);
    const lines: string[] = [];

    const visit = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      const value = node as { type?: string; text?: string; content?: unknown[] };

      if (typeof value.text === 'string') {
        lines.push(value.text);
      }

      if (Array.isArray(value.content)) {
        value.content.forEach(visit);
        if (value.type === 'paragraph' || value.type === 'heading' || value.type === 'listItem') {
          lines.push('\n');
        }
      }
    };

    visit(parsed);
    const text = lines.join('').replace(/\n{3,}/g, '\n\n').trim();
    return text || content;
  } catch {
    // Older rich-text rows may have been stored as HTML rather than TipTap
    // JSON. Keep the feed plain-text even for those legacy values.
    const htmlText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return htmlText || content;
  }
}

export const NOTES_WRITER_ROLES = [
  'Guardian',
  'Job Coach',
  'Shift Lead',
  'Administrator',
] as const;

export function isNotesWriterRole(role: string): boolean {
  return NOTES_WRITER_ROLES.includes(role as typeof NOTES_WRITER_ROLES[number]);
}