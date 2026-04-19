import path from "path";
import os from "os";
import fs from "fs-extra";
import chalk from "chalk";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MANIFEST_PATH = path.join(__dirname, "backup-manifest.json");

/**
 * 文件路径管理器
 * 负责管理备份清单、路径解析和覆盖率检查
 */
class FileManager {
  constructor() {
    this.homeDir = os.homedir();
    this.manifest = this.loadManifest();
    this.configPaths = this.initConfigPaths();
  }

  /**
   * 读取备份清单
   * @returns {Object} 清单内容
   */
  loadManifest() {
    return fs.readJsonSync(MANIFEST_PATH);
  }

  /**
   * 解析清单中的路径
   * @param {string} rawPath 原始路径
   * @returns {string} 解析后的绝对路径
   */
  resolveManifestPath(rawPath) {
    if (!rawPath) {
      return rawPath;
    }

    if (rawPath === "~") {
      return this.homeDir;
    }

    if (rawPath.startsWith("~/")) {
      return path.join(this.homeDir, rawPath.slice(2));
    }

    return rawPath;
  }

  /**
   * 初始化配置类别
   * @returns {Object} 配置类别映射
   */
  initConfigPaths() {
    const categories = {};

    for (const [categoryKey, category] of Object.entries(
      this.manifest.categories || {}
    )) {
      categories[categoryKey] = {
        name: category.name,
        entries: (category.entries || []).map((entry) => ({
          ...entry,
          label: entry.label || entry.key,
          path: this.resolveManifestPath(entry.path),
        })),
        coverageHints: (category.coverageHints || []).map((hintPath) =>
          this.resolveManifestPath(hintPath)
        ),
      };
    }

    return categories;
  }

  /**
   * 检查单个条目
   * @param {Object} entry 清单条目
   * @returns {Object} 条目检查结果
   */
  async checkEntry(entry) {
    const exists = await fs.pathExists(entry.path);
    const result = {
      ...entry,
      exists,
      size: 0,
      fileCount: 0,
    };

    if (!exists) {
      return result;
    }

    if (entry.type === "file") {
      const stat = await fs.stat(entry.path);
      result.size = stat.size;
      return result;
    }

    if (entry.type === "directory") {
      try {
        const items = await fs.readdir(entry.path);
        result.fileCount = items.length;
      } catch (error) {
        result.error = error.message;
      }
    }

    return result;
  }

  /**
   * 检查 coverage hints
   * @param {Array<string>} coverageHints 提示路径
   * @returns {Array<Object>} 覆盖提示结果
   */
  async checkCoverageHints(coverageHints = []) {
    const results = [];

    for (const hintPath of coverageHints) {
      const exists = await fs.pathExists(hintPath);
      results.push({
        path: hintPath,
        exists,
      });
    }

    return results;
  }

  /**
   * 检查配置类别的文件存在性
   * @param {string} category 配置类别
   * @returns {Object} 文件存在性检查结果
   */
  async checkCategoryFiles(category) {
    const config = this.configPaths[category];
    if (!config) {
      throw new Error(`未知的配置类别: ${category}`);
    }

    const result = {
      category,
      name: config.name,
      entries: [],
      coverageHints: [],
      totalExists: 0,
      totalCount: config.entries.length,
    };

    for (const entry of config.entries) {
      const checkedEntry = await this.checkEntry(entry);
      result.entries.push(checkedEntry);

      if (checkedEntry.exists) {
        result.totalExists++;
      }
    }

    result.coverageHints = await this.checkCoverageHints(config.coverageHints);
    return result;
  }

  /**
   * 检查所有配置文件的存在性
   * @returns {Object} 完整的文件存在性报告
   */
  async checkAllFiles() {
    const results = {};

    for (const category of Object.keys(this.configPaths)) {
      try {
        results[category] = await this.checkCategoryFiles(category);
      } catch (error) {
        results[category] = {
          category,
          error: error.message,
        };
      }
    }

    return results;
  }

  /**
   * 格式化文件检查结果显示
   * @param {Object} checkResult 检查结果
   * @returns {string} 格式化的显示文本
   */
  formatCheckResult(checkResult) {
    let output = "";

    for (const [category, result] of Object.entries(checkResult)) {
      if (result.error) {
        output += chalk.red(`❌ ${category}: ${result.error}\n`);
        continue;
      }

      const statusIcon =
        result.totalExists === result.totalCount
          ? "✅"
          : result.totalExists > 0
            ? "⚠️"
            : "❌";

      output += chalk.white(
        `${statusIcon} ${result.name} (${result.totalExists}/${result.totalCount})\n`
      );

      const existingEntries = result.entries.filter((entry) => entry.exists);
      const missingEntries = result.entries.filter((entry) => !entry.exists);
      const uncoveredHints = result.coverageHints.filter((hint) => hint.exists);

      if (existingEntries.length > 0) {
        output += chalk.gray("  已纳入:\n");
        for (const entry of existingEntries) {
          const icon = entry.type === "directory" ? "📁" : "📄";
          const displayName = entry.label || entry.key;
          const suffix =
            entry.type === "directory"
              ? ` (${entry.fileCount} files)`
              : ` (${(entry.size / 1024).toFixed(1)}KB)`;
          output += chalk.gray(`    ${icon} ${displayName}${suffix}\n`);
        }
      }

      if (missingEntries.length > 0) {
        output += chalk.gray("  已纳入但缺失:\n");
        for (const entry of missingEntries) {
          const icon = entry.type === "directory" ? "📁" : "📄";
          const displayName = entry.label || entry.key;
          output += chalk.gray(`    ${icon} ${displayName}\n`);
        }
      }

      if (uncoveredHints.length > 0) {
        output += chalk.yellow("  覆盖提示:\n");
        for (const hint of uncoveredHints) {
          output += chalk.yellow(`    ⚠️ 检测到 ${hint.path} 存在，但当前清单未纳入\n`);
        }
      }

      output += "\n";
    }

    return output;
  }

  /**
   * 获取指定类别的配置路径
   * @param {string} category 配置类别
   * @returns {Object} 配置路径信息
   */
  getCategoryPaths(category) {
    return this.configPaths[category];
  }

  /**
   * 获取所有配置类别
   * @returns {Array} 配置类别列表
   */
  getCategories() {
    return Object.keys(this.configPaths);
  }
}

export default FileManager;
