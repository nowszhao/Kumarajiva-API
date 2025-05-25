#!/usr/bin/env node

/**
 * 独立的数据库迁移工具
 * 使用方法: node src/cli-migrate.js
 */

const { runMigration } = require('./db/migrate');

async function main() {
  console.log('🔄 Kumarajiva 数据库迁移工具');
  console.log('=====================================');
  
  try {
    await runMigration();
    console.log('');
    console.log('🎉 迁移完成！您现在可以启动服务器了：');
    console.log('   node src/app.js');
    process.exit(0);
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
  }
}

main(); 