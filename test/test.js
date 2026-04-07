#!/usr/bin/env node
// Quick smoke test for CC Status Board
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'src');
const passed = [];
const failed = [];

function test(name, fn) {
  try {
    fn();
    passed.push(name);
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (e) {
    failed.push(name);
    console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`);
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

console.log('\nCC Status Board — Tests\n');

// Test statusline
test('statusline renders model and context', () => {
  const input = JSON.stringify({
    model: { display_name: 'Opus' },
    workspace: { current_dir: '/Users/test/myproject' },
    context_window: { remaining_percentage: 85, context_window_size: 1000000 }
  });
  const out = execSync(`echo '${input}' | node ${path.join(SRC, 'statusline.js')}`, { encoding: 'utf8' });
  assert(out.includes('Opus'), 'should contain model name');
  assert(out.includes('myproject'), 'should contain directory');
  assert(out.includes('%'), 'should contain percentage');
});

// Test index builder (if ~/.claude exists)
const claudeDir = path.join(os.homedir(), '.claude');
if (fs.existsSync(claudeDir)) {
  test('index builder scans assets', () => {
    const out = execSync(`CC_SKIP_BILINGUAL=1 node ${path.join(SRC, 'build-index.js')}`, { encoding: 'utf8' });
    assert(out.includes('Asset index'), 'should output index summary');
  });

  // Test asset suggest
  test('asset suggest matches "pdf"', () => {
    execSync(`echo '{"message":"help me create a PDF report"}' | node ${path.join(SRC, 'asset-suggest.js')}`);
    const bridge = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'claude-asset-suggest.json'), 'utf8'));
    assert(bridge.top.length > 0, 'should have suggestions');
    assert(bridge.top[0].invoke.includes('pdf'), 'top match should be pdf');
  });

  test('asset suggest matches "debug"', () => {
    execSync(`echo '{"message":"debug this api error"}' | node ${path.join(SRC, 'asset-suggest.js')}`);
    const bridge = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'claude-asset-suggest.json'), 'utf8'));
    assert(bridge.top.length > 0, 'should have suggestions');
    assert(bridge.top[0].invoke.toLowerCase().includes('debug'), 'top match should be debug-related');
  });

  test('short messages skip gracefully', () => {
    execSync(`echo '{"message":"hi"}' | node ${path.join(SRC, 'asset-suggest.js')}`);
    // Should not crash
  });

  test('asset suggest matches Chinese "调试这个错误"', () => {
    execSync(`echo '{"message":"调试这个错误"}' | node ${path.join(SRC, 'asset-suggest.js')}`);
    const bridgePath = path.join(os.tmpdir(), 'claude-asset-suggest.json');
    if (fs.existsSync(bridgePath)) {
      const bridge = JSON.parse(fs.readFileSync(bridgePath, 'utf8'));
      assert(bridge.top.length > 0, 'should have suggestions for Chinese input');
    }
    // Even if no match (no bilingual index), should not crash
  });

  test('slash commands skip', () => {
    execSync(`echo '{"message":"/help"}' | node ${path.join(SRC, 'asset-suggest.js')}`);
    // Should not crash
  });
}

console.log(`\n  ${passed.length} passed, ${failed.length} failed\n`);
process.exit(failed.length > 0 ? 1 : 0);
