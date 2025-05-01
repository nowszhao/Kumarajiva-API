const axios = require('axios');

class LLMApiService {
  /**
   * 创建会话
   * @param {string} agentId - 代理ID
   * @returns {Promise<Object>} - 返回创建的会话信息
   */
  async createConversation(agentId, cookie) {
    try {
      const response = await axios.post(
        'https://yuanbao.tencent.com/api/user/agent/conversation/create',
        { agentId },
        {
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('创建会话失败:', error.message);
      throw new Error(`创建会话失败: ${error.message}`);
    }
  }

  /**
   * 发起聊天
   * @param {string} conversationId - 会话ID
   * @param {string} prompt - 聊天内容
   * @param {string} agentId - 代理ID
   * @param {string} model - 模型名称，默认为 "gpt_175B_0404"
   * @returns {Promise<Object>} - 返回聊天结果
   */
  async chat(conversationId, prompt, agentId, cookie, model = "gpt_175B_0404") {
    try {
      const response = await axios.post(
        `https://yuanbao.tencent.com/api/chat/${conversationId}`,
        {
          model: model,
          prompt: prompt,
          plugin: "Adaptive",
          displayPrompt: prompt,
          displayPromptType: 1,
          options: {
            imageIntention: {
              needIntentionModel: true,
              backendUpdateFlag: 2,
              intentionStatus: true
            }
          },
          multimedia: [],
          agentId: agentId,
          supportHint: 1,
          version: "v2",
          chatModelId: "deep_seek_v3",
          chatModelExtInfo: "{\"modelId\":\"deep_seek_v3\",\"subModelId\":\"\",\"supportFunctions\":{\"internetSearch\":\"openInternetSearch\"}}",
          supportFunctions: [
            "openInternetSearch"
          ],
          isTemporary: true
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
          },
          responseType: 'text'
        }
      );
      
      // 处理流式响应结果，转换为非流式输出
      const lines = response.data.split('\n');
      let fullText = '';
      let messageId = '';
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        // 去掉 'data: ' 前缀
        const content = line.startsWith('data: ') ? line.substring(6) : line;
        
        try {
          // 尝试解析JSON
          if (content.startsWith('{') && content.endsWith('}')) {
            const data = JSON.parse(content);
            
            // 收集文本内容
            if (data.type === 'text' && data.msg) {
              fullText += data.msg;
            }
            
            // 获取消息ID
            if (data.type === 'meta' && data.messageId) {
              messageId = data.messageId;
            }
          }
        } catch (e) {
          // 忽略非JSON格式的行
        }
      }
      
      return {
        messageId,
        content: fullText
        // raw: response.data
      };
    } catch (error) {
      console.error('聊天请求失败:', error.message);
      throw new Error(`聊天请求失败: ${error.message}`);
    }
  }
}

module.exports = new LLMApiService();