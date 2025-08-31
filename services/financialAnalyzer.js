const axios = require('axios');
const Sentiment = require('sentiment');
const cheerio = require('cheerio');

const sentiment = new Sentiment();

class FinancialAnalyzer {
  constructor() {
    this.alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
    this.newsApiKey = process.env.NEWS_API_KEY;
  }

  async analyzeAsset(symbol, userQuery) {
    const analysis = {
      symbol: symbol.toUpperCase(),
      timestamp: new Date().toISOString(),
      sentiment: null,
      news: null,
      technical: null,
      fundamental: null,
      summary: ''
    };

    try {
      // Run all analyses in parallel for better performance
      const [sentimentData, newsData, technicalData, fundamentalData] = await Promise.all([
        this.getSentimentAnalysis(symbol),
        this.getNewsAnalysis(symbol),
        this.getTechnicalAnalysis(symbol),
        this.getFundamentalAnalysis(symbol)
      ]);

      analysis.sentiment = sentimentData;
      analysis.news = newsData;
      analysis.technical = technicalData;
      analysis.fundamental = fundamentalData;
      analysis.summary = this.generateSummary(analysis, userQuery);

      return analysis;
    } catch (error) {
      console.error('Error in analyzeAsset:', error);
      throw error;
    }
  }

  async getSentimentAnalysis(symbol) {
    try {
      // Get recent news headlines for sentiment analysis
      const newsUrl = `https://newsapi.org/v2/everything?q=${symbol}&sortBy=publishedAt&pageSize=10&apiKey=${this.newsApiKey}`;
      
      if (!this.newsApiKey) {
        return {
          score: 0,
          comparative: 0,
          message: 'News API key not configured. Using mock sentiment data.',
          headlines: []
        };
      }

      const response = await axios.get(newsUrl);
      const articles = response.data.articles || [];
      
      let totalScore = 0;
      let totalComparative = 0;
      const headlines = [];

      articles.forEach(article => {
        if (article.title) {
          const result = sentiment.analyze(article.title);
          totalScore += result.score;
          totalComparative += result.comparative;
          headlines.push({
            title: article.title,
            sentiment: result.score,
            url: article.url
          });
        }
      });

      const avgScore = articles.length > 0 ? totalScore / articles.length : 0;
      const avgComparative = articles.length > 0 ? totalComparative / articles.length : 0;

      return {
        score: Math.round(avgScore * 100) / 100,
        comparative: Math.round(avgComparative * 100) / 100,
        message: this.interpretSentiment(avgScore),
        headlines: headlines.slice(0, 5)
      };
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return {
        score: 0,
        comparative: 0,
        message: 'Unable to fetch sentiment data',
        headlines: []
      };
    }
  }

  async getNewsAnalysis(symbol) {
    try {
      const newsUrl = `https://newsapi.org/v2/everything?q=${symbol}&sortBy=publishedAt&pageSize=5&apiKey=${this.newsApiKey}`;
      
      if (!this.newsApiKey) {
        return {
          articles: [],
          summary: 'News API key not configured. Please add NEWS_API_KEY to your .env file.'
        };
      }

      const response = await axios.get(newsUrl);
      const articles = response.data.articles || [];

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
        summary: 'Unable to fetch news data'
      };
    }
  }

  async getTechnicalAnalysis(symbol) {
    try {
      // Get daily time series data
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${this.alphaVantageKey}`;
      
      if (!this.alphaVantageKey) {
        return {
          price: 'N/A',
          change: 'N/A',
          volume: 'N/A',
          indicators: {},
          message: 'Alpha Vantage API key not configured. Please add ALPHA_VANTAGE_API_KEY to your .env file.'
        };
      }

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

      // Calculate simple moving averages
      const prices = dates.slice(0, 20).map(date => parseFloat(timeSeries[date]['4. close']));
      const sma20 = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const sma50 = dates.length >= 50 ? 
        dates.slice(0, 50).map(date => parseFloat(timeSeries[date]['4. close']))
          .reduce((sum, price) => sum + price, 0) / 50 : null;

      return {
        price: currentPrice.toFixed(2),
        change: change.toFixed(2),
        changePercent: changePercent.toFixed(2),
        volume: latest['5. volume'],
        indicators: {
          sma20: sma20.toFixed(2),
          sma50: sma50 ? sma50.toFixed(2) : 'N/A',
          trend: this.determineTrend(currentPrice, sma20, sma50)
        },
        message: this.interpretTechnicalAnalysis(changePercent, currentPrice, sma20)
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

  async getFundamentalAnalysis(symbol) {
    try {
      const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${this.alphaVantageKey}`;
      
      if (!this.alphaVantageKey) {
        return {
          marketCap: 'N/A',
          peRatio: 'N/A',
          dividendYield: 'N/A',
          message: 'Alpha Vantage API key not configured'
        };
      }

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
        message: this.interpretFundamentals(data)
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

  interpretSentiment(score) {
    if (score > 2) return 'Very Positive sentiment in recent news';
    if (score > 0) return 'Positive sentiment in recent news';
    if (score === 0) return 'Neutral sentiment in recent news';
    if (score > -2) return 'Negative sentiment in recent news';
    return 'Very Negative sentiment in recent news';
  }

  determineTrend(currentPrice, sma20, sma50) {
    if (sma50 === null) return 'Insufficient data';
    if (currentPrice > sma20 && sma20 > sma50) return 'Bullish';
    if (currentPrice < sma20 && sma20 < sma50) return 'Bearish';
    return 'Sideways';
  }

  interpretTechnicalAnalysis(changePercent, currentPrice, sma20) {
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

  interpretFundamentals(data) {
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

  generateSummary(analysis, userQuery) {
    const { sentiment, technical, fundamental } = analysis;
    
    let summary = `**${analysis.symbol} Analysis Summary:**\n\n`;
    
    // Price and technical
    if (technical.price !== 'N/A') {
      summary += `💰 **Current Price:** $${technical.price} (${technical.change >= 0 ? '+' : ''}${technical.change}, ${technical.changePercent}%)\n`;
      summary += `📈 **Technical:** ${technical.message}\n`;
    }
    
    // Sentiment
    if (sentiment.score !== undefined) {
      summary += `🎭 **Sentiment:** ${sentiment.message}\n`;
    }
    
    // Fundamental highlights
    if (fundamental.peRatio !== 'N/A') {
      summary += `📊 **Fundamentals:** P/E: ${fundamental.peRatio}, Market Cap: ${fundamental.marketCap}\n`;
    }
    
    // News count
    if (analysis.news.articles.length > 0) {
      summary += `📰 **News:** ${analysis.news.articles.length} recent articles found\n`;
    }

    summary += `\n*Analysis completed at ${new Date().toLocaleTimeString()}*`;
    
    return summary;
  }
}

module.exports = new FinancialAnalyzer();
