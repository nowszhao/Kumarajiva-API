const { db } = require('../db/init');
const config = require('../config/learning');
const authConfig = require('../config/auth');
const dayjs = require('dayjs');

// Helper function to safely parse JSON or return appropriate default
const safeJsonParse = (jsonString, defaultValue = null) => {
  if (!jsonString) return defaultValue;
  
  if (typeof jsonString === 'object') {
    return jsonString; // Already parsed
  }
  
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('Failed to parse JSON, treating as string:', jsonString);
    return jsonString;
  }
};

// Helper function to normalize definitions format
const normalizeDefinitions = (definitions) => {
  if (!definitions) return [];
  
  // If it's already an array, return as is
  if (Array.isArray(definitions)) {
    return definitions;
  }
  
  // If it's a string, try to parse it
  if (typeof definitions === 'string') {
    try {
      const parsed = JSON.parse(definitions);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      // If parsed result is not an array, convert string to array format
      return [{ pos: 'n.', meaning: parsed }];
    } catch (error) {
      // If JSON parsing fails, treat as a simple string definition
      // Try to extract part of speech if it exists
      const match = definitions.match(/^(\w+\.)\s*(.+)$/);
      if (match) {
        return [{ pos: match[1], meaning: match[2] }];
      }
      return [{ pos: 'n.', meaning: definitions }];
    }
  }
  
  return [];
};

// Helper function to normalize pronunciation format
const normalizePronunciation = (pronunciation) => {
  if (!pronunciation) return { American: '', British: '' };
  
  if (typeof pronunciation === 'object') {
    return pronunciation;
  }
  
  if (typeof pronunciation === 'string') {
    try {
      return JSON.parse(pronunciation);
    } catch (error) {
      return { American: pronunciation, British: '' };
    }
  }
  
  return { American: '', British: '' };
};

class VocabService {
  // Helper method to build user-aware SQL queries
  _buildUserClause(userId) {
    if (authConfig.legacyMode && !userId) {
      return 'user_id IS NULL';
    }
    return userId ? 'user_id = ?' : 'user_id IS NULL';
  }

  // Helper method to get query parameters
  _getUserParams(userId) {
    if (authConfig.legacyMode && !userId) {
      return [];
    }
    return userId ? [userId] : [];
  }

  // 添加新词汇前检查今日限额
  async addVocabulary(vocabData, userId = null) {
    const reviewService = require('./review'); // 避免循环依赖
    const remainingCount = await reviewService.getTodayNewWordsCount(userId);
    
    if (remainingCount <= 0) {
      throw new Error(`Daily new words limit (${config.dailyNewWords}) reached`);
    }

    const { word, definitions, memory_method, pronunciation } = vocabData;
    
    // Check if word already exists for this user
    const existing = await this.getVocabulary(word, userId);
    if (existing) {
      throw new Error(`Word "${word}" already exists`);
    }
    
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO vocabularies (word, definitions, memory_method, pronunciation, timestamp, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        word,
        JSON.stringify(definitions),
        memory_method,
        JSON.stringify(pronunciation),
        Date.now(),
        userId,
        function(err) {
          if (err) reject(err);
          else resolve({ success: true, word, id: this.lastID, remainingToday: remainingCount - 1 });
        }
      );
      
      stmt.finalize();
    });
  }

  // 获取词汇列表
  async getVocabularies(userId = null) {
    return new Promise((resolve, reject) => {
      const whereClause = this._buildUserClause(userId);
      const params = this._getUserParams(userId);
      
      db.all(`SELECT * FROM vocabularies WHERE ${whereClause} ORDER BY timestamp DESC`, params, (err, rows) => {
        if (err) reject(err);
        else {
          const vocabularies = rows.map(row => ({
            ...row,
            definitions: normalizeDefinitions(row.definitions),
            pronunciation: normalizePronunciation(row.pronunciation)
          }));
          resolve(vocabularies);
        }
      });
    });
  }

  // 获取单个词汇
  async getVocabulary(word, userId = null) {
    return new Promise((resolve, reject) => {
      const whereClause = this._buildUserClause(userId);
      const params = [word, ...this._getUserParams(userId)];
      
      db.get(`SELECT * FROM vocabularies WHERE word = ? AND ${whereClause}`, params, (err, row) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else {
          resolve({
            ...row,
            definitions: normalizeDefinitions(row.definitions),
            pronunciation: normalizePronunciation(row.pronunciation)
          });
        }
      });
    });
  }

  // 通过ID获取词汇
  async getVocabularyById(id, userId = null) {
    return new Promise((resolve, reject) => {
      const whereClause = this._buildUserClause(userId);
      const params = [id, ...this._getUserParams(userId)];
      
      db.get(`SELECT * FROM vocabularies WHERE id = ? AND ${whereClause}`, params, (err, row) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else {
          resolve({
            ...row,
            definitions: normalizeDefinitions(row.definitions),
            pronunciation: normalizePronunciation(row.pronunciation)
          });
        }
      });
    });
  }

  // 更新词汇
  async updateVocabulary(word, updateData, userId = null) {
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

    const whereClause = this._buildUserClause(userId);
    const params = [...values, word, ...this._getUserParams(userId)];

    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE vocabularies SET ${updates.join(', ')} WHERE word = ? AND ${whereClause}`,
        params,
        function(err) {
          if (err) reject(err);
          else resolve({ success: true, changes: this.changes });
        }
      );
    });
  }

  // 删除词汇
  async deleteVocabulary(word, userId = null) {
    return new Promise((resolve, reject) => {
      const whereClause = this._buildUserClause(userId);
      const params = [word, ...this._getUserParams(userId)];
      
      db.run(`DELETE FROM vocabularies WHERE word = ? AND ${whereClause}`, params, function(err) {
        if (err) reject(err);
        else resolve({ success: true, changes: this.changes });
      });
    });
  }

  // 导入词汇数据
  async importVocabularies(vocabularies, userId = null) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO vocabularies 
          (word, definitions, memory_method, pronunciation, mastered, timestamp, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
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
            userId,
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
  async exportVocabularies(userId = null) {
    return new Promise((resolve, reject) => {
      const whereClause = this._buildUserClause(userId);
      const params = this._getUserParams(userId);
      
      db.all(`SELECT * FROM vocabularies WHERE ${whereClause}`, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const vocabularies = {};
        rows.forEach(row => {
          vocabularies[row.word] = {
            word: row.word,
            definitions: normalizeDefinitions(row.definitions),
            memory_method: row.memory_method,
            pronunciation: normalizePronunciation(row.pronunciation),
            mastered: Boolean(row.mastered),
            timestamp: row.timestamp
          };
        });

        resolve(vocabularies);
      });
    });
  }

  // Get vocabulary statistics for a user
  async getVocabStats(userId = null) {
    return new Promise((resolve, reject) => {
      const whereClause = this._buildUserClause(userId);
      const params = this._getUserParams(userId);
      
      db.get(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN mastered = 1 THEN 1 ELSE 0 END) as mastered,
          SUM(CASE WHEN mastered = 0 THEN 1 ELSE 0 END) as learning
        FROM vocabularies 
        WHERE ${whereClause}
      `, params, (err, row) => {
        if (err) reject(err);
        else resolve({
          total: row.total || 0,
          mastered: row.mastered || 0,
          learning: row.learning || 0
        });
      });
    });
  }
}

module.exports = new VocabService();