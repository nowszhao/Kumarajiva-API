import React, { useState } from 'react';
import { PencilIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { vocabService } from '../../services/vocab';
import toast from 'react-hot-toast';

export default function VocabTable({ vocabularies, onEdit, onDelete }) {
  const [selectedWords, setSelectedWords] = useState(new Set());
  const [expandedWords, setExpandedWords] = useState(new Set());
  
  // 处理全选
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedWords(new Set(vocabularies.map(v => v.word)));
    } else {
      setSelectedWords(new Set());
    }
  };

  // 处理单个选择
  const handleSelect = (word) => {
    const newSelected = new Set(selectedWords);
    if (newSelected.has(word)) {
      newSelected.delete(word);
    } else {
      newSelected.add(word);
    }
    setSelectedWords(newSelected);
  };

  // 处理展开/收起例句
  const toggleExpand = (word) => {
    const newExpanded = new Set(expandedWords);
    if (newExpanded.has(word)) {
      newExpanded.delete(word);
    } else {
      newExpanded.add(word);
    }
    setExpandedWords(newExpanded);
  };

  // 处理删除
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

  // 处理批量删除
  const handleBatchDelete = async () => {
    if (selectedWords.size === 0) {
      toast.error('请先选择要删除的词汇');
      return;
    }
    
    if (window.confirm(`确定要删除选中的 ${selectedWords.size} 个词汇吗？`)) {
      try {
        await Promise.all(
          Array.from(selectedWords).map(word => 
            vocabService.deleteVocabulary(word)
          )
        );
        toast.success(`成功删除 ${selectedWords.size} 个词汇`);
        setSelectedWords(new Set());
        onDelete();
      } catch (error) {
        toast.error('批量删除失败');
      }
    }
  };

  // 处理掌握状态更新
  const handleMasteryUpdate = async (word, mastered) => {
    try {
      await vocabService.updateVocabulary(word, { mastered });
      toast.success('状态更新成功');
      onDelete(); // 重新加载列表
    } catch (error) {
      toast.error('状态更新失败');
    }
  };

  return (
    <div>
      {selectedWords.size > 0 && (
        <div className="mb-4 flex justify-between items-center">
          <span className="text-sm text-gray-600">
            已选择 {selectedWords.size} 项
          </span>
          <button 
            className="btn btn-error btn-sm"
            onClick={handleBatchDelete}
          >
            删除选中项
          </button>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>
                <label>
                  <input 
                    type="checkbox" 
                    className="checkbox" 
                    checked={selectedWords.size === vocabularies.length}
                    onChange={handleSelectAll}
                  />
                </label>
              </th>
              <th>生词</th>
              <th>音标</th>
              <th>释义</th>
              <th>添加时间</th>
              <th>掌握状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {vocabularies.map((vocab) => (
              <React.Fragment key={vocab.word}>
                <tr>
                  <th>
                    <label>
                      <input 
                        type="checkbox" 
                        className="checkbox"
                        checked={selectedWords.has(vocab.word)}
                        onChange={() => handleSelect(vocab.word)}
                      />
                    </label>
                  </th>
                  <td className="font-medium">
                    <div className="flex items-center gap-2">
                      {vocab.word}
                      <button 
                        className="btn btn-ghost btn-xs"
                        onClick={() => toggleExpand(vocab.word)}
                      >
                        {expandedWords.has(vocab.word) ? (
                          <ChevronUpIcon className="h-4 w-4" />
                        ) : (
                          <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td>{vocab.pronunciation?.American || ''}</td>
                  <td>
                    {vocab.definitions.map((def, index) => (
                      <div key={index}>
                        <span className="text-gray-500">[{def.pos}]</span> {def.meaning}
                      </div>
                    ))}
                  </td>
                  <td>{new Date(vocab.timestamp).toLocaleDateString()}</td>
                  <td>
                    <label className="cursor-pointer">
                      <input
                        type="checkbox"
                        className="toggle toggle-primary toggle-sm"
                        checked={vocab.mastered}
                        onChange={(e) => handleMasteryUpdate(vocab.word, e.target.checked)}
                      />
                    </label>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button 
                        className="btn btn-ghost btn-xs"
                        onClick={() => onEdit(vocab)}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button 
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => handleDelete(vocab.word)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedWords.has(vocab.word) && vocab.memory_method && (
                  <tr>
                    <td colSpan="7" className="bg-base-200">
                      <div className="p-4">
                        <h4 className="font-medium mb-2">例句/记忆方法:</h4>
                        <p className="text-gray-600">{vocab.memory_method}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 