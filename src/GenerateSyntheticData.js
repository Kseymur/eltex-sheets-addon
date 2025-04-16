const SYNTHETIC_DATA_MODEL = "gpt-4o";
const GENERATION_TEMPLATES = {
  TASK: `Your task is to generate a list of social media platform messages to be used as early warning signals for identifying [TOPIC] in [INDUSTRY] industry. Below are 2 lists. "Indicators" list contains signals that can lead to [CONSEQUENCES]. The other list, "Social Media Messages", contains social media platform messages about [TOPIC] that happened in the past. Use "Indicators" and "Social Media Messages" to generate [NUMBER] new social media platform messages that could imply [TOPIC] in [INDUSTRY] industry, including very early stages of it.`,
  CRITICAL: `\n- Use modern vocabulary and writing style.\n- Leave Law Enforcement and Government Regulators' names unchanged, but replace other named entities (organization, person, location names, etc.) with fictional, but probable and modern ones.\n- The output must be a list of [NUMBER] newly generated social media platform messages without any explanations.`
};
const GENERATION_LIMITS = {
  SYNTHETIC_PER_BATCH: 100,
  REAL_PER_BATCH: 10,
  RATIO: 10
};

function constructGenerationPrompt(params) {
  const { topic, industry, stakeholders, consequences } = params;
  if (!topic || !industry || !stakeholders || !consequences) {
    throw new Error('All parameters are required for prompt construction');
  }
  const taskPrompt = GENERATION_TEMPLATES.TASK
    .replace(/\[TOPIC\]/g, topic)
    .replace(/\[INDUSTRY\]/g, industry)
    .replace(/\[CONSEQUENCES\]/g, consequences)
    .replace(/\[NUMBER\]/g, GENERATION_LIMITS.SYNTHETIC_PER_BATCH);
  const criticalPrompt = GENERATION_TEMPLATES.CRITICAL
    .replace(/\[NUMBER\]/g, GENERATION_LIMITS.SYNTHETIC_PER_BATCH);
  return `${taskPrompt}\n\nCritical:\n${criticalPrompt}`;
}

function saveGenerationParameters(params) {
  const documentProperties = PropertiesService.getDocumentProperties();
  try {
    documentProperties.setProperties({
      'TOPIC': params.topic,
      'INDUSTRY': params.industry,
      'STAKEHOLDERS': params.stakeholders,
      'CONSEQUENCES': params.consequences,
      'NUMBER': params.number.toString(),
      'GENERATION_TEMPERATURE': params.temperature
    });
  } catch (error) {
    Logger.log('Error saving generation parameters: ' + error);
    throw new Error('Failed to save generation parameters');
  }
}

function getGenerationParameters() {
  const documentProperties = PropertiesService.getDocumentProperties();
  try {
    return {
      topic: documentProperties.getProperty('TOPIC') || '',
      industry: documentProperties.getProperty('INDUSTRY') || '',
      stakeholders: documentProperties.getProperty('STAKEHOLDERS') || '',
      consequences: documentProperties.getProperty('CONSEQUENCES') || '',
      number: documentProperties.getProperty('NUMBER') || '100',
      temperature: documentProperties.getProperty('GENERATION_TEMPERATURE') || '0.8'
    };
  } catch (error) {
    Logger.log('Error getting generation parameters: ' + error);
    throw new Error('Failed to get generation parameters');
  }
}

function getTotalGeneratedMessages() {
  const properties = PropertiesService.getDocumentProperties();
  const projectName = properties.getProperty('projectName');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`${projectName} Generated Data`);
  if (!sheet) return 0;
  const lastRow = sheet.getLastRow();
  return lastRow > 1 ? lastRow - 1 : 0;
}

function calculateGenerationBatches(totalRequired, realDataCount) {
  const possibleFullBatches = Math.floor(realDataCount / GENERATION_LIMITS.REAL_PER_BATCH);
  const maxPossibleSynthetic = possibleFullBatches * GENERATION_LIMITS.SYNTHETIC_PER_BATCH;
  const requiredBatches = Math.ceil(Math.min(totalRequired, maxPossibleSynthetic) / GENERATION_LIMITS.SYNTHETIC_PER_BATCH);
  return {
    batchCount: requiredBatches,
    totalSynthetic: requiredBatches * GENERATION_LIMITS.SYNTHETIC_PER_BATCH,
    realDataPerBatch: GENERATION_LIMITS.REAL_PER_BATCH,
    syntheticPerBatch: GENERATION_LIMITS.SYNTHETIC_PER_BATCH
  };
}

