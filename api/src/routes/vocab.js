const vocabService = require('../services/vocab');
const reviewService = require('../services/review');
const config = require('../config/learning');
const DataTools = require('../utils/data-tools');

async function routes(fastify, options) {
  // 获取学习配置
  fastify.get('/config', async (request, reply) => {
    return {
      success: true,
      data: {
        ...config,
        remainingNewWords: await reviewService.getTodayNewWordsCount()
      }
    };
  });

  // 获取所有词汇
  fastify.get('/', async (request, reply) => {
    const vocabularies = await vocabService.getVocabularies();
    return { success: true, data: vocabularies };
  });

  // 获取单个词汇
  fastify.get('/:word', async (request, reply) => {
    const vocabulary = await vocabService.getVocabulary(request.params.word);
    if (!vocabulary) {
      reply.code(404).send({ success: false, message: 'Vocabulary not found' });
      return;
    }
    return { success: true, data: vocabulary };
  });

  // 添加新词汇
  fastify.post('/', async (request, reply) => {
    const result = await vocabService.addVocabulary(request.body);
    reply.code(201).send({ success: true, data: result });
  });

  // 更新词汇
  fastify.put('/:word', async (request, reply) => {
    const result = await vocabService.updateVocabulary(request.params.word, request.body);
    if (result.changes === 0) {
      reply.code(404).send({ success: false, message: 'Vocabulary not found' });
      return;
    }
    return { success: true, data: result };
  });

  // 删除词汇
  fastify.delete('/:word', async (request, reply) => {
    const result = await vocabService.deleteVocabulary(request.params.word);
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

      const result = await vocabService.importVocabularies(request.body.vocabularies);
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
      const vocabularies = await vocabService.exportVocabularies();
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
}

module.exports = routes;