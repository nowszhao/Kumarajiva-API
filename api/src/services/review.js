const { db } = require('../db/init');
const dayjs = require('dayjs');
const config = require('../config/learning');

class ReviewService {
  // 获取今日需要复习的词汇
  async getTodayReviewWords() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT v.*, 
               COUNT(lr.id) as review_count,
               MAX(lr.review_date) as last_review_date
        FROM vocabularies v
        LEFT JOIN learning_records lr ON v.word = lr.word
        WHERE v.mastered = FALSE
        GROUP BY v.word
        HAVING 
          last_review_date IS NULL OR 
          (julianday('now') - julianday(datetime(last_review_date/1000, 'unixepoch'))) >= 
          CASE review_count
            WHEN 0 THEN ${config.reviewDays[0]}
            WHEN 1 THEN ${config.reviewDays[1]}
            WHEN 2 THEN ${config.reviewDays[2]}
            WHEN 3 THEN ${config.reviewDays[3]}
            WHEN 4 THEN ${config.reviewDays[4]}
            ELSE ${config.reviewDays[5]}
          END
        LIMIT ${config.dailyReviewLimit}
      `, (err, rows) => {
        if (err) reject(err);
        else {
          const words = rows.map(row => ({
            ...row,
            definitions: JSON.parse(row.definitions),
            pronunciation: JSON.parse(row.pronunciation),
            review_count: row.review_count || 0
          }));
          resolve(words);
        }
      });
    });
  }

  // 获取今日可学习的新词数量
  async getTodayNewWordsCount() {
    const today = dayjs().startOf('day').valueOf();
    const todayEnd = dayjs().endOf('day').valueOf();
    
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT COUNT(*) as count
        FROM vocabularies
        WHERE timestamp BETWEEN ? AND ?
      `, [today, todayEnd], (err, row) => {
        if (err) reject(err);
        else resolve(config.dailyNewWords - (row?.count || 0));
      });
    });
  }

  // 检查词汇是否已掌握
  async checkMastery(word) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT COUNT(*) as correct_streak
        FROM (
          SELECT review_result
          FROM learning_records
          WHERE word = ?
          ORDER BY review_date DESC
          LIMIT ${config.masteryThreshold}
        )
        WHERE review_result = 1
      `, [word], async (err, row) => {
        if (err) {
          reject(err);
        } else if (row.correct_streak >= config.masteryThreshold) {
          // 更新词汇掌握状态
          await this.updateMasteryStatus(word, true);
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  // 更新词汇掌握状态
  async updateMasteryStatus(word, mastered) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE vocabularies SET mastered = ? WHERE word = ?',
        [mastered ? 1 : 0, word],
        (err) => {
          if (err) reject(err);
          else resolve({ success: true });
        }
      );
    });
  }

  // 获取或创建今日进度
  async getTodayProgress() {
    const today = new Date().toISOString().split('T')[0];
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM learning_progress WHERE date = ?',
        [today],
        async (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          if (row) {
            resolve(row);
          } else {
            // 如果没有今日记录，创建新记录
            const todayWords = await this.getTodayReviewWords();
            db.run(
              `INSERT INTO learning_progress (date, total_words, current_word_index, completed, correct) 
               VALUES (?, ?, 0, 0, 0)`,
              [today, todayWords.length],
              function(err) {
                if (err) {
                  reject(err);
                  return;
                }
                resolve({
                  date: today,
                  current_word_index: 0,
                  total_words: todayWords.length,
                  completed: 0,
                  correct: 0
                });
              }
            );
          }
        }
      );
    });
  }

  // 更新学习进度
  async updateProgress(progress) {
    const today = new Date().toISOString().split('T')[0];
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE learning_progress 
         SET current_word_index = ?, completed = ?, correct = ?
         WHERE date = ?`,
        [progress.current_word_index, progress.completed, progress.correct, today],
        (err) => {
          if (err) reject(err);
          else resolve(true);
        }
      );
    });
  }

  // 修改现有的记录复习方法
  async recordReview(word, result) {
    const today = new Date().toISOString().split('T')[0];
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `INSERT INTO learning_records (word, review_date, review_result) 
           VALUES (?, ?, ?)`,
          [word, Date.now(), result ? 1 : 0],
          async (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            // 更新进度
            db.run(
              `UPDATE learning_progress 
               SET completed = completed + 1,
                   correct = correct + CASE WHEN ? THEN 1 ELSE 0 END
               WHERE date = ?`,
              [result ? 1 : 0, today],
              (err) => {
                if (err) reject(err);
                else resolve(true);
              }
            );
          }
        );
      });
    });
  }

  // 生成练习题
  async generateQuiz(word) {
    // 首先检查参数
    if (!word || typeof word !== 'string' || word.trim().length === 0) {
      throw new Error('Invalid word parameter');
    }

    // 清理输入
    const cleanWord = word.trim();

    // 获取目标词汇
    const vocab = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM vocabularies WHERE word = ? COLLATE NOCASE', [cleanWord], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // 如果找不到词汇，返回更详细的错误
    if (!vocab) {
      throw new Error(`Word "${cleanWord}" not found in vocabulary database`);
    }

    try {
      // 获取其他词汇作为干扰项
      const otherWords = await new Promise((resolve, reject) => {
        db.all(
          'SELECT * FROM vocabularies WHERE word != ? ORDER BY RANDOM() LIMIT 3',
          [cleanWord],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      // 如果没有足够的干扰项，抛出错误
      if (otherWords.length < 3) {
        throw new Error('Not enough vocabulary items for quiz generation');
      }

      const targetDefs = JSON.parse(vocab.definitions);
      const options = otherWords.map(w => ({
        word: w.word,
        definition: JSON.parse(w.definitions)[0]?.meaning || '',
        pos: JSON.parse(w.definitions)[0]?.pos || ''
      }));

      // 添加正确答案
      options.push({
        word: vocab.word,
        definition: targetDefs[0]?.meaning || '',
        pos: targetDefs[0]?.pos || ''
      });

      // 打乱选项顺序
      const shuffledOptions = options.sort(() => Math.random() - 0.5);

      return {
        word: vocab.word,
        phonetic: vocab.phonetic || null,
        audio: vocab.audio_url || null,
        definitions: targetDefs || [],
        examples: JSON.parse(vocab.examples || '[]'),
        memory_method: vocab.memory_method || '',
        correct_answer: targetDefs[0]?.meaning || '',
        options: shuffledOptions.map(opt => ({
          definition: opt.definition,
          pos: opt.pos
        }))
      };
    } catch (error) {
      throw new Error(`Failed to generate quiz: ${error.message}`);
    }
  }

  // 获取学习历史记录
  async getLearningHistory() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          v.*,
          MAX(lr.review_date) as last_review_date,
          COUNT(lr.id) as review_count,
          SUM(CASE WHEN lr.review_result = 1 THEN 1 ELSE 0 END) as correct_count
        FROM vocabularies v
        LEFT JOIN learning_records lr ON v.word = lr.word
        WHERE lr.review_date IS NOT NULL
        GROUP BY v.word
        ORDER BY last_review_date DESC
      `, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const words = rows.map(row => ({
            ...row,
            definitions: JSON.parse(row.definitions),
            examples: JSON.parse(row.examples || '[]'),
            last_review_date: row.last_review_date,
            review_count: row.review_count,
            correct_count: row.correct_count
          }));
          resolve(words);
        }
      });
    });
  }

  // 添加重置今日进度的方法
  async resetTodayProgress() {
    const today = new Date().toISOString().split('T')[0];
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // 开始事务
        db.run('BEGIN TRANSACTION');

        // 删除今日的学习记录
        db.run(
          `DELETE FROM learning_records 
           WHERE date(datetime(review_date/1000, 'unixepoch')) = date(?)`,
          [today]
        );

        // 重置今日进度
        db.run(
          `UPDATE learning_progress 
           SET current_word_index = 0, completed = 0, correct = 0 
           WHERE date = ?`,
          [today],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
            } else {
              db.run('COMMIT');
              resolve(true);
            }
          }
        );
      });
    });
  }
}

module.exports = new ReviewService();