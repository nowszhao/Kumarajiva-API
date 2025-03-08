import React from 'react';
import { PencilIcon, TrashIcon, SpeakerWaveIcon } from '@heroicons/react/24/outline';

export default function VocabCard({ vocabulary, onEdit, onDelete }) {
  const { 
    word, 
    definitions, 
    pronunciation, 
    memory_method,
    mastered 
  } = vocabulary;

  const playPronunciation = () => {
    // TODO: 实现发音功能
    console.log('Play pronunciation:', word);
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="card-title text-xl">
              {word}
              {mastered && (
                <span className="badge badge-success ml-2">已掌握</span>
              )}
            </h2>
            <div className="flex items-center mt-1">
              <span className="text-sm text-gray-500">
                {pronunciation?.American || ''}
              </span>
              <button 
                className="btn btn-ghost btn-xs ml-2"
                onClick={playPronunciation}
              >
                <SpeakerWaveIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              className="btn btn-ghost btn-sm"
              onClick={() => onEdit(vocabulary)}
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            <button 
              className="btn btn-ghost btn-sm text-error"
              onClick={() => onDelete(word)}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4">
          <h3 className="font-semibold mb-2">释义:</h3>
          <ul className="list-disc list-inside">
            {definitions.map((def, index) => (
              <li key={index} className="text-gray-700">
                <span className="text-gray-500">[{def.pos}]</span> {def.meaning}
              </li>
            ))}
          </ul>
        </div>

        {memory_method && (
          <div className="mt-4">
            <h3 className="font-semibold mb-2">记忆方法:</h3>
            <p className="text-gray-700">{memory_method}</p>
          </div>
        )}
      </div>
    </div>
  );
}