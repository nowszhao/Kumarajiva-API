const { db } = require('../db/init');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const config = require('../config/learning');

// 配置 dayjs 使用时区插件
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Shanghai');

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
          (julianday(datetime('now', 'localtime')) - 
           julianday(datetime(last_review_date/1000, 'unixepoch', '+8 hours'))) >= 
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
    const today = dayjs().tz().startOf('day').valueOf();
    const todayEnd = dayjs().tz().endOf('day').valueOf();
    
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
    const today = dayjs().tz().format('YYYY-MM-DD');
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
    const today = dayjs().tz().format('YYYY-MM-DD');
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
    const vocab = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM vocabularies WHERE word = ?', [word], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!vocab) {
      throw new Error('Word not found');
    }

    // 获取其他词汇作为干扰项
    const otherWords = await new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM vocabularies WHERE word != ? ORDER BY RANDOM() LIMIT 3',
        [word],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    const targetDefs = JSON.parse(vocab.definitions);
    const options = otherWords.map(w => ({
      word: w.word,
      definition: JSON.parse(w.definitions)[0].meaning,
      pos: JSON.parse(w.definitions)[0].pos
    }));

    // 添加正确答案
    options.push({
      word: vocab.word,
      definition: targetDefs[0].meaning,
      pos: targetDefs[0].pos
    });

    // 打乱选项顺序
    const shuffledOptions = options.sort(() => Math.random() - 0.5);

    return {
      word: vocab.word,
      phonetic: JSON.parse(vocab.pronunciation).American || null,
      audio: vocab.audio_url || null,
      definitions: targetDefs || [],
      examples: JSON.parse(vocab.examples || '[]'),
      memory_method: vocab.memory_method || '',
      correct_answer: targetDefs[0].meaning,
      options: shuffledOptions.map(opt => ({
        definition: opt.definition,
        pos: opt.pos
      }))
    };
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
    const today = dayjs().tz().format('YYYY-MM-DD');
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 删除今日的学习记录，使用本地时区
        db.run(
          `DELETE FROM learning_records 
           WHERE date(datetime(review_date/1000, 'unixepoch', '+8 hours')) = date(?)`,
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