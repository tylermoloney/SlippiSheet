const readline = require('readline');
const config = require('../src/config');
const { logSuccess, logError, logInfo } = require('../src/utils/logging');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Prompt for user input
 * @param {string} question - Question to ask
 * @param {string} defaultValue - Optional default value
 * @returns {Promise<string>} User input
 */
function askQuestion(question, defaultValue = '') {
  const defaultText = defaultValue ? ` [${defaultValue}]` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${defaultText}: `, (answer) => {
      resolve(answer || defaultValue);
    });
  });
}

/**
 * Setup script for SlippiSheet
 */
async function setupSlippiSheet() {
  try {
    console.log("\n====== SlippiSheet Setup ======\n");
    await logInfo("This setup will guide you through configuring SlippiSheet.");
    
    // Get connect code
    const connectCode = await askQuestion("Enter your Slippi connect code (e.g., ABCD#123)");
    
    if (!connectCode || !/^[A-Z0-9]{4,}#[0-9]{1,3}$/.test(connectCode)) {
      await logError("Invalid connect code format. Expected format: ABCD#123");
      process.exit(1);
    }
    
    // Get replay directory (optional)
    const defaultReplayDir = config.get('REPLAY_DIR');
    const replayDir = await askQuestion("Enter your Slippi replay directory", defaultReplayDir);
    
    // Get spreadsheet ID (if not set)
    let spreadsheetId = config.get('SPREADSHEET_ID');
    if (!spreadsheetId) {
      spreadsheetId = await askQuestion("Enter your Google Spreadsheet ID");
      
      if (!spreadsheetId) {
        await logError("Spreadsheet ID is required");
        process.exit(1);
      }
    }
    
    // Get sheet name (if not set)
    const defaultSheetName = config.get('SHEET_NAME');
    const sheetName = await askQuestion("Enter the name of your sheet", defaultSheetName);
    
    // Save configuration
    const updates = {
      CONNECT_CODE: connectCode,  
      REPLAY_DIR: replayDir,      
      SPREADSHEET_ID: spreadsheetId, 
      SHEET_NAME: sheetName
    };

    if (config.saveConfig(updates)) {
      await logSuccess("\nConfiguration saved successfully!");
      await logInfo("\nNext steps:");
      await logInfo("1. Make sure your .env file has Google API credentials");
      await logInfo("2. Share your Google Sheet with the service account email");
      await logInfo("3. Run 'yarn start' to begin tracking your ratings");
    } else {
      await logError("\nFailed to save configuration");
      process.exit(1);
    }
  } catch (error) {
    await logError(`Setup failed: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

setupSlippiSheet();