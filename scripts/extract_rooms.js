const fs = require('fs');
const content = fs.readFileSync('/Users/macmini1tb/.gemini/antigravity/brain/b8709713-029f-4eab-90bb-f46cfe7da803/.system_generated/steps/11/content.md', 'utf8');
const match = content.match(/<script id="init_data" type="application\/json">([\s\S]*?)<\/script>/);
if (match) {
  try {
    const data = JSON.parse(match[1]);
    const textData = data.textData;
    if (textData) {
      for (const [key, val] of Object.entries(textData)) {
          if (key.includes('room')) {
             console.log(key, val.d || val.m || val);
          }
      }
    }
  } catch (e) {
    console.log("Error parsing JSON", e);
  }
}
