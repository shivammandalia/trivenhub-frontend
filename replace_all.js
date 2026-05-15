const fs = require('fs');
const path = require('path');

const API_BASE_URL_DECLARATION = "const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';\n";

function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('http://localhost:5000')) {
        // Only add declaration if not already there
        let hasChanges = false;
        
        const newContent = content.replace(/['`]http:\/\/localhost:5000(.*?)['`]/g, (match, p1) => {
          hasChanges = true;
          return '`${API_BASE_URL}' + p1 + '`';
        });

        if (hasChanges) {
          content = newContent;
          if (!content.includes('const API_BASE_URL')) {
            // Find a good place to insert it: after imports
            const lines = content.split('\n');
            let insertIndex = 0;
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].trim().startsWith('import ')) {
                insertIndex = i + 1;
              }
            }
            lines.splice(insertIndex, 0, API_BASE_URL_DECLARATION);
            content = lines.join('\n');
          }
          fs.writeFileSync(fullPath, content);
          console.log('Replaced in:', fullPath);
        }
      }
    }
  }
}

processDirectory('../Antigraviti/Triven Hub/TrivenHubApp/src');
