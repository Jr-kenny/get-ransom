/**
 * Minimal GitHub-issue markdown → React. No raw HTML (XSS-safe).
 */
import { Fragment } from 'react';

function inline(text, keyPrefix) {
  const nodes = [];
  // code, bold, italic, links — longest patterns first
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(\*[^*]+\*)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyPrefix}-${i++}`;
    if (tok.startsWith('`')) {
      nodes.push(
        <code key={k} className="md-code">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith('**')) {
      nodes.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('[')) {
      const link = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        const href = link[2];
        const safe = /^https?:\/\//i.test(href) ? href : '#';
        nodes.push(
          <a key={k} href={safe} target="_blank" rel="noreferrer noreferrer" className="md-link">
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(tok);
      }
    } else if (tok.startsWith('*')) {
      nodes.push(<em key={k}>{tok.slice(1, -1)}</em>);
    } else {
      nodes.push(tok);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function parseBlocks(src) {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // fenced code
    if (line.trimStart().startsWith('```')) {
      const buf = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ type: 'pre', text: buf.join('\n'), key: key++ });
      continue;
    }

    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      blocks.push({
        type: 'h',
        level: h[1].length,
        text: h[2].trim(),
        key: key++,
      });
      i += 1;
      continue;
    }

    // unordered list run
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ul', items, key: key++ });
      continue;
    }

    // ordered list run
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ol', items, key: key++ });
      continue;
    }

    // paragraph (merge until blank / next block type)
    const para = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trimStart().startsWith('```') &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: 'p', text: para.join(' '), key: key++ });
  }

  return blocks;
}

export default function MarkdownBody({ source, className = '' }) {
  const blocks = parseBlocks(source);
  return (
    <div className={`md-body ${className}`.trim()}>
      {blocks.map((b) => {
        if (b.type === 'pre') {
          return (
            <pre key={b.key} className="md-pre">
              <code>{b.text}</code>
            </pre>
          );
        }
        if (b.type === 'h') {
          const Tag = `h${Math.min(6, Math.max(3, b.level + 1))}`;
          return (
            <Tag key={b.key} className="md-h">
              {inline(b.text, `h${b.key}`)}
            </Tag>
          );
        }
        if (b.type === 'ul') {
          return (
            <ul key={b.key} className="md-ul">
              {b.items.map((item, idx) => (
                <li key={idx}>{inline(item, `u${b.key}-${idx}`)}</li>
              ))}
            </ul>
          );
        }
        if (b.type === 'ol') {
          return (
            <ol key={b.key} className="md-ol">
              {b.items.map((item, idx) => (
                <li key={idx}>{inline(item, `o${b.key}-${idx}`)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={b.key} className="md-p">
            {inline(b.text, `p${b.key}`)}
          </p>
        );
      })}
    </div>
  );
}
