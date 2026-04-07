#!/usr/bin/env node
// CC Status Board — Installer for Claude Code
// Installs: statusline + asset suggest hook + index builder

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');
const HOOKS_DIR = path.join(CLAUDE_DIR, 'hooks');
const CACHE_DIR = path.join(CLAUDE_DIR, 'cache');
const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');
const SRC_DIR = path.join(__dirname, 'src');

const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

console.log(`
${CYAN}╔══════════════════════════════════════════════╗
║       CC Status Board  v1.0.0                ║
║       Smart status bar for Claude Code       ║
╚══════════════════════════════════════════════╝${RESET}
`);

// Ensure directories exist
for (const dir of [CLAUDE_DIR, HOOKS_DIR, CACHE_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// 1. Install hooks
const files = {
  'cc-statusline.js': 'statusline.js',
  'cc-asset-suggest.js': 'asset-suggest.js',
  'cc-build-index.js': 'build-index.js',
};

for (const [target, source] of Object.entries(files)) {
  const src = path.join(SRC_DIR, source);
  const dst = path.join(HOOKS_DIR, target);
  fs.copyFileSync(src, dst);
  console.log(`  ${GREEN}✓${RESET} Installed ${CYAN}${target}${RESET} -> hooks/`);
}

// 2. Update settings.json
let settings = {};
if (fs.existsSync(SETTINGS_PATH)) {
  try { settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); } catch (e) {}
}

// Statusline
const statuslineCmd = `node "${path.join(HOOKS_DIR, 'cc-statusline.js')}"`;
if (!settings.statusLine || !settings.statusLine.command?.includes('cc-statusline')) {
  // Don't overwrite if user has a custom statusline, just inform
  if (settings.statusLine && !settings.statusLine.command?.includes('gsd-statusline') && !settings.statusLine.command?.includes('cc-statusline')) {
    console.log(`  ${YELLOW}⚠${RESET} Existing statusline detected, not overwriting.`);
    console.log(`    ${DIM}To use CC Status Board's statusline, set manually:${RESET}`);
    console.log(`    ${DIM}"statusLine": {"type":"command","command":"${statuslineCmd}"}${RESET}`);
  } else {
    settings.statusLine = { type: 'command', command: statuslineCmd };
    console.log(`  ${GREEN}✓${RESET} Configured statusline`);
  }
}

// UserPromptSubmit hook
if (!settings.hooks) settings.hooks = {};
if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];

const hookCmd = `node "${path.join(HOOKS_DIR, 'cc-asset-suggest.js')}"`;
const hasAssetHook = settings.hooks.UserPromptSubmit.some(h =>
  h.hooks?.some(hh => hh.command?.includes('cc-asset-suggest') || hh.command?.includes('asset-suggest'))
);
if (!hasAssetHook) {
  settings.hooks.UserPromptSubmit.push({
    hooks: [{ type: 'command', command: hookCmd, timeout: 3 }]
  });
  console.log(`  ${GREEN}✓${RESET} Configured asset suggest hook`);
} else {
  console.log(`  ${DIM}  Asset suggest hook already configured${RESET}`);
}

fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
console.log(`  ${GREEN}✓${RESET} Updated settings.json`);

// 3. Build initial asset index
console.log(`\n  Building asset index...`);
try {
  require(path.join(HOOKS_DIR, 'cc-build-index.js'));
} catch (e) {
  console.log(`  ${YELLOW}⚠${RESET} Index build failed: ${e.message}`);
  console.log(`    ${DIM}Run manually: node ~/.claude/hooks/cc-build-index.js${RESET}`);
}

console.log(`
${GREEN}Done!${RESET} Restart Claude Code to see:

  ${CYAN}Opus 4.6 (1M context) │ myproject █░░░░░░░░░ 12% │ 💡 /pdf  /xlsx${RESET}

  ${DIM}• Context meter — see how much context window you've used
  • Asset suggest — relevant AI assets appear as you type
  • Rebuild index: node ~/.claude/hooks/cc-build-index.js${RESET}
`);
