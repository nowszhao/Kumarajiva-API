import React from 'react';
import { Toaster } from 'react-hot-toast';
import VocabularyPage from './pages/Vocabulary';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      <VocabularyPage />
    </div>
  );
}

export default App; 