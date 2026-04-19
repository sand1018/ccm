import fs from "fs-extra";
import path from "path";
import os from "os";
import chalk from "chalk";

/**
 * 配置管理器
 * 负责读取、写入和管理Claude API配置
 */
class ConfigManager {
  constructor() {
    this.homeDir = os.homedir();
    this.claudeDir = path.join(this.homeDir, ".claude");
    this.ccmDir = path.join(this.homeDir, ".ccm");
    this.geminiDir = path.join(this.homeDir, ".gemini");
    this.settingsPath = path.join(this.claudeDir, "settings.json");
    this.claudeConfigPath = path.join(this.claudeDir, "config.json");
    this.geminiEnvPath = path.join(this.geminiDir, ".env");

    // 查找配置文件路径，优先使用 .ccm，兼容 .claude
    this.configPath = this.findConfigPath();
  }

  /**
   * 查找API配置文件路径
   * @returns {string} 配置文件路径
   */
  findConfigPath() {
    const possiblePaths = [
      path.join(this.ccmDir, "api_configs.json"), // 首选：.ccm目录
      path.join(this.claudeDir, "api_configs.json"), // 兼容：.claude目录
    ];

    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }

    // 如果都不存在，返回默认路径（.ccm目录）
    return path.join(this.ccmDir, "api_configs.json");
  }

  /**
   * 确保配置目录存在
   */
  async ensureConfigDir() {
    try {
      await fs.ensureDir(this.claudeDir);
      await fs.ensureDir(this.ccmDir);
      await fs.ensureDir(this.geminiDir);
    } catch (error) {
      throw new Error(`创建配置目录失败: ${error.message}`);
    }
  }

  /**
   * 读取所有API配置
   * @returns {Object} 配置对象
   */
  async getAllConfigs() {
    try {
      await this.ensureConfigDir();

      if (!(await fs.pathExists(this.configPath))) {
        throw new Error("API配置文件不存在，请检查 ~/.ccm/api_configs.json");
      }

      const configContent = await fs.readFile(this.configPath, "utf8");
      const config = JSON.parse(configContent);

      // 支持claude别名：自动将claude字段映射为config字段
      if (config.sites) {
        for (const siteKey in config.sites) {
          const site = config.sites[siteKey];
          if (site.claude && !site.config) {
            site.config = site.claude;
          }
        }
      }

      return config;
    } catch (error) {
      if (error.message.includes("API配置文件不存在")) {
        throw error;
      }
      throw new Error(`读取配置文件失败: ${error.message}`);
    }
  }

  /**
   * 获取当前使用的配置
   * @returns {Object} 当前配置
   */
  async getCurrentConfig() {
    try {
      const allConfigs = await this.getAllConfigs();
      return allConfigs.currentConfig || null;
    } catch (error) {
      console.warn(chalk.yellow("⚠️  读取当前配置失败:"), error.message);
      return null;
    }
  }

  /**
   * 获取当前使用的Codex配置
   * @returns {Object} 当前Codex配置
   */
  async getCurrentCodexConfig() {
    try {
      const allConfigs = await this.getAllConfigs();
      return allConfigs.currentCodexConfig || null;
    } catch (error) {
      console.warn(chalk.yellow("⚠️  读取当前Codex配置失败:"), error.message);
      return null;
    }
  }

  /**
   * 获取当前使用的Gemini配置
   * @returns {Object} 当前Gemini配置
   */
  async getCurrentGeminiConfig() {
    try {
      const allConfigs = await this.getAllConfigs();
      return allConfigs.currentGeminiConfig || null;
    } catch (error) {
      console.warn(chalk.yellow("⚠️  读取当前Gemini配置失败:"), error.message);
      return null;
    }
  }

  /**
   * 保存当前配置
   * @param {Object} config 配置对象
   */
  async saveCurrentConfig(config) {
    try {
      await this.ensureConfigDir();

      const configToSave = {
        site: config.site,
        siteName: config.siteName,
        url: config.url,
        urlName: config.urlName,
        token: config.token,
        tokenName: config.tokenName,
        updatedAt: new Date().toISOString(),
      };

      // 读取现有配置
      const allConfigs = await this.getAllConfigs();

      // 更新当前配置
      allConfigs.currentConfig = configToSave;

      // 规范化配置（清理冗余 + 迁移老格式）
      const normalizedConfig = this.normalizeConfig(allConfigs);

      // 保存到 api_configs.json
      await fs.writeFile(
        this.configPath,
        JSON.stringify(normalizedConfig, null, 2),
        "utf8"
      );
    } catch (error) {
      throw new Error(`保存当前配置失败: ${error.message}`);
    }
  }

  /**
   * 保存当前Codex配置
   * @param {Object} config Codex配置对象
   */
  async saveCurrentCodexConfig(config) {
    try {
      await this.ensureConfigDir();

      const configToSave = {
        site: config.site,
        siteName: config.siteName,
        model: config.model,
        apiKey: config.apiKey,
        apiKeyName: config.apiKeyName,
        provider: config.provider,
        providerName: config.providerName,
        baseUrl: config.baseUrl,
        updatedAt: new Date().toISOString(),
      };

      // 读取现有配置
      const allConfigs = await this.getAllConfigs();

      // 更新当前Codex配置
      allConfigs.currentCodexConfig = configToSave;

      // 规范化配置（清理冗余 + 迁移老格式）
      const normalizedConfig = this.normalizeConfig(allConfigs);

      // 保存到 api_configs.json
      await fs.writeFile(
        this.configPath,
        JSON.stringify(normalizedConfig, null, 2),
        "utf8"
      );
    } catch (error) {
      throw new Error(`保存当前Codex配置失败: ${error.message}`);
    }
  }

  /**
   * 保存当前Gemini配置
   * @param {Object} config Gemini配置对象
   */
  async saveCurrentGeminiConfig(config) {
    try {
      await this.ensureConfigDir();

      const configToSave = {
        site: config.site,
        siteName: config.siteName,
        model: config.model,
        apiKey: config.apiKey,
        apiKeyName: config.apiKeyName,
        baseUrl: config.baseUrl,
        updatedAt: new Date().toISOString(),
      };

      const allConfigs = await this.getAllConfigs();
      allConfigs.currentGeminiConfig = configToSave;

      const normalizedConfig = this.normalizeConfig(allConfigs);

      await fs.writeFile(
        this.configPath,
        JSON.stringify(normalizedConfig, null, 2),
        "utf8"
      );
    } catch (error) {
      throw new Error(`保存当前Gemini配置失败: ${error.message}`);
    }
  }

  /**
   * 读取config.json配置
   * @returns {Object} config配置对象
   */
  async getClaudeConfigJson() {
    try {
      if (!(await fs.pathExists(this.claudeConfigPath))) {
        return {};
      }
      const configContent = await fs.readFile(this.claudeConfigPath, "utf8");
      return JSON.parse(configContent);
    } catch (error) {
      console.warn(chalk.yellow("⚠️  读取~/.claude/config.json失败:"), error.message);
      return {};
    }
  }

  /**
   * 读取settings.json配置
   * @returns {Object} settings配置对象
   */
  async getSettings() {
    try {
      if (!(await fs.pathExists(this.settingsPath))) {
        return {};
      }
      const settingsContent = await fs.readFile(this.settingsPath, "utf8");
      return JSON.parse(settingsContent);
    } catch (error) {
      console.warn(chalk.yellow("⚠️  读取settings.json失败:"), error.message);
      return {};
    }
  }

  /**
   * 保存config.json配置
   * @param {Object} config config配置对象
   */
  async saveClaudeConfigJson(config) {
    try {
      await this.ensureConfigDir();
      await fs.writeFile(
        this.claudeConfigPath,
        JSON.stringify(config, null, 2),
        "utf8"
      );
    } catch (error) {
      throw new Error(`保存~/.claude/config.json失败: ${error.message}`);
    }
  }

  /**
   * 保存settings.json配置
   * @param {Object} settings settings配置对象
   */
  async saveSettings(settings) {
    try {
      await this.ensureConfigDir();
      await fs.writeFile(
        this.settingsPath,
        JSON.stringify(settings, null, 2),
        "utf8"
      );
    } catch (error) {
      throw new Error(`保存settings.json失败: ${error.message}`);
    }
  }

  /**
   * 深度合并对象
   * @param {Object} target 目标对象
   * @param {Object} source 源对象
   * @returns {Object} 合并后的对象
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          typeof source[key] === "object" &&
          source[key] !== null &&
          !Array.isArray(source[key])
        ) {
          result[key] = this.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * 切换API配置
   * @param {string} site 站点标识
   * @param {string} token Token值
   * @param {Object} siteConfig 站点配置对象
   */
  async switchConfig(site, token, siteConfig) {
    try {
      // 获取Claude配置（兼容老格式）
      const claudeConfig = this.getClaudeConfig(siteConfig);

      // 找到Token的名称
      const rawTokens = claudeConfig.env.ANTHROPIC_AUTH_TOKEN;
      const tokens =
        typeof rawTokens === "string" ? { 默认Token: rawTokens } : rawTokens;
      const tokenName = Object.keys(tokens).find(
        (key) => tokens[key] === token
      );

      const config = {
        site,
        siteName: site,
        ANTHROPIC_BASE_URL: claudeConfig.env.ANTHROPIC_BASE_URL,
        token,
        tokenName,
      };

      await this.saveCurrentConfig(config);

      // 读取当前settings.json 和 config.json
      const currentSettings = await this.getSettings();
      const currentConfigJson = await this.getClaudeConfigJson();

      // 清空现有的config.json的primaryApiKey配置
      if (currentConfigJson.primaryApiKey) {
        delete currentConfigJson.primaryApiKey;
      }

      // 为config.json添加站点名称的配置解决强制登陆问题：https://linux.do/t/topic/999263/13
      currentConfigJson.primaryApiKey = config.siteName;

      // 需要删除重置的配置项
      if (currentSettings.env) {
        // 清理认证相关字段
        delete currentSettings.env.ANTHROPIC_AUTH_TOKEN;
        delete currentSettings.env.ANTHROPIC_AUTH_KEY;
        delete currentSettings.env.ANTHROPIC_API_KEY;
        delete currentSettings.env.ANTHROPIC_MODEL;

        // 清理 URL 配置（避免 ANTHROPIC_BASE_URL 和 ANTHROPIC_VERTEX_BASE_URL 冲突）
        delete currentSettings.env.ANTHROPIC_BASE_URL;
        delete currentSettings.env.ANTHROPIC_VERTEX_BASE_URL;
        delete currentSettings.env.ANTHROPIC_VERTEX_PROJECT_ID;

        // 清理 Vertex AI 相关配置
        delete currentSettings.env.CLAUDE_CODE_USE_VERTEX;
        delete currentSettings.env.CLAUDE_CODE_SKIP_VERTEX_AUTH;
      }
      // 重置模型配置
      delete currentSettings.model;

      // 准备合并的配置
      const configToMerge = { ...claudeConfig };

      // 特殊处理：ANTHROPIC_AUTH_TOKEN使用选中的具体token值
      if (configToMerge.env && configToMerge.env.ANTHROPIC_AUTH_TOKEN) {
        configToMerge.env.ANTHROPIC_AUTH_TOKEN = token;
      }

      // 深度合并配置
      const mergedSettings = this.deepMerge(currentSettings, configToMerge);

      // 保存合并后的settings.json 和 config.json
      await this.saveSettings(mergedSettings);
      await this.saveClaudeConfigJson(currentConfigJson);

      return config;
    } catch (error) {
      throw new Error(`切换配置失败: ${error.message}`);
    }
  }

  /**
   * 验证配置格式
   * @param {Object} config 配置对象
   * @returns {boolean} 是否有效
   */
  validateConfig(config) {
    if (!config || typeof config !== "object") {
      return false;
    }

    if (!config.sites || typeof config.sites !== "object") {
      return false;
    }

    for (const [siteKey, siteConfig] of Object.entries(config.sites)) {
      if (!siteConfig.url) {
        return false;
      }

      // 尝试获取Claude配置
      let actualConfig;
      try {
        actualConfig = this.getClaudeConfig(siteConfig);
      } catch (error) {
        return false; // 没有claude或config字段
      }

      // 检查必需的env配置
      if (!actualConfig.env || !actualConfig.env.ANTHROPIC_AUTH_TOKEN) {
        return false;
      }

      const hasBaseUrl = actualConfig.env.ANTHROPIC_BASE_URL;
      const hasVertexBaseUrl = actualConfig.env.ANTHROPIC_VERTEX_BASE_URL;

      // BASE_URL和VERTEX_BASE_URL互斥,不能同时存在
      if (hasBaseUrl && hasVertexBaseUrl) {
        return false;
      }

      // 必须至少有一个URL配置
      if (!hasBaseUrl && !hasVertexBaseUrl) {
        return false;
      }

      // 验证BASE_URL类型
      if (hasBaseUrl && typeof actualConfig.env.ANTHROPIC_BASE_URL !== "string") {
        return false;
      }

      // 验证VERTEX_BASE_URL类型
      if (hasVertexBaseUrl && typeof actualConfig.env.ANTHROPIC_VERTEX_BASE_URL !== "string") {
        return false;
      }

      const authToken = actualConfig.env.ANTHROPIC_AUTH_TOKEN;
      if (typeof authToken === "string") {
        if (!authToken.trim()) return false;
      } else if (typeof authToken === "object" && authToken !== null) {
        if (Object.keys(authToken).length === 0) return false;
      } else {
        return false;
      }
    }

    return true;
  }

  /**
   * 获取Gemini配置
   * @param {Object} siteConfig 站点配置对象
   * @returns {Object} Gemini配置对象
   */
  getGeminiConfig(siteConfig) {
    if (siteConfig.gemini) {
      return siteConfig.gemini;
    }

    throw new Error("站点配置缺少gemini字段");
  }

  /**
   * 验证Gemini配置格式
   * @param {Object} geminiConfig Gemini配置对象
   * @returns {boolean} 是否有效
   */
  validateGeminiSiteConfig(geminiConfig) {
    if (!geminiConfig || typeof geminiConfig !== "object") {
      return false;
    }

    if (!geminiConfig.env || typeof geminiConfig.env !== "object") {
      return false;
    }

    const apiKeyConfig = geminiConfig.env.GEMINI_API_KEY;
    if (!apiKeyConfig) {
      return false;
    }

    if (typeof apiKeyConfig === "string") {
      return Boolean(apiKeyConfig.trim());
    }

    if (typeof apiKeyConfig === "object" && apiKeyConfig !== null) {
      return Object.keys(apiKeyConfig).length > 0;
    }

    return false;
  }

  /**
   * 切换Gemini配置
   * @param {string} site 站点标识
   * @param {string} apiKey API Key
   * @param {Object} siteConfig 站点配置对象
   * @returns {Object} 当前Gemini配置
   */
  async switchGeminiConfig(site, apiKey, siteConfig) {
    try {
      const geminiConfig = this.getGeminiConfig(siteConfig);
      if (!this.validateGeminiSiteConfig(geminiConfig)) {
        throw new Error("Gemini配置格式无效");
      }

      const rawApiKeys = geminiConfig.env.GEMINI_API_KEY;
      const apiKeys =
        typeof rawApiKeys === "string"
          ? { "默认API Key": rawApiKeys }
          : rawApiKeys;
      const apiKeyName = Object.keys(apiKeys).find((key) => apiKeys[key] === apiKey);

      const currentConfig = {
        site,
        siteName: site,
        apiKey,
        apiKeyName: apiKeyName || "默认API Key",
        model: geminiConfig.env.GEMINI_MODEL || null,
        baseUrl: geminiConfig.env.GOOGLE_GEMINI_BASE_URL || null,
      };

      await this.writeGeminiEnv({
        GEMINI_API_KEY: apiKey,
        ...(geminiConfig.env.GEMINI_MODEL
          ? { GEMINI_MODEL: geminiConfig.env.GEMINI_MODEL }
          : {}),
        ...(geminiConfig.env.GOOGLE_GEMINI_BASE_URL
          ? { GOOGLE_GEMINI_BASE_URL: geminiConfig.env.GOOGLE_GEMINI_BASE_URL }
          : {}),
      });

      await this.saveCurrentGeminiConfig(currentConfig);
      return currentConfig;
    } catch (error) {
      throw new Error(`切换Gemini配置失败: ${error.message}`);
    }
  }

  /**
   * 写入 Gemini .env 配置
   * @param {Object} envConfig 需要写入的环境变量
   */
  async writeGeminiEnv(envConfig) {
    await this.ensureConfigDir();

    let existingEnv = {};
    if (await fs.pathExists(this.geminiEnvPath)) {
      const content = await fs.readFile(this.geminiEnvPath, "utf8");
      existingEnv = this.parseEnvFile(content);
    }

    const managedKeys = [
      "GEMINI_API_KEY",
      "GEMINI_MODEL",
      "GOOGLE_GEMINI_BASE_URL",
    ];

    for (const key of managedKeys) {
      delete existingEnv[key];
    }

    const mergedEnv = {
      ...existingEnv,
      ...envConfig,
    };

    await fs.writeFile(this.geminiEnvPath, this.stringifyEnvFile(mergedEnv), "utf8");
  }

  /**
   * 解析 .env 文件
   * @param {string} content 文件内容
   * @returns {Object} 环境变量对象
   */
  parseEnvFile(content) {
    const result = {};

    for (const line of content.split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (!key) {
        continue;
      }

      result[key] = value.replace(/^"(.*)"$/, "$1");
    }

    return result;
  }

  /**
   * 序列化 .env 文件
   * @param {Object} envObject 环境变量对象
   * @returns {string} 序列化结果
   */
  stringifyEnvFile(envObject) {
    const lines = [];

    for (const [key, value] of Object.entries(envObject)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }

      lines.push(`${key}=${String(value)}`);
    }

    return lines.join("\n") + "\n";
  }

  /**
   * 检查配置文件是否存在
   * @returns {boolean} 文件是否存在
   */
  async configExists() {
    return await fs.pathExists(this.configPath);
  }

  /**
   * 获取Claude配置（兼容老格式）
   * @param {Object} siteConfig 站点配置对象
   * @returns {Object} Claude配置对象
   */
  getClaudeConfig(siteConfig) {
    // 优先使用新格式的claude字段
    if (siteConfig.claude) {
      return siteConfig.claude;
    }

    // 兼容老格式的config字段
    if (siteConfig.config) {
      return siteConfig.config;
    }

    // 都没有则抛出错误
    throw new Error("站点配置缺少claude或config字段");
  }

  /**
   * 规范化配置对象（清理冗余字段 + 迁移老格式）
   * @param {Object} config 配置对象
   * @returns {Object} 规范化后的配置对象
   */
  normalizeConfig(config) {
    if (!config.sites) {
      return config;
    }

    for (const siteKey in config.sites) {
      const site = config.sites[siteKey];

      // 情况1：只有config，没有claude -> 自动迁移为claude
      if (site.config && !site.claude) {
        site.claude = site.config;
        delete site.config;
      }

      // 情况2：同时存在claude和config，且内容相同 -> 删除冗余config
      else if (site.claude && site.config) {
        if (JSON.stringify(site.claude) === JSON.stringify(site.config)) {
          delete site.config;
        }
      }

      // 情况4：只有claude -> 无需处理
    }

    return config;
  }
}

export default ConfigManager;
