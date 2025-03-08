# 词汇管理系统

一个简单的词汇管理系统，用于管理和学习英语词汇。

## 功能特点

- 词汇的增删改查
- 词汇列表展示
- 词汇搜索和筛选
- 分页功能
- 批量删除
- 掌握状态管理
- 例句/记忆方法展示
- 响应式设计

## 技术栈

### 前端
- React 18
- Vite
- Tailwind CSS
- DaisyUI
- Axios
- React Hot Toast
- Heroicons

### 后端
- Fastify
- SQLite3
- Node.js

## 项目结构

```
项目目录/
├── api/                    # 后端服务
│   ├── src/
│   │   ├── routes/        # 路由处理
│   │   ├── services/      # 业务逻辑
│   │   ├── db/           # 数据库相关
│   │   └── utils/        # 工具函数
│   └── package.json
│
├── web/                   # 前端应用
│   ├── src/
│   │   ├── components/   # 组件
│   │   ├── pages/       # 页面
│   │   ├── services/    # API服务
│   │   └── utils/       # 工具函数
│   └── package.json
```

## 开始使用

### 环境要求
- Node.js (v14 或更高版本)
- npm 或 yarn

### 后端服务启动

1. **安装依赖:**
   ```bash
   cd api
   npm install
   ```

2. **启动API服务器:**
   ```bash
   node src/app.js
   ```
   服务器将在 [http://localhost:3000](http://localhost:3000) 启动

3. **词汇数据管理:**
   - **导入数据:**
     ```bash
     node src/cli.js import 数据文件路径.json
     ```
   - **导出数据:**
     ```bash
     node src/cli.js export 导出文件路径.json
     ```

### 前端应用启动

1. **安装依赖:**
   ```bash
   cd web
   npm install
   ```

2. **配置环境变量:**
   创建 `.env` 文件:
   ```
   VITE_API_BASE_URL=http://47.121.117.100:3000/api
   ```

3. **启动开发服务器:**
   ```bash
   npm run dev
   ```

## API 接口说明

### 词汇管理接口
- 获取词汇列表: `GET /api/vocab`
- 添加词汇: `POST /api/vocab`
- 更新词汇: `PUT /api/vocab/:word`
- 删除词汇: `DELETE /api/vocab/:word`

### 数据结构
词汇对象结构:
```typescript
interface Vocabulary {
  word: string;          // 单词
  definitions: Array<{   // 释义列表
    pos: string;        // 词性
    meaning: string     // 释义
  }>;
  pronunciation?: {      // 发音
    American?: string;  // 美式音标
    British?: string;   // 英式音标
  };
  memory_method?: string; // 记忆方法/例句
  mastered: boolean;      // 掌握状态
  timestamp: string;      // 添加时间
}
```

## 主要功能说明

1. **词汇管理**
   - 支持添加、编辑、删除词汇
   - 支持批量删除选中词汇
   - 支持更新词汇掌握状态

2. **搜索和筛选**
   - 支持按词汇和释义搜索
   - 支持按掌握状态筛选(全部/已掌握/学习中)

3. **分页功能**
   - 每页显示10条记录
   - 支持页码导航

4. **例句和记忆方法**
   - 支持展开/收起显示例句和记忆方法
   - 支持在添加/编辑时维护例句和记忆方法

