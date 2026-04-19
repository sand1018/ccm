# CCM - 多 AI CLI 配置管理工具

**Language**: [中文](README.md) | [English](README_EN.md)

[![NPM版本](https://img.shields.io/npm/v/@journey1018/ccm.svg)](https://www.npmjs.com/package/@journey1018/ccm)
[![下载量](https://img.shields.io/npm/dm/@journey1018/ccm.svg)](https://www.npmjs.com/package/@journey1018/ccm)
![License](https://img.shields.io/badge/license-MIT-green.svg)

一键切换 Claude Code / Codex / Gemini 配置的命令行工具。支持多站点、多 Token 管理，智能合并配置，WebDAV 云端备份，无需手动修改配置文件。

## 📸 界面预览

![配置切换界面](https://raw.githubusercontent.com/sand1018/ccm/main/assets/readme-preview-2026-04-19.png)

## 📑 目录

- [✨ 核心功能](#-核心功能)
- [📦 安装使用](#-安装使用)
- [🚀 使用方法](#-使用方法)
- [📋 配置文件说明](#-配置文件说明)

## ✨ 核心功能

- 🔄 **一键切换** - 快速切换不同的 API 站点和 Token
- 📋 **配置管理** - 查看、添加、删除 API 配置
- 🔗 **智能合并** - 自动与 Claude Code 配置文件同步
- ⚙️ **完整支持** - 支持所有 Claude Code 配置项
- 💻 **Codex 支持** - 管理 Claude Code Codex 配置（仅支持 Claude 模型），支持开启/关闭 YOLO 模式
- 🚀 **YOLO 模式** - 为 Claude Code API 和 Codex 提供最宽松配置模式，无条件批准所有工具使用请求
- 🔔 **智能通知** - Claude Code 响应完成、工具批准等事件时自动推送系统通知，避免长时间等待
- ☁️ **WebDAV 备份** - 支持全局配置云端备份与恢复，兼容 Windows / macOS / Linux 间迁移（坚果云、其他标准 WebDAV 等）
  - **CCM 配置备份** - 📁 `.ccm/` 下 `api_configs.json` 等全局配置
  - **Claude Code 配置备份** - 📄 settings.json 📄 config.json 📄 `.claude.json`（仅提取用户级根级 `mcpServers`，恢复时合并写回并保留其他字段）📄 CLAUDE.md 📁 agents/ 📁 commands/ 📁 skills/
  - **Codex 备份** - 📄 config.toml 📄 auth.json 📄 AGENTS.md 📄 AGENTS.override.md 📁 prompts/ 📁 skills/ 📁 ~/.agents/skills/
  - **Gemini CLI 备份** - 📄 settings.json 📄 .env 📄 GEMINI.md 📁 commands/ 📁 agents/ 📁 skills/
  - **Antigravity 备份** - 📄 antigravity/mcp_config.json 📁 antigravity/skills/ 📁 antigravity/workflows/ 📁 antigravity/global_workflows/

## 📦 安装使用

```bash
# 全局安装
npm install -g @journey1018/ccm

# 检查并升级到最新版本
ccm update
```

## 🚀 使用方法

### 主要命令

```bash
# 启动交互式界面
ccm

# Claude配置管理
ccm api

# Codex 配置管理
ccm codexapi

# Gemini 配置管理
ccm geminiapi

# 快速切换 API 配置
ccm apiuse

# 查看当前状态
ccm status

# 检查是否有新版本
ccm update --check

# 检查并确认升级
ccm update

# 跳过确认直接升级
ccm update --yes

# 查看帮助
ccm --help
```

`ccm` 为唯一命令入口，避免与系统 `cc` 命令冲突。

## 📋 配置文件说明

### 智能配置合并

工具会自动将你选择的 API 配置与现有的 Claude Code/codex 设置合并，保留所有原有配置项，只更新 API 相关设置。

### 配置格式示例

```json
{
  "sites": {
    "XX公益站": {
      "url": "https://api.example.com",
      "description": "同时支持Claude Code和Codex",
      "claude": {
        "env": {
          "ANTHROPIC_BASE_URL": "https://api.example.com",
          "ANTHROPIC_AUTH_TOKEN": {
            "主力Token": "sk-xxxxxxxxxxxxxx",
            "备用Token": "sk-yyyyyyyyyyyyyy"
          }
        }
      },
      "codex": {
        "OPENAI_API_KEY": "sk-xxxxxxxxxxxxxx",
        "model": "gpt-5",
        "model_reasoning_effort": "high",
        "model_providers": {
          "duckcoding": {
            "name": "duckcoding",
            "base_url": "https://jp.duckcoding.com/v1"
          }
        }
      },
      "gemini": {
        "env": {
          "GEMINI_API_KEY": {
            "主力Key": "gm-xxxxxxxxxxxxxx",
            "备用Key": "gm-yyyyyyyyyyyyyy"
          },
          "GEMINI_MODEL": "gemini-2.5-pro",
          "GOOGLE_GEMINI_BASE_URL": "https://generativelanguage.googleapis.com"
        }
      }
    },
    // 具体看注释
    "XX公益站2": {
      "url": "https://api.demo.com", // （可选）站点的地址 免得忘记公益站点，后期会支持一键打开
      "description": "仅支持Claude Code API", // 随意 可不填
      // Claude Code API配置（最简配置，兼容官方大部分配置，会覆盖配置文件）
      "claude": {
        "env": {
          "ANTHROPIC_BASE_URL": "https://api.demo.com",
          // Token支持两种格式：
          // 1. 对象格式（支持多个token）
          "ANTHROPIC_AUTH_TOKEN": {
            "Token1": "sk-aaaaaaaaaaaaaaa",
            "Token2": "sk-bbbbbbbbbbbbbbb"
          }
          // 2. 字符串格式（单个token，自动命名为"默认Token"）
          // "ANTHROPIC_AUTH_TOKEN": "sk-xxxxxxxxxxxxxx"
        }
      },
      // Codex API配置(最简配置，兼容官方大部分配置)
      "codex": {
        // API Key同样支持两种格式：
        // 1. 对象格式（支持多个API Key）
        "OPENAI_API_KEY": {
          "主要Key": "sk-xxxxxxxxxxxxxx",
          "测试Key": "sk-zzzzzzzzzzzzzzz"
        },
        // 2. 字符串格式（单个API Key，自动命名为"默认API Key"）
        // "OPENAI_API_KEY": "sk-xxxxxxxxxxxxxx",
        "model": "gpt-5-code", // 使用Claude模型
        "model_reasoning_effort": "medium", // 推理强度：low/medium/high
        "model_providers": {
          "custom_provider": {
            "name": "custom_provider",
            "base_url": "https://api.demo.com/v1"
          }
        }
      },
      // Gemini API 配置（写入 ~/.gemini/.env）
      "gemini": {
        "env": {
          // API Key 同样支持两种格式：
          // 1. 对象格式（支持多个 API Key）
          "GEMINI_API_KEY": {
            "主要Key": "gm-xxxxxxxxxxxxxx",
            "测试Key": "gm-zzzzzzzzzzzzzzz"
          },
          // 2. 字符串格式（单个 API Key，自动命名为“默认 API Key”）
          // "GEMINI_API_KEY": "gm-xxxxxxxxxxxxxx",
          "GEMINI_MODEL": "gemini-2.5-flash",
          "GOOGLE_GEMINI_BASE_URL": "https://proxy.demo.com"
        }
      }
    }
  }
}
```

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=sand1018/ccm&type=Date)](https://star-history.com/#sand1018/ccm&Date)

---
