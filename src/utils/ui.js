import chalk from "chalk";
import inquirer from "inquirer";
import boxen from "boxen";
import figlet from "figlet";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "../../package.json"), "utf8")
);

/**
 * 显示启动Banner
 * @param {Object} updateInfo 更新信息（可选）
 */
async function showBanner(updateInfo = null) {
  const banner = figlet.textSync("CCM", {
    font: "Small",
    horizontalLayout: "default",
    verticalLayout: "default",
  });

  let versionText = chalk.gray(`v${packageJson.version}`);

  // 根据更新状态调整版本显示
  if (updateInfo) {
    // 有新版本可用
    versionText += chalk.yellow(" (有更新)");
  } else {
    // 已是最新版本
    versionText += chalk.green(" (最新)");
  }

  let content =
    chalk.cyan.bold(banner) +
    "\n" +
    chalk.white("CCM - 多 AI CLI 配置管理工具") +
    "\n" +
    versionText;

  // 如果有更新信息，添加到 banner 中
  if (updateInfo) {
    content +=
      "\n\n" +
      chalk.yellow("🚀 新版本可用! ") +
      chalk.dim(updateInfo.current) +
      " → " +
      chalk.green(updateInfo.latest) +
      "\n" +
      chalk.gray("运行 ") +
      chalk.cyan("ccm update") +
      chalk.gray(" 更新");
  }

  // 获取并添加配置信息
  const statusBrief = await getCurrentStatusBrief();
  if (statusBrief) {
    content += "\n\n" + statusBrief;
  }

  const boxedBanner = boxen(content, {
    padding: 1,
    margin: 1,
    borderStyle: "round",
    borderColor: "cyan",
    align: "center",
  });

  console.log(boxedBanner);
}

/**
 * 获取当前配置的简短状态信息
 * @returns {string|null} 简短状态信息，如果没有配置则返回null
 */
async function getCurrentStatusBrief() {
  try {
    const { default: ConfigManager } = await import("../core/ConfigManager.js");
    const configManager = new ConfigManager();

    const [currentConfig, currentCodexConfig, currentGeminiConfig] = await Promise.all([
      configManager.getCurrentConfig().catch(() => null),
      configManager.getCurrentCodexConfig().catch(() => null),
      configManager.getCurrentGeminiConfig().catch(() => null),
    ]);

    if (!currentConfig && !currentCodexConfig && !currentGeminiConfig) {
      return null;
    }

    // 创建分割线
    const statusText = "配置状态";
    const totalWidth = 40;
    const textWidth = statusText.length;
    const dashWidth = Math.floor((totalWidth - textWidth) / 2);
    const dividerLine = chalk.gray("╌".repeat(dashWidth) + statusText + "╌".repeat(dashWidth));

    let statusLines = [dividerLine];

    // Claude配置信息
    if (currentConfig) {
      const siteInfo = chalk.cyan(currentConfig.siteName || "未知站点");
      const tokenInfo = chalk.gray(currentConfig.tokenName || "默认Token");
      statusLines.push(`🤖 Claude: ${siteInfo}-${tokenInfo}`);
    }

    // Codex配置信息
    if (currentCodexConfig) {
      const siteInfo = chalk.magenta(currentCodexConfig.siteName || "未知站点");
      const apiKeyInfo = chalk.gray(
        currentCodexConfig.apiKeyName || "默认API Key"
      );
      statusLines.push(`💻 Codex: ${siteInfo}-${apiKeyInfo}`);
    }

    // Gemini配置信息
    if (currentGeminiConfig) {
      const siteInfo = chalk.yellow(currentGeminiConfig.siteName || "未知站点");
      const apiKeyInfo = chalk.gray(
        currentGeminiConfig.apiKeyName || "默认API Key"
      );
      statusLines.push(`🪐 Gemini: ${siteInfo}-${apiKeyInfo}`);
    }

    return statusLines.join("\n");
  } catch (error) {
    return null;
  }
}

/**
 * 显示主菜单
 * @returns {string} 用户选择
 */
