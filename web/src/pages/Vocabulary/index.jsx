import React, { useState, useEffect } from 'react';
import { vocabService } from '../../services/vocab';
import VocabTable from '../../components/VocabTable';
import VocabForm from '../../components/VocabForm';
import toast from 'react-hot-toast';

export default function VocabularyPage() {
  const [vocabularies, setVocabularies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVocab, setEditingVocab] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [filterType, setFilterType] = useState('全部');

  useEffect(() => {
    loadVocabularies();
  }, []);

  const loadVocabularies = async () => {
    try {
      setLoading(true);
      const response = await vocabService.getVocabularies();
      setVocabularies(response.data);
    } catch (error) {
      toast.error('加载词汇列表失败');
      console.error('Error loading vocabularies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (vocabulary) => {
    setEditingVocab(vocabulary);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingVocab(null);
  };

  const filteredVocabularies = vocabularies.filter(vocab => {
    const matchesSearch = 
      vocab.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vocab.definitions.some(def => 
        def.meaning.toLowerCase().includes(searchTerm.toLowerCase())
      );

    if (filterType === '全部') return matchesSearch;
    if (filterType === '已掌握') return matchesSearch && vocab.mastered;
    if (filterType === '学习中') return matchesSearch && !vocab.mastered;
    return matchesSearch;
  });

  const paginatedVocabularies = filteredVocabularies.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalPages = Math.ceil(filteredVocabularies.length / pageSize);

  const handleRefresh = () => {
    loadVocabularies();
    toast.success('刷新成功');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <select 
            className="select select-bordered"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option>全部</option>
            <option>已掌握</option>
            <option>学习中</option>
          </select>
          <div className="form-control">
            <input
              type="text"
              placeholder="搜索单词..."
              className="input input-bordered"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            className="btn btn-primary"
            onClick={() => setIsFormOpen(true)}
          >
            添加
          </button>
          <button 
            className="btn btn-outline"
            onClick={handleRefresh}
          >
            刷新
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      ) : (
        <>
          <VocabTable
            vocabularies={paginatedVocabularies}
            onEdit={handleEdit}
            onDelete={loadVocabularies}
          />
          
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-600">
              显示 {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredVocabularies.length)} 项, 
              共 {filteredVocabularies.length} 项
            </div>
            <div className="join">
              <button
                className="join-item btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                «
              </button>
              <button className="join-item btn">第 {currentPage} 页</button>
              <button
                className="join-item btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                »
              </button>
            </div>
          </div>
        </>
      )}

      {isFormOpen && (
        <VocabForm
          vocabulary={editingVocab}
          onClose={handleFormClose}
          onSubmit={loadVocabularies}
        />
      )}
    </div>
  );
}