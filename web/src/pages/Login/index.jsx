import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginPage() {
  const { login, loginWithRedirect, isLoading } = useAuth();

  const handleGithubLogin = () => {
    login();
  };

  const handleRedirectLogin = () => {
    loginWithRedirect();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo和标题 */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Kumarajiva</h1>
            <p className="text-gray-600">智能词汇学习平台</p>
          </div>

          {/* 登录说明 */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 text-center">欢迎使用</h2>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>个人专属词汇库</span>
              </div>
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>科学间隔复习</span>
              </div>
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>多设备数据同步</span>
              </div>
            </div>
          </div>

          {/* GitHub登录按钮 */}
          <div className="space-y-4">
            <button
              onClick={handleGithubLogin}
              disabled={isLoading}
              className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-3"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span>使用 GitHub 账号登录</span>
                </>
              )}
            </button>

            {/* 备用登录方式 */}
            <div className="text-center">
              <button
                onClick={handleRedirectLogin}
                disabled={isLoading}
                className="text-sm text-gray-500 hover:text-gray-700 underline disabled:text-gray-400"
              >
                弹窗被阻止？点击这里使用页面跳转登录
              </button>
            </div>
          </div>

          {/* 说明文字 */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              登录即表示您同意我们的服务条款和隐私政策
            </p>
          </div>
        </div>

        {/* 底部信息 */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            安全登录 • 数据加密 • 隐私保护
          </p>
        </div>
      </div>
    </div>
  );
} 