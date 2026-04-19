#!/usr/bin/env node

import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 读取 package.json
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

// 设置程序信息
program
  .name('ccm')
  .description('CCM - Claude Code配置管理CLI工具')
  .version(packageJson.version);

// 导入主程序入口
const { default: main } = await import('../src/index.js');

// 启动主程序
main(program)
  .catch(error => {
    console.error('❌ 程序执行错误:', error.message);
    process.exit(1);
  });
