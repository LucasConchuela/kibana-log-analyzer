const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'public', 'sample-http-logs.json');

try {
  const content = fs.readFileSync(filePath, 'utf8');
  let data;
  
  // Handle if it's already NDJSON or JSON array
  if (content.trim().startsWith('[')) {
    data = JSON.parse(content);
  } else {
    data = content.trim().split('\n').map(l => JSON.parse(l));
  }

  const newData = data.map(entry => {
    const newEntry = {};
    const http = {};
    let hasHttp = false;

    // Preserving order for main keys
    const priority = ['_id', '@timestamp', 'level', 'message'];
    priority.forEach(k => {
        if (entry[k] !== undefined) newEntry[k] = entry[k];
    });

    Object.keys(entry).forEach(k => {
      if (priority.includes(k)) return; // Already handled

      if (k.startsWith('http.')) {
        const subKey = k.split('.')[1];
        http[subKey] = entry[k];
        hasHttp = true;
      } else {
        newEntry[k] = entry[k];
      }
    });

    if (hasHttp) newEntry.http = http;
    return newEntry;
  });

  const ndjson = newData.map(e => JSON.stringify(e)).join('\n');
  fs.writeFileSync(filePath, ndjson);
  console.log('Successfully converted sample logs to nested NDJSON');

} catch (err) {
  console.error('Error transforming file:', err);
  process.exit(1);
}
