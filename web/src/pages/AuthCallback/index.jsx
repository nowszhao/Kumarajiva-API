import React, { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthCallbackPage() {
  const { handleAuthCallback } = useAuth();

  useEffect(() => {
    // 这个页面主要用于处理OAuth回调
    // 由于API直接返回JSON而不是重定向，这个页面可能不会被直接使用
    // 但保留作为备用方案
    
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userParam = urlParams.get('user');
    
    if (token && userParam) {
      try {
        const userData = JSON.parse(decodeURIComponent(userParam));
        handleAuthCallback(token, userData);
      } catch (error) {
        console.error('Parse auth callback params error:', error);
      }
    }
  }, [handleAuthCallback]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">正在处理登录...</p>
      </div>
    </div>
  );
} 