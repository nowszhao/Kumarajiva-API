import { authApi } from './auth';

// Helper function to safely parse JSON or return default value
const safeJsonParse = (jsonString, defaultValue = []) => {
  try {
    if (typeof jsonString === 'string') {
      return JSON.parse(jsonString);
    }
    return jsonString || defaultValue;
  } catch (error) {
    console.warn('Failed to parse JSON:', jsonString, error);
    return defaultValue;
  }
};

// Helper function to normalize vocabulary data
const normalizeVocabulary = (vocab) => {
  return {
    ...vocab,
    definitions: safeJsonParse(vocab.definitions, []),
    pronunciation: safeJsonParse(vocab.pronunciation, {})
  };
};

export const vocabService = {
  getVocabularies: async () => {
    const response = await authApi.get('/vocab');
    // Ensure data is properly normalized
    if (response.data && response.data.data) {
      response.data.data = response.data.data.map(normalizeVocabulary);
    }
    return response.data;
  },

  getVocabulary: async (word) => {
    const response = await authApi.get(`/vocab/${word}`);
    // Ensure data is properly normalized
    if (response.data && response.data.data) {
      response.data.data = normalizeVocabulary(response.data.data);
    }
    return response.data;
  },

  addVocabulary: async (vocabData) => {
    const response = await authApi.post('/vocab', vocabData);
    return response.data;
  },

  updateVocabulary: async (word, vocabData) => {
    const response = await authApi.put(`/vocab/${word}`, vocabData);
    return response.data;
  },

  deleteVocabulary: async (word) => {
    const response = await authApi.delete(`/vocab/${word}`);
    return response.data;
  },

  // 批量导入词汇
  importVocabularies: async (vocabularies) => {
    const response = await authApi.post('/vocab/import', { vocabularies });
    return response.data;
  },

  // 导出词汇
  exportVocabularies: async () => {
    const response = await authApi.get('/vocab/export');
    return response.data;
  },

  // 获取词汇统计
  getVocabStats: async () => {
    const response = await authApi.get('/vocab/stats');
    return response.data;
  }
};