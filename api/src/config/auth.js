module.exports = {
  session: {
    secret: process.env.SESSION_SECRET || 'kumarajiva-session-secret-change-in-production',
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000*10000, // 30 days
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 跨域支持
      domain: process.env.COOKIE_DOMAIN || undefined, // 允许配置cookie域名
    },
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    scope: ['user:email'],
    callbackUrl: process.env.GITHUB_CALLBACK_URL || 'http://127.0.0.1:3000/api/auth/github/callback',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'kumarajiva-jwt-secret-change-in-production',
    expiresIn: '7d',
    refreshExpiresIn: '30d', // Refresh token有效期
  },
  // CORS配置
  cors: {
    origin: process.env.CORS_ORIGINS ? 
      process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()) : 
      [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://47.121.117.100:5173',
        'http://47.121.117.100:3000',
        // 添加移动端scheme支持
        'kumarajiva://',
        'kumarajiva-ios://',
        'kumarajiva-android://'
      ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Client-Type', 'X-Client-Version']
  },
  // 客户端类型配置
  clientTypes: {
    WEB: 'web',
    IOS: 'ios', 
    ANDROID: 'android',
    DESKTOP: 'desktop',
    EXTENSION: 'extension'
  },
  // Legacy mode - when true, APIs work without authentication for backward compatibility
  legacyMode: process.env.LEGACY_MODE !== 'false', // Default to true for backward compatibility
}; 
