const fs = require('fs').promises;
const vocabService = require('../services/vocab');

class DataTools {
  // 从JSON文件导入数据
  static async importFromJson(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const vocabularies = JSON.parse(data);
      return await vocabService.importVocabularies(vocabularies);
    } catch (error) {
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  // 导出数据到JSON文件
  static async exportToJson(outputPath) {
    try {
      const vocabularies = await vocabService.exportVocabularies();
      await fs.writeFile(outputPath, JSON.stringify(vocabularies, null, 2));
      return { success: true, count: Object.keys(vocabularies).length };
    } catch (error) {
      throw new Error(`Export failed: ${error.message}`);
    }
  }
}

module.exports = DataTools;