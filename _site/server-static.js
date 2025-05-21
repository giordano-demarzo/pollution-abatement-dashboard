// server-static.js - Combined server that serves static files and API
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 10000;

// Check for API key
if (!process.env.OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in environment variables');
  console.error('Set this in your Render environment variables');
}

// Define API key and base URL
const apiKey = process.env.OPENAI_API_KEY;
const openaiBaseUrl = 'https://api.openai.com/v1';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files - look for assets directory
const staticPath = path.join(__dirname, 'assets');
if (fs.existsSync(staticPath)) {
  console.log(`Serving static files from: ${staticPath}`);
  app.use('/assets', express.static(staticPath));
} else {
  console.error(`Static directory not found: ${staticPath}`);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Server is running',
    staticPath: staticPath,
    staticExists: fs.existsSync(staticPath),
    env: {
      apiKeyExists: !!process.env.OPENAI_API_KEY,
      nodeEnv: process.env.NODE_ENV
    }
  });
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

// Serve index.html for all other routes
app.get('*', (req, res) => {
  // Create a simple HTML page that loads the bundle.js
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pollution Abatement Dashboard</title>
  <script src="https://cdn.tailwindcss.com/3.4.4"></script>
  <style>
    /* Additional styles for markdown content in chat */
    .markdown-content h1,
    .markdown-content h2,
    .markdown-content h3 {
      margin-top: 1rem;
      margin-bottom: 0.5rem;
      font-weight: 600;
      line-height: 1.25;
    }

    .markdown-content h1 {
      font-size: 1.5rem;
    }

    .markdown-content h2 {
      font-size: 1.25rem;
    }

    .markdown-content h3 {
      font-size: 1.125rem;
    }

    .markdown-content p,
    .markdown-content ul,
    .markdown-content ol {
      margin-bottom: 1rem;
    }

    .markdown-content ul,
    .markdown-content ol {
      padding-left: 1.5rem;
    }

    .markdown-content ul {
      list-style-type: disc;
    }

    .markdown-content ol {
      list-style-type: decimal;
    }

    .markdown-content li {
      margin-bottom: 0.25rem;
    }

    .markdown-content a {
      color: #3b82f6;
      text-decoration: none;
    }

    .markdown-content a:hover {
      text-decoration: underline;
    }

    .markdown-content blockquote {
      border-left: 4px solid #e5e7eb;
      padding-left: 1rem;
      font-style: italic;
      margin: 1rem 0;
    }

    .markdown-content code {
      background-color: #f3f4f6;
      padding: 0.2rem 0.4rem;
      border-radius: 0.25rem;
      font-family: monospace;
    }

    .markdown-content pre {
      background-color: #f3f4f6;
      padding: 1rem;
      border-radius: 0.25rem;
      overflow-x: auto;
      margin: 1rem 0;
    }

    .markdown-content pre code {
      background-color: transparent;
      padding: 0;
    }

    /* For highlighting important information */
    .markdown-content strong {
      font-weight: 600;
      color: #1f2937;
    }

    /* Tables */
    .markdown-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }

    .markdown-content th,
    .markdown-content td {
      padding: 0.5rem;
      border: 1px solid #e5e7eb;
    }

    .markdown-content th {
      background-color: #f9fafb;
      font-weight: 600;
      text-align: left;
    }

    .markdown-content tr:nth-child(even) {
      background-color: #f9fafb;
    }

    /* For assistant messages specifically */
    .bg-green-50 .markdown-content h1,
    .bg-green-50 .markdown-content h2,
    .bg-green-50 .markdown-content h3 {
      color: #065f46;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/dashboard.bundle.js"></script>
</body>
</html>
  `;
  
  res.set('Content-Type', 'text/html');
  res.send(html);
});

// Start server
app.listen(PORT, function() {
  console.log('Server is running on port ' + PORT);
  console.log('OpenAI API endpoint: /api/openai');
});
