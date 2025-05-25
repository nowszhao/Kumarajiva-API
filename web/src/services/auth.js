import axios from 'axios';

// 使用环境变量或默认值，避免硬编码
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api';

console.log('API_BASE_URL:', API_BASE_URL);

// 创建axios实例
const authApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // 支持session cookies
});

// 请求拦截器 - 自动添加认证头
authApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器 - 处理认证错误
authApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 清除无效token
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_info');
      // 可以触发全局登出事件
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    return Promise.reject(error);
  }
);

export const authService = {
  // 检查认证状态
  checkAuthStatus: async () => {
    try {
      const response = await authApi.get('/auth/status');
      return response.data;
    } catch (error) {
      console.error('Check auth status failed:', error);
      return { success: false, data: { authenticated: false } };
    }
  },

  // 获取用户资料
  getUserProfile: async () => {
    try {
      const response = await authApi.get('/auth/profile');
      return response.data;
    } catch (error) {
      console.error('Get user profile failed:', error);
      throw error;
    }
  },

  // 登出
  logout: async () => {
    try {
      await authApi.post('/auth/logout');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      // 无论API调用是否成功，都清除本地存储
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_info');
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  },

  // GitHub OAuth登录 - 使用弹窗模式
  loginWithGithub: async () => {
    return new Promise((resolve, reject) => {
      // 保存当前页面URL，登录后可以回到这里
      localStorage.setItem('pre_auth_url', window.location.href);
      
      // 计算弹窗位置（居中）
      const width = 600;
      const height = 700;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      
      // 打开OAuth弹窗
      const popup = window.open(
        `${API_BASE_URL}/auth/github`,
        'github-oauth',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );

      if (!popup) {
        reject(new Error('无法打开登录弹窗，请检查浏览器弹窗设置'));
        return;
      }

      // 监听来自弹窗的消息
      const handleMessage = (event) => {
        console.log('Received message from popup:', event.data, 'origin:', event.origin);
        
        // 验证消息来源 - 允许来自API服务器的消息
        const apiOrigin = API_BASE_URL.replace('/api', ''); // http://127.0.0.1:3000
        if (event.origin !== window.location.origin && event.origin !== apiOrigin) {
          console.log('Message origin mismatch, ignoring. Expected:', window.location.origin, 'or', apiOrigin, 'Got:', event.origin);
          return;
        }

        if (event.data.type === 'OAUTH_SUCCESS') {
          console.log('OAuth success message received');
          // 认证成功
          window.removeEventListener('message', handleMessage);
          popup.close();
          
          const { token, user } = event.data.data;
          console.log('Extracted token and user:', { token: token?.substring(0, 20) + '...', user: user?.username });
          
          // 保存认证信息
          authService.setAuthData(token, user);
          
          // 触发认证成功事件，让AuthContext立即更新状态
          window.dispatchEvent(new CustomEvent('auth:success', {
            detail: { token, user }
          }));
          
          resolve(event.data.data);
        } else if (event.data.type === 'OAUTH_ERROR') {
          console.log('OAuth error message received:', event.data.message);
          // 认证失败
          window.removeEventListener('message', handleMessage);
          popup.close();
          reject(new Error(event.data.message || '登录失败'));
        } else {
          console.log('Unknown message type:', event.data.type);
        }
      };

      // 监听postMessage
      window.addEventListener('message', handleMessage);

      // 检查弹窗是否被关闭（用户手动关闭）
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          console.log('Popup was closed unexpectedly');
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          reject(new Error('登录已取消'));
        }
      }, 1000);

      // 设置超时
      setTimeout(() => {
        if (!popup.closed) {
          popup.close();
        }
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
        reject(new Error('登录超时'));
      }, 300000); // 5分钟超时
    });
  },

  // 跳转到GitHub登录（备用方案，用于不支持弹窗的环境）
  redirectToGithubLogin: () => {
    // 保存当前页面URL，登录后可以回到这里
    localStorage.setItem('pre_auth_url', window.location.href);
    
    // 直接跳转到GitHub OAuth
    window.location.href = `${API_BASE_URL}/auth/github`;
  },

  // 处理OAuth回调（用于页面重定向模式）
  handleOAuthCallback: async () => {
    // 检查当前页面是否是OAuth回调页面
    if (!window.location.pathname.includes('/auth/github/callback')) {
      return null;
    }

    try {
      // 如果是回调页面，尝试获取页面内容（应该是JSON响应）
      const bodyText = document.body.textContent || document.body.innerText;
      
      let authData;
      try {
        authData = JSON.parse(bodyText);
      } catch (parseError) {
        console.error('Failed to parse OAuth callback response:', parseError);
        throw new Error('登录响应格式错误');
      }

      if (authData.success) {
        // 检查是否在弹窗中
        if (window.opener) {
          // 在弹窗中，发送消息给父窗口
          window.opener.postMessage({
            type: 'OAUTH_SUCCESS',
            data: authData.data
          }, window.location.origin);
          
          // 关闭弹窗
          window.close();
          return authData.data;
        } else {
          // 在主窗口中，保存认证信息并重定向
          authService.setAuthData(authData.data.token, authData.data.user);
          
          // 触发认证成功事件
          window.dispatchEvent(new CustomEvent('auth:success', {
            detail: { token: authData.data.token, user: authData.data.user }
          }));
          
          // 重定向到原页面或首页
          const preAuthUrl = authService.getPreAuthUrl();
          window.location.href = preAuthUrl || '/';
          
          return authData.data;
        }
      } else {
        if (window.opener) {
          // 在弹窗中，发送错误消息给父窗口
          window.opener.postMessage({
            type: 'OAUTH_ERROR',
            message: authData.message || '登录失败'
          }, window.location.origin);
          
          window.close();
        } else {
          throw new Error(authData.message || '登录失败');
        }
      }
    } catch (error) {
      console.error('OAuth callback handling error:', error);
      
      if (window.opener) {
        // 在弹窗中，发送错误消息给父窗口
        window.opener.postMessage({
          type: 'OAUTH_ERROR',
          message: error.message || '登录处理失败'
        }, window.location.origin);
        
        window.close();
      } else {
        throw error;
      }
    }
  },

  // 存储认证信息
  setAuthData: (token, user) => {
    if (token) {
      localStorage.setItem('auth_token', token);
    }
    if (user) {
      localStorage.setItem('user_info', JSON.stringify(user));
    }
  },

  // 获取本地存储的认证信息
  getLocalAuthData: () => {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user_info');
    const user = userStr ? JSON.parse(userStr) : null;
    return { token, user };
  },

  // 清除本地认证信息
  clearLocalAuthData: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
  },

  // 获取登录前的URL
  getPreAuthUrl: () => {
    const url = localStorage.getItem('pre_auth_url');
    localStorage.removeItem('pre_auth_url');
    return url;
  }
};

// 导出配置好的axios实例供其他服务使用
export { authApi }; 