const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../vocab.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  db.serialize(() => {
    // 词汇表
    db.run(`
      CREATE TABLE IF NOT EXISTS vocabularies (
        word TEXT PRIMARY KEY,
        definitions TEXT,
        memory_method TEXT,
        pronunciation TEXT,
        mastered BOOLEAN DEFAULT FALSE,
        timestamp INTEGER
      )
    `);

    // 学习记录表
    db.run(`
      CREATE TABLE IF NOT EXISTS learning_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT,
        review_date INTEGER,
        review_result BOOLEAN,
        FOREIGN KEY(word) REFERENCES vocabularies(word)
      )
    `);

    // 学习进度表
    db.run(`
      CREATE TABLE IF NOT EXISTS learning_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        current_word_index INTEGER DEFAULT 0,
        total_words INTEGER DEFAULT 20,
        completed INTEGER DEFAULT 0,
        correct INTEGER DEFAULT 0
      )
    `);

    // 创建索引以优化查询性能
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
      CREATE INDEX IF NOT EXISTS idx_vocabularies_mastered 
      ON vocabularies(mastered)
    `);

    // 组合索引，用于按时间范围和单词查询
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_learning_records_word_date 
      ON learning_records(word, review_date)
    `);

    // 组合索引，用于按掌握状态和复习时间查询
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_vocab_mastered_review 
      ON vocabularies(mastered, word)
    `);
  });
}

module.exports = {
  db,
  initDatabase
};
