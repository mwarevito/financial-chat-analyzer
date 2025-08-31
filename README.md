# Financial Chat Analyzer 💹

A real-time chat-based financial analysis tool that provides sentiment analysis, news updates, technical analysis, and fundamental data for stocks and assets.

## Features

- **💬 Interactive Chat Interface**: Clean, modern chat UI for natural conversations
- **📈 Technical Analysis**: Real-time price data, moving averages, and trend analysis
- **🎭 Sentiment Analysis**: AI-powered sentiment analysis from recent news headlines
- **📰 News Integration**: Latest news articles and their impact analysis
- **📊 Fundamental Analysis**: Key financial metrics like P/E ratio, market cap, dividend yield
- **⚡ Real-time Updates**: WebSocket-based real-time communication

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up API keys:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your API keys:
   - **Alpha Vantage API**: Get free key at https://www.alphavantage.co/support/#api-key
   - **News API**: Get free key at https://newsapi.org/register

3. **Run the application:**
   ```bash
   npm start
   ```

4. **Open your browser** and go to `http://localhost:3000`

## Usage

Simply type questions about stocks in the chat:
- "What's the outlook for AAPL?"
- "Analyze TSLA sentiment"
- "Give me technical analysis for MSFT"
- "How is GOOGL performing?"

## Tech Stack

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **APIs**: Alpha Vantage (financial data), News API (news & sentiment)
- **Real-time**: WebSocket communication

## API Keys Required

- **Alpha Vantage**: For stock prices, technical indicators, and fundamental data
- **News API**: For news articles and sentiment analysis

Both offer free tiers suitable for development and testing.

## Project Structure

```
├── server.js                 # Main server file
├── services/
│   └── financialAnalyzer.js  # Core analysis logic
├── public/
│   ├── index.html           # Main chat interface
│   ├── styles.css           # UI styling
│   └── app.js               # Frontend JavaScript
├── package.json             # Dependencies
└── .env.example             # Environment variables template
```
