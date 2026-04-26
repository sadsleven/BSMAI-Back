#!/usr/bin/env node
/* Cross-platform replacement for the previous `cross-var` based migration:create script. */
const { spawnSync } = require('child_process');
const path = require('path');

const name = process.env.npm_config_name;
if (!name) {
  console.error('Usage: npm run migration:create --name=DescName');
  process.exit(1);
}

const cliPath = require.resolve('typeorm/cli.js');
const target = `./src/database/migrations/${name}`;
const res = spawnSync(process.execPath, [cliPath, 'migration:create', target], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
});
process.exit(res.status ?? 1);
