const path = require('path');
const DataTools = require('./utils/data-tools');
const { initDatabase } = require('./db/init');

// 确保数据库已初始化
initDatabase();

async function main() {
  const command = process.argv[2];
  const filePath = process.argv[3];

  if (!command || !filePath) {
    console.log('Usage:');
    console.log('  Import: node cli.js import <path-to-json>');
    console.log('  Export: node cli.js export <output-path>');
    process.exit(1);
  }

  try {
    if (command === 'import') {
      const result = await DataTools.importFromJson(path.resolve(filePath));
      console.log(`Successfully imported ${result.count} vocabularies`);
    } else if (command === 'export') {
      const result = await DataTools.exportToJson(path.resolve(filePath));
      console.log(`Successfully exported ${result.count} vocabularies`);
    } else {
      console.log('Invalid command. Use "import" or "export"');
    }
  } catch (error) {
    console.error('Operation failed:', error.message);
  }
  
  process.exit(0);
}

main();