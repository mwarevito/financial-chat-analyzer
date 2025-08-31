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
        // Send to serverless function for analysis
        const response = await fetch('/.netlify/functions/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ symbol, query: message })
        });
        
        if (!response.ok) {
            throw new Error('Analysis request failed');
        }
        
        const data = await response.json();
        
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

function extractSymbol(message) {
    // Look for common stock symbols (3-5 uppercase letters)
    const symbolMatch = message.match(/\b[A-Z]{1,5}\b/);
    if (symbolMatch) {
        return symbolMatch[0];
    }
    
    // Check for company names and convert to symbols
    const companyMap = {
        'apple': 'AAPL',
        'tesla': 'TSLA',
        'microsoft': 'MSFT',
        'google': 'GOOGL',
        'amazon': 'AMZN',
        'meta': 'META',
        'netflix': 'NFLX',
        'nvidia': 'NVDA'
    };
    
    const lowerMessage = message.toLowerCase();
    for (const [company, symbol] of Object.entries(companyMap)) {
        if (lowerMessage.includes(company)) {
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
    
    // Summary
    html += `<div class="analysis-section">`;
    html += `<h4>📋 Summary</h4>`;
    html += `<div>${formatMarkdown(analysis.summary)}</div>`;
    html += `</div>`;
    
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
    
    // Sentiment Analysis
    if (analysis.sentiment && analysis.sentiment.score !== undefined) {
        html += `<div class="analysis-section">`;
        html += `<h4>🎭 Sentiment Analysis</h4>`;
        html += `<p><strong>Score:</strong> ${analysis.sentiment.score} (${analysis.sentiment.message})</p>`;
        if (analysis.sentiment.headlines && analysis.sentiment.headlines.length > 0) {
            html += `<p><strong>Recent Headlines:</strong></p>`;
            html += `<ul>`;
            analysis.sentiment.headlines.slice(0, 3).forEach(headline => {
                html += `<li>${escapeHtml(headline.title)} (${headline.sentiment > 0 ? '📈' : headline.sentiment < 0 ? '📉' : '➡️'})</li>`;
            });
            html += `</ul>`;
        }
        html += `</div>`;
    }
    
    // News
    if (analysis.news && analysis.news.articles && analysis.news.articles.length > 0) {
        html += `<div class="analysis-section">`;
        html += `<h4>📰 Recent News</h4>`;
        analysis.news.articles.slice(0, 3).forEach(article => {
            html += `<div class="news-item">`;
            html += `<h5>${escapeHtml(article.title)}</h5>`;
            if (article.description) {
                html += `<p>${escapeHtml(article.description.substring(0, 150))}...</p>`;
            }
            html += `<a href="${article.url}" target="_blank">Read more →</a>`;
            html += `</div>`;
        });
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
