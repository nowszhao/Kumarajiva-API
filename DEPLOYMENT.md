# Kumarajiva 部署指南

本文档详细说明如何在不同环境中部署 Kumarajiva API 和 Web 前端。

## 📋 目录

- [环境要求](#环境要求)
- [GitHub OAuth 配置](#github-oauth-配置)
- [本地开发环境](#本地开发环境)
- [生产环境部署](#生产环境部署)
- [Docker 部署](#docker-部署)
- [环境变量配置](#环境变量配置)
- [故障排除](#故障排除)

## 🔧 环境要求

- Node.js 18+ 
- npm 或 yarn
- Git
- GitHub 账号（用于 OAuth 认证）

## 🔐 GitHub OAuth 配置

### 1. 创建 GitHub OAuth App

1. 访问 [GitHub Developer Settings](https://github.com/settings/applications/new)
2. 填写应用信息：
   - **Application name**: `Kumarajiva API`
   - **Homepage URL**: 您的应用主页地址
   - **Authorization callback URL**: 见下方不同环境的配置

### 2. 不同环境的回调URL配置

#### 本地开发环境
```
Authorization callback URL: http://127.0.0.1:3000/api/auth/github/callback
```

#### 生产环境
```
Authorization callback URL: https://your-domain.com/api/auth/github/callback
```

#### 多环境支持
如果需要支持多个环境，可以创建多个 OAuth App，或者在一个 App 中添加多个回调URL：
```
http://127.0.0.1:3000/api/auth/github/callback
http://localhost:3000/api/auth/github/callback
https://staging.your-domain.com/api/auth/github/callback
https://your-domain.com/api/auth/github/callback
```

## 🏠 本地开发环境

### 1. 克隆项目
```bash
git clone https://github.com/your-username/Kumarajiva-API.git
cd Kumarajiva-API
```

### 2. 配置 API 环境变量
```bash
cd api
cp env.example .env
```

编辑 `.env` 文件：
```env
NODE_ENV=development
PORT=3000

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://127.0.0.1:3000/api/auth/github/callback

# 安全配置
SESSION_SECRET=your_secure_session_secret
JWT_SECRET=your_secure_jwt_secret

# 认证模式
LEGACY_MODE=false
```

### 3. 启动 API 服务
```bash
cd api
npm install
npm start
```

### 4. 配置前端环境变量
```bash
cd web
cp env.example .env.local
```

编辑 `.env.local` 文件：
```env
VITE_API_BASE_URL=http://127.0.0.1:3000/api
```

### 5. 启动前端服务
```bash
cd web
npm install
npm run dev
```

### 6. 访问应用
- 前端：http://127.0.0.1:5173
- API：http://127.0.0.1:3000
- API 文档：http://127.0.0.1:3000/documentation

## 🚀 生产环境部署

### 1. 服务器准备
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 PM2 (进程管理器)
sudo npm install -g pm2

# 安装 Nginx (反向代理)
sudo apt install nginx -y
```

### 2. 部署 API
```bash
# 克隆代码
git clone https://github.com/your-username/Kumarajiva-API.git
cd Kumarajiva-API/api

# 安装依赖
npm install --production

# 配置环境变量
cp env.example .env
nano .env
```

生产环境 `.env` 配置：
```env
NODE_ENV=production
PORT=3000

# GitHub OAuth
GITHUB_CLIENT_ID=your_production_client_id
GITHUB_CLIENT_SECRET=your_production_client_secret
GITHUB_CALLBACK_URL=https://your-domain.com/api/auth/github/callback

# 安全配置 (使用强密钥)
SESSION_SECRET=your_very_secure_session_secret
JWT_SECRET=your_very_secure_jwt_secret

# 认证模式
LEGACY_MODE=false
```

```bash
# 使用 PM2 启动
pm2 start src/app.js --name kumarajiva-api
pm2 save
pm2 startup
```

### 3. 部署前端
```bash
cd ../web

# 安装依赖
npm install

# 配置环境变量
cp env.example .env.production
nano .env.production
```

生产环境前端配置：
```env
VITE_API_BASE_URL=https://your-domain.com/api
```

```bash
# 构建生产版本
npm run build

# 将构建文件复制到 Nginx 目录
sudo cp -r dist/* /var/www/html/
```

### 4. 配置 Nginx
```bash
sudo nano /etc/nginx/sites-available/kumarajiva
```

Nginx 配置：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/kumarajiva /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. 配置 HTTPS (推荐)
```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx -y

# 获取 SSL 证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo crontab -e
# 添加：0 12 * * * /usr/bin/certbot renew --quiet
```

## 🐳 Docker 部署

### 1. API Dockerfile
```dockerfile
# api/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "src/app.js"]
```

### 2. 前端 Dockerfile
```dockerfile
# web/Dockerfile
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
```

### 3. Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: ./api
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
      - GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
      - GITHUB_CALLBACK_URL=${GITHUB_CALLBACK_URL}
      - SESSION_SECRET=${SESSION_SECRET}
      - JWT_SECRET=${JWT_SECRET}
      - LEGACY_MODE=false
    volumes:
      - ./data:/app/data

  web:
    build: ./web
    ports:
      - "80:80"
    depends_on:
      - api
```

### 4. 部署命令
```bash
# 创建环境变量文件
cp .env.example .env
nano .env

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

## ⚙️ 环境变量配置

### API 环境变量

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `NODE_ENV` | 否 | development | 运行环境 |
| `PORT` | 否 | 3000 | API 服务端口 |
| `GITHUB_CLIENT_ID` | 是 | - | GitHub OAuth Client ID |
| `GITHUB_CLIENT_SECRET` | 是 | - | GitHub OAuth Client Secret |
| `GITHUB_CALLBACK_URL` | 是 | - | GitHub OAuth 回调URL |
| `SESSION_SECRET` | 是 | - | Session 加密密钥 |
| `JWT_SECRET` | 是 | - | JWT 签名密钥 |
| `LEGACY_MODE` | 否 | false | 兼容模式开关 |

### 前端环境变量

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `VITE_API_BASE_URL` | 否 | http://127.0.0.1:3000/api | API 服务地址 |

## 🔍 故障排除

### 常见问题

#### 1. OAuth 认证失败
**症状**: "Invalid state parameter" 错误

**解决方案**:
- 检查 `GITHUB_CALLBACK_URL` 是否与 GitHub OAuth App 配置一致
- 确保使用了正确的域名（127.0.0.1 vs localhost）
- 检查 JWT_SECRET 是否正确配置

#### 2. CORS 错误
**症状**: 前端无法访问 API

**解决方案**:
- 检查 API 的 CORS 配置
- 确保前端和 API 的域名配置正确
- 在生产环境中配置正确的 `Access-Control-Allow-Origin`

#### 3. Session 丢失
**症状**: 用户登录后立即退出

**解决方案**:
- 检查 `SESSION_SECRET` 配置
- 确保 cookie 的 `sameSite` 和 `secure` 设置正确
- 在 HTTPS 环境中设置 `secure: true`

#### 4. 前端构建失败
**症状**: `npm run build` 失败

**解决方案**:
- 检查 Node.js 版本（需要 18+）
- 清除 node_modules 重新安装：`rm -rf node_modules package-lock.json && npm install`
- 检查环境变量配置

### 调试技巧

#### 1. 启用详细日志
```env
# API
NODE_ENV=development
LOG_LEVEL=debug

# 前端
VITE_DEBUG=true
```

#### 2. 检查服务状态
```bash
# API 健康检查
curl http://127.0.0.1:3000/health

# 检查认证状态
curl http://127.0.0.1:3000/api/auth/status

# PM2 状态
pm2 status
pm2 logs kumarajiva-api
```

#### 3. 网络调试
```bash
# 检查端口占用
netstat -tulpn | grep :3000

# 检查防火墙
sudo ufw status

# 检查 Nginx 配置
sudo nginx -t
sudo systemctl status nginx
```

## 📞 支持

如果遇到问题，请：

1. 查看 [GitHub Issues](https://github.com/your-username/Kumarajiva-API/issues)
2. 检查日志文件
3. 确认环境变量配置
4. 提交详细的错误报告

---

**注意**: 请确保在生产环境中使用强密钥，并定期更新依赖包以保证安全性。 