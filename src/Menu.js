function onOpen(e) {
  try {
    refreshAddonMenu();
  } catch (err) {
    Logger.log('onOpen(): Error calling refreshAddonMenu(): ' + err);
    showFallbackMenu();
  }
}

function onInstall(e) {
  onOpen(e);
}

function refreshAddonMenu() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createAddonMenu();

  let projectName = null;
  try {
    const docProps = PropertiesService.getDocumentProperties();
    projectName = docProps.getProperty('projectName');
  } catch (err) {
    Logger.log('refreshAddonMenu(): Error accessing DocumentProperties: ' + err);
  }

  if (projectName) {
    menu.addItem('Dataset Generation', 'showDatasetParametersSidebar')
        .addItem('Deduplication', 'showDeduplicationSidebar')
        .addItem('Create New Project', 'showNewProjectDialog');
  } else {
    menu.addItem('Start', 'showWelcomeSidebar');
  }

  menu.addToUi();
}

function showFallbackMenu() {
  SpreadsheetApp.getUi()
    .createAddonMenu()
    .addItem('Start', 'showWelcomeSidebar')
    .addToUi();
}

function getProjectName() {
  try {
    return PropertiesService.getDocumentProperties().getProperty('projectName');
  } catch (err) {
    Logger.log('getProjectName(): Error accessing DocumentProperties: ' + err);
    return null;
  }
}

function showNewProjectDialog() {
  const html = HtmlService.createTemplateFromFile('NewProjectSidebar')
    .evaluate()
    .setWidth(400)
    .setHeight(380);
  SpreadsheetApp.getUi().showModalDialog(html, 'Create New Project');
}

function showDatasetParametersSidebar() {
  const html = HtmlService.createTemplateFromFile('DatasetParametersSidebar')
    .evaluate()
    .setTitle('ELTEX: Dataset Generator')
    .setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showIndicatorsGenerationSidebar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const projectName = getProjectName();
  const indicatorsSheetName = `${projectName} Indicators Creation`;

  const sheet = ss.getSheetByName(indicatorsSheetName);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Error: Indicators sheet not found. Please create a new project first.');
    return;
  }
  ss.setActiveSheet(sheet);

  const template = HtmlService.createTemplateFromFile('IndicatorsAlert');
  template.sheetName = indicatorsSheetName;
  const alertHtml = template.evaluate()
    .setWidth(480)
    .setHeight(420);
  SpreadsheetApp.getUi().showModalDialog(alertHtml, 'Indicators');

  const sidebarHtml = HtmlService.createTemplateFromFile('IndicatorsGenerationSidebar')
    .evaluate()
    .setTitle('ELTEX: Dataset Generator')
    .setWidth(400);
  SpreadsheetApp.getUi().showSidebar(sidebarHtml);
}

function showReadyToGenerateAlert() {
  const html = HtmlService.createTemplateFromFile('ReadyToGenerateAlert')
    .evaluate()
    .setWidth(460)
    .setHeight(440);
  SpreadsheetApp.getUi().showModalDialog(html, "You're Ready!");
}

function showGenerateDatasetSidebar() {
  const html = HtmlService.createTemplateFromFile('GenerateDatasetSidebar')
    .evaluate()
    .setTitle('ELTEX: Dataset Generator')
    .setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showDeduplicationSidebar() {
  const html = HtmlService.createTemplateFromFile('DeduplicationSidebar')
    .evaluate()
    .setTitle('Deduplication')
    .setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showDeduplicationPromptAlert() {
  const template = HtmlService.createTemplateFromFile('DeduplicationPromptAlert');
  template.messageCount = getTotalGeneratedMessages();

  const html = template.evaluate()
    .setWidth(460)
    .setHeight(440);
  SpreadsheetApp.getUi().showModalDialog(html, 'What\'s Next?');
}

function showWelcomeSidebar() {
  const html = HtmlService.createTemplateFromFile('WelcomeSidebar')
    .evaluate()
    .setTitle('ELTEX: Dataset Generator');
  SpreadsheetApp.getUi().showSidebar(html);
}

function createNewProject(projectData) {
  const userEmail = Session.getActiveUser().getEmail();
  const projectId = generateProjectId(projectData.name, userEmail);

  if (projectData) {
    saveProjectProperties(projectId, projectData);
    createProjectSheets(projectData.name);
    Logger.log('Project created successfully!');
  }

  refreshAddonMenu();
  showRealDataStep();
}

function showRealDataStep({ skipSheetCheck = false } = {}) {
  const projectName = getProjectName();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const realDataSheetName = `${projectName} Real Data`;
  const realDataSheet = ss.getSheetByName(realDataSheetName);

  if (!skipSheetCheck && !realDataSheet) {
    SpreadsheetApp.getUi().alert(`Error: Sheet "${realDataSheetName}" not found. Please create a new project first.`);
    return;
  }

  ss.setActiveSheet(realDataSheet);

  const template = HtmlService.createTemplateFromFile('RealDataAlert');
  template.sheetName = realDataSheetName;

  const html = template.evaluate()
    .setWidth(480)
    .setHeight(420);

  SpreadsheetApp.getUi().showModalDialog(html, 'Add Your Data');
  showDatasetParametersSidebar();
}

function generateProjectId(projectName, userEmail) {
  return `${projectName}_${userEmail}`.replace(/[^a-zA-Z0-9_]/g, '_');
}

function saveProjectProperties(projectId, projectData) {
  const properties = PropertiesService.getDocumentProperties();
  properties.setProperties({
    'projectId': projectId,
    'projectName': projectData.name,
    'projectDescription': projectData.description
  });
}

function createProjectSheets(projectName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const realDataSheet = ss.insertSheet(`${projectName} Real Data`);
  realDataSheet.getRange('A1').setValue('Real Data').setFontWeight('bold');
  realDataSheet.autoResizeColumns(1, 1);

  const indicatorsSheet = ss.insertSheet(`${projectName} Indicators Creation`);
  indicatorsSheet.getRange('A1:B1').setValues([['General Knowledge', 'Historical Events']]);
  indicatorsSheet.getRange('A1:B1').setFontWeight('bold');
  indicatorsSheet.autoResizeColumns(1, 2);
}

function showAdvancedSettingsSidebar() {
  const html = HtmlService.createTemplateFromFile('AdvancedSettingsSidebar')
    .evaluate()
    .setTitle('Advanced Settings')
    .setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  }