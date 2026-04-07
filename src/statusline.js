#!/usr/bin/env node
// CC Status Board — Statusline
// Shows: model │ directory │ context bar │ asset suggestions

const fs = require('fs');
const path = require('path');
const os = require('os');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const model = data.model?.display_name || 'Claude';
    const dir = data.workspace?.current_dir || process.cwd();
    const remaining = data.context_window?.remaining_percentage;
    const ctxSize = data.context_window?.context_window_size;

    // ── Context meter ────────────────────────────────────────────
    // Claude Code reserves ~16.5% for autocompact buffer.
    // We normalize so 100% = point where autocompact triggers.
    const AUTO_COMPACT_BUFFER_PCT = 16.5;
    let ctx = '';
    if (remaining != null) {
      const usableRemaining = Math.max(0,
        ((remaining - AUTO_COMPACT_BUFFER_PCT) / (100 - AUTO_COMPACT_BUFFER_PCT)) * 100);
      const used = Math.max(0, Math.min(100, Math.round(100 - usableRemaining)));

      const filled = Math.floor(used / 10);
      const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);

      // Smart tips based on context usage
      let tip = '';
      if (used >= 90) {
        tip = ' \x1b[5;31m⚠ /compact now or start new chat\x1b[0m';
      } else if (used >= 75) {
        tip = ' \x1b[38;5;208m→ /compact recommended\x1b[0m';
      } else if (used >= 60) {
        tip = ' \x1b[33m→ wrap up or /compact soon\x1b[0m';
      } else if (used >= 40) {
        tip = ' \x1b[2m→ /commit before context fills\x1b[0m';
      }

      if (used < 50) {
        ctx = ` \x1b[32m${bar} ${used}%\x1b[0m${tip}`;
      } else if (used < 65) {
        ctx = ` \x1b[33m${bar} ${used}%\x1b[0m${tip}`;
      } else if (used < 80) {
        ctx = ` \x1b[38;5;208m${bar} ${used}%\x1b[0m${tip}`;
      } else {
        ctx = ` \x1b[5;31m${bar} ${used}%\x1b[0m${tip}`;
      }
    }

    // ── Model label with context size ────────────────────────────
    let modelLabel = model;
    if (ctxSize) {
      const sizeLabel = ctxSize >= 1000000 ? `${Math.round(ctxSize / 1000000)}M` : `${Math.round(ctxSize / 1000)}K`;
      modelLabel = `${model} (${sizeLabel} context)`;
    }

    // ── Asset suggestion from bridge file ────────────────────────
    let assetHint = '';
    try {
      const bridgePath = path.join(os.tmpdir(), 'claude-asset-suggest.json');
      if (fs.existsSync(bridgePath)) {
        const bridge = JSON.parse(fs.readFileSync(bridgePath, 'utf8'));
        if (Date.now() - bridge.ts < 30000 && bridge.top && bridge.top.length > 0) {
          const names = bridge.top.slice(0, 3).map(a => a.invoke).join('  ');
          assetHint = ` \x1b[2m\u2502\x1b[0m \x1b[36m\ud83d\udca1 ${names}\x1b[0m`;
        }
      }
    } catch (e) {}

    // ── Output ───────────────────────────────────────────────────
    const dirname = path.basename(dir);
    process.stdout.write(
      `\x1b[2m${modelLabel}\x1b[0m \u2502 \x1b[2m${dirname}\x1b[0m${ctx}${assetHint}`
    );
  } catch (e) {}
});
