const axios = require('axios');
const Sentiment = require('sentiment');

const sentiment = new Sentiment();

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { symbol, query } = JSON.parse(event.body);
    
    if (!symbol) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Symbol is required' })
      };
    }

    const analysis = await analyzeAsset(symbol.toUpperCase(), query);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(analysis)
    };
  } catch (error) {
    console.error('Analysis error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Analysis failed' })
    };
  }
};

async function analyzeAsset(symbol, userQuery) {
  const analysis = {
    symbol: symbol,
    timestamp: new Date().toISOString(),
    sentiment: null,
    news: null,
    technical: null,
    fundamental: null,
    summary: ''
  };

  try {
    const [technicalData, fundamentalData] = await Promise.all([
      getTechnicalAnalysis(symbol),
      getFundamentalAnalysis(symbol)
    ]);

    analysis.technical = technicalData;
    analysis.fundamental = fundamentalData;
    analysis.sentiment = { score: 0, message: 'Sentiment analysis available with News API key' };
    analysis.news = { articles: [], summary: 'News analysis available with News API key' };
    analysis.summary = generateSummary(analysis, userQuery);

    return analysis;
  } catch (error) {
    console.error('Error in analyzeAsset:', error);
    throw error;
  }
}

async function getTechnicalAnalysis(symbol) {
  try {
    const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (!alphaVantageKey) {
      return {
        price: 'N/A',
        change: 'N/A',
        volume: 'N/A',
        indicators: {},
        message: 'Alpha Vantage API key not configured'
      };
    }

    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${alphaVantageKey}`;
    const response = await axios.get(url);
    const data = response.data;

    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }

    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) {
      throw new Error('No time series data available');
    }

    const dates = Object.keys(timeSeries).sort().reverse();
    const latestDate = dates[0];
    const previousDate = dates[1];

    const latest = timeSeries[latestDate];
    const previous = timeSeries[previousDate];

    const currentPrice = parseFloat(latest['4. close']);
    const previousPrice = parseFloat(previous['4. close']);
    const change = currentPrice - previousPrice;
    const changePercent = (change / previousPrice) * 100;

    const prices = dates.slice(0, 20).map(date => parseFloat(timeSeries[date]['4. close']));
    const sma20 = prices.reduce((sum, price) => sum + price, 0) / prices.length;

    return {
      price: currentPrice.toFixed(2),
      change: change.toFixed(2),
      changePercent: changePercent.toFixed(2),
      volume: latest['5. volume'],
      indicators: {
        sma20: sma20.toFixed(2),
        trend: currentPrice > sma20 ? 'Bullish' : 'Bearish'
      },
      message: interpretTechnicalAnalysis(changePercent, currentPrice, sma20)
    };
  } catch (error) {
    console.error('Technical analysis error:', error);
    return {
      price: 'N/A',
      change: 'N/A',
      volume: 'N/A',
      indicators: {},
      message: 'Unable to fetch technical data'
    };
  }
}

async function getFundamentalAnalysis(symbol) {
  try {
    const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (!alphaVantageKey) {
      return {
        marketCap: 'N/A',
        peRatio: 'N/A',
        dividendYield: 'N/A',
        message: 'Alpha Vantage API key not configured'
      };
    }

    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${alphaVantageKey}`;
    const response = await axios.get(url);
    const data = response.data;

    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }

    return {
      marketCap: data['MarketCapitalization'] || 'N/A',
      peRatio: data['PERatio'] || 'N/A',
      dividendYield: data['DividendYield'] || 'N/A',
      eps: data['EPS'] || 'N/A',
      bookValue: data['BookValue'] || 'N/A',
      message: interpretFundamentals(data)
    };
  } catch (error) {
    console.error('Fundamental analysis error:', error);
    return {
      marketCap: 'N/A',
      peRatio: 'N/A',
      dividendYield: 'N/A',
      message: 'Unable to fetch fundamental data'
    };
  }
}

function interpretTechnicalAnalysis(changePercent, currentPrice, sma20) {
  let message = '';
  if (changePercent > 2) message = 'Strong upward momentum today. ';
  else if (changePercent > 0) message = 'Positive movement today. ';
  else if (changePercent < -2) message = 'Significant decline today. ';
  else if (changePercent < 0) message = 'Slight downward pressure. ';
  else message = 'Flat trading today. ';

  if (currentPrice > sma20) message += 'Price is above 20-day average, indicating short-term strength.';
  else message += 'Price is below 20-day average, suggesting short-term weakness.';

  return message;
}

function interpretFundamentals(data) {
  const pe = parseFloat(data['PERatio']);
  const divYield = parseFloat(data['DividendYield']);
  
  let message = '';
  if (pe && pe > 0) {
    if (pe < 15) message += 'Low P/E ratio suggests potential value. ';
    else if (pe > 25) message += 'High P/E ratio indicates growth expectations or overvaluation. ';
    else message += 'Moderate P/E ratio. ';
  }

  if (divYield && divYield > 0) {
    if (divYield > 4) message += 'High dividend yield attractive for income investors.';
    else if (divYield > 2) message += 'Decent dividend yield.';
    else message += 'Low dividend yield.';
  }

  return message || 'Fundamental data analysis complete.';
}

function generateSummary(analysis, userQuery) {
  const { technical, fundamental } = analysis;
  
  let summary = `**${analysis.symbol} Analysis Summary:**\n\n`;
  
  if (technical.price !== 'N/A') {
    summary += `💰 **Current Price:** $${technical.price} (${technical.change >= 0 ? '+' : ''}${technical.change}, ${technical.changePercent}%)\n`;
    summary += `📈 **Technical:** ${technical.message}\n`;
  }
  
  if (fundamental.peRatio !== 'N/A') {
    summary += `📊 **Fundamentals:** P/E: ${fundamental.peRatio}, Market Cap: ${fundamental.marketCap}\n`;
  }

  summary += `\n*Analysis completed at ${new Date().toLocaleTimeString()}*`;
  
  return summary;
}
