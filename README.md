# Kumarajiva-API

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](#introduction) | [中文](#介绍)

## 介绍

Kumarajiva-API 是 [Kumarajiva](https://github.com/nowszhao/Kumarajiva) 和 [Kumarajiva-iOS](https://github.com/nowszhao/Kumarajiva-iOS) 的后端云服务，提供智能生词管理和科学的间隔学习功能，帮助用户更高效地学习和记忆。

## Introduction

Kumarajiva-API is the backend cloud service for [Kumarajiva](https://github.com/nowszhao/Kumarajiva) and [Kumarajiva-iOS](https://github.com/nowszhao/Kumarajiva-iOS), providing intelligent vocabulary management and spaced repetition learning features to help users learn and memorize more effectively.

## 技术栈 | Tech Stack

### 前端 | Frontend
- ⚛️ React 18 - 用户界面框架
- ⚡️ Vite - 现代前端构建工具
- 🎨 Tailwind CSS - 实用优先的 CSS 框架
- 🎯 DaisyUI - 基于 Tailwind 的组件库
- 🔄 Axios - HTTP 客户端
- 🍞 React Hot Toast - 优雅的通知提示
- ⭐️ Heroicons - 精美的 SVG 图标集

### 后端 | Backend
- ⚡️ Fastify - 高性能 Node.js Web 框架
- 🗄️ SQLite3 - 轻量级关系型数据库
- 📦 Node.js - JavaScript 运行时
- 🤖 LLM API - 大语言模型接口集成

## 快速开始 | Quick Start

### 环境要求 | Prerequisites
- Node.js (v14 或更高版本 | v14 or higher)
- npm 或 yarn

### 后端服务 | Backend Service

1. **安装依赖 | Install Dependencies:**
   ```bash
   cd api
   npm install
   ```

2. **启动服务器 | Start API Server:**
   ```bash
   node src/app.js
   ```
   服务器将在 http://localhost:3000 启动
   Server will start at http://localhost:3000

3. **词汇数据管理 | Vocabulary Data Management:**
   - **导入数据 | Import Data:**
     ```bash
     node src/cli.js import <path-to-data.json>
     ```
   - **导出数据 | Export Data:**
     ```bash
     node src/cli.js export <output-path.json>
     ```

### 前端应用 | Frontend Application

1. **安装依赖 | Install Dependencies:**
   ```bash
   cd web
   npm install
   ```

2. **配置环境变量 | Configure Environment:**
   创建 `.env` 文件 | Create `.env` file:
   ```env
   VITE_API_BASE_URL=http://127.0.0.1:3000/api
   ```

3. **启动开发服务器 | Start Development Server:**
   ```bash
   npm run dev
   ```

## API 接口示例 | API Examples

### LLM API 接口 | LLM API Endpoints

#### 创建会话 | Create Conversation

**方式一：通过请求头传递Cookie（适用于浏览器环境）**
```bash
curl --location 'http://localhost:3000/api/llm/conversation/create' \
--header 'Content-Type: application/json' \
--header 'Cookie: hy_user=youruser; hy_token=yourtoken' \
--data '{
  "agentId": "naQivTmsDa"
}'
```

**方式二：通过请求体传递Cookie（适用于任何客户端，包括Chrome插件）**
```bash
curl --location 'http://localhost:3000/api/llm/conversation/create' \
--header 'Content-Type: application/json' \
--data '{
  "agentId": "naQivTmsDa",
  "cookie": "hy_user=youruser; hy_token=yourtoken"
}'
```

响应示例 | Response Example:
```json
{
  "success": true,
  "data": {
    "id": "ee1072d9-4d97-4d96-b23c-eab89c47b898"
  }
}
```

#### 发起聊天 | Chat

**方式一：通过请求头传递Cookie（适用于浏览器环境）**
```bash
curl --location 'http://localhost:3000/api/llm/chat/03245ccb-b3c4-4ff6-8c59-5c4e2139e4d5' \
--header 'Content-Type: application/json' \
--header 'Cookie: hy_user=youruser; hy_token=yourtoken' \
--data '{
  "prompt": "今天有什么新闻？",
  "agentId": "naQivTmsDa",
  "model": "gpt_175B_0404"
}'
```

**方式二：通过请求体传递Cookie（适用于任何客户端，包括Chrome插件）**
```bash
curl --location 'http://localhost:3000/api/llm/chat/03245ccb-b3c4-4ff6-8c59-5c4e2139e4d5' \
--header 'Content-Type: application/json' \
--data '{
  "prompt": "今天有什么新闻？",
  "agentId": "naQivTmsDa",
  "model": "gpt_175B_0404",
  "cookie": "hy_user=youruser; hy_token=yourtoken"
}'
```

响应示例 | Response Example:
```json
{
  "success": true,
  "data": {
    "messageId": "03245ccb-b3c4-4ff6-8c59-5c4e2139e4d5_2",
    "content": "以下是2024年最新的新闻..."
  }
}
```
