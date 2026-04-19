# CCM - Multi AI CLI Configuration Management Tool

**Language**: [中文](README.md) | [English](README_EN.md)

[![NPM Version](https://img.shields.io/npm/v/@journey1018/ccm.svg)](https://www.npmjs.com/package/@journey1018/ccm)
[![Downloads](https://img.shields.io/npm/dm/@journey1018/ccm.svg)](https://www.npmjs.com/package/@journey1018/ccm)
![License](https://img.shields.io/badge/license-MIT-green.svg)

A command-line tool for one-click switching of Claude Code, Codex, and Gemini configurations. Supports multi-site, multi-token management, intelligent configuration merging, WebDAV cloud backup, and no manual file editing required.

## 📸 Interface Preview

![Configuration Switching Interface](https://qm-cloud.oss-cn-chengdu.aliyuncs.com/test/otherType/PixPin_2025-09-30_08-42-40.png)

## 📑 Table of Contents

- [✨ Core Features](#-core-features)
- [📦 Installation](#-installation)
- [🚀 Usage](#-usage)
- [📋 Configuration File Description](#-configuration-file-description)

## ✨ Core Features

- 🔄 **One-Click Switching** - Quickly switch between different API sites and tokens
- 📋 **Configuration Management** - View, add, and delete API configurations
- 🔗 **Intelligent Merging** - Automatically sync with Claude Code configuration files
- ⚙️ **Full Support** - Supports all Claude Code configuration items
- 💻 **Codex Support** - Manage Claude Code Codex configurations (Claude models only), support enabling/disabling YOLO mode
- 🚀 **YOLO Mode** - Provides the most permissive configuration mode for Claude Code API and Codex, unconditionally approves all tool usage requests
- ☁️ **WebDAV Backup** - Support global configuration backup and restore with cross-platform migration between Windows / macOS / Linux (Nutstore and other standard WebDAV services)
  - **CCM Configuration Backup** - 📁 `.ccm/` with `api_configs.json` and related global files
  - **Claude Code Configuration Backup** - 📄 settings.json 📄 config.json 📄 `.claude.json` (root user-level `mcpServers` only; restore merges it back and preserves other fields) 📄 CLAUDE.md 📁 agents/ 📁 commands/ 📁 skills/
  - **Codex Backup** - 📄 config.toml 📄 auth.json 📄 AGENTS.md 📄 AGENTS.override.md 📁 prompts/ 📁 skills/ 📁 ~/.agents/skills/
  - **Gemini CLI Backup** - 📄 settings.json 📄 .env 📄 GEMINI.md 📁 commands/ 📁 agents/ 📁 skills/
  - **Antigravity Backup** - 📄 antigravity/mcp_config.json 📁 antigravity/skills/ 📁 antigravity/workflows/ 📁 antigravity/global_workflows/

## 📦 Installation

```bash
# Global installation
npm install -g @journey1018/ccm

# Check for updates and upgrade to the latest version
ccm update
```

## 🚀 Usage

### Main Commands

```bash
# Start interactive interface
ccm

# API configuration management
ccm api

# Codex configuration management
ccm codexapi

# Gemini configuration management
ccm geminiapi

# Quick switch API configuration
ccm apiuse

# View current status
ccm status

# Check whether a newer version is available
ccm update --check

# Check and confirm upgrade
ccm update

# Upgrade immediately without confirmation
ccm update --yes

# View help
ccm --help
```

`ccm` is the only command entry now, avoiding conflicts with the system `cc` command.

## 📋 Configuration File Description

### Intelligent Configuration Merging

The tool will automatically merge your selected API configuration with existing Claude Code settings, preserving all original configuration items and only updating API-related settings.

### Configuration Format Example

```json
{
  "sites": {
    "XX Public Site": {
      "url": "https://api.example.com",
      "description": "Supports both Claude Code and Codex",
      "claude": {
        "env": {
          "ANTHROPIC_BASE_URL": "https://api.example.com",
          "ANTHROPIC_AUTH_TOKEN": {
            "Primary Token": "sk-xxxxxxxxxxxxxx",
            "Backup Token": "sk-yyyyyyyyyyyyyy"
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
            "Primary Key": "gm-xxxxxxxxxxxxxx",
            "Backup Key": "gm-yyyyyyyyyyyyyy"
          },
          "GEMINI_MODEL": "gemini-2.5-pro",
          "GOOGLE_GEMINI_BASE_URL": "https://generativelanguage.googleapis.com"
        }
      }
    },
    "XX Public Site 2": {
      "url": "https://api.demo.com", // (Optional) Site address to remember public sites, will support one-click opening later
      "description": "Claude Code API only", // Optional, can be left empty
      // Claude Code API configuration (minimal config, compatible with most official configurations, will override config file)
      "claude": {
        "env": {
          "ANTHROPIC_BASE_URL": "https://api.demo.com",
          // Token supports two formats:
          // 1. Object format (supports multiple tokens)
          "ANTHROPIC_AUTH_TOKEN": {
            "Token1": "sk-aaaaaaaaaaaaaaa",
            "Token2": "sk-bbbbbbbbbbbbbbb",
            "Token3": "sk-ccccccccccccccc"
          }
          // 2. String format (single token, automatically named "Default Token")
          // "ANTHROPIC_AUTH_TOKEN": "sk-xxxxxxxxxxxxxx"
        }
      },
      // Codex API configuration (minimal config, compatible with most official configurations)
      "codex": {
        // API Key also supports two formats:
        // 1. Object format (supports multiple API Keys)
        "OPENAI_API_KEY": {
          "Primary Key": "sk-xxxxxxxxxxxxxx",
          "Backup Key": "sk-yyyyyyyyyyyyyy",
          "Test Key": "sk-zzzzzzzzzzzzzzz"
        },
        // 2. String format (single API Key, automatically named "Default API Key")
        // "OPENAI_API_KEY": "sk-xxxxxxxxxxxxxx",
        "model": "claude-3-5-sonnet-20241022", // Use Claude model
        "model_reasoning_effort": "medium", // Reasoning intensity: low/medium/high
        "model_providers": {
          "custom_provider": {
            "name": "custom_provider",
            "base_url": "https://api.demo.com/v1"
          }
        }
      },
      // Gemini API configuration (written to ~/.gemini/.env)
      "gemini": {
        "env": {
          // API keys also support two formats:
          // 1. Object format (multiple API keys)
          "GEMINI_API_KEY": {
            "Primary Key": "gm-xxxxxxxxxxxxxx",
            "Test Key": "gm-zzzzzzzzzzzzzzz"
          },
          // 2. String format (single API key, automatically named "Default API Key")
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
