'use strict';

/**
 * Terminal Markdown Renderer
 * Parses and renders Markdown into ANSI-formatted, word-wrapped lines
 * suitable for terminal TUIs and modals. Zero external dependencies.
 */

function stripAnsi(str) {
  return String(str || '').replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

function visibleLength(str) {
  return stripAnsi(str).length;
}

// Truncates a string that may contain ANSI escape codes to max visible characters
function truncateAnsi(str, maxVis) {
  let vis = 0;
  let out = '';
  const regex = /(\x1b\[[0-9;]*[a-zA-Z])|([^\x1b]+)|(\x1b)/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    if (match[1]) {
      out += match[1];
    } else if (match[2]) {
      const text = match[2];
      for (const ch of text) {
        if (vis < maxVis) {
          out += ch;
          vis++;
        } else {
          out += '\x1b[0m';
          return { text: out, vis };
        }
      }
    } else {
      out += match[3];
    }
  }
  return { text: out + '\x1b[0m', vis };
}

// Pads or truncates an ANSI string to EXACT visible targetWidth
function padAnsi(str, targetWidth) {
  const visLen = visibleLength(str);
  if (visLen === targetWidth) return str;
  if (visLen < targetWidth) {
    return str + ' '.repeat(targetWidth - visLen);
  }
  const truncated = truncateAnsi(str, targetWidth - 1);
  return truncated.text + '…';
}

// Word-wrap a string (which may contain ANSI escape codes) to target width
function wrapAnsiLine(line, maxWidth, indent = '') {
  if (visibleLength(line) <= maxWidth) {
    return [line];
  }

  const words = line.split(' ');
  const result = [];
  let cur = '';

  for (const w of words) {
    if (!cur) {
      cur = w;
      continue;
    }

    const testLine = cur + ' ' + w;
    if (visibleLength(testLine) <= maxWidth) {
      cur = testLine;
    } else {
      result.push(cur);
      cur = indent + w;
    }
  }

  if (cur) {
    result.push(cur);
  }

  return result.length > 0 ? result : [line];
}

function formatInline(text) {
  if (!text) return '';
  return text
    // Code spans
    .replace(/`([^`]+)`/g, '\x1b[36m`$1`\x1b[0m')
    // Bold + Italic
    .replace(/\*\*\*([^*]+)\*\*\*/g, '\x1b[1;3m$1\x1b[0m')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '\x1b[1m$1\x1b[0m')
    .replace(/__([^_]+)__/g, '\x1b[1m$1\x1b[0m')
    // Italic
    .replace(/\*([^*]+)\*/g, '\x1b[3m$1\x1b[0m')
    .replace(/_([^_]+)_/g, '\x1b[3m$1\x1b[0m')
    // Strikethrough
    .replace(/~~([^~]+)~~/g, '\x1b[9m$1\x1b[0m')
    // Links [text](url) -> text (url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '\x1b[1;34m$1\x1b[0m \x1b[90m($2)\x1b[0m');
}

function renderMarkdown(mdText, options = {}) {
  const width = Math.max(30, options.width || 80);
  const lines = String(mdText || '').replace(/\r\n/g, '\n').split('\n');
  const output = [];

  let inFrontmatter = false;
  let frontmatter = [];

  let inCodeBlock = false;
  let codeLang = '';
  let inTable = false;
  let tableRows = [];

  function flushTable() {
    if (tableRows.length === 0) return;

    const contentRows = tableRows.filter(r => !r.every(cell => /^[-: ]+$/.test(cell)));
    if (contentRows.length === 0) {
      tableRows = [];
      inTable = false;
      return;
    }

    const numCols = Math.max(...contentRows.map(r => r.length));
    const colWidths = new Array(numCols).fill(0);

    for (const row of contentRows) {
      for (let c = 0; c < row.length; c++) {
        colWidths[c] = Math.max(colWidths[c], visibleLength(row[c]));
      }
    }

    const totalRaw = colWidths.reduce((a, b) => a + b, 0) + (numCols * 3) + 1;
    if (totalRaw > width && totalRaw > 0) {
      const scale = (width - (numCols * 3) - 1) / totalRaw;
      for (let c = 0; c < numCols; c++) {
        colWidths[c] = Math.max(4, Math.floor(colWidths[c] * scale));
      }
    }

    for (let i = 0; i < contentRows.length; i++) {
      const row = contentRows[i];
      let line = '\x1b[90m│\x1b[0m ';
      for (let c = 0; c < numCols; c++) {
        const rawCell = (row[c] || '').trim();
        const formatted = formatInline(rawCell);
        const cellVis = visibleLength(formatted);
        const targetW = colWidths[c];
        let cellStr = formatted;
        if (cellVis > targetW) {
          cellStr = rawCell.slice(0, targetW - 1) + '…';
        } else {
          cellStr = formatted + ' '.repeat(targetW - cellVis);
        }
        line += (i === 0 ? `\x1b[1m${cellStr}\x1b[0m` : cellStr) + ' \x1b[90m│\x1b[0m ';
      }
      output.push(line);

      if (i === 0) {
        let sep = '\x1b[90m├';
        for (let c = 0; c < numCols; c++) {
          sep += '─'.repeat(colWidths[c] + 2) + (c === numCols - 1 ? '┤\x1b[0m' : '┼');
        }
        output.push(sep);
      }
    }

    output.push('');
    tableRows = [];
    inTable = false;
  }

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const trimmed = rawLine.trim();

    // ── 1. Frontmatter parsing ───────────────────────────────────────────────
    if (idx === 0 && trimmed === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === '---') {
        inFrontmatter = false;
        output.push('\x1b[1;33m[METADATA]\x1b[0m');
        for (const fm of frontmatter) {
          const fmTrimmed = fm.trim();
          if (!fmTrimmed) continue;
          const colonIdx = fmTrimmed.indexOf(':');
          if (colonIdx === -1) continue;
          const k = fmTrimmed.slice(0, colonIdx).trim();
          const v = fmTrimmed.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
          const label = `  \x1b[1;33m${k}:\x1b[0m `;
          const text = formatInline(v);
          const wrapped = wrapAnsiLine(`${label}${text}`, width, '    ');
          output.push(...wrapped);
        }
        output.push('\x1b[90m' + '─'.repeat(Math.min(width, 60)) + '\x1b[0m');
        output.push('');
        continue;
      }
      frontmatter.push(rawLine);
      continue;
    }

    // ── 2. Code Block handling ───────────────────────────────────────────────
    if (trimmed.startsWith('```')) {
      if (inTable) flushTable();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim() || 'code';
        output.push(`\x1b[90m[code: ${codeLang}]\x1b[0m`);
      } else {
        inCodeBlock = false;
        output.push('\x1b[90m[end code]\x1b[0m');
        output.push('');
      }
      continue;
    }

    if (inCodeBlock) {
      output.push('  \x1b[36m' + rawLine + '\x1b[0m');
      continue;
    }

    // ── 3. Table handling ────────────────────────────────────────────────────
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true;
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => c.trim());
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // ── 4. Empty Line ────────────────────────────────────────────────────────
    if (!trimmed) {
      output.push('');
      continue;
    }

    // ── 5. Horizontal Rule ───────────────────────────────────────────────────
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      output.push('\x1b[90m' + '─'.repeat(width) + '\x1b[0m');
      output.push('');
      continue;
    }

    // ── 6. Headings ──────────────────────────────────────────────────────────
    if (trimmed.startsWith('# ')) {
      const title = formatInline(trimmed.slice(2).trim());
      output.push('');
      output.push(`\x1b[1;36m# ${title.toUpperCase()}\x1b[0m`);
      output.push('\x1b[36m' + '═'.repeat(Math.min(width, visibleLength(title) + 2)) + '\x1b[0m');
      output.push('');
      continue;
    }
    if (trimmed.startsWith('## ')) {
      const title = formatInline(trimmed.slice(3).trim());
      output.push('');
      output.push(`\x1b[1;32m## ${title}\x1b[0m`);
      output.push('\x1b[32m' + '─'.repeat(Math.min(width, visibleLength(title) + 3)) + '\x1b[0m');
      continue;
    }
    if (trimmed.startsWith('### ')) {
      const title = formatInline(trimmed.slice(4).trim());
      output.push('');
      output.push(`\x1b[1;33m### ${title}\x1b[0m`);
      continue;
    }
    if (trimmed.startsWith('#### ')) {
      const title = formatInline(trimmed.slice(5).trim());
      output.push(`\x1b[1;37m#### ${title}\x1b[0m`);
      continue;
    }

    // ── 7. Blockquotes ───────────────────────────────────────────────────────
    if (trimmed.startsWith('>')) {
      const quoteText = formatInline(trimmed.replace(/^>\s?/, ''));
      const wrapped = wrapAnsiLine(`  \x1b[90m│\x1b[0m \x1b[3m${quoteText}\x1b[0m`, width, '  \x1b[90m│\x1b[0m ');
      output.push(...wrapped);
      continue;
    }

    // ── 8. Lists ─────────────────────────────────────────────────────────────
    if (/^[-*]\s+\[([ xX])\]\s+(.*)/.test(trimmed)) {
      const m = trimmed.match(/^[-*]\s+\[([ xX])\]\s+(.*)/);
      const isChecked = m[1].toLowerCase() === 'x';
      const checkMark = isChecked ? '\x1b[32m[x]\x1b[0m' : '\x1b[90m[ ]\x1b[0m';
      const text = formatInline(m[2]);
      const wrapped = wrapAnsiLine(`  ${checkMark} ${text}`, width, '      ');
      output.push(...wrapped);
      continue;
    }

    if (/^[-*]\s+(.*)/.test(trimmed)) {
      const itemText = formatInline(trimmed.replace(/^[-*]\s+/, ''));
      const wrapped = wrapAnsiLine(`  \x1b[33m•\x1b[0m ${itemText}`, width, '    ');
      output.push(...wrapped);
      continue;
    }

    if (/^(\d+)\.\s+(.*)/.test(trimmed)) {
      const m = trimmed.match(/^(\d+)\.\s+(.*)/);
      const num = m[1];
      const itemText = formatInline(m[2]);
      const prefix = `  \x1b[33m${num}.\x1b[0m `;
      const indent = ' '.repeat(stripAnsi(prefix).length);
      const wrapped = wrapAnsiLine(`${prefix}${itemText}`, width, indent);
      output.push(...wrapped);
      continue;
    }

    // ── 9. Normal Paragraph ──────────────────────────────────────────────────
    const formatted = formatInline(rawLine);
    const wrapped = wrapAnsiLine(formatted, width);
    output.push(...wrapped);
  }

  if (inTable) {
    flushTable();
  }

  return output;
}

module.exports = {
  renderMarkdown,
  stripAnsi,
  visibleLength,
  truncateAnsi,
  padAnsi
};
