const fs = require('fs');
const path = require('path');

/**
 * Transforms a nested object into a flat array of key-value pairs
 */
function flattenObject(obj, prefix = '') {
  let result = [];
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      result = result.concat(flattenObject(value, `${prefix}${key}_`));
    } else {
      result.push({ metric: `${prefix}${key}`, value });
    }
  }
  return result;
}

/**
 * Converts an array of objects to CSV string
 */
function arrayToCSV(arr) {
  if (!arr || arr.length === 0) return '';
  const headers = Object.keys(arr[0]);
  const rows = arr.map(row => 
    headers.map(h => {
      let val = row[h];
      if (val === undefined || val === null) val = '';
      // Escape quotes and commas
      if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Saves all analytics data as CSV files in a specified folder
 */
function saveToCSV(analyticsData, outputFolder) {
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  const periods = ['current', 'previous', 'yoy'];
  
  for (const period of periods) {
    if (!analyticsData[period] || Object.keys(analyticsData[period]).length === 0) continue;
    
    const periodData = analyticsData[period];
    const periodFolder = path.join(outputFolder, period);
    if (!fs.existsSync(periodFolder)) fs.mkdirSync(periodFolder);

    // 1. Handle flat objects (overview, monetization, premium, cards, endScreens)
    const flatMetrics = {};
    for (const [sectionKey, sectionData] of Object.entries(periodData)) {
      if (typeof sectionData === 'object' && sectionData !== null && !Array.isArray(sectionData)) {
         const flattened = flattenObject(sectionData);
         if (flattened.length > 0) {
           const csvStr = arrayToCSV(flattened);
           fs.writeFileSync(path.join(periodFolder, `${sectionKey}.csv`), csvStr);
         }
      } 
      // 2. Handle arrays (trafficSource, geography, viewerAge, topVideos, etc)
      else if (Array.isArray(sectionData)) {
         if (sectionData.length > 0) {
           const csvStr = arrayToCSV(sectionData);
           fs.writeFileSync(path.join(periodFolder, `${sectionKey}.csv`), csvStr);
         }
      }
    }
  }
  return true;
}

module.exports = { saveToCSV };
