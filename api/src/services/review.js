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
          END as days_since_last_review,
          CASE 
            WHEN rs.last_review_date IS NULL THEN 1000
            ELSE (
              (julianday(datetime('now', 'localtime')) - 
               julianday(datetime(rs.last_review_date/1000, 'unixepoch', '+8 hours'))) /
              CASE 
                WHEN rs.review_count = 1 THEN ${config.reviewDays[0]}
                WHEN rs.review_count = 2 THEN ${config.reviewDays[1]}
                WHEN rs.review_count = 3 THEN ${config.reviewDays[2]}
                WHEN rs.review_count = 4 THEN ${config.reviewDays[3]}
                WHEN rs.review_count = 5 THEN ${config.reviewDays[4]}
                ELSE ${config.reviewDays[5]}
              END
            )
          END as review_urgency_score
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
                julianday(date('now', 'localtime')) - 
                julianday(date(rs.last_review_date/1000, 'unixepoch', '+8 hours'))
              )
            )
          )
        GROUP BY v.word
        ORDER BY 
          review_urgency_score DESC,  -- 首先按紧急程度排序
          days_since_last_review DESC  -- 其次按最后复习时间排序
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
    const today = dayjs().tz().format('YYYY-MM-DD');
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
          // await new Promise((res, rej) => {
          //   db.run(
          //     `UPDATE learning_progress 
          //      SET completed = completed + 1,
          //          correct = correct + CASE WHEN ? THEN 1 ELSE 0 END
          //      WHERE date = ?`,
          //     [result ? 1 : 0, today],
          //     (err) => err ? rej(err) : res()
          //   );
          // });

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

  // 增强获取学习历史记录方法
  async getLearningHistory(filters = {}) {
    const {
      startDate,
      endDate,
      wordType,
      limit = 100,
      offset = 0
    } = filters;

    // 验证和转换时间戳
    let startTs = null;
    let endTs = null;
    
    try {
      if (startDate) {
        startTs = parseInt(startDate);
        if (isNaN(startTs)) throw new Error('Invalid startDate');
      }
      if (endDate) {
        endTs = parseInt(endDate);
        if (isNaN(endTs)) throw new Error('Invalid endDate');
      }
    } catch (error) {
      throw new Error('Invalid time format');
    }

    console.log("Input filters:", {
      startDate: startTs ? new Date(startTs).toISOString() : null,
      endDate: endTs ? new Date(endTs).toISOString() : null,
      wordType,
      limit,
      offset
    });

    return new Promise((resolve, reject) => {
      let conditions = [];
      let timeParams = [];
      let queryParams = [];

      // 构建时间范围条件
      let timeRangeJoin = '';
      if (startTs || endTs) {
        const timeConditions = [];
        if (startTs) {
          timeConditions.push('review_date >= ?');
          timeParams.push(startTs);
          console.log("Added startDate param:", startTs, new Date(startTs).toISOString());
        }
        if (endTs) {
          timeConditions.push('review_date <= ?');
          timeParams.push(endTs);
          console.log("Added endDate param:", endTs, new Date(endTs).toISOString());
        }

        if (timeConditions.length > 0) {
          timeRangeJoin = `
            INNER JOIN (
              SELECT DISTINCT word 
              FROM learning_records 
              WHERE ${timeConditions.join(' AND ')}
            ) time_filter ON v.word = time_filter.word
          `;
        }
      }

      // 修改单词类型条件
      if (wordType && wordType !== 'all') {
        switch(wordType) {
          case 'new':
            conditions.push('review_stats.review_count = 1');
            break;
          case 'reviewing':
            conditions.push('review_stats.review_count > 1 AND v.mastered = 0');
            break;
          case 'mastered':
            conditions.push('v.mastered = 1');
            break;
          case 'wrong':
            conditions.push(`
              review_stats.correct_count < review_stats.review_count 
              AND v.mastered = 0
            `);
            break;
        }
      }

      const whereClause = conditions.length > 0 
        ? `AND ${conditions.join(' AND ')}` 
        : '';

      const sql = `
        WITH review_stats AS (
          SELECT 
            word,
            COUNT(*) as review_count,
            MAX(review_date) as last_review_date,
            SUM(CASE WHEN review_result = 1 THEN 1 ELSE 0 END) as correct_count
          FROM learning_records
          GROUP BY word
        )
        SELECT 
          v.*,
          COALESCE(review_stats.last_review_date, v.timestamp) as last_review_date,
          COALESCE(review_stats.review_count, 0) as review_count,
          COALESCE(review_stats.correct_count, 0) as correct_count
        FROM vocabularies v
        LEFT JOIN review_stats ON v.word = review_stats.word
        ${timeRangeJoin}
        WHERE (review_stats.word IS NOT NULL OR ? = 'all')
        ${whereClause}
        ORDER BY last_review_date DESC, v.timestamp DESC
        LIMIT ? OFFSET ?
      `;

      // 构建完整的参数数组
      queryParams = [
        ...timeParams,           
        wordType || 'all',       
        limit,                   
        offset                   
      ];

      // 添加计数 SQL
      const countSql = `
        WITH review_stats AS (
          SELECT 
            word,
            COUNT(*) as review_count,
            MAX(review_date) as last_review_date,
            SUM(CASE WHEN review_result = 1 THEN 1 ELSE 0 END) as correct_count
          FROM learning_records
          GROUP BY word
        )
        SELECT COUNT(DISTINCT v.word) as total
        FROM vocabularies v
        LEFT JOIN review_stats ON v.word = review_stats.word
        ${timeRangeJoin}
        WHERE (review_stats.word IS NOT NULL OR ? = 'all')
        ${whereClause}
      `;

      console.log("Time range join:", timeRangeJoin);
      console.log("Where clause:", whereClause);
      console.log("Time params:", timeParams.map(ts => ({
        timestamp: ts,
        date: new Date(ts).toISOString()
      })));
      console.log("Query params:", queryParams.map(p => 
        typeof p === 'number' ? {
          value: p,
          date: new Date(p).toISOString()
        } : p
      ));

      // 验证数据是否存在
      const checkSql = `
        SELECT COUNT(*) as count 
        FROM learning_records 
        WHERE review_date >= ? AND review_date <= ?
      `;
      
      db.serialize(() => {
        // 首先检查时间范围内是否有数据
        if (startDate && endDate) {
          db.get(checkSql, [timeParams[0], timeParams[1]], (err, row) => {
            console.log("Records in time range:", row?.count);
          });
        }

        // 计数查询使用除了 limit 和 offset 之外的参数
        const countParams = [...timeParams, wordType || 'all'];
        
        db.get(countSql, countParams, (err, countRow) => {
          if (err) {
            console.error("Count query error:", err);
            reject(err);
            return;
          }
          console.log("Count result:", countRow);

          db.all(sql, queryParams, (err, rows) => {
            if (err) {
              console.error("Main query error:", err);
              reject(err);
              return;
            }
            console.log("Raw rows count:", rows?.length);

            const words = rows.map(row => ({
              ...row,
              definitions: JSON.parse(row.definitions),
              pronunciation: JSON.parse(row.pronunciation),
              examples: JSON.parse(row.examples || '[]'),
              last_review_date: row.last_review_date,
              review_count: row.review_count,
              correct_count: row.correct_count
            }));

            console.log("Processed words count:", words.length);
            if (words.length > 0) {
              console.log("Sample word:", {
                word: words[0].word,
                last_review_date: new Date(words[0].last_review_date).toISOString(),
                review_count: words[0].review_count
              });
            }

            resolve({
              total: countRow.total,
              data: words,
              limit,
              offset
            });
          });
        });
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
          `DELETE FROM learning_progress 
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

  // 获取用户当前的实时数据统计
  async getCurrentStats() {
    try {
      const stats = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            COUNT(*) as total_words,
            SUM(CASE WHEN mastered = 1 THEN 1 ELSE 0 END) as mastered_words,
            (
              SELECT COUNT(DISTINCT word) 
              FROM learning_records
            ) as learned_words
          FROM vocabularies
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows[0]);
        });
      });

      const newWordsCount = config.dailyNewWords;
      var reviewWordsCount = 0
      if(stats.learned_words - (stats.mastered_words + newWordsCount) > 0){
        reviewWordsCount = stats.learned_words - (stats.mastered_words + newWordsCount)
      }
      return {
        totalWordsCount: stats.total_words,
        newWordsCount: newWordsCount,
        reviewWordsCount: reviewWordsCount,
        masteredWordsCount: stats.mastered_words
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new ReviewService();