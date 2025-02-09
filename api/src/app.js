const fastify = require('fastify')({ logger: true });
const { initDatabase } = require('./db/init');
const cors = require('@fastify/cors');

// 初始化数据库
initDatabase();

// 注册 Swagger
fastify.register(require('@fastify/swagger'), {
  swagger: {
    info: {
      title: 'Vocabulary Learning API',
      description: 'API for vocabulary learning and review',
      version: '1.0.0'
    },
  }
});

fastify.register(require('@fastify/swagger-ui'), {
  routePrefix: '/documentation'
});

// 注册 CORS 插件
fastify.register(cors, {
  origin: true, // 允许所有网站的跨域请求
  methods: ['GET', 'PUT', 'POST', 'DELETE'],
  credentials: true
});

// 注册路由
fastify.register(require('./routes/vocab'), { prefix: '/api/vocab' });
fastify.register(require('./routes/review'), { prefix: '/api/review' });

// 启动服务器
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();