async function showMainMenu() {

  const choices = [
    {
      name: "📡 Claude Code API - Claude Code 配置管理",
      value: "api",
      short: "Claude Code API",
    },
    {
      name: "💻 Codex API - Codex配置管理",
      value: "codexapi",
      short: "CodexAPI",
    },
    {
      name: "🪐 Gemini API - Gemini 配置管理",
      value: "geminiapi",
      short: "GeminiAPI",
    },
    {
      name: "🔄 Backup - 备份与恢复",
      value: "backup",
      short: "Backup",
    },
    {
      name: "📊 Status - 查看当前状态",
      value: "status",
      short: "Status",
    },
    {
      name: "❓ Help - 帮助文档",
      value: "help",
      short: "Help",
    },
    new inquirer.Separator(),
    {
      name: "🚪 Exit - 退出",
      value: "exit",
      short: "Exit",
    },
  ];

  const { choice } = await inquirer.prompt([
    {
      type: "list",
      name: "choice",
      message: "请选择功能模块：",
      choices,
      pageSize: 12,
    },
  ]);

  return choice;
}

/**
 * 显示API菜单
 * @param {Object} options 选项参数
 * @param {boolean} options.yoloStatus YOLO模式状态
 * @returns {string} 用户选择
 */
async function showApiMenu(options = {}) {
  console.log(chalk.cyan.bold("\n📡 Claude Code 配置管理"));
  console.log(chalk.gray("═".repeat(40)));

  // 构建通知管理菜单项
  const notificationActionText = options.notificationStatus
    ? "🔕 关闭通知 - 完成和工具批准时禁用系统通知"
    : "🔔 开启通知 - 完成和工具批准时启用系统通知";
  const notificationStatusText = options.notificationStatus
    ? chalk.green("[已开启]")
    : chalk.gray("[已关闭]");

  // 构建YOLO模式菜单项
  const yoloActionText = options.yoloStatus
    ? "🛑 关闭YOLO模式 - 禁用最宽松配置模式"
    : "🚀 开启YOLO模式 - 启用最宽松配置模式";
  const yoloStatusText = options.yoloStatus
    ? chalk.green("[已开启]")
    : chalk.gray("[已关闭]");

  const choices = [
    {
      name: "🔄 切换配置 - 切换API配置",
      value: "switch",
      short: "切换配置",
    },
    {
      name: "📋 查看配置 - 列出所有配置",
      value: "list",
      short: "查看配置",
    },
    {
      name: "➕ 添加配置 - 添加新的API配置",
      value: "add",
      short: "添加配置",
    },
    {
      name: "📝 编辑配置 - 修改现有配置",
      value: "edit",
      short: "编辑配置",
    },
    {
      name: "❌ 删除配置 - 删除API配置",
      value: "delete",
      short: "删除配置",
    },
    {
      name: `${notificationActionText} ${notificationStatusText} ${chalk.yellow("[NEW]")}`,
      value: "notification",
      short: "通知管理",
    },
    {
      name: `${yoloActionText} ${yoloStatusText}`,
      value: "yolo",
      short: "YOLO模式",
    },
    new inquirer.Separator(),
    createBackChoice("back"),
  ];

  const { choice } = await inquirer.prompt([
    {
      type: "list",
      name: "choice",
      message: "请选择操作：",
      choices,
      pageSize: 10,
    },
  ]);

  return choice;
}

/**
 * 选择站点
 * @param {Object} sites 站点配置
 * @returns {string} 选择的站点key
 */
async function selectSite(sites) {
  const choices = Object.entries(sites).map(([key, config]) => {
    const icon = getSiteIcon(key, config);
    // 新格式中站点名称就是key本身
    return {
      name: `${icon} ${key}`,
      value: key,
      short: key,
    };
  });

  // 添加返回选项
  choices.push(createBackChoice("__back__"));

  const { site } = await inquirer.prompt([
    {
      type: "list",
      name: "site",
      message: "选择站点：",
      choices,
      pageSize: 10,
    },
  ]);

  return site;
}

/**
 * 选择URL
 * @param {Object} urls URL配置
 * @returns {string} 选择的URL
 */
async function selectUrl(urls) {
  const choices = Object.entries(urls).map(([name, url]) => ({
    name: `${getRegionIcon(name)} ${name} (${url})`,
    value: url,
    short: name,
  }));

  const { url } = await inquirer.prompt([
    {
      type: "list",
      name: "url",
      message: "选择URL线路：",
      choices,
      pageSize: 10,
    },
  ]);

  return url;
}

/**
 * 选择Token
 * @param {Object} tokens Token配置
 * @returns {string} 选择的Token
 */
