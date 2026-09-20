// Answers can start with short "source notes": the app writes some (like *(using your Biology knowledge pack)*),
// and the AI is asked to start with a tag: [[FROM_FILE]] or [[OUTSIDE]]. We pull these out of the text
// and show them as small badges, so they don't mix into the answer.
const TAG_PATTERN = /^\s*[*_]{0,2}\[\[\s*(FROM_FILE|OUTSIDE)\s*\]\][*_]{0,2}/;
const NOTE_PATTERN = /^\s*((?:\*\*|\*|_)?)\(([^()]{1,200})\)((?:\*\*|\*|_)?)/;

const TAG_LABELS: Record<string, string> = {
  FROM_FILE: 'From your attached file',
  OUTSIDE: 'Not found in your attached file. This answer is from outside sources.',
};

export function splitLabels(content: string): { labels: string[]; body: string } {
  const labels: string[] = [];
  let rest = content;

  while (true) {
    const tag = rest.match(TAG_PATTERN);
    if (tag) {
      labels.push(TAG_LABELS[tag[1]]);
      rest = rest.slice(tag[0].length);
      continue;
    }
    // A note in brackets. Only treated as a note if it has italic markers around it,
    // or it talks about the attached file (so a normal answer starting with "(a) ..." is left alone).
    const note = rest.match(NOTE_PATTERN);
    if (note && (note[1] !== '' || /attached file/i.test(note[2]))) {
      labels.push(note[2].trim());
      rest = rest.slice(note[0].length);
      continue;
    }
    break;
  }

  const trimmed = rest.trimStart();
  // A tag or note that is still being typed out: hold it back so raw text doesn't flash on screen.
  const stillTyping =
    /^[*_]{0,2}\[{1,2}[A-Z_]*\]?$/.test(trimmed) ||
    (/^(?:\*\*|\*|_)\(/.test(trimmed) && !/\)(?:\*\*|\*|_)/.test(trimmed) && trimmed.length < 250);
  return { labels, body: stillTyping ? '' : trimmed };
}