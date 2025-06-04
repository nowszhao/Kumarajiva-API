const reviewService = require('../services/review');
const authConfig = require('../config/auth');

async function routes(fastify, options) {
  // Apply authentication based on legacy mode
  fastify.addHook('preHandler', async (request, reply) => {
    if (authConfig.legacyMode) {
      // Optional authentication for backward compatibility
      await fastify.auth.optionalAuth(request, reply);
    } else {
      // Required authentication in strict mode
      await fastify.auth.authenticate(request, reply);
    }
  });

  // 获取今日需要复习的词汇
  fastify.get('/today', async (request, reply) => {
    const userId = request.user?.id;
    const words = await reviewService.getTodayReviewWords(userId);
    return { success: true, data: words };
  });

  // 获取练习题
  fastify.post('/quiz', async (request, reply) => {
    try {
      // 从请求体获取word，而不是URL参数
      const { word } = request.body;
      if (!word) {
        reply.code(400).send({ success: false, message: 'Word is required' });
        return;
      }
      
      const userId = request.user?.id;
      const quiz = await reviewService.generateQuiz(word, userId);
      return { success: true, data: quiz };
    } catch (error) {
      reply.code(404).send({ success: false, message: error.message });
    }
  });

  // 提交复习结果
  fastify.post('/record', async (request, reply) => {
    const { word, result } = request.body;
    const userId = request.user?.id;
    const record = await reviewService.recordReview(word, result, userId);
    return { success: true, data: record };
  });

  // 增强获取学习历史记录的路由
  fastify.get('/history', async (request, reply) => {
    try {
      const {
        startDate,
        endDate,
        wordType,
        word,
        result,
        limit,
        offset
      } = request.query;

      const filters = {
        startDate,
        endDate,
        wordType,
        word,
        result: result !== undefined ? result === 'true' : undefined,
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0
      };

      const userId = request.user?.id;
      const history = await reviewService.getLearningHistory(filters, userId);
      reply.send({ success: true, data: history });
    } catch (error) {
      reply.status(500).send({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // 获取今日进度
  fastify.get('/progress', async (request, reply) => {
    try {
      const userId = request.user?.id;
      const progress = await reviewService.getTodayProgress(userId);
      reply.send({ success: true, data: progress });
    } catch (error) {
      reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 更新进度
  fastify.post('/progress', async (request, reply) => {
    try {
      const userId = request.user?.id;
      await reviewService.updateProgress(request.body, userId);
      reply.send({ success: true });
    } catch (error) {
      reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 添加重置进度的路由
  fastify.post('/reset', async (request, reply) => {
    try {
      const userId = request.user?.id;
      await reviewService.resetTodayProgress(userId);
      const progress = await reviewService.getTodayProgress(userId);
      reply.send({ success: true, data: progress });
    } catch (error) {
      reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 获取特定单词的学习记录
  fastify.get('/word-history/:word', async (request, reply) => {
    try {
      const { word } = request.params;
      if (!word) {
        reply.code(400).send({ success: false, message: 'Word is required' });
        return;
      }
      
      const userId = request.user?.id;
      const history = await reviewService.getWordLearningHistory(word, userId);
      reply.send({ success: true, data: history });
    } catch (error) {
      reply.status(500).send({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // 获取用户贡献图信息
  fastify.get('/contribution', async (request, reply) => {
    try {
      const userId = request.user?.id;
      const contribution = await reviewService.getUserContribution(userId);
      reply.send({ success: true, data: contribution });
    } catch (error) {
      reply.status(500).send({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // 获取当前实时数据统计
  fastify.get('/stats', async (request, reply) => {
    try {
      const userId = request.user?.id;
      const stats = await reviewService.getCurrentStats(userId);
      reply.send({ success: true, data: stats });
    } catch (error) {
      reply.status(500).send({ success: false, error: error.message });
    }
  });
}

module.exports = routes;