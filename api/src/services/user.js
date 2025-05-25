const { db } = require('../db/init');
const { v4: uuidv4 } = require('uuid');

class UserService {
  // Create or update user from GitHub OAuth
  async createOrUpdateGithubUser(githubData) {
    return new Promise((resolve, reject) => {
      const { id: githubId, login: username, email, avatar_url } = githubData;
      
      // First, try to find existing user
      db.get(
        'SELECT * FROM users WHERE github_id = ?',
        [githubId],
        (err, existingUser) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (existingUser) {
            // Update existing user
            db.run(
              `UPDATE users 
               SET username = ?, email = ?, avatar_url = ?, updated_at = strftime('%s', 'now')
               WHERE github_id = ?`,
              [username, email, avatar_url, githubId],
              function(err) {
                if (err) {
                  reject(err);
                } else {
                  resolve(existingUser);
                }
              }
            );
          } else {
            // Create new user
            db.run(
              `INSERT INTO users (github_id, username, email, avatar_url, login_method)
               VALUES (?, ?, ?, ?, 'github')`,
              [githubId, username, email, avatar_url],
              function(err) {
                if (err) {
                  reject(err);
                } else {
                  // Get the created user
                  db.get(
                    'SELECT * FROM users WHERE id = ?',
                    [this.lastID],
                    (err, newUser) => {
                      if (err) {
                        reject(err);
                      } else {
                        resolve(newUser);
                      }
                    }
                  );
                }
              }
            );
          }
        }
      );
    });
  }

  // Get user by ID
  async getUserById(userId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Get user by GitHub ID
  async getUserByGithubId(githubId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE github_id = ?', [githubId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Create user session
  async createSession(userId) {
    return new Promise((resolve, reject) => {
      const sessionId = uuidv4();
      const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days
      
      db.run(
        'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
        [sessionId, userId, expiresAt],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ sessionId, expiresAt });
          }
        }
      );
    });
  }

  // Get session
  async getSession(sessionId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT s.*, u.* FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.id = ? AND s.expires_at > strftime('%s', 'now')`,
        [sessionId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  // Delete session
  async deleteSession(sessionId) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM sessions WHERE id = ?', [sessionId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // Clean expired sessions
  async cleanExpiredSessions() {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM sessions WHERE expires_at <= strftime(\'%s\', \'now\')',
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        }
      );
    });
  }

  // Get user statistics
  async getUserStats(userId) {
    return new Promise((resolve, reject) => {
      const stats = {};
      
      // Get vocabulary count
      db.get(
        'SELECT COUNT(*) as total FROM vocabularies WHERE user_id = ? OR user_id IS NULL',
        [userId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          stats.totalVocabularies = row.total;
          
          // Get mastered count
          db.get(
            'SELECT COUNT(*) as mastered FROM vocabularies WHERE (user_id = ? OR user_id IS NULL) AND mastered = 1',
            [userId],
            (err, row) => {
              if (err) {
                reject(err);
                return;
              }
              stats.masteredVocabularies = row.mastered;
              
              // Get learning records count
              db.get(
                'SELECT COUNT(*) as total FROM learning_records WHERE user_id = ? OR user_id IS NULL',
                [userId],
                (err, row) => {
                  if (err) {
                    reject(err);
                  } else {
                    stats.totalReviews = row.total;
                    resolve(stats);
                  }
                }
              );
            }
          );
        }
      );
    });
  }
}

module.exports = new UserService(); 