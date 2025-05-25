const jwt = require('jsonwebtoken');
const { db } = require('../db/init');
const authConfig = require('../config/auth');

// JWT token verification
async function verifyToken(token, isRefreshToken = false) {
  try {
    const secret = authConfig.jwt.secret;
    const decoded = jwt.verify(token, secret);
    
    // 检查token类型
    if (isRefreshToken && decoded.type !== 'refresh') {
      return null;
    }
    if (!isRefreshToken && decoded.type === 'refresh') {
      return null;
    }
    
    return decoded;
  } catch (error) {
    console.log('Token verification error:', error.message);
    return null;
  }
}

// Get user from database
async function getUser(userId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// 检测客户端类型
function detectClientType(request) {
  const userAgent = request.headers['user-agent'] || '';
  const clientType = request.headers['x-client-type'];
  
  if (clientType) {
    return clientType.toLowerCase();
  }
  
  // 基于User-Agent检测
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    return authConfig.clientTypes.IOS;
  }
  if (userAgent.includes('Android')) {
    return authConfig.clientTypes.ANDROID;
  }
  if (userAgent.includes('Electron')) {
    return authConfig.clientTypes.DESKTOP;
  }
  if (userAgent.includes('Chrome-Extension')) {
    return authConfig.clientTypes.EXTENSION;
  }
  
  return authConfig.clientTypes.WEB;
}

// 获取token的优先级顺序（根据客户端类型）
function getTokenFromRequest(request) {
  const clientType = detectClientType(request);
  
  // Authorization header (所有客户端都支持)
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return {
      token: authHeader.replace('Bearer ', ''),
      source: 'header'
    };
  }
  
  // Session token (主要用于Web)
  if (clientType === authConfig.clientTypes.WEB && request.session?.token) {
    return {
      token: request.session.token,
      source: 'session'
    };
  }
  
  // Cookie token (备用方案)
  if (request.cookies?.token) {
    return {
      token: request.cookies.token,
      source: 'cookie'
    };
  }
  
  return null;
}

// Authentication middleware with legacy support
async function authenticate(request, reply) {
  const clientType = detectClientType(request);
  console.log('🔍 Auth middleware called, client:', clientType, 'legacyMode:', authConfig.legacyMode);
  
  // In legacy mode, allow requests without authentication
  if (authConfig.legacyMode) {
    console.log('📝 Legacy mode enabled, using optional auth');
    const tokenInfo = getTokenFromRequest(request);
    
    if (tokenInfo) {
      const decoded = await verifyToken(tokenInfo.token);
      if (decoded) {
        const user = await getUser(decoded.userId);
        if (user) {
          request.user = user;
          request.clientType = clientType;
        }
      }
    }
    // Continue regardless of authentication status in legacy mode
    return;
  }

  console.log('🔐 Strict authentication mode');
  // Strict authentication mode
  const tokenInfo = getTokenFromRequest(request);

  console.log('🎫 Token found:', !!tokenInfo, 'source:', tokenInfo?.source);
  if (!tokenInfo) {
    console.log('❌ No token provided');
    return reply.code(401).send({ 
      success: false, 
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
      clientType: clientType
    });
  }

  console.log('🔍 Verifying token...');
  const decoded = await verifyToken(tokenInfo.token);
  console.log('✅ Token decoded:', !!decoded);
  if (!decoded) {
    console.log('❌ Token verification failed');
    return reply.code(401).send({ 
      success: false, 
      message: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
      clientType: clientType
    });
  }

  console.log('👤 Looking up user:', decoded.userId);
  const user = await getUser(decoded.userId);
  console.log('✅ User found:', !!user);
  if (!user) {
    console.log('❌ User not found in database');
    return reply.code(401).send({ 
      success: false, 
      message: 'User not found',
      code: 'USER_NOT_FOUND',
      clientType: clientType
    });
  }

  console.log('🎉 Authentication successful for user:', user.username);
  request.user = user;
  request.clientType = clientType;
  request.tokenSource = tokenInfo.source;
}

// Optional authentication middleware - always allows request but adds user if authenticated
async function optionalAuth(request, reply) {
  const clientType = detectClientType(request);
  const tokenInfo = getTokenFromRequest(request);
  
  if (tokenInfo) {
    const decoded = await verifyToken(tokenInfo.token);
    if (decoded) {
      const user = await getUser(decoded.userId);
      if (user) {
        request.user = user;
        request.clientType = clientType;
        request.tokenSource = tokenInfo.source;
      }
    }
  } else {
    request.clientType = clientType;
  }
  // Always continue regardless of authentication status
}

// Generate JWT token pair (access + refresh)
function generateTokenPair(userId, clientType = 'web') {
  const accessToken = jwt.sign(
    { 
      userId, 
      type: 'access',
      clientType 
    },
    authConfig.jwt.secret,
    { expiresIn: authConfig.jwt.expiresIn }
  );
  
  const refreshToken = jwt.sign(
    { 
      userId, 
      type: 'refresh',
      clientType 
    },
    authConfig.jwt.secret,
    { expiresIn: authConfig.jwt.refreshExpiresIn }
  );
  
  return { accessToken, refreshToken };
}

// Generate single JWT token (backward compatibility)
function generateToken(userId, clientType = 'web') {
  return jwt.sign(
    { 
      userId,
      type: 'access',
      clientType 
    },
    authConfig.jwt.secret,
    { expiresIn: authConfig.jwt.expiresIn }
  );
}

// Refresh token middleware
async function refreshToken(request, reply) {
  const refreshToken = request.body?.refresh_token || 
                      request.headers['x-refresh-token'];
  
  if (!refreshToken) {
    return reply.code(400).send({
      success: false,
      message: 'Refresh token required',
      code: 'REFRESH_TOKEN_REQUIRED'
    });
  }
  
  const decoded = await verifyToken(refreshToken, true);
  if (!decoded) {
    return reply.code(401).send({
      success: false,
      message: 'Invalid or expired refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
  
  const user = await getUser(decoded.userId);
  if (!user) {
    return reply.code(401).send({
      success: false,
      message: 'User not found',
      code: 'USER_NOT_FOUND'
    });
  }
  
  // 生成新的token对
  const clientType = decoded.clientType || detectClientType(request);
  const tokens = generateTokenPair(user.id, clientType);
  
  reply.send({
    success: true,
    data: {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: 'Bearer',
      expires_in: authConfig.jwt.expiresIn,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url
      }
    }
  });
}

module.exports = {
  authenticate,
  optionalAuth,
  generateToken,
  generateTokenPair,
  verifyToken,
  getUser,
  detectClientType,
  refreshToken
}; 