const { db } = require('../db/init');
const config = require('../config/learning');
const dayjs = require('dayjs');

class VocabService {
  // 添加新词汇前检查今日限额
  async addVocabulary(vocabData) {
    const reviewService = require('./review'); // 避免循环依赖
    const remainingCount = await reviewService.getTodayNewWordsCount();
    
    if (remainingCount <= 0) {
      throw new Error(`Daily new words limit (${config.dailyNewWords}) reached`);
    }

    const { word, definitions, memory_method, pronunciation } = vocabData;
    
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO vocabularies (word, definitions, memory_method, pronunciation, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        word,
        JSON.stringify(definitions),
        memory_method,
        JSON.stringify(pronunciation),
        Date.now(),
        (err) => {
          if (err) reject(err);
          else resolve({ success: true, word, remainingToday: remainingCount - 1 });
        }
      );
      
      stmt.finalize();
    });
  }

  // 获取词汇列表
  async getVocabularies() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM vocabularies', (err, rows) => {
        if (err) reject(err);
        else {
          const vocabularies = rows.map(row => ({
            ...row,
            definitions: JSON.parse(row.definitions),
            pronunciation: JSON.parse(row.pronunciation)
          }));
          resolve(vocabularies);
        }
      });
    });
  }

  // 获取单个词汇
  async getVocabulary(word) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM vocabularies WHERE word = ?', [word], (err, row) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else {
          resolve({
            ...row,
            definitions: JSON.parse(row.definitions),
            pronunciation: JSON.parse(row.pronunciation)
          });
        }
      });
    });
  }

  // 更新词汇
  async updateVocabulary(word, updateData) {
    const updates = [];
    const values = [];
    
    Object.entries(updateData).forEach(([key, value]) => {
      if (key === 'definitions' || key === 'pronunciation') {
        updates.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    });

    values.push(word);

    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE vocabularies SET ${updates.join(', ')} WHERE word = ?`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve({ success: true, changes: this.changes });
        }
      );
    });
  }

  // 删除词汇
  async deleteVocabulary(word) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM vocabularies WHERE word = ?', [word], function(err) {
        if (err) reject(err);
        else resolve({ success: true, changes: this.changes });
      });
    });
  }

  // 导入词汇数据
  async importVocabularies(vocabularies) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO vocabularies 
          (word, definitions, memory_method, pronunciation, mastered, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        let importCount = 0;
        for (const [word, vocab] of Object.entries(vocabularies)) {
          stmt.run(
            word,
            JSON.stringify(vocab.definitions),
            vocab.memory_method,
            JSON.stringify(vocab.pronunciation),
            vocab.mastered ? 1 : 0,
            vocab.timestamp,
            (err) => {
              if (err) console.error(`Error importing word ${word}:`, err);
              else importCount++;
            }
          );
        }

        stmt.finalize((err) => {
          if (err) reject(err);
          else resolve({ success: true, count: importCount });
        });
      });
    });
  }

  // 导出词汇数据
  async exportVocabularies() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM vocabularies', (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const vocabularies = {};
        rows.forEach(row => {
          vocabularies[row.word] = {
            word: row.word,
            definitions: JSON.parse(row.definitions),
            memory_method: row.memory_method,
            pronunciation: JSON.parse(row.pronunciation),
            mastered: Boolean(row.mastered),
            timestamp: row.timestamp
          };
        });

        resolve(vocabularies);
      });
    });
  }
}

module.exports = new VocabService();