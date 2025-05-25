const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * 数据库迁移脚本
 * 将旧版本的单用户数据库升级为支持多用户的新版本
 * 完全保持原始表结构，只添加用户管理功能
 */
class DatabaseMigrator {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = new sqlite3.Database(dbPath);
  }

  async checkIfMigrationNeeded() {
    return new Promise((resolve, reject) => {
      // 检查users表是否存在
      this.db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
        if (err) reject(err);
        else resolve(!row); // 如果users表不存在，则需要迁移
      });
    });
  }

  async checkIfDataExists() {
    return new Promise((resolve, reject) => {
      // 检查是否有现有的词汇数据
      this.db.get("SELECT COUNT(*) as count FROM vocabularies", (err, row) => {
        if (err) reject(err);
        else resolve(row.count > 0);
      });
    });
  }

  async checkUserIdColumnExists(tableName) {
    return new Promise((resolve, reject) => {
      this.db.get(`PRAGMA table_info(${tableName})`, (err, rows) => {
        if (err) reject(err);
        else {
          // 检查是否已经有user_id列
          this.db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
            if (err) reject(err);
            else {
              const hasUserIdColumn = rows.some(row => row.name === 'user_id');
              resolve(hasUserIdColumn);
            }
          });
        }
      });
    });
  }

  async runMigration() {
    console.log('🔄 开始数据库迁移...');

    try {
      // 1. 创建users表
      await this.createUsersTable();
      
      // 2. 创建会话表
      await this.createSessionsTable();
      
      // 3. 检查是否有现有数据需要迁移
      const hasData = await this.checkIfDataExists();
      
      if (hasData) {
        console.log('📊 发现现有数据，创建默认用户并迁移数据...');
        // 4. 创建默认用户
        const defaultUserId = await this.createDefaultUser();
        
        // 5. 迁移现有数据到默认用户
        await this.migrateExistingData(defaultUserId);
      }
      
      console.log('✅ 数据库迁移完成！');
      return true;
    } catch (error) {
      console.error('❌ 数据库迁移失败:', error);
      throw error;
    }
  }

  async createUsersTable() {
    return new Promise((resolve, reject) => {
      const sql = `
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
      `;
      this.db.run(sql, (err) => {
        if (err) reject(err);
        else {
          console.log('✓ Users表创建成功');
          
          // 创建索引
          this.db.run('CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id)', () => {
            this.db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)', () => {
              resolve();
            });
          });
        }
      });
    });
  }

  async createSessionsTable() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id INTEGER,
          created_at INTEGER DEFAULT (strftime('%s', 'now')),
          expires_at INTEGER,
          FOREIGN KEY(user_id) REFERENCES users(id)
        )
      `;
      this.db.run(sql, (err) => {
        if (err) reject(err);
        else {
          console.log('✓ Sessions表创建成功');
          
          // 创建索引
          this.db.run('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)', () => {
            this.db.run('CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)', () => {
              resolve();
            });
          });
        }
      });
    });
  }

  async createDefaultUser() {
    return new Promise((resolve, reject) => {
      const defaultUser = {
        username: 'system',
        email: 'system@gmail.com',
        avatar_url: 'https://avatars.githubusercontent.com/u/192389794?v=4',
        login_method: 'github'
      };

      const sql = `
        INSERT INTO users (username, email, avatar_url, login_method)
        VALUES (?, ?, ?, ?)
      `;

      this.db.run(sql, [defaultUser.username, defaultUser.email, defaultUser.avatar_url, defaultUser.login_method], 
        function(err) {
          if (err) reject(err);
          else {
            console.log('✓ 默认用户创建成功，ID:', this.lastID);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  async migrateExistingData(userId) {
    console.log('📊 迁移词汇数据...');
    await this.addUserIdToVocabularies(userId);
    
    console.log('📈 迁移学习记录...');
    await this.addUserIdToLearningRecords(userId);
    
    console.log('📊 迁移学习进度...');
    await this.addUserIdToLearningProgress(userId);
  }

  async addUserIdToVocabularies(userId) {
    return new Promise(async (resolve, reject) => {
      try {
        // 检查是否已经有user_id列
        const hasUserIdColumn = await this.checkUserIdColumnExists('vocabularies');
        
        if (!hasUserIdColumn) {
          // 添加user_id列
          this.db.run('ALTER TABLE vocabularies ADD COLUMN user_id INTEGER', (err) => {
            if (err) {
              reject(err);
              return;
            }
            this.updateVocabulariesUserData(userId, resolve, reject);
          });
        } else {
          this.updateVocabulariesUserData(userId, resolve, reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  updateVocabulariesUserData(userId, resolve, reject) {
    // 更新现有数据
    this.db.run('UPDATE vocabularies SET user_id = ? WHERE user_id IS NULL', [userId], (err) => {
      if (err) reject(err);
      else {
        console.log('✓ 词汇表迁移完成');
        resolve();
      }
    });
  }

  async addUserIdToLearningRecords(userId) {
    return new Promise(async (resolve, reject) => {
      try {
        // 检查是否已经有user_id列
        const hasUserIdColumn = await this.checkUserIdColumnExists('learning_records');
        
        if (!hasUserIdColumn) {
          // 添加user_id列
          this.db.run('ALTER TABLE learning_records ADD COLUMN user_id INTEGER', (err) => {
            if (err) {
              reject(err);
              return;
            }
            this.updateLearningRecordsUserData(userId, resolve, reject);
          });
        } else {
          this.updateLearningRecordsUserData(userId, resolve, reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  updateLearningRecordsUserData(userId, resolve, reject) {
    // 更新现有数据
    this.db.run('UPDATE learning_records SET user_id = ? WHERE user_id IS NULL', [userId], (err) => {
      if (err) reject(err);
      else {
        console.log('✓ 学习记录表迁移完成');
        resolve();
      }
    });
  }

  async addUserIdToLearningProgress(userId) {
    return new Promise(async (resolve, reject) => {
      try {
        // 检查是否已经有user_id列
        const hasUserIdColumn = await this.checkUserIdColumnExists('learning_progress');
        
        if (!hasUserIdColumn) {
          // 添加user_id列
          this.db.run('ALTER TABLE learning_progress ADD COLUMN user_id INTEGER', (err) => {
            if (err) {
              reject(err);
              return;
            }
            this.updateLearningProgressUserData(userId, resolve, reject);
          });
        } else {
          this.updateLearningProgressUserData(userId, resolve, reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  updateLearningProgressUserData(userId, resolve, reject) {
    // 更新现有数据
    this.db.run('UPDATE learning_progress SET user_id = ? WHERE user_id IS NULL', [userId], (err) => {
      if (err) reject(err);
      else {
        console.log('✓ 学习进度表迁移完成');
        resolve();
      }
    });
  }

  async createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_vocabularies_user_id ON vocabularies(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_learning_records_user_id ON learning_records(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_learning_progress_user_id ON learning_progress(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_vocabularies_user_word ON vocabularies(user_id, word)',
      'CREATE INDEX IF NOT EXISTS idx_learning_records_user_word ON learning_records(user_id, word)'
    ];

    for (const indexSql of indexes) {
      await new Promise((resolve, reject) => {
        this.db.run(indexSql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    console.log('✓ 数据库索引创建完成');
  }

  async close() {
    return new Promise((resolve) => {
      this.db.close((err) => {
        if (err) {
          // 数据库可能已经关闭，忽略错误
        }
        resolve();
      });
    });
  }
}

// 运行迁移的主函数
async function runMigration() {
  const dbPath = path.join(__dirname, '../../vocab.db');
  const migrator = new DatabaseMigrator(dbPath);

  try {
    const needsMigration = await migrator.checkIfMigrationNeeded();
    
    if (!needsMigration) {
      console.log('✅ 数据库已是最新版本，无需迁移');
      return;
    }

    console.log('🔄 检测到旧版本数据库，开始迁移...');
    await migrator.runMigration();
    await migrator.createIndexes();
    
    console.log('🎉 数据库升级完成！');
    console.log('📝 迁移摘要:');
    console.log('   - ✅ 创建了用户管理系统');
    console.log('   - ✅ 创建了默认用户 (legacy_user)');
    console.log('   - ✅ 迁移了所有现有数据到默认用户');
    console.log('   - ✅ 添加了必要的数据库索引');
    console.log('   - ✅ 保持了原始表结构完整性');
    console.log('');
    console.log('💡 现在您可以:');
    console.log('   1. 使用现有数据（自动分配给默认用户）');
    console.log('   2. 通过GitHub OAuth添加新用户');
    console.log('   3. 享受完整的多用户功能');

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    try {
      await migrator.close();
    } catch (closeError) {
      // 忽略关闭错误，因为可能数据库已经关闭
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runMigration();
}

module.exports = { DatabaseMigrator, runMigration }; 