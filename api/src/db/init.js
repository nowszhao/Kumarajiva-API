const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../vocab.db');
const db = new sqlite3.Database(dbPath);

async function initDatabase() {
  // 首先尝试运行数据库迁移
  try {
    const { runMigration } = require('./migrate');
    await runMigration();
  } catch (error) {
    console.log('数据库迁移检查完成');
  }

  // 然后确保所有表和索引都存在（为新安装准备）
  db.serialize(() => {
    // 用户表
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        github_id INTEGER UNIQUE,
        username TEXT,
        email TEXT,
        avatar_url TEXT,
        login_method TEXT DEFAULT 'github',
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // 用户会话表
    db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        expires_at INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);

    // 词汇表（保持向后兼容）
    db.run(`
      CREATE TABLE IF NOT EXISTS vocabularies (
        word TEXT PRIMARY KEY,
        definitions TEXT,
        memory_method TEXT,
        pronunciation TEXT,
        mastered BOOLEAN DEFAULT FALSE,
        timestamp INTEGER,
        user_id INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 学习记录表（保持向后兼容）
    db.run(`
      CREATE TABLE IF NOT EXISTS learning_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT,
        review_date INTEGER,
        review_result BOOLEAN,
        user_id INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(word) REFERENCES vocabularies(word)
      )
    `);

    // 学习进度表（保持向后兼容）
    db.run(`
      CREATE TABLE IF NOT EXISTS learning_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        current_word_index INTEGER DEFAULT 0,
        total_words INTEGER DEFAULT 30,
        completed INTEGER DEFAULT 0,
        correct INTEGER DEFAULT 0,
        user_id INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 用户表索引
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_users_github_id 
      ON users(github_id)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_users_email 
      ON users(email)
    `);

    // 会话表索引
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id 
      ON sessions(user_id)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_sessions_expires 
      ON sessions(expires_at)
    `);

    // 词汇表索引
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_vocabularies_user_id 
      ON vocabularies(user_id)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_vocabularies_word 
      ON vocabularies(word)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_vocabularies_mastered 
      ON vocabularies(mastered)
    `);

    // 学习记录表索引
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_learning_records_user_id 
      ON learning_records(user_id)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_learning_records_word 
      ON learning_records(word)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_learning_records_review_date 
      ON learning_records(review_date)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_learning_records_result 
      ON learning_records(review_result)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_learning_records_user_word 
      ON learning_records(user_id, word)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_learning_records_word_date 
      ON learning_records(word, review_date)
    `);

    // 学习进度表索引
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_learning_progress_user_id 
      ON learning_progress(user_id)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_learning_progress_date 
      ON learning_progress(date)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_learning_progress_user_date 
      ON learning_progress(user_id, date)
    `);
  });
}

module.exports = {
  db,
  initDatabase
};


