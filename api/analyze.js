// Using built-in fetch instead of axios for better Vercel compatibility

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { symbol, query } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const analysis = await analyzeAsset(symbol.toUpperCase(), query);
    
    return res.status(200).json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({ error: 'Analysis failed' });
  }
}

async function analyzeAsset(symbol, userQuery) {
  const analysis = {
    symbol: symbol,
    timestamp: new Date().toISOString(),
    sentiment: null,
    news: null,
    technical: null,
    fundamental: null,
    recommendation: null,
    summary: ''
  };

  try {
    const [technicalData, fundamentalData, newsData] = await Promise.all([
      getTechnicalAnalysis(symbol),
      getFundamentalAnalysis(symbol),
      getNewsAnalysis(symbol)
    ]);

    analysis.technical = technicalData;
    analysis.fundamental = fundamentalData;
    analysis.sentiment = getSentimentFromNews(newsData);
    analysis.news = newsData;
    analysis.recommendation = generateRecommendation(technicalData, fundamentalData, getSentimentFromNews(newsData));
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
    const response = await fetch(url);
    const data = await response.json();

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
      message: 'Unable to fetch technical data: ' + error.message
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
    const response = await fetch(url);
    const data = await response.json();

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
      message: 'Unable to fetch fundamental data: ' + error.message
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
  const { technical, fundamental, sentiment } = analysis;
  
  let summary = `**${analysis.symbol} Analysis Summary:**\n\n`;
  
  if (technical.price !== 'N/A') {
    summary += `💰 **Current Price:** $${technical.price} (${technical.change >= 0 ? '+' : ''}${technical.change}, ${technical.changePercent}%)\n`;
    summary += `📈 **Technical:** ${technical.message}\n`;
  }
  
  // Recommendation (prominent placement)
  if (analysis.recommendation) {
    summary += `\n🎯 **RECOMMENDATION: ${analysis.recommendation.action}**\n`;
    summary += `📊 **Confidence:** ${analysis.recommendation.confidence} | **Risk:** ${analysis.recommendation.riskLevel}\n`;
    summary += `💡 **Analysis:** ${analysis.recommendation.message}\n\n`;
  }
  
  // Sentiment
  if (sentiment.score !== undefined) {
    summary += `🎭 **Sentiment:** ${sentiment.message}\n`;
  }
  
  // News count
  if (analysis.news.articles.length > 0) {
    summary += `📰 **News:** ${analysis.news.articles.length} recent articles found\n`;
  }
  
  if (fundamental.peRatio !== 'N/A') {
    summary += `📊 **Fundamentals:** P/E: ${fundamental.peRatio}, Market Cap: ${fundamental.marketCap}\n`;
  }

  summary += `\n*Analysis completed at ${new Date().toLocaleTimeString()}*`;
  
  return summary;
}

async function getNewsAnalysis(symbol) {
  try {
    const newsApiKey = process.env.NEWS_API_KEY;
    
    if (!newsApiKey) {
      return {
        articles: [],
        summary: 'News API key not configured. Please add NEWS_API_KEY to environment variables.'
      };
    }

    const url = `https://newsapi.org/v2/everything?q=${symbol}&sortBy=publishedAt&pageSize=5&apiKey=${newsApiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'error') {
      throw new Error(data.message);
    }

    const articles = data.articles || [];

    return {
      articles: articles.map(article => ({
        title: article.title,
        description: article.description,
        url: article.url,
        publishedAt: article.publishedAt,
        source: article.source.name
      })),
      summary: `Found ${articles.length} recent news articles about ${symbol}`
    };
  } catch (error) {
    console.error('News analysis error:', error);
    return {
      articles: [],
      summary: 'Unable to fetch news data: ' + error.message
    };
  }
}

function getSentimentFromNews(newsData) {
  if (!newsData.articles || newsData.articles.length === 0) {
    return {
      score: 0,
      message: 'No news articles available for sentiment analysis'
    };
  }

  // Simple sentiment analysis based on keywords
  let positiveWords = ['growth', 'profit', 'increase', 'rise', 'gain', 'strong', 'beat', 'exceed', 'positive', 'up'];
  let negativeWords = ['loss', 'decline', 'fall', 'drop', 'weak', 'miss', 'negative', 'down', 'concern', 'risk'];
  
  let totalScore = 0;
  let headlines = [];

  newsData.articles.forEach(article => {
    if (article.title) {
      const title = article.title.toLowerCase();
      let score = 0;
      
      positiveWords.forEach(word => {
        if (title.includes(word)) score += 1;
      });
      
      negativeWords.forEach(word => {
        if (title.includes(word)) score -= 1;
      });
      
      totalScore += score;
      headlines.push({
        title: article.title,
        sentiment: score,
        url: article.url
      });
    }
  });

  const avgScore = newsData.articles.length > 0 ? totalScore / newsData.articles.length : 0;
  
  let message;
  if (avgScore > 0.5) message = 'Very Positive sentiment in recent news';
  else if (avgScore > 0) message = 'Positive sentiment in recent news';
  else if (avgScore === 0) message = 'Neutral sentiment in recent news';
  else if (avgScore > -0.5) message = 'Negative sentiment in recent news';
  else message = 'Very Negative sentiment in recent news';

  return {
    score: Math.round(avgScore * 100) / 100,
    message: message,
    headlines: headlines.slice(0, 5)
  };
}

function generateRecommendation(technical, fundamental, sentiment) {
  let score = 0;
  let reasons = [];
  let riskFactors = [];
  
  // Technical Analysis Scoring (40% weight)
  if (technical.price !== 'N/A') {
    const changePercent = parseFloat(technical.changePercent);
    const currentPrice = parseFloat(technical.price);
    const sma20 = parseFloat(technical.indicators.sma20);
    
    // Price momentum
    if (changePercent > 3) {
      score += 2;
      reasons.push('Strong upward momentum (+3%)');
    } else if (changePercent > 0) {
      score += 1;
      reasons.push('Positive price movement');
    } else if (changePercent < -3) {
      score -= 2;
      reasons.push('Significant price decline (-3%)');
      riskFactors.push('Recent sharp decline');
    } else if (changePercent < 0) {
      score -= 1;
      reasons.push('Negative price movement');
    }
    
    // Trend analysis
    if (currentPrice > sma20 * 1.02) {
      score += 1;
      reasons.push('Price above 20-day average');
    } else if (currentPrice < sma20 * 0.98) {
      score -= 1;
      reasons.push('Price below 20-day average');
      riskFactors.push('Below short-term trend');
    }
  }
  
  // Fundamental Analysis Scoring (40% weight)
  if (fundamental.peRatio !== 'N/A') {
    const pe = parseFloat(fundamental.peRatio);
    if (pe > 0) {
      if (pe < 15) {
        score += 2;
        reasons.push('Attractive P/E ratio (value play)');
      } else if (pe < 25) {
        score += 1;
        reasons.push('Reasonable P/E ratio');
      } else if (pe > 40) {
        score -= 1;
        reasons.push('High P/E ratio (expensive)');
        riskFactors.push('High valuation risk');
      }
    }
  }
  
  // Dividend yield consideration
  if (fundamental.dividendYield !== 'N/A') {
    const divYield = parseFloat(fundamental.dividendYield);
    if (divYield > 3) {
      score += 1;
      reasons.push('Good dividend yield');
    }
  }
  
  // Sentiment Analysis Scoring (20% weight)
  if (sentiment.score > 0.5) {
    score += 1;
    reasons.push('Positive market sentiment');
  } else if (sentiment.score < -0.5) {
    score -= 1;
    reasons.push('Negative market sentiment');
    riskFactors.push('Poor news sentiment');
  }
  
  // Generate recommendation
  let recommendation, confidence, action;
  
  if (score >= 3) {
    recommendation = 'BUY';
    action = '🟢 Strong Buy';
    confidence = 'High';
  } else if (score >= 1) {
    recommendation = 'BUY';
    action = '🟢 Buy';
    confidence = 'Medium';
  } else if (score >= -1) {
    recommendation = 'HOLD';
    action = '🟡 Hold';
    confidence = 'Medium';
  } else if (score >= -3) {
    recommendation = 'SELL';
    action = '🔴 Sell';
    confidence = 'Medium';
  } else {
    recommendation = 'SELL';
    action = '🔴 Strong Sell';
    confidence = 'High';
  }
  
  // Risk Assessment
  let riskLevel;
  if (riskFactors.length >= 3) {
    riskLevel = 'High';
  } else if (riskFactors.length >= 1) {
    riskLevel = 'Medium';
  } else {
    riskLevel = 'Low';
  }
  
  return {
    recommendation: recommendation,
    action: action,
    confidence: confidence,
    score: score,
    riskLevel: riskLevel,
    reasons: reasons.slice(0, 4),
    riskFactors: riskFactors.slice(0, 3),
    message: generateRecommendationMessage(recommendation, confidence, riskLevel)
  };
}

function generateRecommendationMessage(recommendation, confidence, riskLevel) {
  let message = '';
  
  if (recommendation === 'BUY') {
    message = `${confidence} confidence buy recommendation. `;
    if (riskLevel === 'Low') {
      message += 'Low risk investment with good upside potential.';
    } else if (riskLevel === 'Medium') {
      message += 'Moderate risk - consider position sizing carefully.';
    } else {
      message += 'Higher risk - suitable for aggressive investors only.';
    }
  } else if (recommendation === 'HOLD') {
    message = `Hold current position. `;
    message += 'Mixed signals suggest waiting for clearer direction.';
  } else {
    message = `${confidence} confidence sell recommendation. `;
    if (riskLevel === 'High') {
      message += 'High risk of further decline - consider exit strategy.';
    } else {
      message += 'Consider taking profits or reducing exposure.';
    }
  }
  
  return message;
}
