import { useEffect, useState } from 'react';
import useVocabStore from '../stores/useVocabStore';

function HistoryPage() {
  const { fetchLearningHistory } = useVocabStore();
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      setIsLoading(true);
      const data = await fetchLearningHistory();
      setHistory(data);
      setIsLoading(false);
    };
    loadHistory();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">学习历史</h1>
      <div className="grid gap-4">
        {history.map((item) => (
          <div key={item.word} className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
            <div className="card-body">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="card-title text-xl mb-2">{item.word}</h2>
                  <div className="text-sm text-gray-500">{item.phonetic}</div>
                </div>
                <div className="badge badge-lg">
                  正确率: {Math.round((item.correct_count / item.review_count) * 100)}%
                </div>
              </div>
              
              <div className="divider my-2"></div>
              
              <div className="grid gap-2">
                {item.definitions.map((def, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="text-gray-500 min-w-16">{def.pos}</span>
                    <span>{def.definition}</span>
                  </div>
                ))}
              </div>

              {item.examples && item.examples.length > 0 && (
                <>
                  <div className="divider my-2"></div>
                  <div className="space-y-2">
                    <div className="font-semibold">例句：</div>
                    {item.examples.map((example, index) => (
                      <p key={index} className="text-gray-600">• {example}</p>
                    ))}
                  </div>
                </>
              )}

              <div className="mt-4 flex gap-2 text-sm text-gray-500">
                <div>学习次数：{item.review_count}</div>
                <div>•</div>
                <div>最后复习：{new Date(item.last_review_date).toLocaleDateString()}</div>
                <div>•</div>
                <div>掌握状态：{item.mastered ? '已掌握' : '学习中'}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default HistoryPage; 