const llmApiService = require('../services/llmapi');

async function routes(fastify, options) {
  // 创建会话
  fastify.post('/conversation/create', async (request, reply) => {
    try {
      const { agentId } = request.body;
      const cookie = request.headers.cookie || '';
      
      if (!agentId) {
        reply.code(400).send({ success: false, message: 'Agent ID is required' });
        return;
      }
      
      const result = await llmApiService.createConversation(agentId, cookie);
      return { success: true, data: result };
    } catch (error) {
      reply.code(500).send({ success: false, message: error.message });
    }
  });

  // 发起聊天
  fastify.post('/chat/:conversationId', async (request, reply) => {
    try {
      const { conversationId } = request.params;
      const { prompt, agentId, model } = request.body;
      const cookie = request.headers.cookie || '';
      
      if (!conversationId) {
        reply.code(400).send({ success: false, message: 'Conversation ID is required' });
        return;
      }
      
      if (!prompt) {
        reply.code(400).send({ success: false, message: 'Prompt is required' });
        return;
      }
      
      if (!agentId) {
        reply.code(400).send({ success: false, message: 'Agent ID is required' });
        return;
      }
      
      const result = await llmApiService.chat(conversationId, prompt, agentId, cookie, model);
      return { success: true, data: result };
    } catch (error) {
      reply.code(500).send({ success: false, message: error.message });
    }
  });
}

module.exports = routes;