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
        total_words INTEGER DEFAULT 5,
        completed INTEGER DEFAULT 0,
        correct INTEGER DEFAULT 0
      )
    `);
  });
}

module.exports = {
  db,
  initDatabase
};