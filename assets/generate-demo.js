#!/usr/bin/env node
// Generate demo screenshots as SVG for README
const fs = require('fs');
const path = require('path');

const demos = [
  {
    name: 'demo-context-meter.svg',
    lines: [
      { text: 'Opus 4.6 (1M context) │ myproject ', bar: '█░░░░░░░░░', pct: '8%', color: '#22c55e', hint: '' },
      { text: 'Opus 4.6 (1M context) │ webapp    ', bar: '████░░░░░░', pct: '40%', color: '#eab308', hint: '' },
      { text: 'Opus 4.6 (1M context) │ api-server', bar: '███████░░░', pct: '68%', color: '#f97316', hint: '' },
      { text: 'Opus 4.6 (1M context) │ monorepo  ', bar: '█████████░', pct: '92%', color: '#ef4444', hint: '' },
    ]
  },
  {
    name: 'demo-asset-suggest.svg',
    lines: [
      { prompt: '❯ help me do SEO analysis', text: 'Opus 4.6 (1M) │ myproject █░░░░░░░░░ 8%', hint: '💡 /marketing:seo-audit  /backlink-builder' },
      { prompt: '❯ debug this API error', text: 'Opus 4.6 (1M) │ myproject ██░░░░░░░░ 15%', hint: '💡 /gsd-debug  Agent("gsd-debugger")' },
      { prompt: '❯ make a landing page', text: 'Opus 4.6 (1M) │ myproject ███░░░░░░░ 22%', hint: '💡 /frontend-design  /theme-factory' },
      { prompt: '❯ 做个数据库查询', text: 'Opus 4.6 (1M) │ myproject ███░░░░░░░ 28%', hint: '💡 /data:write-query  /data:sql-queries' },
    ]
  }
];

function escapeXml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

for (const demo of demos) {
  const lineH = 32;
  const padding = 20;
  const hasPrompt = demo.lines[0].prompt;
  const totalH = demo.lines.length * (hasPrompt ? lineH * 2 + 8 : lineH) + padding * 2;
  const W = 820;

  let y = padding + 18;
  let content = '';

  for (const line of demo.lines) {
    if (hasPrompt) {
      // Prompt line
      content += `<text x="${padding}" y="${y}" fill="#a3a3a3" font-size="14" font-family="Menlo,monospace">${escapeXml(line.prompt)}</text>\n`;
      y += lineH;
      // Status line
      content += `<text x="${padding}" y="${y}" fill="#737373" font-size="13" font-family="Menlo,monospace">${escapeXml(line.text)}</text>`;
      if (line.hint) {
        const hintX = padding + line.text.length * 7.8 + 10;
        content += `<text x="${hintX}" y="${y}" fill="#22d3ee" font-size="13" font-family="Menlo,monospace">${escapeXml(line.hint)}</text>`;
      }
      content += '\n';
      y += lineH + 8;
    } else {
      // Bar line
      const textPart = escapeXml(line.text);
      const barStart = padding + line.text.length * 8;
      content += `<text x="${padding}" y="${y}" fill="#a3a3a3" font-size="14" font-family="Menlo,monospace">${textPart}</text>`;
      content += `<text x="${barStart}" y="${y}" fill="${line.color}" font-size="14" font-family="Menlo,monospace">${escapeXml(line.bar)} ${escapeXml(line.pct)}</text>`;
      content += '\n';
      y += lineH;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}">
  <rect width="${W}" height="${totalH}" rx="8" fill="#1a1a2e"/>
  <rect x="0" y="0" width="${W}" height="28" rx="8" fill="#16162a"/>
  <circle cx="16" cy="14" r="5" fill="#ff5f57"/>
  <circle cx="34" cy="14" r="5" fill="#febc2e"/>
  <circle cx="52" cy="14" r="5" fill="#28c840"/>
  <text x="${W/2}" y="18" text-anchor="middle" fill="#666" font-size="12" font-family="Menlo,monospace">Claude Code</text>
  <g transform="translate(0, 12)">
  ${content}
  </g>
</svg>`;

  fs.writeFileSync(path.join(__dirname, demo.name), svg);
  console.log(`Generated ${demo.name}`);
}
