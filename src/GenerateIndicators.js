const API_CONFIG = {
    DEFAULT_MODELS: {
      OPENAI: 'gpt-4o-2024-08-06',
      ANTHROPIC: 'claude-3-7-sonnet-20250219',
      GOOGLE: 'gemini-2.0-pro-exp-02-05',  
      SUMMARIZATION: {
        provider: 'openai',
        model: 'gpt-4o-2024-08-06'
      }
    },
    OPENAI: {
      URL: 'https://api.openai.com/v1/chat/completions',
      MODELS: [
        'gpt-4o-2024-08-06',    
        'gpt-4o-mini-2024-07-18'
      ]
    },
    ANTHROPIC: {
      URL: 'https://api.anthropic.com/v1/messages',
      VERSION: '2023-06-01',
      MODELS: [
        'claude-3-7-sonnet-20250219',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229'
      ]
    },
    GOOGLE: {
      URL: 'https://generativelanguage.googleapis.com/v1beta/models',
      MODELS: [
        'gemini-2.0-flash',
        'gemini-2.0-pro-exp-02-05'  
      ]
    }
  };
  
  const INDICATOR_PROMPT = "Your task is to generate a list of [TOPIC] in [INDUSTRY] Indicators that could be spotted by looking at social media chatter, including very early stages of [TOPIC]. [INDUSTRY] ecosystem participants could include [STAKEHOLDERS].";
  const SUMMARIZE_PROMPT = "Your task is to deduplicate and summarize a list of Blockchain Ecosystem Cyberattack Indicators you will find below. It's okay to merge similar ideas into one concept, but don't remove any ideas completely. Generate a succinct paragraph with densely packed indicators and associated concepts you will find below without additional comments.";
  
  const ApiKeyManager = {
    getAllApiKeys() {
      const scriptProperties = PropertiesService.getScriptProperties();
      return {
        openai: scriptProperties.getProperty('OPENAI_API_KEY'),
        anthropic: scriptProperties.getProperty('ANTHROPIC_API_KEY'),
        google: scriptProperties.getProperty('GOOGLE_API_KEY')
      };
    },
  
    validateApiKeys(keys) {
      const missingKeys = Object.entries(keys)
        .filter(([_, value]) => !value)
        .map(([key]) => key);
  
      if (missingKeys.length > 0) {
        SpreadsheetApp.getUi().alert(
          `Error: Missing API keys for: ${missingKeys.join(', ')}. Please set them in script properties.`
        );
        return false;
      }
      return true;
    }
  };
  
  const SheetManager = {
    getSheetData(sheet) {
      const genKnowData = sheet.getRange('A2:A').getValues().filter(row => row[0]);
      const histEventsData = sheet.getRange('B2:B').getValues().filter(row => row[0]);
  
      return {
        generalKnowledge: genKnowData.length > 0 ? genKnowData.map(row => row[0]).join('\n') : '',
        historicalEvents: histEventsData.length > 0 ? histEventsData.map(row => row[0]).join('\n') : ''
      };
    }
  };
  
  function buildPrompt(indicatorPrompt, sheetData) {
    const { generalKnowledge, historicalEvents } = sheetData;
    let prompt = indicatorPrompt;
    
    if (generalKnowledge) {
      prompt += `\n\nInformation included below could help you reason about useful signals for monitoring reports on social media.\n\nGeneral Knowledge:\n${generalKnowledge}`;
    }
    
    if (historicalEvents) {
      prompt += `\n\nInformation included below could help you reason about useful signals for monitoring reports on social media.\n\nHistorical Events:\n${historicalEvents}`;
    }
    
    return prompt;
  }
  
  function fetchAllResponses(apiKeys, prompt) {
    const documentProperties = PropertiesService.getDocumentProperties();
    const selectedProviders = JSON.parse(documentProperties.getProperty('SELECTED_PROVIDERS') || '{}');
    
    const responses = {};
    
    for (const [provider, model] of Object.entries(selectedProviders)) {
      if (!apiKeys[provider]) continue;
      
      switch(provider) {
        case 'openai':
          responses.openai = fetchLLMResponseFromOpenAI(apiKeys.openai, prompt, model);
          break;
        case 'anthropic':
          responses.anthropic = fetchLLMResponseFromAnthropic(apiKeys.anthropic, prompt, model);
          break;
        case 'google':
          responses.google = fetchLLMResponseFromGoogle(apiKeys.google, prompt, model);
          break;
      }
    }
    
    return responses;
  }
  
  function validateResponses(responses) {
    return Object.values(responses).some(response => !!response);
  }
  
  function formatResponses(responses) {
    const formattedResponses = [];
    
    if (responses.openai) {
      formattedResponses.push(`OpenAI Response:\n${responses.openai}`);
    }
    
    if (responses.anthropic) {
      formattedResponses.push(`Anthropic Response:\n${responses.anthropic}`);
    }
    
    if (responses.google) {
      formattedResponses.push(`Google Response:\n${responses.google}`);
    }
    
    return formattedResponses.join('\n\n');
  }
  
  function fetchLLMResponseFromOpenAI(apiKey, prompt, model) {
    const options = {
      method: 'post',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify({
        model: model,
        messages: [
          { role: 'user', content: prompt }
        ]
      }),
    };
  
    try {
      const response = UrlFetchApp.fetch(API_CONFIG.OPENAI.URL, options);
      const responseData = JSON.parse(response.getContentText());
      return responseData.choices[0]?.message?.content || null;
    } catch (error) {
      Logger.log(`OpenAI API error: ${error.message}`);
      return null;
    }
  }
  
  function fetchLLMResponseFromAnthropic(apiKey, prompt, model) {
    const options = {
      method: 'post',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': API_CONFIG.ANTHROPIC.VERSION,
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify({
        model: model,
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 4096
      }),
    };
  
    try {
      const response = UrlFetchApp.fetch(API_CONFIG.ANTHROPIC.URL, options);
      const responseData = JSON.parse(response.getContentText());
      return responseData.content[0]?.text || null;
    } catch (error) {
      Logger.log(`Anthropic API error: ${error.message}`);
      return null;
    }
  }
  
  function fetchLLMResponseFromGoogle(apiKey, prompt, model) {
    const apiUrl = `${API_CONFIG.GOOGLE.URL}/${model}:generateContent?key=${apiKey}`;
    const options = {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ]
      }),
    };
  
    try {
      const response = UrlFetchApp.fetch(apiUrl, options);
      const responseData = JSON.parse(response.getContentText());
      return responseData.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (error) {
      Logger.log(`Google Gemini API error: ${error.message}`);
      return null;
    }
  }
  
  function summarizeIndicators(apiKeys, combinedResponses, summarizePrompt) {
    if (!combinedResponses) {
      throw new Error('No responses to summarize');
    }
  
    const documentProperties = PropertiesService.getDocumentProperties();
    let config = JSON.parse(
      documentProperties.getProperty('SUMMARIZATION_CONFIG') || 'null'
    );
    
    if (!config || !config.provider || !config.model) {
      config = API_CONFIG.DEFAULT_MODELS.SUMMARIZATION;
    }
  
    const { provider, model } = config;
    const fullPrompt = `${summarizePrompt}\n\n${combinedResponses}`;
  
    switch (provider) {
      case 'openai':
        return fetchLLMResponseFromOpenAI(apiKeys.openai, fullPrompt, model);
      case 'anthropic':
        return fetchLLMResponseFromAnthropic(apiKeys.anthropic, fullPrompt, model);
      case 'google':
        return fetchLLMResponseFromGoogle(apiKeys.google, fullPrompt, model);
      default:
        throw new Error('Invalid summarization provider');
    }
  }
  
  function saveIndicatorConfiguration(config) {
    const documentProperties = PropertiesService.getDocumentProperties();
    documentProperties.setProperties({
      'INDICATOR_PROMPT': config.generation,
      'SUMMARIZE_PROMPT': config.summarization,
      'SELECTED_PROVIDERS': JSON.stringify(config.providers),
      'SUMMARIZATION_CONFIG': JSON.stringify(config.summarizationConfig)
    });
  }
  
  function saveAdvancedSettings(config) {
    const documentProperties = PropertiesService.getDocumentProperties();
    documentProperties.setProperty('CUSTOM_DEFAULT_MODELS', JSON.stringify(config));
    showIndicatorsGenerationSidebar();
    return config;
  }
  
  function getDefaultModels() {
    const documentProperties = PropertiesService.getDocumentProperties();
    const customDefaults = JSON.parse(documentProperties.getProperty('CUSTOM_DEFAULT_MODELS') || 'null');
    return customDefaults || API_CONFIG.DEFAULT_MODELS;
  }
  
  function generateIndicatorsForSidebar() {
    const apiKeys = ApiKeyManager.getAllApiKeys();
    if (!ApiKeyManager.validateApiKeys(apiKeys)) {
      throw new Error('Missing API keys');
    }
  
    const documentProperties = PropertiesService.getDocumentProperties();
    let selectedProviders = JSON.parse(documentProperties.getProperty('SELECTED_PROVIDERS') || 'null');
    if (!selectedProviders || Object.keys(selectedProviders).length === 0) {
      const defaults = API_CONFIG.DEFAULT_MODELS;
      selectedProviders = {
        openai: defaults.OPENAI,
        anthropic: defaults.ANTHROPIC,
        google: defaults.GOOGLE
      };
      documentProperties.setProperty('SELECTED_PROVIDERS', JSON.stringify(selectedProviders));
    }
  
    const topic = documentProperties.getProperty('TOPIC');
    const industry = documentProperties.getProperty('INDUSTRY');
    const stakeholders = documentProperties.getProperty('STAKEHOLDERS');
  
    if (!topic || !industry || !stakeholders) {
      throw new Error('Missing required parameters. Please set Topic, Industry, and Stakeholders first.');
    }
  
    const prompt = INDICATOR_PROMPT
      .replace(/\[TOPIC\]/g, topic)         
      .replace(/\[INDUSTRY\]/g, industry)    
      .replace(/\[STAKEHOLDERS\]/g, stakeholders); 
    
    const responses = fetchAllResponses(apiKeys, prompt);
    
    if (!validateResponses(responses)) {
      throw new Error('Failed to retrieve responses from providers');
    }
  
    const combinedResponses = formatResponses(responses);
    const summary = summarizeIndicators(apiKeys, combinedResponses, SUMMARIZE_PROMPT);
  
    if (!summary) {
      throw new Error('Failed to generate summary');
    }
  
    return summary;
  }
  
  function approveIndicators(indicators) {
    if (!indicators) {
      throw new Error('No indicators provided');
    }
  
    const documentProperties = PropertiesService.getDocumentProperties();
    
    let approvedIndicators;
    try {
      approvedIndicators = JSON.parse(documentProperties.getProperty('APPROVED_INDICATORS') || '[]');
    } catch (e) {
      approvedIndicators = [];
    }
  
    approvedIndicators.push({
      indicators: indicators,
      timestamp: new Date().toISOString(),
      providerConfig: JSON.parse(documentProperties.getProperty('SELECTED_PROVIDERS') || '{}'),
      summarizationConfig: JSON.parse(documentProperties.getProperty('SUMMARIZATION_CONFIG') || '{}')
    });
  
    if (approvedIndicators.length > 100) {
      approvedIndicators = approvedIndicators.slice(-100);
    }
  
    documentProperties.setProperty('APPROVED_INDICATORS', JSON.stringify(approvedIndicators));
  
    return true;
  }
  
  function getApprovedIndicators() {
    const documentProperties = PropertiesService.getDocumentProperties();
    try {
      return JSON.parse(documentProperties.getProperty('APPROVED_INDICATORS') || '[]');
    } catch (e) {
      Logger.log('Error parsing approved indicators: ' + e);
      return [];
    }
  }