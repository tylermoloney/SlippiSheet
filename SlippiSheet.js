const { startSlippiMonitoring } = require('./SlippiMonitor'); // Rename file as well

async function initialize() {
  try {
    console.log('Starting SlippiSheet...');
    await startSlippiMonitoring();
    console.log('SlippiSheet initialization complete.');
  } catch (error) {
    console.error('Initialization failed:', error);
  }
}

// Start the application
initialize();

process.on('SIGINT', () => {
  console.log('Shutting down SlippiSheet...');
  process.exit(0);
});