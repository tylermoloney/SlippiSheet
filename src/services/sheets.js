const { google } = require('googleapis');
const config = require('../config');
const { logSuccess, logError, logInfo, logWarning } = require('../utils/logging');

/**
 * Format a private key for Google API
 * @param {string} key - The private key from env
 * @returns {string} Formatted private key
 */
function formatPrivateKey(key) {
  if (!key) return null;
  // Remove quotes if present
  const keyContent = key.replace(/^["']|["']$/g, '');
  // Replace literal '\n' with actual newlines
  return keyContent.replace(/\\n/g, '\n');
}

/**
 * Service for interacting with Google Sheets API
 */
class SheetsService {
  constructor() {
    this.spreadsheetId = config.get('SPREADSHEET_ID');
    this.sheetName = config.get('SHEET_NAME');

    try {
      // Ensure private key is properly formatted
      const privateKey = process.env.GOOGLE_PRIVATE_KEY
        ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : null;

      if (!process.env.GOOGLE_CLIENT_EMAIL || !privateKey) {
        throw new Error('Missing Google API credentials. Check your .env file.');
      }

      // Set up authentication
      this.client = new google.auth.JWT(
        process.env.GOOGLE_CLIENT_EMAIL,
        null,
        privateKey,
        ['https://www.googleapis.com/auth/spreadsheets']
      );

      // Create sheets instance
      this.sheets = google.sheets({ version: 'v4', auth: this.client });

      // Verify auth
      this.client.authorize((err) => {
        if (err) {
          console.error('Authentication error:', err.message);
        } else {
          console.log('Google Sheets authentication successful');
        }
      });
    } catch (error) {
      console.error('Error setting up Google Sheets client:', error.message);
      throw error;
    }
  }

  /**
   * Append a rating to the spreadsheet
   * @param {number} rating - The new rating to append
   * @returns {Promise<boolean>} Success status
   */
  async appendRating(rating) {
    try {

      // Validate inputs
      if (!rating && rating !== 0) {
        throw new Error('Rating value is required');
      }

      // Get current values
      const getRowsResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!B:B`,
      }).catch(err => {
        throw new Error(`Failed to get spreadsheet data: ${err.message}`);
      });

      const ratingValues = getRowsResponse.data.values || [];
      const numRows = ratingValues.length;
      const nextRow = numRows + 1;

      // Calculate rating change
      const previousRating = numRows > 0 ? parseFloat(ratingValues[numRows - 1][0]) : 0;
      const difference = rating - previousRating;

      await logInfo(`Rating change: ${parseFloat(difference).toFixed(1)}`);

      if (difference === 0) {
        await logInfo('No change in rating. Data not appended to Google Sheet');
        return false;
      }

      const currentDate = new Date().toLocaleDateString();
      const range = `${this.sheetName}!A${nextRow}:C${nextRow}`;

      await logInfo(`Appending to range: ${range}`);

      try {
        const request = {
          spreadsheetId: this.spreadsheetId,
          range,
          valueInputOption: 'RAW',
          resource: {
            values: [[currentDate, rating, difference]],
          },
        };

        await this.sheets.spreadsheets.values.append(request);

        const message = `Data appended successfully. Rating change: ${parseFloat(difference).toFixed(1)} New rating: ${parseFloat(rating).toFixed(1)}`;
        if (difference > 0) {
          await logSuccess(message);
        } else {
          await logWarning(message);
        }

        return true;
      } catch (appendError) {
        throw new Error(`Failed to append data: ${appendError.message}`);
      }
    } catch (error) {
      await logError(`Error appending data to Google Sheet: ${error.message}`);

      if (error.message.includes('permission')) {
        await logInfo('Hint: Make sure your service account has permission to edit the spreadsheet');
      } else if (error.message.includes('not found')) {
        await logInfo('Hint: Check that your spreadsheet ID is correct');
      } else if (error.message.includes('invalid_grant') || error.message.includes('authent')) {
        await logInfo('Hint: There may be an issue with your Google credentials. Check your service account key.');
      } else if (error.message.includes('limit')) {
        await logInfo('Hint: You might be hitting Google API rate limits. Consider adding delay between requests.');
      }

      throw error;
    }
  }
}

module.exports = new SheetsService();