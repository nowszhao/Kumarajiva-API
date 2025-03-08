import React, { useState } from 'react';
import VocabCard from '../VocabCard';
import { vocabService } from '../../services/vocab';
import toast from 'react-hot-toast';

export default function VocabList({ vocabularies, onDelete, onEdit }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredVocabularies = vocabularies.filter(vocab => 
    vocab.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vocab.definitions.some(def => 
      def.meaning.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const handleDelete = async (word) => {
    if (window.confirm(`确定要删除词汇 "${word}" 吗？`)) {
      try {
        await vocabService.deleteVocabulary(word);
        toast.success('词汇删除成功');
        onDelete();
      } catch (error) {
        toast.error(error.response?.data?.message || '删除失败');
      }
    }
  };

  return (
    <div>
      <div className="mb-6">
        <input
          type="text"
          placeholder="搜索词汇..."
          className="input input-bordered w-full max-w-xs"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredVocabularies.map(vocabulary => (
          <VocabCard
            key={vocabulary.word}
            vocabulary={vocabulary}
            onEdit={onEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {filteredVocabularies.length === 0 && (
        <div className="text-center text-gray-500 mt-8">
          {searchTerm ? '没有找到匹配的词汇' : '还没有添加任何词汇'}
        </div>
      )}
    </div>
  );
}