function generateOnSheetGenerate() {
  const properties = PropertiesService.getDocumentProperties();
  const projectId = properties.getProperty('projectId');
  const projectName = properties.getProperty('projectName');
  if (!projectId || !projectName) {
    SpreadsheetApp.getUi().alert('Error: No active project found.');
    return;
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`${projectName} Real Data`);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Error: Real data sheet not found.');
    return;
  }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const realDataColIndex = headers.findIndex(header => header.toString().toLowerCase() === 'real data') + 1;
  if (realDataColIndex === 0) {
    SpreadsheetApp.getUi().alert('Error: Column "real data" not found.');
    return;
  }
  const data = sheet.getRange(2, realDataColIndex, sheet.getLastRow() - 1, 1).getValues()
    .flat()
    .filter(value => value);
  const requiredDatasetSize = parseInt(properties.getProperty('NUMBER'), 10);
  const batchConfig = calculateGenerationBatches(requiredDatasetSize, data.length);
  if (batchConfig.totalSynthetic < requiredDatasetSize) {
    SpreadsheetApp.getUi().alert(
      `Warning: Cannot generate ${requiredDatasetSize} messages with available real data.\n` +
      `Maximum possible with current data: ${batchConfig.totalSynthetic} messages.\n` +
      `Need more real data samples for larger dataset.`
    );
  }
  data.sort(() => Math.random() - 0.5);
  const groupedData = [];
  for (let i = 0; i < batchConfig.batchCount * GENERATION_LIMITS.REAL_PER_BATCH; i += GENERATION_LIMITS.REAL_PER_BATCH) {
    groupedData.push(data.slice(i, i + GENERATION_LIMITS.REAL_PER_BATCH));
  }
  const params = {
    topic: properties.getProperty('TOPIC'),
    industry: properties.getProperty('INDUSTRY'),
    stakeholders: properties.getProperty('STAKEHOLDERS'),
    consequences: properties.getProperty('CONSEQUENCES')
  };
  const prompt = constructGenerationPrompt(params);
  const temperature = parseFloat(properties.getProperty('GENERATION_TEMPERATURE') || '0.8');
  let approvedIndicators = [];
  try {
    approvedIndicators = JSON.parse(properties.getProperty('APPROVED_INDICATORS') || '[]');
  } catch (error) {
    Logger.log('Error parsing approved indicators: ' + error);
  }
  const latestIndicators = approvedIndicators.length > 0 ?
    approvedIndicators[approvedIndicators.length - 1].indicators : '';
  if (!data.length) {
    SpreadsheetApp.getUi().alert('Error: No data found in column "real data".');
    return;
  }
  if (!prompt) {
    SpreadsheetApp.getUi().alert('Error: Generation prompt is not set.');
    return;
  }
  const structuredSchema = {
    type: 'json_schema',
    json_schema: {
      name: 'synthetic_data_response',
      schema: {
        type: 'object',
        properties: {
          synthetic_messages: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['synthetic_messages'],
        additionalProperties: false
      },
      strict: true
    }
  };
  const jsonlData = groupedData.map((group, index) => JSON.stringify({
    custom_id: `${projectId}_request_${index + 1}`,
    method: 'POST',
    url: '/v1/chat/completions',
    body: {
      model: SYNTHETIC_DATA_MODEL,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\nIndicators:\n${latestIndicators}\n\nReal Data:\n${group.join('\n')}`
        },
      ],
      temperature: temperature,
      response_format: structuredSchema
    },
  })).join('\n');
  const blob = Utilities.newBlob(jsonlData, 'application/jsonl', `${projectId}_batchinput.jsonl`);
  Logger.log(`Blob created with size: ${blob.getBytes().length} bytes`);
  const response = uploadBatch(blob);
  if (response?.id) {
    Logger.log(`Batch file uploaded with ID: ${response.id}`);
    PropertiesService.getDocumentProperties().setProperty(`${projectId}_batchFileId`, response.id);
    createBatchJob();
  } else {
    SpreadsheetApp.getUi().alert('Error: Batch file upload failed.');
  }
}

function createBatchJob() {
  const apiUrl = 'https://api.openai.com/v1/batches';
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  const properties = PropertiesService.getDocumentProperties();
  const projectId = properties.getProperty('projectId');
  const fileId = PropertiesService.getDocumentProperties().getProperty(`${projectId}_batchFileId`);
  const payload = {
    input_file_id: fileId,
    endpoint: '/v1/chat/completions',
    completion_window: '24h',
  };
  const options = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify(payload),
  };
  const response = UrlFetchApp.fetch(apiUrl, options);
  const batchId = JSON.parse(response.getContentText()).id;
  Logger.log(`Batch created with ID: ${batchId}`);
  PropertiesService.getDocumentProperties().setProperty(`${projectId}_batchId`, batchId);
}

function uploadBatch(blob) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) {
    SpreadsheetApp.getUi().alert('Error: OpenAI API key is not set.');
    return null;
  }
  const apiUrl = 'https://api.openai.com/v1/files';
  const options = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    payload: {
      file: blob,
      purpose: 'batch',
    },
  };
  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    return JSON.parse(response.getContentText());
  } catch (error) {
    Logger.log(`Error uploading batch file: ${error.message}`);
    return null;
  }
}

function checkGenerationStatus() {
  const properties = PropertiesService.getDocumentProperties();
  const projectId = properties.getProperty('projectId');
  const batchId = PropertiesService.getDocumentProperties().getProperty(`${projectId}_batchId`);
  if (!batchId) {
    Logger.log('Error: No batch job found.');
    return 'no_batch';
  }
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) {
    Logger.log('Error: OpenAI API key is not set.');
    return 'no_api_key';
  }
  const apiUrl = `https://api.openai.com/v1/batches/${batchId}`;
  const options = {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  };
  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseData = JSON.parse(response.getContentText());
    if (!responseData || !responseData.status) {
      Logger.log('Error: Status not found in API response.');
      return 'unknown';
    }
    const status = responseData.status;
    Logger.log(`Generation status: ${status}`);
    return status;
  } catch (error) {
    Logger.log(`Error checking batch status: ${error.message}`);
    return 'error';
  }
}

function getSyntheticData() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  const properties = PropertiesService.getDocumentProperties();
  const projectId = properties.getProperty('projectId');
  const projectName = properties.getProperty('projectName');
  const batchId = PropertiesService.getDocumentProperties().getProperty(`${projectId}_batchId`);
  if (!projectId || !projectName) {
    SpreadsheetApp.getUi().alert('Error: No active project found.');
    return;
  }
  if (!batchId) {
    SpreadsheetApp.getUi().alert('Error: No batch job found.');
    return;
  }
  const batchApiUrl = `https://api.openai.com/v1/batches/${batchId}`;
  const options = {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  };
  try {
    const batchResponse = UrlFetchApp.fetch(batchApiUrl, options);
    const batchData = JSON.parse(batchResponse.getContentText());
    if (!batchData.output_file_id) {
      SpreadsheetApp.getUi().alert('Error: Output file ID not found. Check generation status.');
      return;
    }
    const fileApiUrl = `https://api.openai.com/v1/files/${batchData.output_file_id}/content`;
    const fileResponse = UrlFetchApp.fetch(fileApiUrl, options);
    const fileContent = fileResponse.getContentText();
    if (!fileContent || fileContent.trim() === '') {
      SpreadsheetApp.getUi().alert('Error: Output file is empty.');
      return;
    }
    const results = fileContent.split('\n')
      .filter(line => line.trim() !== '')
      .map(line => JSON.parse(line));
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`${projectName} Generated Data`) ||
      SpreadsheetApp.getActiveSpreadsheet().insertSheet(`${projectName} Generated Data`);
    sheet.clear();
    sheet.getRange(1, 1).setValue('Generated Message');
    const rows = [];
    results.forEach(result => {
      const messages = JSON.parse(result.response.body.choices[0].message.content).synthetic_messages;
      messages.forEach(message => {
        if (message.trim()) {
          rows.push([message.trim()]);
        }
      });
    });
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 1).setValues(rows);
    }
    Logger.log(`Batch results added to sheet!`);
    showDeduplicationPromptAlert();
  } catch (error) {
    Logger.log(`Error retrieving batch results: ${error.message}`);
    SpreadsheetApp.getUi().alert('Error retrieving batch results. Check logs for details.');
  }
}