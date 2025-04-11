const fs = require('fs');
const path = require('path');
const { fetchDataAndAppend } = require('./fetchData');
const { promisify } = require('util');

const DEFAULT_REPLAY_DIR = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'Slippi');
const POLLING_INTERVAL = 5 * 60 * 1000; // 5 minutes
const POST_GAME_DELAY = 5 * 1000; // 5 seconds
const FILE_CHECK_INTERVAL = 5000; // 5 seconds

function getCurrentMonthFolder(baseDir) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthlyFolder = `${year}-${month}`;
  return path.join(baseDir, monthlyFolder);
}

/**
 * A handler for monitoring Slippi replays and tracking rating changes
 */
class SlippiMonitor {
  constructor(options = {}) {
    this.baseReplayDir = options.replayDir || DEFAULT_REPLAY_DIR;
    this.replayDir = getCurrentMonthFolder(this.baseReplayDir);
    this.watcher = null;
    this.pollingInterval = null;
    this.fileCheckInterval = null;
    this.isWatching = false;
    this.isPolling = false;
    this.chalk = null;
    
    // Track active game
    this.activeGame = null; // {filename, path, lastSize, lastModified, startTime, noChangeCount}
  }

  async getChalk() {
    if (!this.chalk) {
      this.chalk = (await import('chalk')).default;
    }
    return this.chalk;
  }

  /**
   * Start monitoring for game completions
   */
  async start() {
    const chalk = await this.getChalk();
    console.log(chalk.blue('Starting Slippi monitoring service...'));

    // Initial data fetch
    console.log(chalk.blue('Fetching initial data from Slippi API...'));
    try {
      await fetchDataAndAppend();
      console.log(chalk.green('Initial data fetch complete'));
    } catch (err) {
      console.error(chalk.red(`Initial data fetch failed: ${err.message}`));
    }

    try {
      await this.startFileWatcher();
      this.startFileChangeMonitoring();
    } catch (err) {
      console.error(chalk.red(`Error setting up file watcher: ${err.message}`));
      console.log(chalk.yellow('Falling back to polling method...'));
      this.startPolling();
    }

    return this;
  }

  /**
   * Stop all monitoring activities
   */
  stop() {
    const stopWatcher = () => {
      if (this.watcher) {
        this.watcher.close();
        this.watcher = null;
        this.isWatching = false;
      }
    };

    const stopPolling = () => {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
        this.isPolling = false;
      }
    };

    const stopFileChecking = () => {
      if (this.fileCheckInterval) {
        clearInterval(this.fileCheckInterval);
        this.fileCheckInterval = null;
      }
    };

