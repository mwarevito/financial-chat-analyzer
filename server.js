const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const financialAnalyzer = require('./services/financialAnalyzer');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('analyze_asset', async (data) => {
    const { symbol, query } = data;
    
    try {
      // Send typing indicator
      socket.emit('bot_typing', true);
      
      // Perform analysis
      const analysis = await financialAnalyzer.analyzeAsset(symbol, query);
      
      // Send response
      socket.emit('bot_typing', false);
      socket.emit('analysis_result', analysis);
    } catch (error) {
      console.error('Analysis error:', error);
      socket.emit('bot_typing', false);
      socket.emit('error', { message: 'Sorry, I encountered an error analyzing that asset.' });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Financial Chat Analyzer running on port ${PORT}`);
});
