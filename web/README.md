# Kumarajiva Web Frontend

智能词汇学习平台的Web前端应用。

## 功能特性

- 🔐 **GitHub OAuth 认证** - 安全的用户登录系统
- 📚 **个人词汇库** - 每个用户的专属词汇管理
- 🔍 **智能搜索** - 快速查找词汇
- 📊 **学习统计** - 跟踪学习进度
- 🎨 **现代UI** - 基于Tailwind CSS的美观界面

## 技术栈

- React 18
- Vite
- Tailwind CSS + DaisyUI
- Axios
- React Hot Toast

## 快速开始

1. **安装依赖**
   ```bash
   npm install
   ```

2. **配置环境变量**
   创建 `.env.local` 文件：
   ```env
   VITE_API_BASE_URL=http://localhost:3000/api
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ``` 

4. **访问应用**
   打开 http://localhost:5173

## 认证流程

1. 访问应用时会自动检查登录状态
2. 未登录用户会看到登录页面
3. 点击"使用 GitHub 账号登录"进行OAuth认证
4. 登录成功后自动跳转到词汇管理页面

## 注意事项

- 确保API服务器已启动并配置了GitHub OAuth
- 需要在GitHub创建OAuth应用并配置相应的环境变量