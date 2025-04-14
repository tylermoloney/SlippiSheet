require('dotenv').config();
const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor() {
    // Default configuration values
    this.config = {
      REPLAY_DIR: path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'Slippi'),
      DOLPHIN_PORT: 51441, // Default port for Dolphin
      POLLING_INTERVAL: 5 * 60 * 1000, // 5 minutes
      POST_GAME_DELAY: 5000, // 5 seconds
      FILE_CHECK_INTERVAL: 5000, // 5 seconds
      CONNECT_CODE: null, // Will be set by user
      SPREADSHEET_ID: process.env.SPREADSHEET_ID,
      SLIPPI_API_URL: process.env.SLIPPI_API_URL || 'https://gql-gateway-2-dot-slippi.uc.r.appspot.com/graphql',
      SHEET_NAME: process.env.SHEET_NAME || 'Sheet1'
    };
    
    // Load configuration from various sources
    this.loadFromEnv();
    this.loadFromFile();
  }
  
  /**
   * Load configuration from environment variables
   */
  loadFromEnv() {
    // Override from environment variables
    if (process.env.SLIPPI_REPLAY_DIR) this.config.REPLAY_DIR = process.env.SLIPPI_REPLAY_DIR;
    if (process.env.SLIPPI_DOLPHIN_PORT) this.config.DOLPHIN_PORT = parseInt(process.env.SLIPPI_DOLPHIN_PORT);
    if (process.env.CONNECT_CODE) this.config.CONNECT_CODE = process.env.CONNECT_CODE;
    if (process.env.POST_GAME_DELAY) this.config.POST_GAME_DELAY = parseInt(process.env.POST_GAME_DELAY);
    if (process.env.FILE_CHECK_INTERVAL) this.config.FILE_CHECK_INTERVAL = parseInt(process.env.FILE_CHECK_INTERVAL);
  }
  
  /**
   * Load configuration from user config file
   */
  loadFromFile() {
    try {
      // Look for config in project root first, then resources directory
      let configPath = path.join(process.cwd(), 'user-config.json');
      
      // If not found, check in resources directory
      if (!fs.existsSync(configPath)) {
        configPath = path.join(process.cwd(), 'resources', 'user-config.json');
      }
      
      if (fs.existsSync(configPath)) {
        const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        // Override with user config
        if (userConfig.connectCode) this.config.CONNECT_CODE = userConfig.connectCode;
        if (userConfig.replayDir) this.config.REPLAY_DIR = userConfig.replayDir;
        if (userConfig.dolphinPort) this.config.DOLPHIN_PORT = userConfig.dolphinPort;
        if (userConfig.spreadsheetId) this.config.SPREADSHEET_ID = userConfig.spreadsheetId;
        if (userConfig.sheetName) this.config.SHEET_NAME = userConfig.sheetName;
      }
    } catch (error) {
      console.error('Error loading user config:', error.message);
    }
  }
  
  /**
   * Get a configuration value
   * @param {string} key - The configuration key
   * @param {any} defaultValue - Default value if key doesn't exist
   * @returns {any} The configuration value
   */
  get(key, defaultValue = null) {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }
  
  /**
   * Validate that all required configuration is present
   * @returns {boolean} True if configuration is valid
   * @throws {Error} If configuration is invalid
   */
  validate() {
    // Check required values
    if (!this.config.CONNECT_CODE) {
      throw new Error('Connect code not configured. Please run "yarn setup" first.');
    }
  
    if (!this.config.SPREADSHEET_ID) {
      throw new Error('Spreadsheet ID not configured. Please check your configuration.');
    }
    
    // Validate connect code format if present
    if (this.config.CONNECT_CODE && 
        !/^[A-Z0-9]{4}#[0-9]{1,3}$/.test(this.config.CONNECT_CODE)) {
      throw new Error(`Invalid connect code format: "${this.config.CONNECT_CODE}". Expected format: ABCD#123`);
    }
    
    return true;
  }
  
  /**
   * Save the configuration to a user config file
   * @param {Object} updates - Configuration updates to save
   */
  saveConfig(updates = {}) {
    try {
      // Update config with new values
      Object.entries(updates).forEach(([key, value]) => {
        const configKey = key.toUpperCase();
        if (this.config[configKey] !== undefined) {
          this.config[configKey] = value;
        }
      });
      
      // Prepare user config object (camelCase keys for better JSON)
      const userConfig = {
        connectCode: this.config.CONNECT_CODE,
        replayDir: this.config.REPLAY_DIR,
        dolphinPort: this.config.DOLPHIN_PORT,
        spreadsheetId: this.config.SPREADSHEET_ID,
        sheetName: this.config.SHEET_NAME
      };
      
      // Ensure resources directory exists
      const resourcesDir = path.join(process.cwd(), 'resources');
      if (!fs.existsSync(resourcesDir)) {
        fs.mkdirSync(resourcesDir, { recursive: true });
      }
      
      // Save to file
      const configPath = path.join(process.cwd(), 'resources', 'user-config.json');
      fs.writeFileSync(configPath, JSON.stringify(userConfig, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('Error saving user config:', error.message);
      return false;
    }
  }
}

// Create a singleton instance
const configManager = new ConfigManager();
module.exports = configManager;