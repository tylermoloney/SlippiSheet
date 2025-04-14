const DolphinConnector = require('./src/connectors/dolphin');
const FileWatcher = require('./src/connectors/fileWatcher');
const slippiService = require('./src/services/slippi');
const sheetsService = require('./src/services/sheets');
const config = require('./src/config');
const path = require('path');
const { logSuccess, logError, logInfo } = require('./src/utils/logging');

/**
 * Main SlippiSheet application
 */
class SlippiSheet {
  constructor() {
    this.config = config;
    this.dolphin = new DolphinConnector(config);
    this.fileWatcher = new FileWatcher(config);
    this.useDolphinMode = true;
    this.useFileWatcherMode = false;
    this.postGameDelay = config.get('POST_GAME_DELAY');
  }

  /**
   * Start the application
   */
  async start() {
    try {
      // Validate configuration
      this.config.validate();

      // Try Dolphin connection first
      await logInfo('Attempting to connect to Dolphin...');
      this.useDolphinMode = await this.dolphin.connect();

      // Set up Dolphin event handlers if connection successful
      if (this.useDolphinMode) {
        this.dolphin.setGameStartHandler(() => this.handleGameStart());
        this.dolphin.setGameEndHandler(() => this.processGameCompletion());
      }

      // Fall back to file watcher if Dolphin connection failed
      if (!this.useDolphinMode) {
        await logInfo('Dolphin connection not available, falling back to file watcher');
        this.useFileWatcherMode = true;

        this.fileWatcher.onGameStart((filePath) => this.handleGameStart(filePath));
        this.fileWatcher.onGameComplete((filePath) => this.processGameCompletion(filePath));

        await this.fileWatcher.start();
      }

      await logSuccess('SlippiSheet is running. Press Ctrl+C to exit.');


      // Test Google Sheets connection
      try {
        await logInfo('Testing Google Sheets connection...');
        await sheetsService.debugAuth();
      } catch (err) {
        await logError(`Google Sheets connection test failed: ${err.message}`);
        // Continue anyway. Error handling on fetch will give more information.
      }
      // Initial data fetch
      try {
        await this.fetchAndAppendRating();
        await logSuccess('Initial data fetch complete');
      } catch (err) {
        await logError(`Initial data fetch failed: ${err.message}`);
      }
    } catch (error) {
      await logError(`Failed to start SlippiSheet: ${error.message}`);
      process.exit(1);
    }
  }

  async handleGameStart(filePath) {
    try {
      if (filePath) {
        await logInfo(`Game started: ${path.basename(filePath)}`);
      } else {
        await logInfo('Game started via Dolphin connection');
      }

    } catch (error) {
      await logError(`Error handling game start: ${error.message}`);
    }
  }

  /**
   * Process game completion and fetch updated ratings
   */
  async processGameCompletion() {
    await logInfo('Checking for rating updates...');

    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          await this.fetchAndAppendRating();
          await logSuccess('Rating data processed successfully');
          resolve(true);
        } catch (err) {
          await logError(`Error processing data: ${err.message}`);
          resolve(false);
        }
      }, this.postGameDelay);
    });
  }

  /**
   * Fetch player rating and append to spreadsheet
   */
  async fetchAndAppendRating() {
    try {
      const rating = await slippiService.fetchPlayerRating();
      await sheetsService.appendRating(rating);
      return true;
    } catch (error) {
      await logError(`Error in fetchAndAppendRating: ${error.message}`);
      return false;
    }
  }
}

async function main() {
  try {
    const app = new SlippiSheet();
    await app.start();
  } catch (error) {
    console.error(`Failed to start application: ${error.message}`);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  await logError(`Uncaught exception: ${error.message}`);
  console.error(error);
});

process.on('unhandledRejection', async (reason) => {
  await logError(`Unhandled rejection: ${reason}`);
  console.error(reason);
});

// Start the application
main();