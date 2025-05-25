// 加载环境变量
require('dotenv').config();

const fastify = require('fastify')({ logger: true });
const { initDatabase } = require('./db/init');
const cors = require('@fastify/cors');
const authConfig = require('./config/auth');
const auth = require('./middleware/auth');

// 启动服务器
const start = async () => {
  try {
    // 初始化数据库（包括自动迁移）
    await initDatabase();
    
    // 注册cookie插件 (session插件需要)
    await fastify.register(require('@fastify/cookie'));

    // 注册会话管理插件
    await fastify.register(require('@fastify/session'), {
      secret: authConfig.session.secret,
      cookie: authConfig.session.cookie
    });

    // 注册认证中间件到fastify实例
    fastify.decorate('auth', auth);

    // 注册 Swagger
    await fastify.register(require('@fastify/swagger'), {
      swagger: {
        info: {
          title: 'Kumarajiva Vocabulary Learning API',
          description: 'API for vocabulary learning and review with multi-user support',
          version: '1.0.0'
        },
        securityDefinitions: {
          bearerAuth: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header'
          }
        }
      }
    });

    await fastify.register(require('@fastify/swagger-ui'), {
      routePrefix: '/documentation'
    });

    // 注册 CORS 插件 - 使用配置文件中的设置
    await fastify.register(cors, authConfig.cors);

    // 注册路由
    await fastify.register(require('./routes/auth'), { prefix: '/api/auth' });
    await fastify.register(require('./routes/vocab'), { prefix: '/api/vocab' });
    await fastify.register(require('./routes/review'), { prefix: '/api/review' });
    await fastify.register(require('./routes/llmapi'), { prefix: '/api/llm' });

    // 添加系统信息路由
    fastify.get('/api/info', async (request, reply) => {
      reply.send({
        success: true,
        data: {
          name: 'Kumarajiva Vocabulary Learning API',
          version: '1.0.0',
          description: 'A backend cloud service for vocabulary management and spaced repetition learning',
          features: [
            'Multi-user authentication via GitHub OAuth',
            'Cross-platform support (Web, iOS, Android, Desktop, Chrome Extension)',
            'Vocabulary management',
            'Spaced repetition learning system',
            'Learning progress tracking',
            'LLM integration for enhanced learning',
            'JWT + Refresh Token authentication',
            'Legacy mode for backward compatibility'
          ],
          authentication: {
            methods: ['GitHub OAuth'],
            legacyMode: authConfig.legacyMode,
            supportedClients: Object.values(authConfig.clientTypes),
            endpoints: {
              githubLogin: '/api/auth/github',
              githubCallback: '/api/auth/github/callback',
              refreshToken: '/api/auth/refresh',
              profile: '/api/auth/profile',
              status: '/api/auth/status',
              logout: '/api/auth/logout'
            }
          },
          documentation: '/documentation'
        }
      });
    });

    // 健康检查路由
    fastify.get('/health', async (request, reply) => {
      reply.send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        legacyMode: authConfig.legacyMode,
        supportedClients: Object.values(authConfig.clientTypes)
      });
    });

    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('🚀 Kumarajiva API Server started successfully!');
    console.log('📚 Features: Multi-user vocabulary learning with GitHub OAuth');
    console.log(`🔐 Legacy Mode: ${authConfig.legacyMode ? 'Enabled (backward compatible)' : 'Disabled'}`);
    console.log('📱 Supported Clients:', Object.values(authConfig.clientTypes).join(', '));
    console.log('📖 Documentation: http://localhost:3000/documentation');
    console.log('💡 Health Check: http://localhost:3000/health');
    console.log('🔑 OAuth Login: http://localhost:3000/api/auth/github?client_type=web');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();