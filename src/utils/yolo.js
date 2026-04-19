import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { waitForBackConfirm } from './ui.js';

/**
 * YOLO模式管理工具类
 * 负责Claude Code的YOLO模式开启和关闭
 */
class YoloManager {
  constructor() {
    this.claudeDir = path.join(os.homedir(), '.claude');
    this.claudeSettingsFile = path.join(this.claudeDir, 'settings.json');
    this.yoloCommand = 'ccm claude-yolo'; // YOLO模式使用的命令
  }

  isYoloHookCommand(command) {
    return (
      typeof command === 'string' &&
      (
        command.includes('ccm claude-yolo') ||
        command.includes('cc claude-yolo') ||
        command.includes('claude-yolo')
      )
    );
  }

  /**
   * 检查YOLO模式状态
   * @returns {boolean} true表示已开启，false表示未开启
   */
  async checkYoloModeStatus() {
    try {
      // 如果配置文件不存在，认为未开启
      if (!await fs.pathExists(this.claudeSettingsFile)) {
        return false;
      }

      // 读取配置文件内容
      const settingsContent = await fs.readFile(this.claudeSettingsFile, 'utf8');
      const settings = JSON.parse(settingsContent);

      // 检查是否存在YOLO模式的hooks配置
      if (settings.hooks && settings.hooks.PreToolUse) {
        for (const hook of settings.hooks.PreToolUse) {
          if (hook.hooks && hook.hooks.some(h =>
            h.type === 'command' &&
            h.command &&
            this.isYoloHookCommand(h.command)
          )) {
            return true;
          }
        }
      }

      return false;

    } catch (error) {
      // 发生错误时认为未开启
      return false;
    }
  }

  /**
   * 开启或关闭YOLO模式
   * @param {Object} options 选项
   * @param {boolean} options.showConfirm 是否显示完成确认，默认true
   */
  async toggleYoloMode(options = { showConfirm: true }) {
    try {
      // 检查当前YOLO模式状态
      const currentStatus = await this.checkYoloModeStatus();

      // 确保Claude配置目录存在
      await fs.ensureDir(this.claudeDir);

      if (currentStatus) {
        // 当前已开启，关闭YOLO模式
        console.log(chalk.yellow('\n🛑 关闭YOLO模式...'));
        console.log(chalk.gray('将移除Claude Code hooks配置'));

        await this.removeYoloHooks();

        console.log(chalk.green('✅ YOLO模式已关闭！'));
        console.log(chalk.blue('ℹ️  已恢复为安全模式'));
      } else {
        // 当前未开启，开启YOLO模式
        console.log(chalk.yellow('\n🚀 开启YOLO模式...'));
        console.log(chalk.gray('将设置Claude Code最宽松配置模式'));
        console.log(chalk.gray(`使用命令: ${this.yoloCommand}`));

        // 添加hooks配置
        await this.addYoloHooks();

        console.log(chalk.green('✅ YOLO模式已开启！'));
        console.log(chalk.yellow('⚠️  警告：当前为最宽松模式，请谨慎使用'));
      }

      console.log(chalk.gray(`配置文件: ${this.claudeSettingsFile}`));

      // 可选的用户确认
      if (options.showConfirm) {
        await waitForBackConfirm('YOLO模式操作完成');
      }

      return !currentStatus; // 返回新状态

    } catch (error) {
      console.error(chalk.red('❌ 操作YOLO模式失败:'), error.message);

      // 错误情况下也可选确认
      if (options.showConfirm) {
        await waitForBackConfirm('操作完成');
      }

      throw error;
    }
  }

  /**
   * 添加YOLO模式hooks配置
   * @private
   */
  async addYoloHooks() {
    let settings = {};

    // 读取现有配置
    if (await fs.pathExists(this.claudeSettingsFile)) {
      const settingsContent = await fs.readFile(this.claudeSettingsFile, 'utf8');
      settings = JSON.parse(settingsContent);
    }

    // 确保hooks结构存在
    if (!settings.hooks) {
      settings.hooks = {};
    }
    if (!settings.hooks.PreToolUse) {
      settings.hooks.PreToolUse = [];
    }

    // 添加YOLO模式hooks配置
    const yoloHook = {
      matcher: ".*",
      hooks: [
        {
          type: "command",
          command: this.yoloCommand
        }
      ]
    };

    // 检查是否已存在相同配置，避免重复添加
    const existingHook = settings.hooks.PreToolUse.find(hook =>
      hook.hooks && hook.hooks.some(h =>
        h.type === 'command' &&
        h.command &&
        this.isYoloHookCommand(h.command)
      )
    );

    if (!existingHook) {
      settings.hooks.PreToolUse.push(yoloHook);
    }

    // 写入配置文件
    await fs.writeFile(this.claudeSettingsFile, JSON.stringify(settings, null, 2), 'utf8');
  }

  /**
   * 移除YOLO模式hooks配置
   * @private
   */
  async removeYoloHooks() {
    if (!await fs.pathExists(this.claudeSettingsFile)) {
      return;
    }

    // 读取现有配置
    const settingsContent = await fs.readFile(this.claudeSettingsFile, 'utf8');
    const settings = JSON.parse(settingsContent);

    // 移除YOLO模式hooks配置
    if (settings.hooks && settings.hooks.PreToolUse) {
      settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(hook =>
        !(hook.hooks && hook.hooks.some(h =>
          h.type === 'command' &&
          h.command &&
          this.isYoloHookCommand(h.command)
        ))
      );

      // 如果PreToolUse为空，可以选择保留空数组或删除
      if (settings.hooks.PreToolUse.length === 0) {
        delete settings.hooks.PreToolUse;
      }

      // 如果hooks为空，删除hooks节点
      if (Object.keys(settings.hooks).length === 0) {
        delete settings.hooks;
      }
    }

    // 写入配置文件
    await fs.writeFile(this.claudeSettingsFile, JSON.stringify(settings, null, 2), 'utf8');
  }

  /**
   * 获取YOLO模式相关配置文件路径
   * @returns {Object} 配置文件路径信息
   */
  getConfigPaths() {
    return {
      claudeDir: this.claudeDir,
      settingsFile: this.claudeSettingsFile,
      yoloCommand: this.yoloCommand
    };
  }
}

// 导出单例实例
export default new YoloManager();