    stopWatcher();
    stopPolling();
    stopFileChecking();
    this.activeGame = null;
    console.log('Slippi monitoring service stopped');
  }

  /**
   * Watch for new Slippi replay files
   */
  async startFileWatcher() {
    if (this.isWatching) return;
    
    const chalk = await this.getChalk();
    console.log(chalk.blue(`Setting up watcher for Slippi replays in: ${this.replayDir}`));

    // Check if directory exists
    if (!fs.existsSync(this.replayDir)) {
      console.log(chalk.yellow(`Creating directory: ${this.replayDir}`));
      try {
        fs.mkdirSync(this.replayDir, { recursive: true });
      } catch (error) {
        throw new Error(`Could not create replay directory: ${error.message}`);
      }
    }

    // Check for recently active game
    try {
      const files = await promisify(fs.readdir)(this.replayDir);
      const slpFiles = files.filter(file => file.endsWith('.slp'));
      
      if (slpFiles.length > 0) {
        // Get stats for all .slp files
        const fileStats = await Promise.all(
          slpFiles.map(async file => {
            const filePath = path.join(this.replayDir, file);
            const stats = await promisify(fs.stat)(filePath);
            return { file, filePath, stats };
          })
        );
        
        // Sort by modification time, newest first
        fileStats.sort((a, b) => b.stats.mtime - a.stats.mtime);
        
        // Check if the most recent file was modified in the last 5 minutes
        const recentFile = fileStats[0];
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        
        if (recentFile && recentFile.stats.mtime.getTime() > fiveMinutesAgo) {
          console.log(chalk.yellow(`Found recent replay that might be an active game: ${recentFile.file}`));
          this.setActiveGame(recentFile.file, recentFile.filePath);
        }
      }
    } catch (err) {
      console.error(chalk.red(`Error checking for recent games: ${err.message}`));
    }

    // Set up the watcher for new games
    this.watcher = fs.watch(this.replayDir, (eventType, filename) => {
      if (eventType === 'rename' && filename && filename.endsWith('.slp')) {
        const filePath = path.join(this.replayDir, filename);
        
        // Check if this is a new file (game start)
        if (fs.existsSync(filePath) && 
            (!this.activeGame || this.activeGame.filename !== filename)) {
          this.setActiveGame(filename, filePath);
        }
      }
    });
    
    this.isWatching = true;
    console.log(chalk.green('Replay file watcher started successfully'));
    
    // Set up process exit handler
    process.on('exit', () => this.stop());
    process.on('SIGINT', () => {
      this.stop();
      process.exit(0);
    });
  }
  
  /**
   * Set a new active game for monitoring
   */
  async setActiveGame(filename, filePath) {
    try {
      const chalk = await this.getChalk();
      const stats = await promisify(fs.stat)(filePath);
      
      // If we already have an active game, consider it ended
      if (this.activeGame) {
        console.log(chalk.yellow(`Previous game ${this.activeGame.filename} interrupted by new game`));
        this.clearActiveGame();
      }
      
      console.log(chalk.blue(`New game started: ${filename} at ${new Date().toLocaleString()}`));
      
      // Set the new active game
      this.activeGame = {
        filename: filename,
        path: filePath,
        startTime: Date.now(),
        lastSize: stats.size,
        lastModified: stats.mtime,
        noChangeCount: 0
      };
      
    } catch (err) {
      console.error(`Error setting active game: ${err.message}`);
    }
  }
  
  /**
   * Clear the active game after it ends
   */
  clearActiveGame() {
    this.activeGame = null;
  }
  
  /**
   * Start monitoring the active game file for changes to detect when it ends
   */
  startFileChangeMonitoring() {
    // Check every 5 seconds
    this.fileCheckInterval = setInterval(async () => {
      try {
        // If no active game, nothing to check
        if (!this.activeGame) return;
        
        // Check if file still exists
        if (!fs.existsSync(this.activeGame.path)) {
          await this.handleGameEnd("File deleted");
          return;
        }
        
        // Get current file stats
        const stats = await promisify(fs.stat)(this.activeGame.path);
        const currentSize = stats.size;
        const currentModified = stats.mtime;
        
        // If file size hasn't changed, increment counter
        if (currentSize === this.activeGame.lastSize && 
            currentModified.getTime() === this.activeGame.lastModified.getTime()) {
          this.activeGame.noChangeCount++;
          
          // After 3 checks (15 seconds) of no changes, consider the game ended
          if (this.activeGame.noChangeCount >= 3) {
            await this.handleGameEnd("File stopped changing");
            return;
          }
        } else {
          // Update the tracked size/time and reset counter
          this.activeGame.lastSize = currentSize;
          this.activeGame.lastModified = currentModified;
          this.activeGame.noChangeCount = 0;
        }
        
        // If game has been active for more than 30 minutes, something is wrong
        if (Date.now() - this.activeGame.startTime > 30 * 60 * 1000) {
          await this.handleGameEnd("Game duration exceeded 30 minutes");
          return;
        }
      } catch (err) {
        console.error(`Error during file monitoring: ${err.message}`);
      }
    }, FILE_CHECK_INTERVAL);
  }
  
  /**
   * Handle a game ending
   */
  async handleGameEnd(reason) {
    try {
      const chalk = await this.getChalk();
      
      if (!this.activeGame) return;
      
      const filename = this.activeGame.filename;
      
      console.log(chalk.yellow(`Game ended: ${filename} (${reason})`));
      console.log(chalk.yellow('Waiting a moment before processing data...'));
      
      // Clear the active game
      this.clearActiveGame();
      
      // Wait a bit for the API to update with the game results
      setTimeout(async () => {
        console.log(chalk.blue('Checking for rating updates...'));
        try {
          await fetchDataAndAppend();
          console.log(chalk.green('Rating data processed successfully'));
        } catch (err) {
          console.error(chalk.red(`Error processing data: ${err.message}`));
        }
      }, POST_GAME_DELAY);
      
    } catch (err) {
      console.error(`Error handling game end: ${err.message}`);
    }
  }

  /**
   * Fall back to periodic polling for data changes
   */
  async startPolling() {
    if (this.isPolling) return;
    
    const chalk = await this.getChalk();
    console.log(chalk.blue(`Starting polling service (every ${POLLING_INTERVAL/60000} minutes)`));
    
    this.pollingInterval = setInterval(async () => {
      console.log(chalk.blue('Polling for rating updates...'));
      try {
        await fetchDataAndAppend();
        console.log(chalk.green('Rating check complete'));
      } catch (err) {
        console.error(chalk.red(`Error during polling: ${err.message}`));
      }
    }, POLLING_INTERVAL);
    
    this.isPolling = true;
    console.log(chalk.green('Polling service started successfully'));
  }
}

/**
 * Create and start a Slippi monitor
 */
async function startSlippiMonitoring(replayDir = DEFAULT_REPLAY_DIR) {
  const monitor = new SlippiMonitor({ replayDir });
  await monitor.start();
  return monitor;
}

module.exports = { 
  startSlippiMonitoring,
  SlippiMonitor
};