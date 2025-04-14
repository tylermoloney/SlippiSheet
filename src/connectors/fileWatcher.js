const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { logInfo, logError, logSuccess, logGameEvent } = require('../utils/logging');
/**
 * Monitors the filesystem for new Slippi replay files
 */
class FileWatcher {
  constructor(config) {
    this.replayDir = config.get('REPLAY_DIR');
    this.checkInterval = config.get('FILE_CHECK_INTERVAL');
    this.watcher = null;
    this.isWatching = false;
    this.onGameProcessed = null;
    this.onGameStarted = null;  // Add callback for game start
    this.processedFiles = new Set();
    this.inProgressFiles = new Set(); // Track files being written
    this.startTime = null;
  }

  /**
   * Get the current month's replay folder
   * @returns {string} Path to the current month's replay folder
   */
  getCurrentMonthFolder() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const monthlyFolder = `${year}-${month}`;
    return path.join(this.replayDir, monthlyFolder);
  }

  /**
   * Start watching for new replay files
   */
  async start() {
    if (this.isWatching) return;

    try {
      // Record the start time to filter out old files
      this.startTime = Date.now();
      await logInfo('Recording start time: ' + new Date(this.startTime).toLocaleString());
      
      const monthFolder = this.getCurrentMonthFolder();
      await logInfo(`Starting file watcher for replay directory: ${monthFolder}`);
      
      // Create the folder if it doesn't exist
      if (!fs.existsSync(monthFolder)) {
        await logInfo(`Replay folder does not exist, creating: ${monthFolder}`);
        fs.mkdirSync(monthFolder, { recursive: true });
      }
      
      // Set up file watcher with two separate watchers:
      // 1. One for detecting the creation of files (game start)
      // 2. One for detecting when files are finished writing (game end)
      
      // Watcher for game start detection - no awaitWriteFinish
      this.startWatcher = chokidar.watch(monthFolder, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true
      });
      
      // Watcher for game end detection - with awaitWriteFinish
      this.watcher = chokidar.watch(monthFolder, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100
        }
      });
      
      // Game start detection (immediate file creation)
      this.startWatcher.on('add', async (filePath) => {
        try {
          // Only process .slp files that we haven't seen starting yet
          if (path.extname(filePath) === '.slp' && 
              !this.inProgressFiles.has(filePath) && 
              !this.processedFiles.has(filePath)) {
            
            // Get file stats to check creation time
            const stats = fs.statSync(filePath);
            
            // Only process files created after the watcher started
            if (stats.birthtimeMs > this.startTime) {
              this.inProgressFiles.add(filePath);
              await logInfo(`Game started: ${path.basename(filePath)}`);
              await logGameEvent(`🎮 GAME STARTED - new file detected: ${path.basename(filePath)}`, true);
              
              // Extract player info if possible (can be basic for now)
              const filename = path.basename(filePath);
              const match = filename.match(/Game_(\d{8}T\d{6})\.slp/);
              if (match) {
                const dateStr = match[1];
                const year = dateStr.substring(0, 4);
                const month = dateStr.substring(4, 6);
                const day = dateStr.substring(6, 8);
                const hours = dateStr.substring(9, 11);
                const minutes = dateStr.substring(11, 13);
                const seconds = dateStr.substring(13, 15);
                const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                await logInfo(`Game timestamp: ${formattedDate}`);
              }
              
              if (this.onGameStarted) {
                this.onGameStarted(filePath);
              }
            }
          }
        } catch (err) {
          await logError(`Error detecting game start for ${filePath}: ${err.message}`);
        }
      });
      
      // Game end detection (file finished writing)
      this.watcher.on('add', async (filePath) => {
        try {
          // Only process .slp files that haven't been fully processed yet
          if (path.extname(filePath) === '.slp' && !this.processedFiles.has(filePath)) {
            // Get file stats to check creation time
            const stats = fs.statSync(filePath);
            
            // Only process files created after the watcher started
            if (stats.birthtimeMs > this.startTime) {
              this.processedFiles.add(filePath);
              this.inProgressFiles.delete(filePath); // Remove from in-progress
              
              await logInfo(`Game ended: ${path.basename(filePath)}`);
              await logGameEvent(`🏁 GAME ENDED - file complete: ${path.basename(filePath)}`, false);
              
              if (this.onGameProcessed) {
                this.onGameProcessed(filePath);
              }
            } else {
              await logInfo(`Skipping existing file: ${path.basename(filePath)}`);
            }
          }
        } catch (err) {
          await logError(`Error processing file ${filePath}: ${err.message}`);
        }
      });
      
      this.isWatching = true;
      await logSuccess(`File watcher started successfully`);
            
      return true;
    } catch (error) {
      await logError(`Error starting file watcher: ${error.message}`);
      return false;
    }
  }

  /**
   * Stop watching for new files
   */
  async stop() {
    if (!this.isWatching) return;
    
    try {
      if (this.watcher) {
        await this.watcher.close();
      }
      
      if (this.startWatcher) {
        await this.startWatcher.close();
      }
      
      this.isWatching = false;
      await logInfo('File watcher stopped');
    } catch (error) {
      await logError(`Error stopping file watcher: ${error.message}`);
    }
  }

  /**
   * Set callback for when a game ends (file completely written)
   * @param {Function} callback - The callback function
   */
  onGameComplete(callback) {
    this.onGameProcessed = callback;
  }
  
  /**
   * Set callback for when a game starts (file creation begins)
   * @param {Function} callback - The callback function
   */
  onGameStart(callback) {
    this.onGameStarted = callback;
  }

  /**
   * Reset the processed files cache
   */
  resetCache() {
    this.processedFiles.clear();
    this.inProgressFiles.clear();
  }
}

module.exports = FileWatcher;