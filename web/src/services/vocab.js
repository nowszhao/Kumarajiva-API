import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const vocabService = {
  getVocabularies: async () => {
    const response = await axios.get(`${API_BASE_URL}/vocab`);
    return response.data;
  },

  getVocabulary: async (word) => {
    const response = await axios.get(`${API_BASE_URL}/vocab/${word}`);
    return response.data;
  },

  addVocabulary: async (vocabData) => {
    const response = await axios.post(`${API_BASE_URL}/vocab`, vocabData);
    return response.data;
  },

  updateVocabulary: async (word, vocabData) => {
    const response = await axios.put(`${API_BASE_URL}/vocab/${word}`, vocabData);
    return response.data;
  },

  deleteVocabulary: async (word) => {
    const response = await axios.delete(`${API_BASE_URL}/vocab/${word}`);
    return response.data;
  }
};