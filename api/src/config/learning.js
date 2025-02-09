// 学习配置
const learningConfig = {
  // 每日新词数量
  dailyNewWords: 5,
  
  // 每日复习数量上限
  dailyReviewLimit: 5,
  
  // 艾宾浩斯复习时间点（天数）
  reviewDays: [1, 2, 4, 7, 15, 30],
  
  // 词汇掌握标准（连续正确次数）
  masteryThreshold: 5
};

module.exports = learningConfig;