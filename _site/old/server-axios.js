// server-axios.js - Compatible with older Node.js versions
// Uses axios instead of the OpenAI SDK
require('dotenv').config({ path: '.env.local' });
const express = require('express');
const cors = require('cors');
const axios = require('axios');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5001;

// Check for API key
if (!process.env.OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in environment variables');
  process.exit(1);
}

// Define API key and base URL
const apiKey = process.env.OPENAI_API_KEY;
const openaiBaseUrl = 'https://api.openai.com/v1';

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Test endpoints for debugging
app.get('/test', (req, res) => {
  res.json({
    message: 'Server is working correctly',
    nodeVersion: process.version,
    env: {
      apiKeyExists: !!process.env.OPENAI_API_KEY,
      publicApiUrl: process.env.PUBLIC_API_URL
    }
  });
});

// Simple test endpoint for POST requests
app.post('/test', (req, res) => {
  console.log('Received POST test request');
  console.log('Request body:', req.body);
  res.json({
    message: 'POST request received successfully',
    receivedData: req.body
  });
});

// OpenAI API endpoint
app.post('/api/openai', async (req, res) => {
  try {
    console.log('Received request to OpenAI API');
    
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

// Start server
app.listen(PORT, function() {
  console.log('Server is running on port ' + PORT);
  console.log('OpenAI API endpoint: http://localhost:' + PORT + '/api/openai');
});
