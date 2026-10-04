export interface SubtitleCue {
  id: number;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
}

export interface SubtitleState {
  enabled: boolean;
  activeSubtitleId: string | number | null;
  cues: SubtitleCue[];
  currentText: string;
  delayMs: number; // timing offset in ms
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  textColor: string;
  backgroundColor: string;
}

export function parseSrt(content: string): SubtitleCue[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const blocks = normalized.split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i].split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    let timeLine = '';
    let textStartIdx = 1;

    if (lines[0].includes('-->')) {
      timeLine = lines[0];
    } else if (lines[1] && lines[1].includes('-->')) {
      timeLine = lines[1];
      textStartIdx = 2;
    }

    if (!timeLine) continue;

    const parts = timeLine.split('-->');
    if (parts.length !== 2) continue;

    const start = parseTimestamp(parts[0].trim());
    const end = parseTimestamp(parts[1].trim());

    if (start === null || end === null || end <= start) continue;

    const text = lines.slice(textStartIdx).join('\n').replace(/<[^>]+>/g, '');
    cues.push({
      id: i + 1,
      start,
      end,
      text,
    });
  }

  return cues;
}

export function parseVtt(content: string): SubtitleCue[] {
  // WebVTT is structurally similar to SRT
  const cleaned = content.replace(/^WEBVTT[^\n]*\n+/i, '');
  return parseSrt(cleaned);
}

export function parseAss(content: string): SubtitleCue[] {
  const lines = content.split(/\r?\n/);
  const cues: SubtitleCue[] = [];
  let inEvents = false;
  let id = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[Events]')) {
      inEvents = true;
      continue;
    }
    if (inEvents && trimmed.startsWith('Dialogue:')) {
      const parts = trimmed.substring(9).split(',');
      if (parts.length >= 10) {
        const start = parseAssTimestamp(parts[1].trim());
        const end = parseAssTimestamp(parts[2].trim());
        const text = parts.slice(9).join(',').replace(/\{[^}]+\}/g, '').replace(/\\N/g, '\n').trim();

        if (start !== null && end !== null && text) {
          cues.push({ id: id++, start, end, text });
        }
      }
    }
  }

  return cues;
}

function parseTimestamp(timeStr: string): number | null {
  // 00:01:20,123 or 00:01:20.123 or 01:20.123
  const match = timeStr.match(/(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})[,.](\d{1,3})/);
  if (!match) return null;

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const millis = parseInt(match[4].padEnd(3, '0').slice(0, 3), 10);

  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

function parseAssTimestamp(timeStr: string): number | null {
  // 0:00:00.00
  const match = timeStr.match(/(\d+):(\d{2}):(\d{2})\.(\d{2,3})/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const centis = parseInt(match[4].padEnd(3, '0').slice(0, 3), 10);

  return hours * 3600 + minutes * 60 + seconds + centis / 1000;
}

export function parseSubtitleFile(content: string, filename: string): SubtitleCue[] {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (ext === 'ass' || ext === 'ssa') {
    return parseAss(content);
  }
  if (ext === 'vtt') {
    return parseVtt(content);
  }
  return parseSrt(content);
}