async function selectToken(tokens) {
  const choices = Object.entries(tokens).map(([name, token]) => ({
    name: `${getTokenIcon(name)} ${name} (${token.substring(0, 10)}...)`,
    value: token,
    short: name,
  }));

  // 添加返回选项
  choices.push(createBackChoice("__back__"));

  const { token } = await inquirer.prompt([
    {
      type: "list",
      name: "token",
      message: "选择Token：",
      choices,
      pageSize: 10,
    },
  ]);

  return token;
}

/**
 * 确认配置切换
 * @param {Object} config 配置信息
 * @returns {boolean} 是否确认
 */
async function confirmSwitch(config) {
  console.log(chalk.white("\n📋 即将切换到以下配置："));

  const configBox = boxen(
    `${chalk.white("站点：")} ${chalk.cyan(config.siteName)}\n` +
      `${chalk.white("ANTHROPIC_BASE_URL：")} ${chalk.cyan(
        config.ANTHROPIC_BASE_URL
      )}\n` +
      `${chalk.white("Token：")} ${chalk.cyan(
        config.token.substring(0, 20) + "..."
      )}`,
    {
      padding: 1,
      margin: { top: 0, bottom: 1, left: 0, right: 0 },
      borderStyle: "round",
      borderColor: "yellow",
    }
  );

  console.log(configBox);

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "确认切换配置？",
      default: true,
    },
  ]);

  return confirm;
}

/**
 * 显示成功消息
 * @param {string} message 消息内容
 */
function showSuccess(message) {
  console.log(chalk.green("✨ " + message));
}

/**
 * 显示警告消息
 * @param {string} message 消息内容
 */
function showWarning(message) {
  console.log(chalk.yellow("⚠️  " + message));
}

/**
 * 显示错误消息
 * @param {string} message 消息内容
 */
function showError(message) {
  console.log(chalk.red("❌ " + message));
}

/**
 * 显示信息消息
 * @param {string} message 消息内容
 */
function showInfo(message) {
  console.log(chalk.blue("ℹ️  " + message));
}

/**
 * 获取站点图标（通用版）
 * @param {string} siteKey 站点标识
 * @param {Object} siteConfig 站点配置对象（可选）
 * @returns {string} 图标
 */
function getSiteIcon(siteKey, siteConfig = null) {
  return "🌐"; // 通用网络服务图标
}

/**
 * 获取地区图标
 * @param {string} regionName 地区名称
 * @returns {string} 图标
 */
function getRegionIcon(regionName) {
  const lowerName = regionName.toLowerCase();
  if (lowerName.includes("日本") || lowerName.includes("japan")) return "🇯🇵";
  if (lowerName.includes("新加坡") || lowerName.includes("singapore"))
    return "🇸🇬";
  if (lowerName.includes("美国") || lowerName.includes("usa")) return "🇺🇸";
  if (lowerName.includes("香港") || lowerName.includes("hongkong")) return "🇭🇰";
  if (lowerName.includes("大陆") || lowerName.includes("china")) return "🇨🇳";
  return "🌍";
}

/**
 * 获取Token图标（固定版）
 * @param {string} tokenName Token名称
 * @returns {string} 图标
 */
function getTokenIcon(tokenName) {
  return "🔑"; // 固定Token图标
}

/**
 * 通用返回确认
 * @param {string} message 提示消息
 * @returns {Promise<void>} 等待用户确认返回
 */
async function waitForBackConfirm(message = "操作完成") {
  await inquirer.prompt([
    {
      type: "list",
      name: "back",
      message: `${message}：`,
      choices: [createBackChoice("back")],
    },
  ]);
}

/**
 * 创建标准返回按钮选项
 * @param {string} value - 返回值 ('back' | '__back__')
 * @returns {Object} 标准返回按钮配置
 */
function createBackChoice(value = "back") {
  return {
    name: "⬅️  返回上一级菜单",
    value: value,
    short: "返回",
  };
}

export {
  showBanner,
  showMainMenu,
  showApiMenu,
  selectSite,
  selectUrl,
  selectToken,
  confirmSwitch,
  showSuccess,
  showWarning,
  showError,
  showInfo,
  getSiteIcon,
  getRegionIcon,
  getTokenIcon,
  waitForBackConfirm,
  createBackChoice,
  getCurrentStatusBrief,
};
