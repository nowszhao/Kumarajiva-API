import React from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import VocabularyPage from './pages/Vocabulary';
import LoginPage from './pages/Login';
import OAuthCallbackPage from './pages/OAuthCallback';

// 主应用内容组件
function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  // 检查是否是OAuth回调页面
  if (window.location.pathname.includes('/auth/github/callback')) {
    return <OAuthCallbackPage />;
  }

  // 显示加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">正在验证登录状态...</p>
        </div>
      </div>
    );
  }

  // 根据认证状态显示不同页面
  return isAuthenticated ? <VocabularyPage /> : <LoginPage />;
}

function App() {
  return (
    <AuthProvider>
    <div className="min-h-screen bg-gray-50">
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 2000,
              iconTheme: {
                primary: '#4ade80',
                secondary: '#fff',
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        <AppContent />
    </div>
    </AuthProvider>
  );
}

export default App; 