import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/auth';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 检查认证状态
  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      
      // 检查服务器认证状态（包括session和token）
      const statusResponse = await authService.checkAuthStatus();
      
      if (statusResponse.success && statusResponse.data.authenticated) {
        setUser(statusResponse.data.user);
        setIsAuthenticated(true);
        
        // 如果服务器认证成功但本地没有用户信息，保存到本地
        const { user: localUser } = authService.getLocalAuthData();
        if (!localUser && statusResponse.data.user) {
          authService.setAuthData(null, statusResponse.data.user);
        }
      } else {
        // 服务器未认证，清除本地数据
        setUser(null);
        setIsAuthenticated(false);
        authService.clearLocalAuthData();
      }
    } catch (error) {
      console.error('Check auth status error:', error);
      setUser(null);
      setIsAuthenticated(false);
      authService.clearLocalAuthData();
    } finally {
      setIsLoading(false);
    }
  };

  // 登录 - 使用弹窗模式
  const login = async () => {
    try {
      setIsLoading(true);
      toast.loading('正在打开登录窗口...', { id: 'login-loading' });
      
      const authData = await authService.loginWithGithub();
      
      if (authData && authData.user) {
        setUser(authData.user);
        setIsAuthenticated(true);
        toast.dismiss('login-loading');
        toast.success(`欢迎回来，${authData.user.username}！`);
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.dismiss('login-loading');
      
      // 根据错误类型显示不同的提示
      if (error.message.includes('弹窗')) {
        toast.error('无法打开登录窗口，请检查浏览器弹窗设置');
      } else if (error.message.includes('取消')) {
        toast.error('登录已取消');
      } else if (error.message.includes('超时')) {
        toast.error('登录超时，请重试');
      } else {
        toast.error(error.message || '登录失败，请重试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 备用登录方法 - 页面重定向模式
  const loginWithRedirect = () => {
    authService.redirectToGithubLogin();
  };

  // 登出
  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
      setIsAuthenticated(false);
      toast.success('已成功登出');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('登出失败');
    }
  };

  // 处理OAuth回调后的认证状态更新
  const handleAuthCallback = async (token, userData) => {
    try {
      if (token && userData) {
        authService.setAuthData(token, userData);
        setUser(userData);
        setIsAuthenticated(true);
        toast.success(`欢迎回来，${userData.username}！`);
      } else {
        // 如果没有直接的token和用户数据，重新检查状态
        await checkAuthStatus();
      }
    } catch (error) {
      console.error('Handle auth callback error:', error);
      toast.error('登录处理失败');
    }
  };

  // 处理OAuth回调 - 用于页面重定向模式
  const handleOAuthCallback = async () => {
    try {
      const result = await authService.handleOAuthCallback();
      if (result && result.user) {
        setUser(result.user);
        setIsAuthenticated(true);
        toast.success(`欢迎回来，${result.user.username}！`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('OAuth callback error:', error);
      toast.error(error.message || '登录处理失败');
      return false;
    }
  };

  // 监听全局登出事件
  useEffect(() => {
    const handleGlobalLogout = () => {
      setUser(null);
      setIsAuthenticated(false);
    };

    window.addEventListener('auth:logout', handleGlobalLogout);
    return () => {
      window.removeEventListener('auth:logout', handleGlobalLogout);
    };
  }, []);

  // 监听认证成功事件（来自弹窗OAuth）
  useEffect(() => {
    const handleAuthSuccess = (event) => {
      const { token, user } = event.detail;
      console.log('Received auth success event:', { token: token?.substring(0, 20) + '...', user });
      
      setUser(user);
      setIsAuthenticated(true);
      setIsLoading(false);
      
      toast.success(`欢迎回来，${user.username}！`);
    };

    window.addEventListener('auth:success', handleAuthSuccess);
    return () => {
      window.removeEventListener('auth:success', handleAuthSuccess);
    };
  }, []);

  // 初始化时检查认证状态
  useEffect(() => {
    const initAuth = async () => {
      // 检查是否是OAuth回调页面
      if (window.location.pathname.includes('/auth/github/callback')) {
        // 处理OAuth回调（支持弹窗和重定向模式）
        await handleOAuthCallback();
      } else {
        // 正常检查认证状态
        await checkAuthStatus();
      }
    };

    initAuth();
  }, []);

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    loginWithRedirect,
    logout,
    checkAuthStatus,
    handleAuthCallback,
    handleOAuthCallback
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 