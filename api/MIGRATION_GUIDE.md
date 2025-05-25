# 数据库迁移指南 | Database Migration Guide

## 概述 | Overview

本指南介绍如何将旧版本的单用户 Kumarajiva-API 数据库平滑升级到新的多用户版本。

This guide explains how to smoothly upgrade your old single-user Kumarajiva-API database to the new multi-user version.

## 迁移前准备 | Pre-Migration Preparation

### 1. 备份数据库 | Backup Database
```bash
# 备份现有数据库
cp vocab.db vocab.db.backup.$(date +%Y%m%d_%H%M%S)
```

### 2. 检查数据 | Check Data
```bash
# 检查现有数据量
sqlite3 vocab.db "
SELECT 
  (SELECT COUNT(*) FROM vocabularies) as vocab_count,
  (SELECT COUNT(*) FROM learning_records) as record_count,
  (SELECT COUNT(*) FROM learning_progress) as progress_count;
"
```

## 原始数据库结构 | Original Database Structure

您的旧版数据库应该具有以下结构：

### Tables:
- `vocabularies` - 词汇表
- `learning_records` - 学习记录表  
- `learning_progress` - 学习进度表

### 原始表结构 | Original Schema:
```sql
-- vocabularies 表
CREATE TABLE vocabularies (
  word TEXT PRIMARY KEY,
  definitions TEXT,
  memory_method TEXT,
  pronunciation TEXT,
  mastered BOOLEAN DEFAULT FALSE,
  timestamp INTEGER
);

-- learning_records 表
CREATE TABLE learning_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT,
  review_date INTEGER,
  review_result BOOLEAN,
  FOREIGN KEY(word) REFERENCES vocabularies(word)
);

-- learning_progress 表
CREATE TABLE learning_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  current_word_index INTEGER DEFAULT 0,
  total_words INTEGER DEFAULT 30,
  completed INTEGER DEFAULT 0,
  correct INTEGER DEFAULT 0
);
```

## 迁移方法 | Migration Methods

### 方法一：自动迁移（推荐）| Method 1: Automatic Migration (Recommended)

启动服务器时自动运行迁移：
```bash
# 直接启动服务器，系统会自动检查并运行迁移
node src/app.js
```

### 方法二：手动迁移 | Method 2: Manual Migration

使用专用迁移工具：
```bash
# 运行迁移工具
node src/cli-migrate.js
```

### 方法三：直接调用 | Method 3: Direct Call

直接运行迁移脚本：
```bash
# 直接运行迁移脚本
node src/db/migrate.js
```

## 迁移过程 | Migration Process

### 步骤 1: 检查迁移需求
- 系统检查是否存在 `users` 表
- 如果不存在，说明需要迁移

### 步骤 2: 创建用户管理系统
- 创建 `users` 表
- 创建 `sessions` 表
- 创建相关索引

### 步骤 3: 数据迁移
- 创建默认用户 `legacy_user`
- 向现有表添加 `user_id` 列
- 将所有现有数据分配给默认用户

### 步骤 4: 优化索引
- 创建用户相关的数据库索引
- 优化查询性能

## 迁移后结果 | Post-Migration Results

### 新增表 | New Tables
```sql
-- users 表
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id INTEGER UNIQUE,
  username TEXT,
  email TEXT,
  avatar_url TEXT,
  login_method TEXT DEFAULT 'github',
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- sessions 表  
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  expires_at INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
```

### 更新的表 | Updated Tables
原有三个表都添加了 `user_id INTEGER` 列：
- `vocabularies` 表增加 `user_id` 列
- `learning_records` 表增加 `user_id` 列  
- `learning_progress` 表增加 `user_id` 列

### 默认用户 | Default User
系统自动创建默认用户：
- ID: 1
- username: `legacy_user`
- email: `legacy@kumarajiva.local`
- login_method: `legacy`

## 验证迁移 | Verify Migration

### 1. 检查数据完整性
```bash
# 运行数据库修复和验证工具
node src/cli-fix-db.js
```

### 2. 查看迁移结果
```bash
sqlite3 vocab.db "
SELECT 
  (SELECT COUNT(*) FROM users) as user_count,
  (SELECT COUNT(*) FROM vocabularies WHERE user_id = 1) as vocab_count,
  (SELECT COUNT(*) FROM learning_records WHERE user_id = 1) as record_count,
  (SELECT COUNT(*) FROM learning_progress WHERE user_id = 1) as progress_count;
"
```

### 3. 测试API功能
```bash
# 启动服务器
node src/app.js

# 测试健康检查
curl http://localhost:3000/health

# 测试API访问（兼容模式）
curl http://localhost:3000/api/vocab
```

## 兼容性保证 | Compatibility Guarantee

### 向后兼容 | Backward Compatibility
- ✅ 所有现有数据完全保留
- ✅ 原有API继续正常工作
- ✅ 不需要修改现有客户端代码
- ✅ 支持渐进式迁移

### 数据安全 | Data Safety
- ✅ 原始表结构完全保持
- ✅ 只添加必要的用户管理字段
- ✅ 所有外键关系保持不变
- ✅ 所有索引优化保留

## 故障排除 | Troubleshooting

### 常见问题 | Common Issues

#### 1. 数据库被锁定
```bash
# 如果遇到数据库锁定，请确保没有其他进程在使用数据库
lsof vocab.db
# 停止相关进程后重试
```

#### 2. 迁移失败
```bash
# 恢复备份
cp vocab.db.backup.YYYYMMDD_HHMMSS vocab.db
# 重新运行迁移
node src/cli-migrate.js
```

#### 3. 数据不一致
```bash
# 运行修复工具
node src/cli-fix-db.js
```

### 获取帮助 | Get Help
如果遇到问题，请：
1. 检查错误日志
2. 验证数据库文件权限
3. 确保Node.js版本兼容
4. 提交GitHub Issue并附上错误信息

## 迁移完成后 | Post-Migration

### 1. 配置多用户认证
```bash
# 配置GitHub OAuth
cp env.example .env
# 编辑.env文件，添加GitHub OAuth配置
```

### 2. 测试新功能
- GitHub OAuth 登录
- 用户数据隔离
- 多用户API访问

### 3. 生产部署
- 设置 `LEGACY_MODE=false` 启用严格认证
- 配置生产环境安全参数
- 测试完整功能

## 总结 | Summary

✅ **迁移特点**:
- 🔄 **零停机时间** - 可在线迁移
- 🛡️ **数据安全** - 完全保留现有数据
- 🔧 **自动化** - 一键完成迁移
- 📈 **性能优化** - 添加必要索引
- 🔒 **向后兼容** - 现有应用无需修改

✅ **迁移结果**:
- 👥 支持多用户系统
- 🔐 GitHub OAuth 认证
- 📊 用户数据隔离  
- 🚀 准备好生产部署

您的 Kumarajiva-API 现在已经成功升级为多用户版本！🎉 