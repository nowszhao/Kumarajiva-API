import { create } from 'zustand';
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://47.121.117.100:3000/api'
});

const useVocabStore = create((set, get) => ({
  // 状态
  todayWords: [],
  currentWord: null,
  currentQuiz: null,
  currentWordIndex: 0,
  learningProgress: {
    total: 0,
    completed: 0,
    correct: 0,
    mastered: 0
  },
  
  // 重置状态
  reset: () => {
    set({
      todayWords: [],
      currentWord: null,
      currentQuiz: null,
      currentWordIndex: 0,
      learningProgress: {
        total: 0,
        completed: 0,
        correct: 0,
        mastered: 0
      }
    });
  },

  // 获取今日词汇和进度
  fetchTodayWords: async () => {
    try {
      const [wordsResponse, progressResponse] = await Promise.all([
        api.get('/review/today'),
        api.get('/review/progress')
      ]);
      
      const words = wordsResponse.data.data;
      const progress = progressResponse.data.data;
      
      set({ 
        todayWords: words,
        currentWordIndex: progress.current_word_index,
        learningProgress: {
          total: progress.total_words,
          completed: progress.completed,
          correct: progress.correct,
          mastered: progress.mastered || 0
        }
      });
      return words;
    } catch (error) {
      console.error('Failed to fetch today data:', error);
      return [];
    }
  },

  // 获取练习题
  fetchQuiz: async (word) => {
    try {
      const response = await api.post('/review/quiz', { word });
      const quizData = response.data.data;
      set({ currentQuiz: quizData });
      return quizData;
    } catch (error) {
      console.error('Failed to fetch quiz:', error);
      return null;
    }
  },

  // 提交答案
  submitAnswer: async (word, result) => {
    try {
      await api.post('/review/record', { word, result });
      set(state => ({
        learningProgress: {
          ...state.learningProgress,
          completed: state.learningProgress.completed + 1,
          correct: result ? state.learningProgress.correct + 1 : state.learningProgress.correct
        }
      }));
    } catch (error) {
      console.error('Failed to submit answer:', error);
    }
  },

  // 重置今日进度
  resetProgress: async () => {
    try {
      await api.post('/review/reset');
      set({
        currentWordIndex: 0,
        learningProgress: {
          total: get().todayWords.length,
          completed: 0,
          correct: 0,
          mastered: 0
        }
      });
    } catch (error) {
      console.error('Failed to reset progress:', error);
    }
  },

  // 获取学习历史
  fetchLearningHistory: async () => {
    try {
      const response = await api.get('/review/history');
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch learning history:', error);
      return [];
    }
  },

  // 更新当前单词索引
  setCurrentWordIndex: async (index) => {
    try {
      await api.post('/review/progress', {
        current_word_index: index,
        ...get().learningProgress
      });
      set({ currentWordIndex: index });
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  }
}));

export default useVocabStore; 