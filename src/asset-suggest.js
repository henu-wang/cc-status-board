#!/usr/bin/env node
// Asset Suggest Hook v3 (UserPromptSubmit)
// Intent matching + TF-IDF + specificity bonus + full-text search
// Writes top 3 matches to bridge file for statusline display

const fs = require('fs');
const path = require('path');
const os = require('os');

const INDEX_PATH = path.join(os.homedir(), '.claude/cache/asset-index.json');
const BRIDGE_PATH = path.join(os.tmpdir(), 'claude-asset-suggest.json');
const MAX_SUGGESTIONS = 3;
const MIN_SCORE = 5;

let input = '';
const timeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(timeout);
  try {
    const data = JSON.parse(input);
    const userMessage = (data.message || data.prompt || '').toLowerCase();

    if (userMessage.length < 3 || userMessage.startsWith('/')) process.exit(0);
    if (!fs.existsSync(INDEX_PATH)) process.exit(0);

    const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    if (index.version !== 2) process.exit(0);

    // ── Step 1: Tokenize ─────────────────────────────────────────
    const latinWords = userMessage.match(/[a-z][a-z0-9-]*[a-z0-9]/g) || [];
    const cjkChars = userMessage.match(/[\u4e00-\u9fff]+/g) || [];
    const cjkTokens = [];
    for (const seg of cjkChars) {
      cjkTokens.push(seg);
      for (let i = 0; i < seg.length - 1; i++) cjkTokens.push(seg.slice(i, i + 2));
      if (seg.length >= 3) {
        for (let i = 0; i < seg.length - 2; i++) cjkTokens.push(seg.slice(i, i + 3));
      }
    }
    const queryTokens = new Set([...latinWords, ...cjkTokens]);

    // ── Step 2: Detect user intents ──────────────────────────────
    const userIntents = new Set();
    const intentAliases = index.intent_taxonomy || {};
    for (const [intent, aliases] of Object.entries(intentAliases)) {
      for (const alias of aliases) {
        if (queryTokens.has(alias) || userMessage.includes(alias)) {
          userIntents.add(intent);
          break;
        }
      }
    }

    // ── Step 3: Score each asset ─────────────────────────────────
    const idf = index.idf || {};
    const scored = index.assets
      .filter(a => a.type !== 'hook')
      .map(asset => {
        let score = 0;
        const assetIntents = asset.intents || [];
        const intentCount = assetIntents.length || 1;

        // A) Intent match with SPECIFICITY bonus
        //    An asset with 2 intents matching 1 = 10 * (1 / sqrt(2)) = 7.07
        //    An asset with 8 intents matching 1 = 10 * (1 / sqrt(8)) = 3.54
        //    Specialist assets rank higher than generalists
        let intentOverlap = 0;
        for (const ui of userIntents) {
          if (assetIntents.includes(ui)) intentOverlap++;
        }
        if (intentOverlap > 0) {
          const specificityMultiplier = 1 / Math.sqrt(intentCount);
          score += intentOverlap * 10 * specificityMultiplier;
          // Extra bonus for multiple intent matches (rare, high precision)
          if (intentOverlap >= 2) score += intentOverlap * 5;
        }

        // B) TF-IDF keyword match
        const assetKwSet = new Set(asset.keywords || []);
        for (const qt of queryTokens) {
          if (assetKwSet.has(qt)) {
            score += (idf[qt] || 1) * 1.5;
          }
        }

        // C) Direct name match — strongest precision signal
        const nameLower = asset.name.toLowerCase().replace(/[:-]/g, ' ');
        const nameParts = nameLower.split(/\s+/);
        for (const qt of queryTokens) {
          if (qt.length < 3) continue;
          // Exact part match (e.g., "seo" matches "seo-audit")
          if (nameParts.some(p => p === qt)) {
            score += 12;
          } else if (nameLower.includes(qt)) {
            score += 6;
          }
        }

        // D) Full-text description search
        const descLower = (asset.desc || '').toLowerCase();
        for (const qt of queryTokens) {
          if (qt.length < 3) continue;
          // Count occurrences for density signal
          const regex = new RegExp(qt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          const matches = descLower.match(regex);
          if (matches) {
            score += Math.min(matches.length * 0.8, 3); // cap at 3
          }
        }

        // E) Penalize assets with no intent overlap when user has clear intents
        if (userIntents.size > 0 && intentOverlap === 0) {
          score *= 0.2;
        }

        // F) Dedup penalty: if asset type is 'plugin' and a skill/command
        //    with same base name exists, slightly prefer the non-plugin
        if (asset.type === 'plugin') {
          score *= 0.95;
        }

        return { name: asset.name, type: asset.type, invoke: asset.invoke,
                 desc: asset.desc, score };
      })
      .filter(a => a.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score);

    // ── Step 4: Diversity filter — no more than 2 from same namespace ──
    const result = [];
    const nsCounts = {};
    for (const a of scored) {
      const ns = a.name.split(':')[0] || a.name.split('-')[0];
      nsCounts[ns] = (nsCounts[ns] || 0) + 1;
      if (nsCounts[ns] <= 2) result.push(a);
      if (result.length >= MAX_SUGGESTIONS) break;
    }

    if (result.length === 0) {
      try { fs.unlinkSync(BRIDGE_PATH); } catch (e) {}
      process.exit(0);
    }

    fs.writeFileSync(BRIDGE_PATH, JSON.stringify({
      ts: Date.now(),
      top: result.map(a => ({
        type: a.type, name: a.name, invoke: a.invoke,
        desc: (a.desc || '').length > 60 ? (a.desc || '').substring(0, 57) + '...' : (a.desc || ''),
        score: Math.round(a.score * 10) / 10
      }))
    }));

  } catch (e) {
    process.exit(0);
  }
});
