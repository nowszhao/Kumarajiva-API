import { useEffect, useState } from 'react';
import useVocabStore from '../stores/useVocabStore';

function LearningPage() {
  const { 
    todayWords, 
    currentQuiz, 
    learningProgress,
    currentWordIndex,
    fetchTodayWords, 
    fetchQuiz, 
    submitAnswer,
    setCurrentWordIndex
  } = useVocabStore();

  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 将所有处理函数移到组件顶部
  const handleAnswerSelect = async (answer) => {
    setSelectedAnswer(answer);
    setShowResult(true);
    const isCorrect = answer === currentQuiz.correct_answer;
    await submitAnswer(currentQuiz.word, isCorrect);
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    setShowResult(false);
    setCurrentWordIndex(currentWordIndex + 1);
  };

  const handleRestart = async () => {
    await useVocabStore.getState().resetProgress();
    await fetchTodayWords();
  };

  useEffect(() => {
    const initializeWords = async () => {
      setIsLoading(true);
      if (!todayWords || todayWords.length === 0) {
        await fetchTodayWords();
      }
      setIsLoading(false);
    };
    initializeWords();
  }, []);

  useEffect(() => {
    if (todayWords.length > 0 && currentWordIndex < todayWords.length) {
      fetchQuiz(todayWords[currentWordIndex].word);
    }
  }, [todayWords, currentWordIndex]);

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  console.log('todayWords', todayWords,",currentWordIndex",currentWordIndex,",currentQuiz",currentQuiz,",learningProgress",learningProgress,",currentQuiz",currentQuiz);

  // 没有词汇需要学习
  if (!todayWords || todayWords.length === 0) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body text-center">
          <h2 className="card-title justify-center">今日无需复习</h2>
          <p>已完成所有词汇的学习</p>
        </div>
      </div>
    );
  }

  // 学习完成
  if (currentWordIndex >= todayWords.length) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body text-center">
          <h2 className="card-title justify-center">今日学习完成！</h2>
          <p>正确率: {Math.round((learningProgress.correct / learningProgress.total) * 100)}%</p>
          <div className="card-actions justify-center">
            <button 
              className="btn btn-primary"
              onClick={handleRestart}
            >
              重新开始
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 等待题目加载
  if (!currentQuiz) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  // 添加新的统计信息组件
  const StatsCard = () => (
    <div className="bg-base-100 rounded-lg shadow-lg p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">学习统计</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-sm text-gray-500">总单词量</div>
          <div className="text-2xl font-bold">{learningProgress.total || 0}</div>
        </div>
        <div className="space-y-1">
          <div className="text-sm text-gray-500">已掌握</div>
          <div className="text-2xl font-bold text-green-600">
            {learningProgress.mastered || 0}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-sm text-gray-500">今日进度</div>
          <div className="text-2xl font-bold text-primary">
            {Math.round((currentWordIndex / todayWords.length) * 100)}%
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-sm text-gray-500">今日正确率</div>
          <div className="text-2xl font-bold text-blue-600">
            {learningProgress.completed > 0
              ? Math.round((learningProgress.correct / learningProgress.completed) * 100)
              : 0}%
          </div>
        </div>
      </div>
    </div>
  );

  // 修改问题显示部分
  const QuestionHeader = () => (
    <div className="mb-8">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-gray-800">
              题目 {currentWordIndex + 1}/{todayWords.length}
            </h2>
            {/* 添加新词/复习标签 */}
            {todayWords[currentWordIndex]?.review_count > 0 ? (
              <span className="badge badge-warning">复习</span>
            ) : (
              <span className="badge badge-info">新词</span>
            )}
          </div>
          <p className="text-gray-500 mt-1">选择正确的释义</p>
        </div>
        <div className="badge badge-primary badge-lg">
          {Math.round((learningProgress.completed / learningProgress.total) * 100)}%
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-4">
      <div className="flex gap-8">
        {/* 左侧测验区域 */}
        <div className="flex-1">
          {/* 进度显示 */}
          <div className="mb-4">
            <div className="w-full bg-base-200 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentWordIndex / todayWords.length) * 100}%` }}
              />
            </div>
          </div>

          {/* 使用新的问题显示组件 */}
          <QuestionHeader />

          {/* 记忆方法 */}
          <div className="bg-primary-50 p-6 rounded-lg mb-8">
            <p className="text-lg text-primary-700">{currentQuiz.memory_method}</p>
          </div>

          {/* 选项按钮 */}
          <div className="grid grid-cols-1 gap-4">
            {currentQuiz.options.map((option, index) => (
              <button
                key={index}
                className={`
                  p-6 rounded-lg text-left transition-all duration-200
                  ${showResult
                    ? option.definition === currentQuiz.correct_answer
                      ? 'bg-green-50 border-2 border-green-500 text-green-700'
                      : selectedAnswer === option.definition
                      ? 'bg-red-50 border-2 border-red-500 text-red-700'
                      : 'bg-base-100 border-2 border-gray-100'
                    : 'bg-base-100 border-2 border-gray-100 hover:border-primary hover:bg-primary-50'
                  }
                `}
                onClick={() => !showResult && handleAnswerSelect(option.definition)}
                disabled={showResult}
              >
                <span className="text-lg">{option.definition}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 右侧区域 */}
        <div className="w-96">
          {/* 添加统计卡片 */}
          <StatsCard />
          
          {/* 现有的结果展示 */}
          {showResult && (
            <div className="sticky top-4">
              <div className={`rounded-lg p-6 ${
                selectedAnswer === currentQuiz.correct_answer 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                {/* 词汇详细信息 */}
                <div className="mb-4">
                  <h3 className="text-2xl font-bold mb-2">{currentQuiz.word}</h3>
                  <div className="flex items-center gap-4 text-gray-600">
                    {currentQuiz.pronunciation && <span>{currentQuiz.pronunciation}</span>}
                  </div>
                </div>

                {/* 词性和释义 */}
                {currentQuiz.definitions && currentQuiz.definitions.length > 0 && (
                  <div className="space-y-2">
                    {currentQuiz.definitions.map((def, index) => (
                      <div key={index} className="flex gap-2">
                        <span className="text-gray-500">{def.pos}</span>
                        <span>{def.meaning}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button 
                className="btn btn-primary w-full mt-4"
                onClick={handleNextQuestion}
              >
                下一题
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LearningPage;