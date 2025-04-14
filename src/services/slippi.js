const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { logInfo, logError, logSuccess } = require('../utils/logging');

/**
 * Service for interacting with the Slippi API
 */
class SlippiService {
  constructor() {
    this.apiUrl = config.get('SLIPPI_API_URL');
    this.connectCode = config.get('CONNECT_CODE');
    this.payloadTemplate = null;
    this.loadPayloadTemplate();
  }

  /**
   * Load the GraphQL payload template
   */
  loadPayloadTemplate() {
    try {
      const templatePath = path.join(process.cwd(), 'resources', 'templates', 'payload-sample.json');
      
      if (fs.existsSync(templatePath)) {
        this.payloadTemplate = require(templatePath);
      } else {
        // Use hardcoded fallback if file doesn't exist
        this.payloadTemplate = {
          "operationName": "GetConnectCode",
          "variables": {
            "cc": "",
            "uid": ""
          },
          "query": "query GetConnectCode($cc: String!) {\n  getConnectCode(code: $cc) {\n    user {\n      displayName\n      connectCode {\n        code\n        __typename\n      }\n      rankedNetplayProfile {\n        id\n        ratingOrdinal\n        wins\n        losses\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n"
        };
      }
    } catch (error) {
      logError(`Failed to load payload template: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch player rating from the Slippi API
   * @param {string} connectCode - Player's connect code
   * @returns {Promise<number>} The player's rating
   */
  async fetchPlayerRating(connectCode = null) {
    try {
      const code = connectCode || this.connectCode;
      
      if (!code) {
        throw new Error('Connect code not configured');
      }
      
      await logInfo('Fetching data from Slippi API...');
      
      // Create a fresh copy of the payload
      const payload = JSON.parse(JSON.stringify(this.payloadTemplate));
      payload.variables.cc = code;
      payload.variables.uid = code;
      
      const response = await axios.post(this.apiUrl, payload);
      
      if (!response.data?.data?.getConnectCode?.user?.rankedNetplayProfile) {
        throw new Error('Invalid response structure from Slippi API');
      }
      
      const data = response.data.data.getConnectCode.user.rankedNetplayProfile.ratingOrdinal;
      const roundedData = parseFloat(data.toFixed(1));
      
      await logSuccess(`Data fetched successfully. Rating: ${roundedData}`);
      return roundedData;
    } catch (error) {
      await logError(`Error fetching player rating: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new SlippiService();