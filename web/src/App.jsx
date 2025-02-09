import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import LearningPage from './pages/LearningPage';
import HistoryPage from './pages/HistoryPage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-base-200">
        <Navbar />
        <main className="container mx-auto py-8">
          <Routes>
            <Route path="/" element={<LearningPage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
