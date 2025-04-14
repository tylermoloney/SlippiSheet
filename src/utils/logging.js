/**
 * Load chalk dynamically
 * @returns {Object} Chalk instance
 */
async function loadChalk() {
    try {
      if (!global.chalk) {
        global.chalk = (await import('chalk')).default;
      }
      return global.chalk;
    } catch (error) {
      console.error('Error loading chalk:', error.message);
      // Fallback to plain console without colors
      return {
        blue: text => `[INFO] ${text}`,
        green: text => `[SUCCESS] ${text}`,
        yellow: text => `[WARNING] ${text}`,
        red: text => `[ERROR] ${text}`
      };
    }
  }
  
  /**
   * Log an informational message
   * @param {string} message - Message to log
   */
  async function logInfo(message) {
    const chalk = await loadChalk();
    console.log(chalk.blue(message));
  }
  
  /**
   * Log a success message
   * @param {string} message - Message to log
   */
  async function logSuccess(message) {
    const chalk = await loadChalk();
    console.log(chalk.green(message));
  }
  
  /**
   * Log a warning message
   * @param {string} message - Message to log
   */
  async function logWarning(message) {
    const chalk = await loadChalk();
    console.log(chalk.yellow(message));
  }
  
  /**
   * Log an error message
   * @param {string} message - Message to log
   */
  async function logError(message) {
    const chalk = await loadChalk();
    console.error(chalk.red(message));
  }
  
  /**
   * Log a game event with proper formatting
   * @param {string} message - Message to log
   * @param {boolean} isStart - Whether this is a start event (blue) or end event (yellow)
   * @param {boolean} includeHeader - Whether to include the separator line before the message
   * @param {boolean} includeTimestamp - Whether to include the timestamp
   * @param {boolean} includeFooter - Whether to include the separator line after the message
   */
  async function logGameEvent(message, isStart = true, includeHeader = true, includeTimestamp = true, includeFooter = true) {
    const chalk = await loadChalk();
    const color = isStart ? chalk.blue : chalk.yellow;
    
    // Only log the separator if requested
    if (includeHeader) {
      console.log(color('================================================'));
    }
    
    // Always log the message (if not empty)
    if (message) {
      console.log(color(message));
    }
    
    // Only log the timestamp if requested
    if (includeTimestamp && message) {
      console.log(color(`🕒 Time: ${new Date().toLocaleString()}`));
    }
    
    // Only log the footer separator if requested
    if (includeFooter) {
      console.log(color('================================================'));
    }
  }
  
  module.exports = {
    loadChalk,
    logInfo,
    logSuccess,
    logWarning,
    logError,
    logGameEvent
  };