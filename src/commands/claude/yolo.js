import chalk from 'chalk';

/**
 * Claude Code YOLO模式钩子处理器
 * 无条件批准所有工具的使用请求
 * 用作Claude Code PreToolUse hooks的处理命令
 */
class ClaudeYoloHook {
  /**
   * 执行YOLO模式处理逻辑
   * 从stdin读取输入，无条件返回approve决策
   */
  async execute() {
    return new Promise((resolve, reject) => {
      const chunks = [];

      // 读取 stdin 输入
      process.stdin.on('data', chunk => {
        chunks.push(chunk);
      });

      // 处理输入结束
      process.stdin.on('end', () => {
        try {
          // 解析输入数据获取工具名称
          const jsonData = Buffer.concat(chunks).toString().trim();
          const hookData = JSON.parse(jsonData);
          const toolName = hookData.tool_name;

          // ! ExitPlanMode 必须用户手动确认，不自动批准
          // 不返回任何决策，让 Claude Code 弹出确认窗口
          if (toolName === 'ExitPlanMode') {
            // 静默退出，不输出任何 JSON
            // Claude Code 检测不到决策时会触发用户确认流程
            process.exit(0);
            return;
          }

          // 其他工具继续 YOLO 自动批准
          const response = {
            decision: 'approve',
            reason: 'YOLO mode: All tools approved automatically - no restrictions'
          };

          console.log(JSON.stringify(response));
          resolve();
        } catch (error) {
          // 解析失败时默认批准（保持 YOLO 宽松特性）
          const response = {
            decision: 'approve',
            reason: 'YOLO mode: Approved despite parsing error - no restrictions'
          };

          console.log(JSON.stringify(response));
          resolve();
        }
      });

      // 处理stdin错误
      process.stdin.on('error', error => {
        // 即使 stdin 错误也批准
        const response = {
          decision: 'approve',
          reason: 'YOLO mode: Approved despite stdin error - no restrictions'
        };

        console.log(JSON.stringify(response));
        resolve();
      });

      // 设置超时处理，防止无限等待
      const timeout = setTimeout(() => {
        const response = {
          decision: 'approve',
          reason: 'YOLO mode: Approved due to timeout - no restrictions'
        };

        console.log(JSON.stringify(response));
        resolve();
      }, 5000); // 5秒超时

      // 清理超时处理器
      process.stdin.on('end', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log(chalk.cyan.bold('🚀 Claude YOLO Hook'));
    console.log();
    console.log(chalk.white('功能:'));
    console.log('  作为Claude Code PreToolUse hooks的处理命令');
    console.log('  无条件批准所有工具的使用请求');
    console.log();
    console.log(chalk.yellow('⚠️  警告:'));
    console.log('  此命令仅供Claude Code hooks内部使用');
    console.log('  启用YOLO模式会自动批准所有工具操作，请谨慎使用');
    console.log();
    console.log(chalk.white('相关命令:'));
    console.log('  ccm api       管理API配置并开启/关闭YOLO模式');
    console.log('  ccm codexapi  管理Codex配置并开启/关闭YOLO模式');
  }
}

export default new ClaudeYoloHook();
