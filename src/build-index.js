#!/usr/bin/env node
// Build a searchable index of ALL installed AI assets
// Sources: skills, agents, commands, plugins, MCP servers, hooks
// Output: ~/.claude/cache/asset-index.json
//
// v2: Intent-based classification + TF-IDF weights

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');
const OUTPUT = path.join(CLAUDE_DIR, 'cache', 'asset-index.json');

const cacheDir = path.join(CLAUDE_DIR, 'cache');
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

// ── Intent taxonomy ──────────────────────────────────────────────
// Each intent has trigger patterns (checked against name+desc) and
// query aliases (what users might type to mean this intent).
const INTENT_TAXONOMY = {
  'seo': {
    triggers: ['seo', 'search engine', 'keyword research', 'on-page', 'meta tag', 'sitemap', 'indexing', 'serp'],
    aliases: ['seo', '搜索引擎', '关键词', '排名', 'ranking', 'keyword', 'serp', 'sitemap', '收录']
  },
  'backlink': {
    triggers: ['backlink', 'link building', 'link-building', 'outreach', 'guest post', 'external link'],
    aliases: ['backlink', '外链', 'link building', '反链', 'outreach', '链接建设']
  },
  'content-marketing': {
    triggers: ['content creation', 'content marketing', 'blog', 'newsletter', 'copywriting', 'draft content', 'draft-content'],
    aliases: ['content', '内容', 'blog', 'copywriting', '文案', 'newsletter', '写作']
  },
  'competitive-analysis': {
    triggers: ['competitor', 'competitive', 'market positioning', 'battlecard', 'competitive-'],
    aliases: ['competitor', '竞品', '竞争', 'competitive', '对手', 'battlecard', '竞分']
  },
  'scraping': {
    triggers: ['scrape', 'scraping', 'crawl', 'extract data', 'web scraper', 'spider'],
    aliases: ['scrape', '爬虫', 'crawl', '抓取', '采集', 'spider', 'extract']
  },
  'pdf': {
    triggers: ['pdf', '.pdf'],
    aliases: ['pdf']
  },
  'spreadsheet': {
    triggers: ['xlsx', 'excel', 'spreadsheet', '.csv', 'tsv', 'tabular'],
    aliases: ['excel', 'xlsx', '表格', 'spreadsheet', 'csv']
  },
  'slides': {
    triggers: ['pptx', 'slide', 'presentation', 'deck', 'pitch'],
    aliases: ['ppt', 'pptx', '幻灯片', 'slide', 'presentation', 'deck', '演示']
  },
  'document': {
    triggers: ['docx', 'word document', '.docx'],
    aliases: ['docx', 'word', '文档']
  },
  'frontend': {
    triggers: ['frontend', 'front-end', 'ui design', 'web component', 'react', 'css', 'html', 'landing page', 'dashboard'],
    aliases: ['frontend', '前端', 'ui', 'design', '页面', 'component', 'landing', 'dashboard', '界面']
  },
  'database': {
    triggers: ['database', 'mysql', 'sql', 'query', 'postgresql', 'sqlite', 'migration', 'schema'],
    aliases: ['database', '数据库', 'sql', 'mysql', 'query', '查询', 'db']
  },
  'deploy': {
    triggers: ['deploy', 'deployment', 'production', 'ci/cd', 'pm2', 'server', 'hosting'],
    aliases: ['deploy', '部署', 'production', '上线', '发布', 'server', '服务器']
  },
  'debug': {
    triggers: ['debug', 'debugging', 'troubleshoot', 'diagnose', 'error', 'bug fix'],
    aliases: ['debug', '调试', 'bug', '报错', 'error', 'fix', '修复', 'troubleshoot']
  },
  'testing': {
    triggers: ['test', 'testing', 'qa', 'unit test', 'integration test', 'e2e', 'playwright'],
    aliases: ['test', '测试', 'qa', 'unittest', 'e2e', '自动化测试']
  },
  'code-review': {
    triggers: ['code review', 'code-review', 'review code', 'pull request review', 'adversarial review'],
    aliases: ['review', '代码审查', 'code review', 'pr review']
  },
  'video': {
    triggers: ['video', 'youtube', 'tiktok', 'remotion', 'gif', 'animation'],
    aliases: ['video', '视频', 'youtube', 'tiktok', '短视频', 'gif', '动画']
  },
  'email': {
    triggers: ['email', 'mail', 'outreach', 'newsletter', 'email sequence', 'drip'],
    aliases: ['email', '邮件', 'mail', 'outreach', 'newsletter']
  },
  'sales': {
    triggers: ['sales', 'pipeline', 'forecast', 'deal', 'prospect', 'crm', 'call prep'],
    aliases: ['sales', '销售', 'pipeline', 'forecast', 'prospect', 'crm', '客户']
  },
  'project-management': {
    triggers: ['project', 'roadmap', 'sprint', 'milestone', 'epic', 'story', 'kanban', 'scrum'],
    aliases: ['project', '项目', 'roadmap', 'sprint', '规划', 'milestone', '里程碑']
  },
  'planning': {
    triggers: ['plan', 'planning', 'architect', 'design doc', 'spec', 'prd', 'requirement'],
    aliases: ['plan', '计划', '规划', 'spec', 'prd', '需求', 'architecture', '架构']
  },
  'research': {
    triggers: ['research', 'investigate', 'discovery', 'literature', 'study', 'explore'],
    aliases: ['research', '研究', '调研', 'investigate', 'explore', '探索']
  },
  'analytics': {
    triggers: ['analytics', 'metrics', 'data analysis', 'statistics', 'performance report', 'kpi'],
    aliases: ['analytics', '分析', 'metrics', '数据', 'kpi', '报表', 'data', '统计']
  },
  'social-media': {
    triggers: ['social media', 'twitter', 'instagram', 'facebook', 'tiktok', 'influencer', 'brand'],
    aliases: ['social', '社交', '社媒', 'twitter', 'instagram', 'tiktok', '小红书', '抖音']
  },
  'automation': {
    triggers: ['automat', 'workflow', 'n8n', 'zapier', 'script', 'cron', 'schedule'],
    aliases: ['automation', '自动化', 'workflow', 'script', '脚本', 'cron', '定时']
  },
  'browser': {
    triggers: ['chrome', 'browser', 'playwright', 'puppeteer', 'selenium', 'web automation'],
    aliases: ['chrome', '浏览器', 'browser', 'playwright', '网页自动化']
  },
  'mcp-server': {
    triggers: ['mcp', 'model context protocol', 'mcp server', 'mcp-'],
    aliases: ['mcp', '协议', 'server', 'integration']
  },
  'ai-agent': {
    triggers: ['agent', 'multi-agent', 'autonomous', 'crew', 'langgraph', 'autogen'],
    aliases: ['agent', '智能体', 'autonomous', '多agent', 'crew']
  },
  'prompt-engineering': {
    triggers: ['prompt', 'system prompt', 'instruction', 'cursorrule', '.cursorrules'],
    aliases: ['prompt', '提示词', 'system prompt', 'instruction']
  },
  'finance': {
    triggers: ['finance', 'accounting', 'journal entry', 'reconciliation', 'sox', 'income statement', 'variance'],
    aliases: ['finance', '财务', '会计', 'accounting', 'journal', '对账']
  },
  'legal': {
    triggers: ['legal', 'contract', 'nda', 'compliance', 'gdpr', 'privacy'],
    aliases: ['legal', '法务', 'contract', '合同', 'nda', 'compliance', '合规']
  },
  'customer-support': {
    triggers: ['support', 'ticket', 'triage', 'escalat', 'knowledge base', 'kb article'],
    aliases: ['support', '客服', 'ticket', '工单', 'triage', 'escalation']
  },
  'product-management': {
    triggers: ['product', 'prd', 'feature spec', 'roadmap', 'stakeholder', 'user research'],
    aliases: ['product', '产品', 'prd', 'feature', 'roadmap', 'stakeholder']
  },
  'documentation': {
    triggers: ['documentation', 'docs', 'technical writing', 'readme', 'api doc'],
    aliases: ['docs', '文档', 'documentation', 'readme', '写文档']
  },
  'bio-research': {
    triggers: ['bio', 'clinical', 'preprint', 'chembl', 'drug', 'genomic', 'single-cell', 'rna'],
    aliases: ['bio', '生物', 'clinical', '临床', 'drug', '药物', 'genomic']
  },
  'trading': {
    triggers: ['trade', 'trading', 'prediction', 'market', 'forecast', 'macro'],
    aliases: ['trade', '交易', 'trading', 'market', '预测', 'macro', '宏观']
  },
  'health': {
    triggers: ['body', 'health', 'track', 'fitness', 'weight', 'diet'],
    aliases: ['health', '健康', 'body', '身体', 'fitness', '体重', '饮食']
  },
  'art-design': {
    triggers: ['art', 'design', 'creative', 'visual', 'illustration', 'canvas', 'algorithmic'],
    aliases: ['art', '艺术', 'design', '设计', 'creative', '创意', 'visual']
  },
  'promotion': {
    triggers: ['promot', 'marketing', 'growth', 'lead gen', 'campaign', 'nurture'],
    aliases: ['promote', '推广', 'marketing', '营销', 'growth', 'campaign', '活动']
  },
  'security': {
    triggers: ['security', 'secure', 'threat', 'vulnerability', 'pentest'],
    aliases: ['security', '安全', 'secure', 'threat', '漏洞']
  }
};

function extractFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = m[1];
  const name = fm.match(/^name:\s*["']?(.+?)["']?\s*$/m);
  const desc = fm.match(/^description:\s*["']?([\s\S]*?)["']?\s*$/m);
  let d = desc ? desc[1].trim().replace(/["']$/, '').trim() : '';
  if (d.length > 300) d = d.substring(0, 300);
  return { name: name ? name[1].trim() : null, desc: d };
}

// Classify asset into intents
function classifyIntents(name, desc) {
  const text = `${name || ''} ${desc || ''}`.toLowerCase();
  const intents = [];
  for (const [intent, { triggers }] of Object.entries(INTENT_TAXONOMY)) {
    for (const t of triggers) {
      if (text.includes(t)) {
        intents.push(intent);
        break;
      }
    }
  }
  return intents.length > 0 ? intents : ['general'];
}

function buildKeywords(name, desc) {
  const stop = new Set(['a','an','the','is','are','was','were','be','been','being',
    'have','has','had','do','does','did','will','would','shall','should','may',
    'might','must','can','could','this','that','these','those','it','its',
    'for','and','or','but','in','on','at','to','of','with','by','from','as',
    'into','through','during','before','after','above','below','between',
    'use','when','user','wants','any','all','time','also','not','do','if',
    'about','using','used','such','like','including','includes','your','you',
    'they','them','their','more','most','other','than','then','just','only',
    'very','too','so','up','out','no','each','every','both','few','own','same',
    'how','what','which','who','where','why','need','needs','based','via',
    'tool','tools','skill','command','server','create','run','trigger',
    'should','provide','provides','available','specific','type']);

  const text = `${name || ''} ${desc || ''}`.toLowerCase();
  const words = text.match(/[a-z][a-z0-9-]*[a-z0-9]/g) || [];
  return [...new Set(words.filter(w => !stop.has(w) && w.length >= 3))];
}

const assets = [];

// ── Scan all asset sources ───────────────────────────────────────

// 1. Skills
const skillsDir = path.join(CLAUDE_DIR, 'skills');
if (fs.existsSync(skillsDir)) {
  for (const d of fs.readdirSync(skillsDir)) {
    const fp = path.join(skillsDir, d, 'SKILL.md');
    if (!fs.existsSync(fp)) continue;
    const { name, desc } = extractFrontmatter(fs.readFileSync(fp, 'utf8'));
    if (!name) continue;
    assets.push({ type: 'skill', name, invoke: `/${name}`, desc,
      intents: classifyIntents(name, desc), keywords: buildKeywords(name, desc) });
  }
}

// 2. Agents
const agentsDir = path.join(CLAUDE_DIR, 'agents');
if (fs.existsSync(agentsDir)) {
  for (const f of fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'))) {
    const { name, desc } = extractFrontmatter(fs.readFileSync(path.join(agentsDir, f), 'utf8'));
    if (!name) continue;
    assets.push({ type: 'agent', name, invoke: `Agent("${name}")`, desc,
      intents: classifyIntents(name, desc), keywords: buildKeywords(name, desc) });
  }
}

// 3. Commands
const cmdsDir = path.join(CLAUDE_DIR, 'commands');
if (fs.existsSync(cmdsDir)) {
  for (const f of fs.readdirSync(cmdsDir).filter(f => f.endsWith('.md'))) {
    const { name, desc } = extractFrontmatter(fs.readFileSync(path.join(cmdsDir, f), 'utf8'));
    if (!name) continue;
    assets.push({ type: 'command', name, invoke: `/${name}`, desc,
      intents: classifyIntents(name, desc), keywords: buildKeywords(name, desc) });
  }
}

// 4. Plugin Skills & Commands
const pluginsDir = path.join(CLAUDE_DIR, 'plugins');
if (fs.existsSync(pluginsDir)) {
  for (const sub of ['cache', 'marketplaces']) {
    const baseDir = path.join(pluginsDir, sub);
    if (!fs.existsSync(baseDir)) continue;
    const walk = (dir, depth) => {
      if (depth > 6) return;
      try {
        for (const f of fs.readdirSync(dir)) {
          const fp = path.join(dir, f);
          if (fs.statSync(fp).isDirectory()) { walk(fp, depth + 1); continue; }
          if (!f.endsWith('.md') || !(dir.includes('/commands') || dir.includes('/skills/'))) continue;
          const isSkillFile = f === 'SKILL.md';
          let { name: cmdName, desc } = extractFrontmatter(fs.readFileSync(fp, 'utf8'));
          if (!cmdName) cmdName = isSkillFile ? path.basename(path.dirname(fp)) : f.replace(/\.md$/, '');
          if (!cmdName || cmdName === 'commands' || cmdName === 'skills') continue;
          const parts = fp.split('/');
          let pluginName = 'plugin';
          const anchor = isSkillFile ? 'skills' : 'commands';
          const anchorIdx = parts.lastIndexOf(anchor);
          if (anchorIdx >= 1) {
            for (let i = anchorIdx - 1; i >= 0; i--) {
              if (!/^\d+\.\d+/.test(parts[i]) && parts[i] !== sub) { pluginName = parts[i]; break; }
            }
          }
          const fullName = `${pluginName}:${cmdName}`;
          if (assets.some(a => a.name === fullName || a.name === cmdName)) continue;
          assets.push({ type: 'plugin', name: fullName, invoke: `/${fullName}`, desc: desc || '',
            intents: classifyIntents(fullName, desc), keywords: buildKeywords(fullName, desc) });
        }
      } catch (e) {}
    };
    walk(baseDir, 0);
  }
}

// 5. MCP Servers
for (const mcpPath of [path.join(HOME, '.mcp.json'), path.join(CLAUDE_DIR, '.mcp.json')]) {
  if (!fs.existsSync(mcpPath)) continue;
  try {
    const servers = JSON.parse(fs.readFileSync(mcpPath, 'utf8')).mcpServers || {};
    for (const [name, config] of Object.entries(servers)) {
      const desc = `MCP: ${name} (${config.command || ''})`;
      assets.push({ type: 'mcp', name, invoke: `mcp__${name}__*`, desc,
        intents: classifyIntents(name, desc), keywords: buildKeywords(name, desc) });
    }
  } catch (e) {}
}

// 6. Hooks (informational, not suggested)
const hooksDir = path.join(CLAUDE_DIR, 'hooks');
if (fs.existsSync(hooksDir)) {
  for (const f of fs.readdirSync(hooksDir).filter(f => f.endsWith('.js') || f.endsWith('.sh'))) {
    const name = f.replace(/\.(js|sh)$/, '');
    assets.push({ type: 'hook', name, invoke: '(auto)', desc: `Hook: ${name}`,
      intents: ['general'], keywords: [name] });
  }
}

// ── Compute IDF weights ──────────────────────────────────────────
const docCount = assets.length;
const df = {}; // document frequency per keyword
for (const a of assets) {
  const unique = new Set(a.keywords);
  for (const kw of unique) {
    df[kw] = (df[kw] || 0) + 1;
  }
}
const idf = {};
for (const [kw, freq] of Object.entries(df)) {
  idf[kw] = Math.log(docCount / freq);
}

// ── Write index ──────────────────────────────────────────────────
const index = {
  version: 2,
  built_at: new Date().toISOString(),
  total: assets.length,
  intent_taxonomy: Object.fromEntries(
    Object.entries(INTENT_TAXONOMY).map(([k, v]) => [k, v.aliases])
  ),
  idf,
  assets
};

fs.writeFileSync(OUTPUT, JSON.stringify(index));
const types = {};
assets.forEach(a => { types[a.type] = (types[a.type] || 0) + 1; });
console.log(`Asset index v2 built: ${assets.length} assets -> ${OUTPUT}`);
for (const [t, c] of Object.entries(types)) console.log(`  ${t}: ${c}`);
