import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { vocabService } from '../../services/vocab';
import toast from 'react-hot-toast';

export default function VocabForm({ vocabulary = null, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    word: vocabulary?.word || '',
    definitions: vocabulary?.definitions || [{ pos: 'n.', meaning: '' }],
    memory_method: vocabulary?.memory_method || '',
    pronunciation: vocabulary?.pronunciation || {
      American: '',
      British: ''
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (vocabulary) {
        await vocabService.updateVocabulary(vocabulary.word, formData);
        toast.success('词汇更新成功');
      } else {
        await vocabService.addVocabulary(formData);
        toast.success('词汇添加成功');
      }
      onSubmit();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || '操作失败');
    }
  };

  const addDefinition = () => {
    setFormData(prev => ({
      ...prev,
      definitions: [...prev.definitions, { pos: 'n.', meaning: '' }]
    }));
  };

  const removeDefinition = (index) => {
    setFormData(prev => ({
      ...prev,
      definitions: prev.definitions.filter((_, i) => i !== index)
    }));
  };

  const updateDefinition = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      definitions: prev.definitions.map((def, i) => 
        i === index ? { ...def, [field]: value } : def
      )
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              {vocabulary ? '编辑词汇' : '添加新词汇'}
            </h2>
            <button 
              className="btn btn-ghost btn-sm"
              onClick={onClose}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">单词</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={formData.word}
                onChange={(e) => setFormData(prev => ({ ...prev, word: e.target.value }))}
                required
              />
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">释义</span>
                <button 
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={addDefinition}
                >
                  添加释义
                </button>
              </label>
              {formData.definitions.map((def, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <select
                    className="select select-bordered w-24"
                    value={def.pos}
                    onChange={(e) => updateDefinition(index, 'pos', e.target.value)}
                  >
                    <option value="n.">n.</option>
                    <option value="v.">v.</option>
                    <option value="adj.">adj.</option>
                    <option value="adv.">adv.</option>
                    <option value="prep.">prep.</option>
                    <option value="conj.">conj.</option>
                    <option value="phrase">phrase</option>
                  </select>
                  <input
                    type="text"
                    className="input input-bordered flex-1"
                    value={def.meaning}
                    onChange={(e) => updateDefinition(index, 'meaning', e.target.value)}
                    required
                  />
                  {formData.definitions.length > 1 && (
                    <button 
                      type="button"
                      className="btn btn-ghost btn-sm text-error"
                      onClick={() => removeDefinition(index)}
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">美式发音</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={formData.pronunciation.American}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  pronunciation: {
                    ...prev.pronunciation,
                    American: e.target.value
                  }
                }))}
              />
            </div>

            <div className="form-control mb-6">
              <label className="label">
                <span className="label-text">记忆方法</span>
              </label>
              <textarea
                className="textarea textarea-bordered h-24"
                value={formData.memory_method}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  memory_method: e.target.value
                }))}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button 
                type="button" 
                className="btn btn-ghost"
                onClick={onClose}
              >
                取消
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
              >
                保存
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}