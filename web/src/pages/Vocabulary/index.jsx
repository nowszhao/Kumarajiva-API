import React, { useState, useEffect } from 'react';
import { vocabService } from '../../services/vocab';
import VocabTable from '../../components/VocabTable';
import VocabForm from '../../components/VocabForm';
import Header from '../../components/Header';
import toast from 'react-hot-toast';

// Helper function to safely search in definitions
const searchInDefinitions = (definitions, searchTerm) => {
  if (!definitions || !searchTerm) return false;
  
  // Handle string definitions
  if (typeof definitions === 'string') {
    try {
      const parsed = JSON.parse(definitions);
      return searchInDefinitions(parsed, searchTerm);
    } catch (error) {
      return definitions.toLowerCase().includes(searchTerm.toLowerCase());
    }
  }
  
  // Handle array definitions
  if (Array.isArray(definitions)) {
    return definitions.some(def => {
      if (typeof def === 'string') {
        return def.toLowerCase().includes(searchTerm.toLowerCase());
      }
      if (def && def.meaning) {
        return def.meaning.toLowerCase().includes(searchTerm.toLowerCase());
      }
      return false;
    });
  }
  
  return false;
};

export default function VocabularyPage() {
  const [vocabularies, setVocabularies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVocab, setEditingVocab] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [filterType, setFilterType] = useState('全部');
  const [sortColumn, setSortColumn] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    loadVocabularies();
  }, []);

  const loadVocabularies = async () => {
    try {
      setLoading(true);
      const response = await vocabService.getVocabularies();
      setVocabularies(response.data || []);
    } catch (error) {
      toast.error('加载词汇列表失败');
      console.error('Error loading vocabularies:', error);
      setVocabularies([]); // Set empty array on error
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
    if (!vocab) return false;
    
    const matchesSearch = 
      (vocab.word && vocab.word.toLowerCase().includes(searchTerm.toLowerCase())) ||
      searchInDefinitions(vocab.definitions, searchTerm);

    if (filterType === '全部') return matchesSearch;
    if (filterType === '已掌握') return matchesSearch && vocab.mastered;
    if (filterType === '学习中') return matchesSearch && !vocab.mastered;
    return matchesSearch;
  });

  const sortedVocabularies = [...filteredVocabularies].sort((a, b) => {
    let comparison = 0;
    if (sortColumn === 'word') {
      comparison = a.word.localeCompare(b.word);
    } else if (sortColumn === 'timestamp') {
      const timestampA = parseInt(a.timestamp, 10);
      const timestampB = parseInt(b.timestamp, 10);
      comparison = timestampB - timestampA;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const paginatedVocabularies = sortedVocabularies.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalPages = Math.ceil(filteredVocabularies.length / pageSize);

  const handleRefresh = () => {
    loadVocabularies();
    toast.success('刷新成功');
  };

  const handleSort = (column) => {
    if (column === sortColumn) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder('asc');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
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
              sortColumn={sortColumn}
              sortOrder={sortOrder}
              onSort={handleSort}
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
    </div>
  );
}