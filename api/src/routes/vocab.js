const vocabService = require('../services/vocab');
const reviewService = require('../services/review');
const config = require('../config/learning');
const DataTools = require('../utils/data-tools');
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

  // 获取学习配置
  fastify.get('/config', async (request, reply) => {
    const userId = request.user?.id;
    return {
      success: true,
      data: {
        ...config,
        remainingNewWords: await reviewService.getTodayNewWordsCount(userId)
      }
    };
  });

  // 获取所有词汇
  fastify.get('/', async (request, reply) => {
    const userId = request.user?.id;
    const vocabularies = await vocabService.getVocabularies(userId);
    return { success: true, data: vocabularies };
  });

  // 获取单个词汇
  fastify.get('/:word', async (request, reply) => {
    const userId = request.user?.id;
    const vocabulary = await vocabService.getVocabulary(request.params.word, userId);
    if (!vocabulary) {
      reply.code(404).send({ success: false, message: 'Vocabulary not found' });
      return;
    }
    return { success: true, data: vocabulary };
  });

  // 添加新词汇
  fastify.post('/', async (request, reply) => {
    try {
      const userId = request.user?.id;
      const result = await vocabService.addVocabulary(request.body, userId);
      reply.code(201).send({ success: true, data: result });
    } catch (error) {
      reply.code(400).send({ success: false, message: error.message });
    }
  });

  // 更新词汇
  fastify.put('/:word', async (request, reply) => {
    const userId = request.user?.id;
    const result = await vocabService.updateVocabulary(request.params.word, request.body, userId);
    if (result.changes === 0) {
      reply.code(404).send({ success: false, message: 'Vocabulary not found' });
      return;
    }
    return { success: true, data: result };
  });

  // 删除词汇
  fastify.delete('/:word', async (request, reply) => {
    const userId = request.user?.id;
    const result = await vocabService.deleteVocabulary(request.params.word, userId);
    if (result.changes === 0) {
      reply.code(404).send({ success: false, message: 'Vocabulary not found' });
      return;
    }
    return { success: true, data: result };
  });

  // 添加导入词汇的路由
  fastify.post('/import', async (request, reply) => {
    try {
      if (!request.body || !request.body.vocabularies) {
        reply.code(400).send({ 
          success: false, 
          message: 'Request body must contain vocabularies data' 
        });
        return;
      }

      const userId = request.user?.id;
      const result = await vocabService.importVocabularies(request.body.vocabularies, userId);
      reply.code(201).send({ 
        success: true, 
        message: `Successfully imported ${result.count} vocabularies` 
      });
    } catch (error) {
      reply.code(500).send({ 
        success: false, 
        message: `Import failed: ${error.message}` 
      });
    }
  });

  // 添加导出词汇的路由
  fastify.get('/export', async (request, reply) => {
    try {
      const userId = request.user?.id;
      const vocabularies = await vocabService.exportVocabularies(userId);
      return { 
        success: true, 
        data: vocabularies 
      };
    } catch (error) {
      reply.code(500).send({ 
        success: false, 
        message: `Export failed: ${error.message}` 
      });
    }
  });

  // 获取词汇统计信息
  fastify.get('/stats', async (request, reply) => {
    try {
      const userId = request.user?.id;
      const stats = await vocabService.getVocabStats(userId);
      return { 
        success: true, 
        data: stats 
      };
    } catch (error) {
      reply.code(500).send({ 
        success: false, 
        message: `Failed to get stats: ${error.message}` 
      });
    }
  });
}

module.exports = routes;