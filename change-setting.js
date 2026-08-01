1const fs = require('fs');
const path = 'C:/Users/Admin/AppData/Roaming/Antigravity IDE/User/settings.json';

try {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace('"vscord.app.name": "Custom"', '"vscord.app.name": "Visual Studio Code"');
  fs.writeFileSync(path, content, 'utf8');
  console.log('Successfully updated settings.json to use default Visual Studio Code presence.');
} catch (err) {
  console.error('Error updating settings.json:', err);
}
