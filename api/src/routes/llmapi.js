const llmApiService = require('../services/llmapi');

async function routes(fastify, options) {
  // Apply optional authentication to all routes for backward compatibility
  fastify.addHook('preHandler', async (request, reply) => {
    await fastify.auth.optionalAuth(request, reply);
  });

  // 创建会话
  fastify.post('/conversation/create', async (request, reply) => {
    try {
      const { agentId, cookie: bodyCookie } = request.body;
      // 优先使用请求体中的cookie，如果没有则使用请求头中的cookie
      const cookie = bodyCookie || request.headers.cookie || '';
      
      console.log('cookie:', cookie, 'agentId:', agentId);
      console.log('authenticated user:', request.user?.id || 'none');

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
      const { prompt, agentId, model, cookie: bodyCookie } = request.body;
      // 优先使用请求体中的cookie，如果没有则使用请求头中的cookie
      const cookie = bodyCookie || request.headers.cookie || '';

      console.log('cookie:', cookie, 'agentId:', agentId, 'model:', model);
      console.log('authenticated user:', request.user?.id || 'none');

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