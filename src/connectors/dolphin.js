const { ConnectionEvent } = require('@slippi/slippi-js');
const { SlpLiveStream, SlpRealTime } = require('@vinceau/slp-realtime');
const { logSuccess, logError, logInfo, logGameEvent } = require('../utils/logging');

/**
 * Handles connections to Dolphin for retrieving real-time game data
 */
class DolphinConnector {
  constructor(config) {
    this.port = config.get('DOLPHIN_PORT');
    this.stream = null;
    this.realtime = null;
    this.startSubscription = null;
    this.endSubscription = null;
    this.currentPlayers = [];
    this.connected = false;
    this.onGameStart = null;
    this.onGameEnd = null;
  }

  /**
   * Connect to Dolphin and set up event handlers
   * @returns {Promise<boolean>} Whether connection was successful
   */
  async connect() {
    try {
      await logInfo(`Setting up direct connection to Dolphin on port ${this.port}...`);
      
      this.stream = new SlpLiveStream('dolphin');
      this.realtime = new SlpRealTime();
      this.realtime.setStream(this.stream);
      
      // Set up event handlers
      this.setupGameHandlers();
      this.setupConnectionHandlers();
      
      // Start the connection
      await this.stream.start('127.0.0.1', this.port);
      
      return true;
    } catch (err) {
      await logError(`Failed to connect to Dolphin: ${err.message}`);
      return false;
    }
  }

  /**
   * Set up game start and end event handlers
   */
  setupGameHandlers() {
    // Game start handler
    this.startSubscription = this.realtime.game.start$.subscribe(async ({ players }) => {
      await logGameEvent('🎮 GAME STARTED via Dolphin connection', true, true, true, false);
      
      // Log player information without separators or timestamps
      this.currentPlayers = [];
      if (players && players.length) {
        players.forEach(async (player, index) => {
          if (player && player.displayName !== undefined) {
            this.currentPlayers[index] = player;
            await logInfo(`Player ${index + 1}: ${player.displayName}`);
          }
        });
      }
      
      // Add footer
      await logGameEvent('', true, false, false, true);
      
      if (this.onGameStart) {
        this.onGameStart(players);
      }
    });
    
    // Game end handler
    this.endSubscription = this.realtime.game.end$.subscribe(async (data) => {
      // Log game end with header
      await logGameEvent('🏁 GAME ENDED via Dolphin connection', false, true, true, false);

      if (data.winnerPlayerIndex !== undefined) {
        // Get the winner's display name if available
        const winnerIndex = data.winnerPlayerIndex;
        let winnerDisplay = `Player ${winnerIndex + 1}`;

        if (this.currentPlayers[winnerIndex] &&
            this.currentPlayers[winnerIndex].displayName) {
          winnerDisplay = this.currentPlayers[winnerIndex].displayName;
        }

        // Log winner
        await logGameEvent(`🏆 Winner: ${winnerDisplay}`, false, false, false, false);
      }
      
      // Add footer
      await logGameEvent('', false, false, false, true);
      
      if (this.onGameEnd) {
        this.onGameEnd(data);
      }
    });
  }

  /**
   * Set up connection event handlers
   */
  setupConnectionHandlers() {
    this.stream.connection.on(ConnectionEvent.ERROR, async (err) => {
      await logError(`Connection error: ${err}`);
      if (this.connected) {
        this.connected = false;
        this.cleanup();
      }
    });

    this.stream.connection.once(ConnectionEvent.CONNECT, async () => {
      await logSuccess(`Successfully connected to Dolphin on port ${this.port}`);
      this.connected = true;
    });

    this.stream.connection.on(ConnectionEvent.DISCONNECT, async () => {
      await logError('Disconnected from Dolphin');
      if (this.connected) {
        this.connected = false;
        this.cleanup();
      }
    });
  }

  /**
   * Clean up resources on disconnect
   */
  cleanup() {
    try {
      // Unsubscribe from observables
      if (this.startSubscription) {
        this.startSubscription.unsubscribe();
        this.startSubscription = null;
      }
      
      if (this.endSubscription) {
        this.endSubscription.unsubscribe();
        this.endSubscription = null;
      }
      
      // Clean up connection
      if (this.stream && this.stream.connection) {
        this.stream.connection.removeAllListeners();
        
        if (this.stream.connection.connected) {
          this.stream.connection.disconnect();
        }
      }
      
      // Stop the stream
      if (this.stream && typeof this.stream.stop === 'function') {
        this.stream.stop();
      }
      
      // Reset state
      this.currentPlayers = [];
      this.stream = null;
      this.realtime = null;
    } catch (err) {
      logError(`Error during cleanup: ${err.message}`);
    }
  }

  /**
   * Set callback for game start events
   * @param {Function} callback - The callback function
   */
  setGameStartHandler(callback) {
    this.onGameStart = callback;
  }

  /**
   * Set callback for game end events
   * @param {Function} callback - The callback function
   */
  setGameEndHandler(callback) {
    this.onGameEnd = callback;
  }
}

module.exports = DolphinConnector;