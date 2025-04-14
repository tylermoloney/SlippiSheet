# SlippiSheet

Track your Super Smash Bros. Melee Slippi ratings automatically in Google Sheets.

## Features
- Automatically detects when Slippi games end
- Retrieves your latest rating from the Slippi API
- Records ratings and changes to your Google Sheet
- Works in the background while you play

## Prerequisites
- Node.js 16.x or higher
- A Google Sheet set up to record your data
- Google Cloud Platform credentials

## Modes of Operation
SlippiSheet uses two methods of tracking current games.
1. **Dolphin Direct Connection**: Connects directly to Dolphin for real-time game detection (preferred)
2. **File watcher**: Monitors your replay folder for new game files (Fallback option)

The application attempts to use Dolphin connection first, and falls back to file watcher if unsuccessful.


## Setup

Clone the repository
```bash 
git clone https://github.com/tylermoloney/SlippiSheet.git
cd SlippiSheet
```

### 1. Install Dependencies
This project uses Yarn as its package manager:

```bash
yarn install
```

### 2. Configure Google Sheets Access
1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Google Sheets API
3. Create a service account and download the credentials as JSON
4. Extract the email and private key from the credentials file

### 3. Configure Environment Variables
Create a .env file with the following variables:

```
SPREADSHEET_ID=your_spreadsheet_id_here
SLIPPI_API_URL=https://gql-gateway-2-dot-slippi.uc.r.appspot.com/graphql
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
SHEET_NAME=Sheet1
```

- Make sure to share your Google Sheet with the service account email address

### 4. Configure Slippi Connect Code
Run the setup script and follow the prompts. You will need:
- Your Slippi connect code (e.g. ABCD#123)
- Google Spreadsheet ID
- Sheet name

```bash
yarn setup
```

### 5. Start the Application

```bash
yarn start
```

## How It Works
The application connects to your Slippi Dolphin instance. If for some reason it cannot, it will watch your Slippi replay folder for new games. When a game ends, it:
1. Waits for the rating to update on the Slippi server
2. Fetches your updated rating
3. Adds it to your Google Sheet with a timestamp
4. Shows the rating change in the console

## Troubleshooting
- If games aren't being detected, verify your Slippi replays are saving to the expected location
- For Google Sheets errors, make sure your service account has edit access to the spreadsheet
- If you see authentication errors, check that your GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY are correctly formatted in the .env file

## Sample Output

```
================================================
GAME STARTED via Dolphin connection
🕒 Time: 4/13/2025, 11:01:43 PM
Player 1: tyler
Player 2: Player2
================================================

================================================
🏁 GAME ENDED via Dolphin connection
🕒 Time: 4/13/2025, 11:06:33 PM
🏆 Winner: tyler
================================================

Checking for rating updates...
Fetching data from Slippi API...
Data fetched successfully. Rating: 1133.9
Rating change: 17.7
Data appended successfully. Rating change: 17.7 New rating: 1133.9: 4/13/2025, 11:06:39 PM
Rating data processed successfully
```
## Known Issues
When running in file watcher mode, you may see an error after about 1 minute of running related to **enet\lib\Host.js**. These errors are normal and can be ignored because:
1. The application tries to connect to Dolphin first before falling back to file watcher mode.
2. When the connection fails, the enet networking library logs the errors.
3. The error does not affect the file watcher functionality.