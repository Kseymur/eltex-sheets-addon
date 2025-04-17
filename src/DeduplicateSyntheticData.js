// === DEDUPLICATION SERVICE CONFIGURATION ===
// These are stubs. Replace with your own values if you deploy your own deduplication service.
const DEDUP_TABLE_NAME = 'eltex_synth_data'; // <-- Change to your table name if needed
const DEDUP_FILTER_BY = ["topic", "subindustry", "job_id"]; // <-- Change if your API expects other filters

let totalStats = {
  received: 0,
  inserted: 0,
  dropped: 0,
};

function getParameters() {
  const properties = PropertiesService.getDocumentProperties();
  return {
    similarityThreshold: properties.getProperty('similarityThreshold') || '0.9'
  };
}

function saveParameters(params) {
  const properties = PropertiesService.getDocumentProperties();
  properties.setProperty('similarityThreshold', params.similarityThreshold);
  Logger.log(`Parameters saved successfully!`);
}

function generateHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(12);
}

function deduplicateSyntheticData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const properties = PropertiesService.getDocumentProperties();
  const projectName = properties.getProperty('projectName');
  const generatedDataSheet = `${projectName} Generated Data`;
  const sheet = ss.getSheetByName(generatedDataSheet);

  if (!sheet) {
    SpreadsheetApp.getUi().alert(`Error: Sheet named "${generatedDataSheet}" not found. Please generate synthetic data first.`);
    return;
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  const apiUrl = scriptProperties.getProperty('DEDUP_API_URL');
  const apiKey = scriptProperties.getProperty('DEDUP_API_KEY');

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const contentColIndex = headers.indexOf('Generated Message');

  if (contentColIndex === -1) {
    SpreadsheetApp.getUi().alert('Error: Required column (Generated Message) not found');
    return;
  }

  if (!apiUrl || !apiKey) {
    SpreadsheetApp.getUi().alert('Deduplication service is not configured. Please set DEDUP_API_URL and DEDUP_API_KEY in Script Properties.');
    return;
  }

  const config = {
    similarityThreshold: properties.getProperty('similarityThreshold') || 0.9,
    topic: properties.getProperty('TOPIC'),
    industry: properties.getProperty('INDUSTRY'),
    jobId: properties.getProperty('projectId')
  };

  const contentData = processInputData(data.slice(1), contentColIndex, config);

  totalStats = { received: 0, inserted: 0, dropped: 0 };

  const outputSheet = initializeOutputSheet(ss, projectName);
  let currentRow = 2;

  const BATCH_SIZE = 100;
  for (let i = 0; i < contentData.length; i += BATCH_SIZE) {
    const batchMessages = contentData.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    const payload = createBatchPayload(batchMessages, config);

    try {
      const response = UrlFetchApp.fetch(apiUrl, {
        method: 'POST',
        contentType: 'application/json',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      if (response.getResponseCode() === 200) {
        const result = JSON.parse(response.getContentText());
        updateTotalStats(result.data.stats);

        const nonDuplicateMessages = result.data.non_duplicate_messages;
        if (nonDuplicateMessages.length > 0) {
          const data = nonDuplicateMessages.map(msg => {
            const originalMessage = batchMessages.find(m => m.messageId === msg.message_id);
            return originalMessage ? [originalMessage.content] : null;
          }).filter(row => row !== null);

          if (data.length > 0) {
            outputSheet.getRange(currentRow, 1, data.length, 1).setValues(data);
            currentRow += data.length;
          }
        }

        Logger.log(`Batch ${batchNumber} processed successfully`);
      } else {
        Logger.log(`Error in batch ${batchNumber}: ${response.getContentText()}`);
      }
    } catch (error) {
      Logger.log(`Exception in batch ${batchNumber}: ${error.message}`);
    }
  }

  outputSheet.autoResizeColumns(1, 1);
  logSummarizedStats();
}

function processInputData(rows, contentColIndex, config) {
  return rows.map((row, index) => {
    const content = row[contentColIndex];
    const timestamp = new Date().toISOString();
    const messageId = generateHash(`${content}${timestamp}${index}`);

    return {
      content,
      topic: config.topic,
      industry: config.industry,
      timestamp,
      messageId,
      platformName: 'synthetic',
      platformUserId: config.jobId,
      platformMessageId: messageId,
      platformMessageUrl: ''
    };
  });
}

function initializeOutputSheet(ss, projectName) {
  const deduplicatedDataSheet = `${projectName} Generated Data Deduplicated`;
  let outputSheet = ss.getSheetByName(deduplicatedDataSheet);

  if (!outputSheet) {
    outputSheet = ss.insertSheet(deduplicatedDataSheet);
    const headerRange = outputSheet.getRange(1, 1);
    headerRange.setValue('Deduplicated Generated Message');
    headerRange.setFontWeight('bold');
  } else {
    const lastRow = Math.max(outputSheet.getLastRow(), 1);
    if (lastRow > 1) {
      outputSheet.getRange(2, 1, lastRow - 1, 1).clear();
    }
  }

  return outputSheet;
}

function createBatchPayload(batchMessages, config) {
  return {
    table_name: DEDUP_TABLE_NAME, 
    job_id: config.jobId,
    topic: config.topic,
    industry: config.industry,
    subindustry: config.industry,
    similarity_search_score_threshold: parseFloat(config.similarityThreshold),
    filter_by: DEDUP_FILTER_BY, 
    messages: batchMessages.map(item => ({
      message_id: item.messageId,
      timestamp: item.timestamp,
      content: item.content,
      platform_name: item.platformName || 'synthetic',
      platform_user_id: item.platformUserId || config.jobId,
      platform_message_id: item.platformMessageId || item.messageId,
      platform_message_url: item.platformMessageUrl || ''
    }))
  };
}

function updateTotalStats(stats) {
  totalStats.received += stats.received;
  totalStats.inserted += stats.inserted;
  totalStats.dropped += stats.dropped;
  Logger.log(`Updated Total Stats: ${JSON.stringify(totalStats)}`);
}

function logSummarizedStats() {
  const insertionRate = totalStats.received
    ? ((totalStats.inserted / totalStats.received) * 100).toFixed(2)
    : '0.00';

  Logger.log('=== Deduplication Summary ===');
  Logger.log(`Total Received: ${totalStats.received}`);
  Logger.log(`Total Inserted: ${totalStats.inserted}`);
  Logger.log(`Total Dropped: ${totalStats.dropped}`);
  Logger.log(`Overall Insertion Rate: ${insertionRate}%`);
}