const { db } = require('../db/init');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const config = require('../config/learning');
const authConfig = require('../config/auth');

// 配置 dayjs 使用时区插件
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Shanghai');

class ReviewService {
  // Helper method to build user-aware SQL queries
  _buildUserClause(userId) {
    if (authConfig.legacyMode && !userId) {
      return '1=1'; // 在legacy模式下忽略用户限制
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

  // 获取今日需要学习的所有词汇(新词+复习词)
  async getTodayReviewWords(userId = null) {
    const [newWords, reviewWords] = await Promise.all([
      this.getTodayNewWords(userId),
      this.getTodayReviewDueWords(userId)
    ]);

    // 合并新词和复习词
    return [...newWords, ...reviewWords];
  }

  // 获取今日新词
  async getTodayNewWords(userId = null) {
    return new Promise((resolve, reject) => {
      const userClause = this._buildUserClause(userId);
      const userParams = this._getUserParams(userId);
      const params = [...userParams, ...userParams, config.dailyNewWords];
      
      const sql = `
        SELECT v.* 
        FROM vocabularies v
        LEFT JOIN learning_records lr ON v.word = lr.word AND lr.${userClause}
        WHERE lr.word IS NULL  -- 从未学习过的词
        AND v.mastered = FALSE
        AND v.${userClause}
        ORDER BY v.timestamp ASC
        LIMIT ?
      `;
      console.log("getTodayNewWords-sql", sql);
      console.log("getTodayNewWords-params", params);
      db.all(sql, params, (err, rows) => {
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
  async getTodayReviewDueWords(userId = null) {
    return new Promise((resolve, reject) => {
      const userClause = this._buildUserClause(userId);
      const userParams = this._getUserParams(userId);
      const params = [...userParams, ...userParams, ...userParams, config.dailyReviewLimit - config.dailyNewWords];
      
      const sql = `
        WITH review_stats AS (
          SELECT 
            word,
            COUNT(*) as review_count,
            MAX(review_date) as last_review_date,
            MIN(review_date) as first_review_date,
            SUM(CASE WHEN review_result = 1 THEN 1 ELSE 0 END) as correct_count
          FROM learning_records lr
          WHERE lr.${userClause}
          GROUP BY word
        )
        SELECT 
          v.*,
          COALESCE(review_stats.last_review_date, v.timestamp) as last_review_date,
          COALESCE(review_stats.review_count, 0) as review_count,
          COALESCE(review_stats.correct_count, 0) as correct_count,
          review_stats.first_review_date
        FROM vocabularies v
        INNER JOIN learning_records lr ON v.word = lr.word AND lr.${userClause}
        LEFT JOIN review_stats ON v.word = review_stats.word
        WHERE 
          v.mastered = FALSE
          AND v.${userClause}
          AND (
            review_stats.last_review_date IS NULL
            OR (
              CASE 
                WHEN review_stats.review_count = 1 THEN ${config.reviewDays[0]}
                WHEN review_stats.review_count = 2 THEN ${config.reviewDays[1]}
                WHEN review_stats.review_count = 3 THEN ${config.reviewDays[2]}
                WHEN review_stats.review_count = 4 THEN ${config.reviewDays[3]}
                WHEN review_stats.review_count = 5 THEN ${config.reviewDays[4]}
                ELSE ${config.reviewDays[5]}
              END <= (
                julianday(date('now', 'localtime')) - 
                julianday(date(review_stats.first_review_date/1000, 'unixepoch', '+8 hours'))
              )
            )
          )
        GROUP BY v.word
        ORDER BY 
          review_stats.last_review_date DESC,  -- 首先按紧急程度排序
          review_stats.first_review_date DESC  -- 其次按最早复习时间排序
        LIMIT ?
      `;
      console.log("getTodayReviewDueWords-sql", sql);
      console.log("getTodayReviewDueWords-params", params);
      db.all(sql, params, (err, rows) => {
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
  async getTodayNewWordsCount(userId = null) {
    const today = dayjs().tz().startOf('day').valueOf();
    const todayEnd = dayjs().tz().endOf('day').valueOf();
    
    return new Promise((resolve, reject) => {
      const userClause = this._buildUserClause(userId);
      const params = [today, todayEnd, ...this._getUserParams(userId)];
      
      db.get(`
        SELECT COUNT(*) as count
        FROM vocabularies
        WHERE timestamp BETWEEN ? AND ? AND ${userClause}
      `, params, (err, row) => {
        if (err) reject(err);
        else resolve(config.dailyNewWords - (row?.count || 0));
      });
    });
  }

  // 检查词汇是否已掌握
  async checkMastery(word, userId = null) {
    return new Promise((resolve, reject) => {
      const userClause = this._buildUserClause(userId);
      const params = [word, ...this._getUserParams(userId)];
      
      db.get(`
        WITH consecutive_correct AS (
          SELECT COUNT(*) as streak
          FROM (
            SELECT review_result
            FROM learning_records
            WHERE word = ? AND ${userClause}
            ORDER BY review_date DESC
            LIMIT ${config.masteryThreshold}
          )
          WHERE review_result = 1
        )
        SELECT 
          CASE WHEN streak >= ${config.masteryThreshold} THEN 1 ELSE 0 END as is_mastered
        FROM consecutive_correct
      `, params, (err, row) => {
        if (err) reject(err);
        else resolve(Boolean(row?.is_mastered));
      });
    });
  }

  // 更新词汇掌握状态
  async updateMasteryStatus(word, mastered, userId = null) {
    return new Promise((resolve, reject) => {
      const userClause = this._buildUserClause(userId);
      const params = [mastered ? 1 : 0, word, ...this._getUserParams(userId)];
      
      db.run(
        `UPDATE vocabularies SET mastered = ? WHERE word = ? AND ${userClause}`,
        params,
        (err) => {
          if (err) reject(err);
          else resolve({ success: true });
        }
      );
    });
  }

  // 获取或创建今日进度
  async getTodayProgress(userId = null) {
    const today = dayjs().tz().format('YYYY-MM-DD');
    return new Promise((resolve, reject) => {
      const userClause = this._buildUserClause(userId);
      const userParams = this._getUserParams(userId);
      const params = [today, ...userParams];
      
      db.get(
        `SELECT * FROM learning_progress WHERE date = ? AND ${userClause}`,
        params,
        async (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          if (row) {
            resolve(row);
          } else {
            // 如果没有今日记录，创建新记录
            const todayWords = await this.getTodayReviewWords(userId);
            const insertParams = [today, todayWords.length, userId];
            
            db.run(
              `INSERT INTO learning_progress (date, total_words, current_word_index, completed, correct, user_id) 
               VALUES (?, ?, 0, 0, 0, ?)`,
              insertParams,
              function(err) {
                if (err) {
                  reject(err);
                  return;
                }
                // 获取刚创建的记录，包含数据库生成的 id
                const selectParams = [today, ...userParams];
                db.get(
                  `SELECT * FROM learning_progress WHERE date = ? AND ${userClause}`,
                  selectParams,
                  (err, newRow) => {
                    if (err) {
                      reject(err);
                      return;
                    }
                    resolve(newRow);
                  }
                );
              }
            );
          }
        }
      );
    });
  }

  // 更新学习进度
  async updateProgress(progress, userId = null) {
    const today = dayjs().tz().format('YYYY-MM-DD');
    return new Promise((resolve, reject) => {
      const userClause = this._buildUserClause(userId);
      const params = [progress.current_word_index, progress.completed, progress.correct, today, ...this._getUserParams(userId)];
      
      db.run(
        `UPDATE learning_progress 
         SET current_word_index = ?, completed = ?, correct = ?
         WHERE date = ? AND ${userClause}`,
        params,
        (err) => {
          if (err) reject(err);
          else resolve(true);
        }
      );
    });
  }

  // 修改现有的记录复习方法
  async recordReview(word, result, userId = null) {
    const today = dayjs().tz().format('YYYY-MM-DD');
    
    return new Promise((resolve, reject) => {
      db.serialize(async () => {
        try {
          // 开始事务
          db.run('BEGIN TRANSACTION');

          // 1. 记录复习结果
          await new Promise((res, rej) => {
            db.run(
              `INSERT INTO learning_records (word, review_date, review_result, user_id) 
               VALUES (?, ?, ?, ?)`,
              [word, Date.now(), result ? 1 : 0, userId],
              (err) => err ? rej(err) : res()
            );
          });

          // 2. 检查是否达到掌握标准
          const mastered = await this.checkMastery(word, userId);
          if (mastered) {
            await this.updateMasteryStatus(word, true, userId);
          }

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
  async generateQuiz(word, userId = null) {
    const userClause = this._buildUserClause(userId);
    const params = [word, ...this._getUserParams(userId)];
    
    const vocab = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM vocabularies WHERE word = ? AND ${userClause}`, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!vocab) {
      throw new Error('Word not found');
    }

    // 获取其他词汇作为干扰项
    const distractorParams = [word, ...this._getUserParams(userId)];
    const otherWords = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM vocabularies 
         WHERE word != ? AND ${userClause}
         ORDER BY RANDOM() 
         LIMIT 3`,
        distractorParams,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // 安全地解析 definitions，确保总是返回数组
    let targetDefs;
    try {
      const parsed = JSON.parse(vocab.definitions);
      // 如果解析结果是字符串，转换为数组格式
      if (typeof parsed === 'string') {
        targetDefs = [{ meaning: parsed, pos: '' }];
      } else if (Array.isArray(parsed)) {
        targetDefs = parsed;
      } else {
        targetDefs = [{ meaning: vocab.definitions, pos: '' }];
      }
    } catch (error) {
      // 如果JSON解析失败，将原始字符串作为单个定义
      targetDefs = [{ meaning: vocab.definitions, pos: '' }];
    }
    
    console.log("Final targetDefs:", targetDefs);
    console.log("Is targetDefs array:", Array.isArray(targetDefs));

    const options = otherWords.map(w => {
      let otherDefs;
      try {
        const parsed = JSON.parse(w.definitions);
        if (typeof parsed === 'string') {
          otherDefs = [{ meaning: parsed, pos: '' }];
        } else if (Array.isArray(parsed)) {
          otherDefs = parsed;
        } else {
          otherDefs = [{ meaning: w.definitions, pos: '' }];
        }
      } catch (error) {
        otherDefs = [{ meaning: w.definitions, pos: '' }];
      }
      
      return {
        word: w.word,
        definition: otherDefs[0].meaning,
        pos: otherDefs[0].pos || ''
      };
    });

    // 添加正确答案
    options.push({
      word: vocab.word,
      definition: targetDefs[0].meaning,
      pos: targetDefs[0].pos || ''
    });

    // 打乱选项顺序
    const shuffledOptions = options.sort(() => Math.random() - 0.5);

    // 安全地解析 pronunciation
    let phonetic = null;
    try {
      let pronunciation;
      
      // Check if it's already an object
      if (typeof vocab.pronunciation === 'object' && vocab.pronunciation !== null) {
        pronunciation = vocab.pronunciation;
      } else if (typeof vocab.pronunciation === 'string') {
        // Try to parse as JSON
        pronunciation = JSON.parse(vocab.pronunciation);
        
        // Check if we got a string back (double encoded JSON)
        if (typeof pronunciation === 'string') {
          pronunciation = JSON.parse(pronunciation);
        }
      } else {
        pronunciation = {};
      }
      
      // Check each pronunciation field and use the first non-empty one
      if (pronunciation.American && pronunciation.American.trim()) {
        phonetic = pronunciation.American.trim();
      } else if (pronunciation.american && pronunciation.american.trim()) {
        phonetic = pronunciation.american.trim();
      } else if (pronunciation.British && pronunciation.British.trim()) {
        phonetic = pronunciation.British.trim();
      } else if (pronunciation.british && pronunciation.british.trim()) {
        phonetic = pronunciation.british.trim();
      }
    } catch (error) {
      // If parsing fails and it's a string, use it directly
      if (typeof vocab.pronunciation === 'string' && vocab.pronunciation.trim()) {
        phonetic = vocab.pronunciation.trim();
      } else {
        phonetic = null;
      }
    }

    return {
      word: vocab.word,
      phonetic: phonetic,
      audio: vocab.audio_url || null,
      definitions: targetDefs, // 确保这里总是返回数组
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
  async getLearningHistory(filters = {}, userId = null) {
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
      offset,
      userId
    });

    return new Promise((resolve, reject) => {
      const userClause = this._buildUserClause(userId);
      const userParams = this._getUserParams(userId);

      let conditions = [];
      let timeParams = [];
      let queryParams = [];

      // 构建时间范围条件 - 用于时间过滤的 JOIN
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
          const timeUserClause = this._buildUserClause(userId);
          const timeUserParams = this._getUserParams(userId);
          timeRangeJoin = `
            INNER JOIN (
              SELECT DISTINCT word 
              FROM learning_records 
              WHERE ${timeConditions.join(' AND ')} AND ${timeUserClause}
            ) time_filter ON v.word = time_filter.word
          `;
          // 时间过滤的用户参数需要添加到 timeParams 中
          timeParams.push(...timeUserParams);
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
          WHERE ${userClause}
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
        WHERE v.${userClause} AND (review_stats.word IS NOT NULL OR ? = 'all')
        ${whereClause}
        ORDER BY 
          CASE WHEN review_stats.word IS NULL THEN v.timestamp ELSE review_stats.last_review_date END DESC,
          v.timestamp DESC
        LIMIT ? OFFSET ?
      `;

      // 构建完整的参数数组
      queryParams = [
        ...userParams,           // CTE 中的用户参数
        ...timeParams,           // 时间过滤 JOIN 中的参数
        ...userParams,           // 主查询 WHERE 中的用户参数
        wordType || 'all',       // wordType 参数
        limit,                   
        offset                   
      ];

      // 计数 SQL - 使用相同的逻辑但不包括 LIMIT 和 OFFSET
      const countSql = `
        WITH review_stats AS (
          SELECT 
            word,
            COUNT(*) as review_count,
            MAX(review_date) as last_review_date,
            SUM(CASE WHEN review_result = 1 THEN 1 ELSE 0 END) as correct_count
          FROM learning_records
          WHERE ${userClause}
          GROUP BY word
        )
        SELECT COUNT(DISTINCT v.word) as total
        FROM vocabularies v
        LEFT JOIN review_stats ON v.word = review_stats.word
        ${timeRangeJoin}
        WHERE v.${userClause} AND (review_stats.word IS NOT NULL OR ? = 'all')
        ${whereClause}
      `;

      console.log("Time range join:", timeRangeJoin);
      console.log("Where clause:", whereClause);
      console.log("SQL:", sql);
      console.log("Query params:", queryParams);
      
      db.serialize(() => {
        // 计数查询使用除了 limit 和 offset 之外的参数
        const countParams = queryParams.slice(0, -2);
        
        db.get(countSql, countParams, (err, countRow) => {
          if (err) {
            console.error("Count query error:", err);
            reject(err);
            return;
          }
          console.log("Count result:", countRow);

          // 执行主查询
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
                review_count: words[0].review_count,
                mastered: words[0].mastered
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
  async resetTodayProgress(userId = null) {
    const today = dayjs().tz().format('YYYY-MM-DD');
    
    return new Promise((resolve, reject) => {
      const userClause = this._buildUserClause(userId);
      const userParams = this._getUserParams(userId);

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 删除今日的学习记录，使用本地时区
        const deleteRecordsParams = [today, ...userParams];
        db.run(
          `DELETE FROM learning_records 
           WHERE date(datetime(review_date/1000, 'unixepoch', '+8 hours')) = date(?) AND ${userClause}`,
          deleteRecordsParams
        );

        // 重置今日进度
        const deleteProgressParams = [today, ...userParams];
        db.run(
          `DELETE FROM learning_progress 
           WHERE date = ? AND ${userClause}`,
          deleteProgressParams,
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
            } else {
              db.run('COMMIT');
            resolve({ success: true, changes: this.changes });
            }
          }
        );
      });
    });
  }

  // 获取用户当前的实时数据统计
  async getCurrentStats(userId = null) {
    try {
      const userClause = this._buildUserClause(userId);
      const userParams = this._getUserParams(userId);
      
      const stats = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            COUNT(*) as total_words,
            SUM(CASE WHEN mastered = 1 THEN 1 ELSE 0 END) as mastered_words,
            (
              SELECT COUNT(DISTINCT word) 
              FROM learning_records
              WHERE ${userClause}
            ) as learned_words
          FROM vocabularies
          WHERE ${userClause}
        `, [...userParams, ...userParams], (err, rows) => {
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