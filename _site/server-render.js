// server-render.js - Combined server for Render deployment
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 10000; // Render will provide the PORT

// Check for API key
if (!process.env.OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in environment variables');
  console.error('Set this in your Render environment variables');
  // Don't exit, as we might still want to serve static files
}

// Define API key and base URL
const apiKey = process.env.OPENAI_API_KEY;
const openaiBaseUrl = 'https://api.openai.com/v1';

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies

// Serve static files from the _site directory (built by Jekyll)
app.use(express.static(path.join(__dirname, '_site')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// OpenAI API endpoint
app.post('/api/openai', async (req, res) => {
  try {
    console.log('Received request to OpenAI API');
    
    // Check if we have an API key
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured',
        details: 'Please set OPENAI_API_KEY in the environment variables'
      });
    }
    
    // Extract data from the frontend request
    const { input, model, temperature, max_output_tokens, top_p } = req.body;
    
    if (!input || !Array.isArray(input)) {
      return res.status(400).json({ error: 'Invalid input format' });
    }
    
    // Transform the input format to match OpenAI's expected format
    const messages = input.map(function(item) {
      return {
        role: item.role,
        content: item.content.map(function(c) { return c.text; }).join('\n')
      };
    });
    
    console.log('Sending request to OpenAI with ' + messages.length + ' messages');
    
    // Set up the request to the OpenAI API
    const openaiRequest = {
      model: model || 'gpt-4o',
      messages: messages,
      temperature: temperature || 0.7,
      max_tokens: max_output_tokens || 2048,
      top_p: top_p || 1
    };
    
    // Make the API call using axios
    const openaiResponse = await axios.post(
      openaiBaseUrl + '/chat/completions', 
      openaiRequest,
      {
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Extract the response
    const completion = openaiResponse.data;
    const responseText = completion.choices && 
                         completion.choices[0] && 
                         completion.choices[0].message && 
                         completion.choices[0].message.content || 
                         "No response received";
                         
    console.log('Received response from OpenAI');
    
    // Return response to frontend
    res.json({
      text: responseText,
      usage: completion.usage
    });
    
  } catch (error) {
    console.error('Error calling OpenAI API:', error.response ? error.response.data : error.message);
    
    // Send appropriate error response
    res.status(error.response ? error.response.status : 500).json({
      error: 'Error processing your request',
      details: error.response ? error.response.data : error.message
    });
  }
});

// For any other route, serve the index.html (for single-page app)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '_site', 'index.html'));
});

// Start server
app.listen(PORT, function() {
  console.log('Server is running on port ' + PORT);
  console.log('OpenAI API endpoint: /api/openai');
});
