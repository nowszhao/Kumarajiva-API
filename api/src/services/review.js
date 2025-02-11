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
  // 获取今日需要学习的所有词汇(新词+复习词)
  async getTodayReviewWords() {
    const [newWords, reviewWords] = await Promise.all([
      this.getTodayNewWords(),
      this.getTodayReviewDueWords()
    ]);

    // 合并新词和复习词
    return [...newWords, ...reviewWords];
  }

  // 获取今日新词
  async getTodayNewWords() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT v.* 
        FROM vocabularies v
        LEFT JOIN learning_records lr ON v.word = lr.word
        WHERE lr.word IS NULL  -- 从未学习过的词
        AND v.mastered = FALSE
        ORDER BY v.timestamp ASC
        LIMIT ?
      `;
      console.log("getTodayNewWords-sql",sql);
      db.all(sql, [config.dailyNewWords], (err, rows) => {
        if (err) reject(err);
        else {
          const words = rows.map(row => ({
            ...row,
            definitions: JSON.parse(row.definitions),
            pronunciation: JSON.parse(row.pronunciation),
            is_new: true,
            review_count: 0
          }));
          resolve(words);
        }
      });
    });
  }

  // 获取今日待复习词汇
  async getTodayReviewDueWords() {
    return new Promise((resolve, reject) => {
      const sql = `
        WITH review_stats AS (
          SELECT 
            word,
            COUNT(*) as review_count,
            MAX(review_date) as last_review_date,
            SUM(CASE WHEN review_result = 1 THEN 1 ELSE 0 END) as correct_count,
            SUM(CASE 
              WHEN review_result = 1 AND review_date > (
                SELECT MAX(review_date) 
                FROM learning_records lr2 
                WHERE lr2.word = learning_records.word 
                AND lr2.review_result = 0
              ) THEN 1 
              ELSE 0 
            END) as consecutive_correct
          FROM learning_records
          GROUP BY word
        )
        SELECT 
          v.*,
          COALESCE(rs.review_count, 0) as review_count,
          rs.last_review_date,
          COALESCE(rs.consecutive_correct, 0) as consecutive_correct,
          COALESCE(rs.correct_count, 0) as correct_count,
          CASE 
            WHEN rs.last_review_date IS NULL THEN 0
            ELSE (julianday(datetime('now', 'localtime')) - 
                  julianday(datetime(rs.last_review_date/1000, 'unixepoch', '+8 hours')))
          END as days_since_last_review
        FROM vocabularies v
        INNER JOIN learning_records lr ON v.word = lr.word
        LEFT JOIN review_stats rs ON v.word = rs.word
        WHERE 
          v.mastered = FALSE
          AND (
            rs.last_review_date IS NULL
            OR (
              CASE 
                WHEN rs.review_count = 1 THEN ${config.reviewDays[0]}
                WHEN rs.review_count = 2 THEN ${config.reviewDays[1]}
                WHEN rs.review_count = 3 THEN ${config.reviewDays[2]}
                WHEN rs.review_count = 4 THEN ${config.reviewDays[3]}
                WHEN rs.review_count = 5 THEN ${config.reviewDays[4]}
                ELSE ${config.reviewDays[5]}
              END <= (
                julianday(datetime('now', 'localtime')) - 
                julianday(datetime(rs.last_review_date/1000, 'unixepoch', '+8 hours'))
              )
            )
          )
        GROUP BY v.word
        ORDER BY 
          days_since_last_review DESC
        LIMIT ?
      `;
      console.log("getTodayReviewDueWords-sql", sql);
      db.all(sql, [config.dailyReviewLimit - config.dailyNewWords], (err, rows) => {
        if (err) {
          console.error("getTodayReviewDueWords error:", err);
          reject(err);
        } else {
          console.log("getTodayReviewDueWords rows:", rows?.length);
          const words = rows.map(row => ({
            ...row,
            definitions: JSON.parse(row.definitions),
            pronunciation: JSON.parse(row.pronunciation),
            is_new: false,
            review_count: row.review_count || 0,
            consecutive_correct: row.consecutive_correct || 0
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
        WITH consecutive_correct AS (
          SELECT COUNT(*) as streak
          FROM (
            SELECT review_result
            FROM learning_records
            WHERE word = ?
            ORDER BY review_date DESC
            LIMIT ${config.masteryThreshold}
          )
          WHERE review_result = 1
        )
        SELECT 
          CASE WHEN streak >= ${config.masteryThreshold} THEN 1 ELSE 0 END as is_mastered
        FROM consecutive_correct
      `, [word], (err, row) => {
        if (err) reject(err);
        else resolve(Boolean(row?.is_mastered));
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
      db.serialize(async () => {
        try {
          // 开始事务
          db.run('BEGIN TRANSACTION');

          // 1. 记录复习结果
          await new Promise((res, rej) => {
            db.run(
              `INSERT INTO learning_records (word, review_date, review_result) 
               VALUES (?, ?, ?)`,
              [word, Date.now(), result ? 1 : 0],
              (err) => err ? rej(err) : res()
            );
          });

          // 2. 检查是否达到掌握标准
          const mastered = await this.checkMastery(word);
          if (mastered) {
            await this.updateMasteryStatus(word, true);
          }

          // 3. 更新今日进度
          await new Promise((res, rej) => {
            db.run(
              `UPDATE learning_progress 
               SET completed = completed + 1,
                   correct = correct + CASE WHEN ? THEN 1 ELSE 0 END
               WHERE date = ?`,
              [result ? 1 : 0, today],
              (err) => err ? rej(err) : res()
            );
          });

          // 提交事务
          db.run('COMMIT');
          resolve({
            success: true,
            mastered,
            result
          });
        } catch (error) {
          db.run('ROLLBACK');
          reject(error);
        }
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