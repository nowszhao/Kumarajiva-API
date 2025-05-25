import React, { useEffect, useState } from 'react';

export default function OAuthCallbackPage() {
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('正在处理登录...');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // 获取页面内容（应该是JSON响应）
        const bodyText = document.body.textContent || document.body.innerText;
        
        let authData;
        try {
          authData = JSON.parse(bodyText);
        } catch (parseError) {
          console.error('Failed to parse OAuth callback response:', parseError);
          setStatus('error');
          setMessage('登录响应格式错误');
          
          if (window.opener) {
            window.opener.postMessage({
              type: 'OAUTH_ERROR',
              message: '登录响应格式错误'
            }, window.location.origin);
            
            setTimeout(() => window.close(), 2000);
          }
          return;
        }

        if (authData.success) {
          setStatus('success');
          setMessage('登录成功！正在跳转...');
          
          // 检查是否在弹窗中
          if (window.opener) {
            // 在弹窗中，发送消息给父窗口
            window.opener.postMessage({
              type: 'OAUTH_SUCCESS',
              data: authData.data
            }, window.location.origin);
            
            // 延迟关闭弹窗，让用户看到成功消息
            setTimeout(() => window.close(), 1000);
          } else {
            // 在主窗口中，保存认证信息并重定向
            if (authData.data.token) {
              localStorage.setItem('auth_token', authData.data.token);
            }
            if (authData.data.user) {
              localStorage.setItem('user_info', JSON.stringify(authData.data.user));
            }
            
            // 重定向到原页面或首页
            const preAuthUrl = localStorage.getItem('pre_auth_url');
            localStorage.removeItem('pre_auth_url');
            
            setTimeout(() => {
              window.location.href = preAuthUrl || '/';
            }, 1000);
          }
        } else {
          setStatus('error');
          setMessage(authData.message || '登录失败');
          
          if (window.opener) {
            // 在弹窗中，发送错误消息给父窗口
            window.opener.postMessage({
              type: 'OAUTH_ERROR',
              message: authData.message || '登录失败'
            }, window.location.origin);
            
            setTimeout(() => window.close(), 2000);
          }
        }
      } catch (error) {
        console.error('OAuth callback handling error:', error);
        setStatus('error');
        setMessage('登录处理失败');
        
        if (window.opener) {
          // 在弹窗中，发送错误消息给父窗口
          window.opener.postMessage({
            type: 'OAUTH_ERROR',
            message: error.message || '登录处理失败'
          }, window.location.origin);
          
          setTimeout(() => window.close(), 2000);
        }
      }
    };

    // 延迟执行，确保页面完全加载
    setTimeout(handleOAuthCallback, 100);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Logo */}
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>

          {/* 状态显示 */}
          {status === 'processing' && (
            <>
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">处理中</h2>
              <p className="text-gray-600">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-green-900 mb-2">登录成功</h2>
              <p className="text-green-600">{message}</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-red-900 mb-2">登录失败</h2>
              <p className="text-red-600">{message}</p>
              {window.opener && (
                <p className="text-sm text-gray-500 mt-2">窗口将自动关闭...</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
} 