const express = require('express');
const open = require('open');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const config = require('../src/config');
const { logSuccess, logInfo, logWarning, logError } = require('../src/utils/logging');

const app = express();
const PORT = 3000;

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let browserConnected = false;
let shutdownTimer = null;

wss.on('connection', (ws) => {
    browserConnected = true;
    logInfo('Browser connected');

    if (shutdownTimer) {
        clearTimeout(shutdownTimer);
        shutdownTimer = null;
    }

    ws.on('close', () => {
        browserConnected = false;
        logInfo('Browser disconnected');
        shutdownTimer = setTimeout(() => {
            logWarning('Browser closed. Shutting down setup server...');
            server.close(() => process.exit(0));
        }, 3000);
    });

    // Check every 5 seconds if connected
    const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'heartbeat' }));
        } else {
            clearInterval(interval);
        }
    }, 5000);
});


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

app.get('/api/config', (req, res) => {
    const currentConfig = {
      connectCode: config.get('CONNECT_CODE'),
      replayDir: config.get('REPLAY_DIR'),
      dolphinPort: config.get('DOLPHIN_PORT'),
      spreadsheetId: config.get('SPREADSHEET_ID'),
      sheetName: config.get('SHEET_NAME')
    };
    
    res.json(currentConfig);
  });


app.post('/api/config', (req, res) => {
    const updates = req.body;

    const configUpdates = {
        CONNECT_CODE: updates.connectCode,
        REPLAY_DIR: updates.replayDir,
        DOLPHIN_PORT: updates.dolphinPort,
        SPREADSHEET_ID: updates.spreadsheetId,
        SHEET_NAME: updates.sheetName
    };
    
    // Validate connect code format
    if (updates.connectCode && !/^[A-Z0-9]{4}#[0-9]{1,3}$/.test(updates.connectCode)) {
        return res.status(400).json({ error: 'Invalid connect code format. Expected: ABCD#123' });
    }

    // Save configuration
    const success = config.saveConfig(configUpdates);

    if (success) {
        logSuccess('Configuration saved successfully');
        res.json({ success: true, message: 'Configuration saved successfully' });
    } else {
        logError('Failed to save configuration');
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

app.post('/api/shutdown', (req, res) => {
    res.json({ message: 'Server shutting down...' });
    setTimeout(() => {
      server.close(() => process.exit(0));
    }, 1000);
  });

  server.listen(PORT, () => {
    logInfo(`Setup server running on http://localhost:${PORT}`);
    logInfo('Opening browser for setup...');
    
    open(`http://localhost:${PORT}`).catch(err => {
      logWarning(`Could not automatically open browser: ${err.message}`);
      logInfo(`Please manually open: http://localhost:${PORT}`);
    });
    
    // Set a timeout to exit if browser doesn't connect
    setTimeout(() => {
      if (!browserConnected) {
        logWarning('No browser connection detected. Please make sure you have opened the setup page in your browser.');
      }
    }, 10000);
  });