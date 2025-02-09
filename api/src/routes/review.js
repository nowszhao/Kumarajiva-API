const reviewService = require('../services/review');

async function routes(fastify, options) {
  // 获取今日需要复习的词汇
  fastify.get('/today', async (request, reply) => {
    const words = await reviewService.getTodayReviewWords();
    return { success: true, data: words };
  });

  // 获取练习题
  fastify.get('/quiz/:word', async (request, reply) => {
    try {
      const quiz = await reviewService.generateQuiz(request.params.word);
      return { success: true, data: quiz };
    } catch (error) {
      reply.code(404).send({ success: false, message: error.message });
    }
  });

  // 提交复习结果
  fastify.post('/record', async (request, reply) => {
    const { word, result } = request.body;
    const record = await reviewService.recordReview(word, result);
    return { success: true, data: record };
  });

  // 获取学习历史记录
  fastify.get('/history', async (request, reply) => {
    try {
      const history = await reviewService.getLearningHistory();
      reply.send({ success: true, data: history });
    } catch (error) {
      reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 获取今日进度
  fastify.get('/progress', async (request, reply) => {
    try {
      const progress = await reviewService.getTodayProgress();
      reply.send({ success: true, data: progress });
    } catch (error) {
      reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 更新进度
  fastify.post('/progress', async (request, reply) => {
    try {
      await reviewService.updateProgress(request.body);
      reply.send({ success: true });
    } catch (error) {
      reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 添加重置进度的路由
  fastify.post('/reset', async (request, reply) => {
    try {
      await reviewService.resetTodayProgress();
      const progress = await reviewService.getTodayProgress();
      reply.send({ success: true, data: progress });
    } catch (error) {
      reply.status(500).send({ success: false, error: error.message });
    }
  });
}

module.exports = routes;