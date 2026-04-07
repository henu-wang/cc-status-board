# CC Status Board

> Smart status bar for Claude Code — context meter, AI asset discovery, and session info at a glance.

![Context Meter](assets/demo-context-meter.svg)

## What It Does

CC Status Board adds three features to your Claude Code status bar:

### 1. Context Meter

See how much of your context window you've used — at a glance. Color-coded: green (< 50%) → yellow (50-65%) → orange (65-80%) → blinking red (80%+).

### 2. AI Asset Discovery

As you type, the most relevant installed AI assets appear in your status bar. No extra tokens consumed — matching runs 100% locally using intent classification + TF-IDF scoring.

![Asset Discovery](assets/demo-asset-suggest.svg)

**Scans all your installed assets:**
- Skills (`~/.claude/skills/`)
- Agents (`~/.claude/agents/`)
- Commands (`~/.claude/commands/`)
- Plugins (Claude Code built-in plugins)
- MCP Servers (`.mcp.json`)

**Smart matching (not just keyword search):**
- 35+ intent categories with CJK + English aliases
- TF-IDF weighting — rare keywords matter more
- Specificity bonus — specialist tools rank above generalists
- Diversity filter — no more than 2 results from the same namespace

### 3. Model & Directory Info

Always shows your current model, context window size, and working directory.

```
Opus 4.6 (1M context) │ myproject █░░░░░░░░░ 12%
Sonnet 4.6 (200K context) │ webapp ███░░░░░░░ 28%
```

## Install

```bash
npx cc-status-board
```

Or clone and install manually:

```bash
git clone https://github.com/WilliamWangAI/cc-status-board.git
cd cc-status-board
node install.js
```

Then **restart Claude Code**.

## How It Works

```
┌─────────────────────────────────────────────────┐
│ You type a message                              │
│           │                                     │
│           ▼                                     │
│ UserPromptSubmit hook                           │
│  → Tokenize (CJK bigrams + Latin words)        │
│  → Detect intents (35+ categories)             │
│  → Score assets (TF-IDF + specificity)         │
│  → Write top 3 to temp bridge file             │
│           │                                     │
│           ▼                                     │
│ Statusline reads bridge file                    │
│  → Display: model │ dir │ context% │ 💡 assets │
└─────────────────────────────────────────────────┘
```

**Zero token consumption.** Everything runs as local Node.js processes.

## Rebuild Asset Index

When you install new skills, MCP servers, or plugins:

```bash
node ~/.claude/hooks/cc-build-index.js
```

## Uninstall

Remove from `~/.claude/settings.json`:
1. Delete the `statusLine` entry
2. Remove the `cc-asset-suggest` entry from `hooks.UserPromptSubmit`
3. Delete the hook files:

```bash
rm ~/.claude/hooks/cc-statusline.js
rm ~/.claude/hooks/cc-asset-suggest.js
rm ~/.claude/hooks/cc-build-index.js
rm ~/.claude/cache/asset-index.json
```

## Configuration

The status bar works out of the box. To customize:

| What | How |
|------|-----|
| Change bar width | Edit `statusline.js`, change `Math.floor(used / 10)` denominator |
| Add intent categories | Edit `build-index.js`, add to `INTENT_TAXONOMY` |
| Change max suggestions | Edit `asset-suggest.js`, change `MAX_SUGGESTIONS` |
| Adjust match threshold | Edit `asset-suggest.js`, change `MIN_SCORE` |

## Requirements

- Claude Code (CLI, desktop, or IDE extension)
- Node.js >= 18

## License

MIT

## Author

Built by [William Wang](https://github.com/WilliamWangAI) — founder of [TokRepo](https://tokrepo.com), [GEOScore AI](https://geoscoreai.com), and [KeepRule](https://keeprule.com).
