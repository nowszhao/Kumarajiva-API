const userService = require('../services/user');
const { generateToken, generateTokenPair, detectClientType } = require('../middleware/auth');
const authConfig = require('../config/auth');
const axios = require('axios');
const jwt = require('jsonwebtoken');

async function routes(fastify, options) {
  // GitHub OAuth initiate - 支持客户端类型参数
  fastify.get('/github', async (request, reply) => {
    if (!authConfig.github.clientId) {
      reply.code(500).send({
        success: false,
        message: 'GitHub OAuth not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.'
      });
      return;
    }

    // 从查询参数获取客户端类型，默认为web
    const clientType = request.query.client_type || 
                      request.headers['x-client-type'] || 
                      detectClientType(request);
    
    // 从查询参数获取回调URL（用于自定义重定向）
    const customCallback = request.query.callback_url;
    
    // 使用客户端类型作为state，包含更多信息以提高安全性
    const stateData = {
      clientType: clientType,
      timestamp: Date.now(),
      random: Math.random().toString(36).substring(7),
      customCallback: customCallback
    };
    
    // 使用JWT编码state，确保安全性
    const state = jwt.sign(stateData, authConfig.jwt.secret, { expiresIn: '10m' });
    
    console.log('=== GitHub OAuth Initiate ===');
    console.log('Client Type:', clientType);
    console.log('Custom Callback:', customCallback);
    console.log('Generated state:', state);

    const githubAuthUrl = `https://github.com/login/oauth/authorize?` +
      `client_id=${authConfig.github.clientId}&` +
      `redirect_uri=${encodeURIComponent(authConfig.github.callbackUrl)}&` +
      `scope=${authConfig.github.scope.join(' ')}&` +
      `state=${state}`;

    console.log('Redirecting to:', githubAuthUrl);
    console.log('=== End GitHub OAuth Initiate ===');

    reply.redirect(githubAuthUrl);
  });

  // GitHub OAuth callback - 根据客户端类型返回不同响应
  fastify.get('/github/callback', async (request, reply) => {
    try {
      const { code, state, error, error_description } = request.query;

      console.log('=== GitHub OAuth Callback ===');
      console.log('Received code:', code ? 'present' : 'missing');
      console.log('Received state:', state ? 'present' : 'missing');
      console.log('Received error:', error);

      // 处理GitHub返回的错误
      if (error) {
        console.log('GitHub OAuth error:', error, error_description);
        return handleOAuthError(reply, {
          error: 'oauth_error',
          message: error_description || error,
          details: { error, error_description }
        }, 'web'); // 默认按web处理错误
      }

      if (!code) {
        return handleOAuthError(reply, {
          error: 'missing_code',
          message: 'Authorization code not provided'
        }, 'web');
      }

      if (!state) {
        return handleOAuthError(reply, {
          error: 'missing_state',
          message: 'State parameter not provided'
        }, 'web');
      }

      // 验证并解析state
      let stateData;
      try {
        stateData = jwt.verify(state, authConfig.jwt.secret);
        console.log('State verified successfully:', stateData);
      } catch (jwtError) {
        console.log('State verification failed:', jwtError.message);
        return handleOAuthError(reply, {
          error: 'invalid_state',
          message: 'Invalid or expired state parameter'
        }, 'web');
      }

      const clientType = stateData.clientType || 'web';
      console.log('Client type from state:', clientType);

      // Exchange code for access token
      console.log('Exchanging code for access token...');
      const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
        client_id: authConfig.github.clientId,
        client_secret: authConfig.github.clientSecret,
        code: code,
      }, {
        headers: {
          'Accept': 'application/json'
        }
      });

      const accessToken = tokenResponse.data.access_token;

      if (!accessToken) {
        console.log('Failed to get access token:', tokenResponse.data);
        return handleOAuthError(reply, {
          error: 'token_exchange_failed',
          message: 'Failed to exchange code for access token'
        }, clientType);
      }

      // Get user info from GitHub
      console.log('Fetching user info from GitHub...');
      const userResponse = await axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      const githubUser = userResponse.data;

      // Get user email if not public
      if (!githubUser.email) {
        try {
        const emailResponse = await axios.get('https://api.github.com/user/emails', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        });
        const primaryEmail = emailResponse.data.find(email => email.primary);
        githubUser.email = primaryEmail ? primaryEmail.email : null;
        } catch (emailError) {
          console.log('Failed to fetch user email:', emailError.message);
        }
      }

      // Create or update user in database
      console.log('Creating/updating user in database...');
      const user = await userService.createOrUpdateGithubUser(githubUser);

      // 生成token（根据客户端类型决定是否需要refresh token）
      const needsRefreshToken = ['ios', 'android', 'desktop'].includes(clientType);
      let authData;

      if (needsRefreshToken) {
        const tokens = generateTokenPair(user.id, clientType);
        authData = {
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_type: 'Bearer',
          expires_in: authConfig.jwt.expiresIn
        };
      } else {
        const token = generateToken(user.id, clientType);
        authData = {
          token: token,
          expires_in: authConfig.jwt.expiresIn
        };
      }

      // 添加用户信息
      authData.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            avatar_url: user.avatar_url,
        login_method: user.login_method,
        created_at: user.created_at
      };

      console.log('Authentication successful for user:', user.username);
      console.log('Client type:', clientType);
      console.log('=== End GitHub OAuth Callback ===');

      // 根据客户端类型返回不同的响应
      return handleOAuthSuccess(reply, authData, clientType, stateData);

    } catch (error) {
      console.error('GitHub OAuth callback error:', error);
      return handleOAuthError(reply, {
        error: 'internal_error',
        message: 'Authentication failed due to server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, 'web');
    }
  });

  // 处理OAuth成功的响应
  function handleOAuthSuccess(reply, authData, clientType, stateData) {
    switch (clientType) {
      case 'ios':
        // iOS应用使用自定义URL Scheme
        const iosScheme = process.env.IOS_URL_SCHEME || 'kumarajiva-ios';
        const iosParams = new URLSearchParams({
          access_token: authData.access_token || authData.token,
          refresh_token: authData.refresh_token || '',
          user_id: authData.user.id,
          username: authData.user.username
        });
        return reply.redirect(`${iosScheme}://oauth-callback?${iosParams.toString()}`);

      case 'android':
        // Android应用使用自定义URL Scheme
        const androidScheme = process.env.ANDROID_URL_SCHEME || 'kumarajiva-android';
        const androidParams = new URLSearchParams({
          access_token: authData.access_token || authData.token,
          refresh_token: authData.refresh_token || '',
          user_id: authData.user.id,
          username: authData.user.username
        });
        return reply.redirect(`${androidScheme}://oauth-callback?${androidParams.toString()}`);

      case 'desktop':
        // 桌面应用使用本地回调
        const desktopCallback = stateData.customCallback || 'http://localhost:8080/oauth-callback';
        const desktopParams = new URLSearchParams({
          access_token: authData.access_token || authData.token,
          refresh_token: authData.refresh_token || '',
          user_id: authData.user.id,
          username: authData.user.username
        });
        return reply.redirect(`${desktopCallback}?${desktopParams.toString()}`);

      case 'extension':
      case 'chrome':
        // Chrome插件直接返回JSON
        return reply.send({
          success: true,
          data: authData
        });

      case 'web':
      default:
        // Web应用的处理
        if (stateData.customCallback) {
          // 如果有自定义回调URL，重定向到该URL
          const webParams = new URLSearchParams({
            token: authData.token || authData.access_token,
            user_id: authData.user.id,
            username: authData.user.username
          });
          return reply.redirect(`${stateData.customCallback}?${webParams.toString()}`);
        } else {
          // 返回HTML页面，包含JSON数据和自动处理脚本
          const jsonData = JSON.stringify({ success: true, data: authData });
          const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>登录处理中...</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 1rem;
            backdrop-filter: blur(10px);
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top: 4px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <h2>登录成功！</h2>
        <p>正在处理登录信息...</p>
    </div>
    
    <script>
        // 认证数据
        const authData = ${jsonData};
        
        console.log('OAuth callback received:', authData);
        
        // 检查是否在弹窗中
        if (window.opener && window.opener !== window) {
            console.log('In popup, sending message to parent');
            // 在弹窗中，发送消息给父窗口
            window.opener.postMessage({
                type: 'OAUTH_SUCCESS',
                data: authData.data
            }, '*');
            
            // 延迟关闭弹窗
            setTimeout(() => {
                window.close();
            }, 2000);
        } else {
            console.log('In main window, saving data and redirecting');
            // 在主窗口中，保存认证信息
            if (authData.data.token || authData.data.access_token) {
                localStorage.setItem('auth_token', authData.data.token || authData.data.access_token);
            }
            if (authData.data.user) {
                localStorage.setItem('user_info', JSON.stringify(authData.data.user));
            }
            
            // 触发认证成功事件
            window.dispatchEvent(new CustomEvent('auth:success', {
                detail: {
                    token: authData.data.token || authData.data.access_token,
                    user: authData.data.user
                }
            }));
            
            // 重定向到原页面或首页
            const preAuthUrl = localStorage.getItem('pre_auth_url');
            localStorage.removeItem('pre_auth_url');
            
            setTimeout(() => {
                window.location.href = preAuthUrl || '/';
            }, 1000);
        }
    </script>
</body>
</html>`;
          
          return reply.type('text/html').send(html);
        }
    }
  }

  // 处理OAuth错误的响应
  function handleOAuthError(reply, errorData, clientType) {
    switch (clientType) {
      case 'ios':
        const iosScheme = process.env.IOS_URL_SCHEME || 'kumarajiva-ios';
        const iosParams = new URLSearchParams({
          error: errorData.error,
          error_description: errorData.message
        });
        return reply.redirect(`${iosScheme}://oauth-error?${iosParams.toString()}`);

      case 'android':
        const androidScheme = process.env.ANDROID_URL_SCHEME || 'kumarajiva-android';
        const androidParams = new URLSearchParams({
          error: errorData.error,
          error_description: errorData.message
        });
        return reply.redirect(`${androidScheme}://oauth-error?${androidParams.toString()}`);

      case 'desktop':
      case 'extension':
      case 'chrome':
      case 'web':
      default:
        // Web应用错误处理 - 返回HTML页面
        const errorJsonData = JSON.stringify({ success: false, ...errorData });
        const errorHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>登录失败</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 1rem;
            backdrop-filter: blur(10px);
        }
        .error-icon {
            width: 60px;
            height: 60px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">
            <svg width="30" height="30" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
        </div>
        <h2>登录失败</h2>
        <p>${errorData.message || '认证过程中发生错误'}</p>
    </div>
    
    <script>
        const errorData = ${errorJsonData};
        
        console.log('OAuth error received:', errorData);
        
        // 检查是否在弹窗中
        if (window.opener && window.opener !== window) {
            console.log('In popup, sending error message to parent');
            // 在弹窗中，发送错误消息给父窗口
            window.opener.postMessage({
                type: 'OAUTH_ERROR',
                message: errorData.message || '登录失败'
            }, '*');
            
            // 延迟关闭弹窗
            setTimeout(() => {
                window.close();
            }, 1000);
        } else {
            console.log('In main window, will redirect after delay');
            // 在主窗口中，延迟后重定向到首页
            setTimeout(() => {
                window.location.href = '/';
            }, 3000);
        }
    </script>
</body>
</html>`;
        return reply.code(400).type('text/html').send(errorHtml);
    }
  }

  // Token刷新接口
  fastify.post('/refresh', async (request, reply) => {
    return fastify.auth.refreshToken(request, reply);
  });

  // Get current user profile
  fastify.get('/profile', {
    preHandler: async (request, reply) => {
      await fastify.auth.optionalAuth(request, reply);
    }
  }, async (request, reply) => {
    if (!request.user) {
      reply.code(401).send({
        success: false,
        message: 'Not authenticated'
      });
      return;
    }

    const stats = await userService.getUserStats(request.user.id);

    reply.send({
      success: true,
      data: {
        user: {
          id: request.user.id,
          username: request.user.username,
          email: request.user.email,
          avatar_url: request.user.avatar_url,
          login_method: request.user.login_method,
          created_at: request.user.created_at
        },
        stats: stats,
        client_type: request.clientType
      }
    });
  });

  // Get JWT Token (专门为移动应用提供)
  fastify.get('/token', {
    preHandler: async (request, reply) => {
      await fastify.auth.optionalAuth(request, reply);
    }
  }, async (request, reply) => {
    if (!request.user) {
      reply.code(401).send({
        success: false,
        message: 'Not authenticated. Please login first via /api/auth/github'
      });
      return;
    }

    const clientType = request.clientType || 'web';
    const needsRefreshToken = ['ios', 'android', 'desktop'].includes(clientType);

    let tokenData;
    if (needsRefreshToken) {
      const tokens = generateTokenPair(request.user.id, clientType);
      tokenData = {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_type: 'Bearer',
        expires_in: authConfig.jwt.expiresIn
      };
    } else {
      const token = generateToken(request.user.id, clientType);
      tokenData = {
        token: token,
        expires_in: authConfig.jwt.expiresIn
      };
    }

    reply.send({
      success: true,
      data: {
        ...tokenData,
        user: {
          id: request.user.id,
          username: request.user.username,
          email: request.user.email,
          avatar_url: request.user.avatar_url,
          login_method: request.user.login_method
        },
        client_type: clientType
      }
    });
  });

  // Logout
  fastify.post('/logout', async (request, reply) => {
    try {
      const sessionId = request.session.sessionId;
      
      if (sessionId) {
        await userService.deleteSession(sessionId);
      }

      // Clear session
      request.session.destroy();

      reply.send({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      reply.code(500).send({
        success: false,
        message: 'Logout failed',
        error: error.message
      });
    }
  });

  // Check authentication status
  fastify.get('/status', {
    preHandler: async (request, reply) => {
      await fastify.auth.optionalAuth(request, reply);
    }
  }, async (request, reply) => {
    reply.send({
      success: true,
      data: {
        authenticated: !!request.user,
        legacyMode: authConfig.legacyMode,
        client_type: request.clientType,
        user: request.user ? {
          id: request.user.id,
          username: request.user.username,
          email: request.user.email,
          avatar_url: request.user.avatar_url
        } : null
      }
    });
  });

  // Clean expired sessions (maintenance endpoint)
  fastify.post('/cleanup', async (request, reply) => {
    try {
      const result = await userService.cleanExpiredSessions();
      reply.send({
        success: true,
        message: `Cleaned ${result.changes} expired sessions`
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        message: 'Cleanup failed',
        error: error.message
      });
    }
  });
}

module.exports = routes; 