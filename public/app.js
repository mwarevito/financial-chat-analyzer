const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const typingIndicator = document.getElementById('typingIndicator');
const quickButtons = document.querySelectorAll('.quick-btn');

// Event listeners
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

quickButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const query = btn.dataset.query;
        messageInput.value = `Analyze ${query}`;
        sendMessage();
    });
});

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    // Display user message
    displayUserMessage(message);
    
    // Extract symbol from message
    const symbol = extractSymbol(message);
    if (!symbol) {
        displayError('Please specify a stock symbol (e.g., AAPL, TSLA, MSFT)');
        return;
    }

    // Show typing indicator
    typingIndicator.style.display = 'block';
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    try {
        // Check if this is a follow-up
        const isFollowUp = conversationContext.lastSymbol === symbol && conversationContext.lastAnalysis;
        
        console.log('Request:', { symbol, isFollowUp: !!isFollowUp, message });
        
        // Send to serverless function for analysis
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                symbol, 
                query: message,
                context: conversationContext.lastAnalysis,
                isFollowUp: isFollowUp
            })
        });
        
        if (!response.ok) {
            throw new Error('Analysis request failed');
        }
        
        const data = await response.json();
        
        // Update conversation context
        conversationContext.lastSymbol = symbol;
        conversationContext.lastAnalysis = data;
        conversationContext.conversationHistory.push({
            query: message,
            response: data,
            timestamp: new Date()
        });
        
        console.log('Context updated:', { 
            lastSymbol: conversationContext.lastSymbol, 
            hasAnalysis: !!conversationContext.lastAnalysis 
        });
        
        // Hide typing indicator and display result
        typingIndicator.style.display = 'none';
        displayAnalysisResult(data);
    } catch (error) {
        typingIndicator.style.display = 'none';
        displayError('Sorry, I encountered an error analyzing that asset.');
    }
    
    // Clear input
    messageInput.value = '';
}

// Enhanced company recognition
const companyMap = {
    // Tech giants
    'apple': 'AAPL', 'iphone': 'AAPL', 'mac': 'AAPL', 'ipad': 'AAPL',
    'tesla': 'TSLA', 'elon': 'TSLA', 'musk': 'TSLA', 'electric car': 'TSLA',
    'microsoft': 'MSFT', 'windows': 'MSFT', 'xbox': 'MSFT', 'office': 'MSFT',
    'google': 'GOOGL', 'alphabet': 'GOOGL', 'youtube': 'GOOGL', 'android': 'GOOGL',
    'amazon': 'AMZN', 'aws': 'AMZN', 'bezos': 'AMZN', 'prime': 'AMZN',
    'meta': 'META', 'facebook': 'META', 'instagram': 'META', 'whatsapp': 'META',
    'netflix': 'NFLX', 'streaming': 'NFLX',
    'nvidia': 'NVDA', 'ai chip': 'NVDA', 'gpu': 'NVDA',
    
    // Finance & others
    'berkshire': 'BRK.B', 'buffett': 'BRK.B', 'warren': 'BRK.B',
    'jpmorgan': 'JPM', 'jp morgan': 'JPM',
    'disney': 'DIS', 'mickey': 'DIS',
    'coca cola': 'KO', 'coke': 'KO',
    'walmart': 'WMT',
    'boeing': 'BA',
    'intel': 'INTC',
    'amd': 'AMD',
    'paypal': 'PYPL',
    'salesforce': 'CRM',
    'zoom': 'ZM',
    'uber': 'UBER',
    'airbnb': 'ABNB',
    'spotify': 'SPOT',
    'twitter': 'TWTR', 'x corp': 'TWTR'
};

// Conversation context storage
let conversationContext = {
    lastSymbol: null,
    lastAnalysis: null,
    conversationHistory: []
};

function extractSymbol(message) {
    const lowerMessage = message.toLowerCase().trim();
    
    // Simple follow-up patterns
    const followUpWords = ['why', 'how', 'what', 'should', 'risk', 'price', 'news', 'explain', 'tell', 'more'];
    const isFollowUp = followUpWords.some(word => lowerMessage.includes(word)) || message.includes('?');
    
    if (isFollowUp && conversationContext.lastSymbol) {
        return conversationContext.lastSymbol;
    }
    
    // Look for explicit stock symbols first (3-5 uppercase letters)
    const symbolMatch = message.match(/\b[A-Z]{1,5}\b/);
    if (symbolMatch) {
        return symbolMatch[0];
    }
    
    // Enhanced company name recognition
    for (const [keyword, symbol] of Object.entries(companyMap)) {
        if (lowerMessage.includes(keyword)) {
            return symbol;
        }
    }
    
    return null;
}

function displayUserMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';
    messageDiv.innerHTML = `
        <div class="message-content">
            ${escapeHtml(message)}
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function displayAnalysisResult(analysis) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';
    
    let content = `<strong>🤖 Financial Analyst</strong>`;
    content += `<div style="margin-top: 10px;">${formatAnalysis(analysis)}</div>`;
    
    messageDiv.innerHTML = `<div class="message-content">${content}</div>`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatAnalysis(analysis) {
    let html = `<div class="analysis-result">`;
    
    // Check if this is a follow-up response
    if (analysis.isFollowUp && analysis.summary) {
        html += `<div class="analysis-section">`;
        html += `<h4>💬 Follow-up Response</h4>`;
        html += `<div class="follow-up-response">${formatMarkdown(analysis.summary)}</div>`;
        html += `</div>`;
        html += `</div>`;
        return html;
    }
    
    // 1. SMART SIGNAL FIRST (most prominent)
    if (analysis.recommendation) {
        html += `<div class="analysis-section recommendation-section">`;
        html += `<h4>🎯 Smart Signal</h4>`;
        html += `<div class="recommendation-card">`;
        html += `<div class="rec-action">${analysis.recommendation.action}</div>`;
        html += `<div class="rec-details">`;
        html += `<p><strong>Confidence:</strong> ${analysis.recommendation.confidence}</p>`;
        html += `<p><strong>Risk:</strong> ${analysis.recommendation.riskLevel}</p>`;
        html += `<p><strong>Score:</strong> ${analysis.recommendation.score}/5</p>`;
        html += `</div>`;
        html += `<p class="rec-message">${analysis.recommendation.message}</p>`;
        if (analysis.recommendation.reasons.length > 0) {
            html += `<div class="rec-reasons">`;
            html += `<strong>📈 Bullish Factors:</strong>`;
            html += `<ul>`;
            analysis.recommendation.reasons.forEach(reason => {
                html += `<li>✓ ${reason}</li>`;
            });
            html += `</ul>`;
            html += `</div>`;
        }
        if (analysis.recommendation.riskFactors.length > 0) {
            html += `<div class="rec-risks">`;
            html += `<strong>⚠️ Risk Factors:</strong>`;
            html += `<ul>`;
            analysis.recommendation.riskFactors.forEach(risk => {
                html += `<li>• ${risk}</li>`;
            });
            html += `</ul>`;
            html += `</div>`;
        }
        html += `</div>`;
        html += `</div>`;
    }

    // Technical Analysis
    if (analysis.technical && analysis.technical.price !== 'N/A') {
        html += `<div class="analysis-section">`;
        html += `<h4>📈 Technical Analysis</h4>`;
        html += `<p><strong>Price:</strong> $${analysis.technical.price} (${analysis.technical.change >= 0 ? '+' : ''}${analysis.technical.change})</p>`;
        html += `<p><strong>Volume:</strong> ${formatNumber(analysis.technical.volume)}</p>`;
        if (analysis.technical.indicators.sma20) {
            html += `<p><strong>20-day SMA:</strong> $${analysis.technical.indicators.sma20}</p>`;
        }
        if (analysis.technical.indicators.trend) {
            html += `<p><strong>Trend:</strong> ${analysis.technical.indicators.trend}</p>`;
        }
        html += `</div>`;
    }
    
    // 4. COMBINED SENTIMENT & NEWS
    if (analysis.news && analysis.news.articles && analysis.news.articles.length > 0) {
        html += `<div class="analysis-section">`;
        html += `<h4>📰 Market Sentiment & News</h4>`;
        
        // Sentiment summary first
        if (analysis.sentiment && analysis.sentiment.score !== undefined) {
            html += `<div class="sentiment-summary">`;
            html += `<p><strong>Overall Sentiment:</strong> ${analysis.sentiment.message} (Score: ${analysis.sentiment.score})</p>`;
            html += `</div>`;
        }
        
        // Top news articles
        html += `<div class="news-articles">`;
        analysis.news.articles.slice(0, 3).forEach(article => {
            html += `<div class="news-item">`;
            html += `<h5>${escapeHtml(article.title)}</h5>`;
            if (article.description) {
                html += `<p>${escapeHtml(article.description.substring(0, 120))}...</p>`;
            }
            html += `<div class="news-meta">`;
            html += `<span>${article.source} • ${new Date(article.publishedAt).toLocaleDateString()}</span>`;
            html += `<a href="${article.url}" target="_blank">Read →</a>`;
            html += `</div>`;
            html += `</div>`;
        });
        html += `</div>`;
        html += `</div>`;
    } else if (analysis.sentiment && analysis.sentiment.score !== undefined) {
        html += `<div class="analysis-section">`;
        html += `<h4>🎭 Market Sentiment</h4>`;
        html += `<p>${analysis.sentiment.message}</p>`;
        html += `</div>`;
    }
    
    // Fundamental Analysis
    if (analysis.fundamental && analysis.fundamental.peRatio !== 'N/A') {
        html += `<div class="analysis-section">`;
        html += `<h4>📊 Fundamental Analysis</h4>`;
        html += `<p><strong>P/E Ratio:</strong> ${analysis.fundamental.peRatio}</p>`;
        html += `<p><strong>Market Cap:</strong> ${analysis.fundamental.marketCap}</p>`;
        if (analysis.fundamental.dividendYield !== 'N/A') {
            html += `<p><strong>Dividend Yield:</strong> ${analysis.fundamental.dividendYield}%</p>`;
        }
        if (analysis.fundamental.eps !== 'N/A') {
            html += `<p><strong>EPS:</strong> ${analysis.fundamental.eps}</p>`;
        }
        html += `</div>`;
    }
    
    html += `</div>`;
    return html;
}

function displayError(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';
    messageDiv.innerHTML = `
        <div class="message-content">
            <strong>🤖 Financial Analyst</strong>
            <div class="error-message">${escapeHtml(message)}</div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatMarkdown(text) {
    // Simple markdown formatting
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

function formatNumber(num) {
    if (!num) return 'N/A';
    return parseInt(num).toLocaleString();
}

// Auto-focus on input
messageInput.focus();
