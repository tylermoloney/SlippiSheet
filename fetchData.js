const { google } = require('googleapis');
const axios = require('axios');
require('dotenv').config();

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SLIPPI_API_URL = process.env.SLIPPI_API_URL;
const keys = require('./slippisheetcredentials.json');
const SHEET_NAME = 'Season 2';
const payload = require('./payload.json');

let chalk;
async function loadChalk() {
  if (!chalk) {
    chalk = (await import('chalk')).default;
  }
  return chalk;
}

async function fetchDataAndAppend() {
  const chalk = await loadChalk();
  try {
    console.log(chalk.blue('Fetching data from Slippi API...'));

    const response = await axios.post(SLIPPI_API_URL, payload);
    if (!response.data?.data?.getConnectCode?.user?.rankedNetplayProfile) {
      throw new Error('Invalid response structure from Slippi API');
    }

    const data = response.data.data.getConnectCode.user.rankedNetplayProfile.ratingOrdinal;
    const roundedData = parseFloat(data.toFixed(1));
    console.log(chalk.green('Data fetched successfully. Rating: ' + roundedData));
    await appendToGoogleSheet(roundedData);
  } catch (error) {
    console.error(chalk.red(`Error fetching/processing data: ${error.message}`));
  }
}

// Append data to Google Sheet
async function appendToGoogleSheet(data) {
  const chalk = await loadChalk();
  console.log(chalk.blue('Beginning appendToGoogleSheet...'));
  const client = new google.auth.JWT(
    keys.client_email,
    null,
    keys.private_key.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  const sheets = google.sheets({ version: 'v4', auth: client });

  try {
    // Get the last row in column B (rating column)
    const getRowsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!B:B`,
    });

    const ratingValues = getRowsResponse.data.values || [];
    const numRows = ratingValues.length;
    const nextRow = numRows + 1;

    // Calculate rating change
    const previousRating = numRows > 0 ? parseFloat(getRowsResponse.data.values[numRows - 1][0]) : 0;
    const difference = data - previousRating;
    
    console.log('Rating change:', parseFloat(difference).toFixed(1));

    if (difference === 0) {
      const message = 'No change in rating. Data not appended to Google Sheet';
      console.log(`${message}: ${new Date().toLocaleTimeString()}`);
      return;
    }  

    const logColor = difference > 0 ? chalk.green : chalk.red;
    const currentDate = new Date().toLocaleDateString();
    const range = `${SHEET_NAME}!A${nextRow}:C${nextRow}`;

    const request = {
      spreadsheetId: SPREADSHEET_ID,
      range,      
      valueInputOption: 'RAW',
      resource: {
        values: [[currentDate, data, difference]],
      },
    };

    await sheets.spreadsheets.values.append(request);
    const message = 'Data appended successfully. Rating change: ' + parseFloat(difference).toFixed(1) + ' New rating: ' + parseFloat(data).toFixed(1);
    console.log(logColor(`${message}: ${new Date().toLocaleString()}`));
  } catch (error) {
    console.error('Error appending data to Google Sheet:', error);
  }
}

module.exports = { fetchDataAndAppend, appendToGoogleSheet };