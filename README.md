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

## Setup

### 1. Install Dependencies
This project uses Yarn as its package manager:

```yarn install``` - Install dependencies
### 2. Configure Google Sheets Access
1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Google Sheets API
3. Create a service account and download the credentials as JSON
4. Save this file as `credentials.json` in the project root
5. Share your Google Sheet with the service account email

### 3. Configure Slippi Connect Code
1. Create a file named `payload.json` based on the sample:
```cp payload-sample.json payload.json```
2. Replace `<ABCD#123>` with your own Slippi connect code

### 4. Start the Application
```yarn start```


## How It Works
The application monitors your Slippi replay folder for new games. When a game ends, it:
1. Waits for the rating to update on the Slippi server
2. Fetches your updated rating
3. Adds it to your Google Sheet with a timestamp
4. Shows the rating change in the console

## Troubleshooting
- If games aren't being detected, verify your Slippi replays are saving to the expected location
- For Google Sheets errors, make sure your service account has edit access to the spreadsheet