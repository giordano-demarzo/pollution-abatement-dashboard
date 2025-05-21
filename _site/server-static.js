// server-static.js - Combined server that serves static files and API
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Function to recursively copy directories
const copyDirRecursively = (src, dest) => {
  // Check if source exists
  if (!fs.existsSync(src)) {
    console.error(`Source directory does not exist: ${src}`);
    return false;
  }

  // Create destination if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Read source directory
  const entries = fs.readdirSync(src, { withFileTypes: true });

  let successful = true;
  
  // Copy each entry
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      // Recursively copy directory
      const subDirSuccess = copyDirRecursively(srcPath, destPath);
      if (!subDirSuccess) {
        successful = false;
      }
    } else {
      // Copy file
      try {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied file: ${srcPath} to ${destPath}`);
      } catch (error) {
        console.error(`Error copying file ${srcPath} to ${destPath}: ${error.message}`);
        successful = false;
      }
    }
  }
  
  return successful;
};

// Function to ensure data files are available
const ensureDataFilesExist = () => {
  console.log('Checking for data files...');
  
  // Check if optimized_data directory exists and has files
  const optimizedDataPath = path.join(__dirname, 'optimized_data');
  let optimizedDataHasFiles = false;
  
  if (fs.existsSync(optimizedDataPath)) {
    const files = fs.readdirSync(optimizedDataPath);
    optimizedDataHasFiles = files.length > 0;
    console.log(`optimized_data directory has ${files.length} files.`);
  }
  
  if (!optimizedDataHasFiles) {
    console.log('Optimized data directory missing or empty, will try to copy from other locations...');
    
    // Try to find data in different locations
    const possibleSourceDirs = [
      // Check if files are in the cloned Git repository
      path.join(__dirname, '.git', 'optimized_data'),
      path.join(__dirname, 'github', 'optimized_data'),
      // Try parent directories
      path.join(__dirname, '..', 'optimized_data'),
      path.join(__dirname, '..', '..', 'optimized_data'),
      // Try hidden directories where files might be cached
      path.join(__dirname, '.cache', 'optimized_data'),
      path.join(__dirname, '.render', 'optimized_data')
    ];
    
    // Try to copy from each possible source location
    for (const sourceDir of possibleSourceDirs) {
      if (fs.existsSync(sourceDir)) {
        console.log(`Found data files in ${sourceDir}, copying to ${optimizedDataPath}...`);
        if (copyDirRecursively(sourceDir, optimizedDataPath)) {
          console.log('Successfully copied data files!');
          break;
        }
      }
    }
  } else {
    console.log('Optimized data directory exists and has files.');
  }
};

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

// Ensure data files exist
ensureDataFilesExist();

// Serve assets directory
const assetsPath = path.join(__dirname, 'assets');
if (fs.existsSync(assetsPath)) {
  console.log(`Serving assets files from: ${assetsPath}`);
  app.use('/assets', express.static(assetsPath));
} else {
  console.error(`Assets directory not found: ${assetsPath}`);
}

// Serve optimized_data directory
const optimizedDataPath = path.join(__dirname, 'optimized_data');
if (fs.existsSync(optimizedDataPath)) {
  console.log(`Serving optimized data files from: ${optimizedDataPath}`);
  app.use('/optimized_data', express.static(optimizedDataPath));
} else {
  console.error(`Optimized data directory not found: ${optimizedDataPath}`);
  
  // Create the directory if it doesn't exist
  try {
    fs.mkdirSync(path.join(__dirname, 'optimized_data'), { recursive: true });
    fs.mkdirSync(path.join(__dirname, 'optimized_data', 'pollutants'), { recursive: true });
    fs.mkdirSync(path.join(__dirname, 'optimized_data', 'pollutant_bref_hierarchies'), { recursive: true });
    fs.mkdirSync(path.join(__dirname, 'optimized_data', 'bref_relevance'), { recursive: true });
    fs.mkdirSync(path.join(__dirname, 'optimized_data', 'sdgs'), { recursive: true });
    console.log('Created optimized_data directories');
  } catch (err) {
    console.error('Error creating optimized_data directories:', err);
  }
  
  // Serve the directory anyway
  app.use('/optimized_data', express.static(optimizedDataPath));
}

// Serve processed_data directory
const processedDataPath = path.join(__dirname, 'processed_data');
if (fs.existsSync(processedDataPath)) {
  console.log(`Serving processed data files from: ${processedDataPath}`);
  app.use('/processed_data', express.static(processedDataPath));
} else {
  console.error(`Processed data directory not found: ${processedDataPath}`);
}

// Health check endpoint with debugging info
app.get('/health', (req, res) => {
  // List directories to help with debugging
  const directoryMap = {};
  const dirs = ['assets', 'optimized_data', 'processed_data', '.'];
  
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    try {
      if (fs.existsSync(dirPath)) {
        directoryMap[dir] = fs.readdirSync(dirPath).slice(0, 10); // Show first 10 files
        
        // Also show subdirectories for optimized_data
        if (dir === 'optimized_data') {
          directoryMap[`${dir}_subdirs`] = {};
          ['pollutants', 'pollutant_bref_hierarchies', 'bref_relevance', 'sdgs'].forEach(subdir => {
            const subdirPath = path.join(dirPath, subdir);
            if (fs.existsSync(subdirPath)) {
              directoryMap[`${dir}_subdirs`][subdir] = fs.readdirSync(subdirPath).slice(0, 5);
            } else {
              directoryMap[`${dir}_subdirs`][subdir] = 'Directory not found';
            }
          });
        }
      } else {
        directoryMap[dir] = 'Directory not found';
      }
    } catch (error) {
      directoryMap[dir] = `Error reading directory: ${error.message}`;
    }
  });
  
  res.status(200).json({ 
    status: 'ok', 
    message: 'Server is running',
    directories: directoryMap,
    env: {
      apiKeyExists: !!process.env.OPENAI_API_KEY,
      nodeEnv: process.env.NODE_ENV,
      publicUrl: process.env.PUBLIC_URL || 'Not set'
    }
  });
});

// File explorer endpoint for debugging data locations
app.get('/api/explorer', (req, res) => {
  const basePath = req.query.path || '.';
  const fullPath = path.join(__dirname, basePath);
  
  try {
    // Check if path exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Path not found', path: fullPath });
    }
    
    // Get path stats
    const stats = fs.statSync(fullPath);
    
    // Handle directory
    if (stats.isDirectory()) {
      const files = fs.readdirSync(fullPath);
      const fileDetails = files.map(file => {
        const filePath = path.join(fullPath, file);
        try {
          const fileStats = fs.statSync(filePath);
          return {
            name: file,
            isDirectory: fileStats.isDirectory(),
            size: fileStats.size,
            modified: fileStats.mtime
          };
        } catch (error) {
          return {
            name: file,
            error: error.message
          };
        }
      });
      
      return res.json({
        path: fullPath,
        isDirectory: true,
        files: fileDetails
      });
    }
    
    // Handle file
    if (stats.isFile()) {
      // For JSON files, return the content
      if (fullPath.endsWith('.json')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const jsonContent = JSON.parse(content);
          return res.json({
            path: fullPath,
            isDirectory: false,
            fileSize: stats.size,
            modified: stats.mtime,
            content: jsonContent
          });
        } catch (error) {
          return res.json({
            path: fullPath,
            isDirectory: false,
            fileSize: stats.size,
            modified: stats.mtime,
            error: `Error reading JSON: ${error.message}`
          });
        }
      }
      
      // For other files, return basic info
      return res.json({
        path: fullPath,
        isDirectory: false,
        fileSize: stats.size,
        modified: stats.mtime
      });
    }
    
    // Unknown file type
    return res.json({
      path: fullPath,
      error: 'Unknown file type'
    });
  } catch (error) {
    return res.status(500).json({
      error: `Error exploring path: ${error.message}`,
      path: fullPath
    });
  }
});

// File content endpoint for downloading files
app.get('/api/file-content', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: 'No file path provided' });
  }

  const fullPath = path.join(__dirname, filePath);
  
  try {
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found', path: fullPath });
    }
    
    if (fs.statSync(fullPath).isDirectory()) {
      return res.status(400).json({ error: 'Path is a directory, not a file', path: fullPath });
    }
    
    // Read the file
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // If JSON, parse it
    if (fullPath.endsWith('.json')) {
      try {
        const jsonContent = JSON.parse(content);
        return res.json(jsonContent);
      } catch (error) {
        return res.status(500).json({ error: `Error parsing JSON: ${error.message}` });
      }
    }
    
    // Otherwise return as text
    res.set('Content-Type', 'text/plain');
    return res.send(content);
  } catch (error) {
    return res.status(500).json({ error: `Error reading file: ${error.message}` });
  }
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

// Add file logging route for debugging
app.get('/api/file-check', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: 'No file path provided' });
  }

  const fullPath = path.join(__dirname, filePath);
  
  try {
    if (fs.existsSync(fullPath)) {
      if (fs.statSync(fullPath).isDirectory()) {
        const files = fs.readdirSync(fullPath);
        return res.json({ 
          exists: true, 
          isDirectory: true, 
          files: files.slice(0, 20) // List up to 20 files
        });
      } else {
        const fileContent = fs.readFileSync(fullPath, 'utf8');
        return res.json({ 
          exists: true, 
          isDirectory: false, 
          size: fs.statSync(fullPath).size,
          preview: fileContent.slice(0, 1000) // First 1000 chars
        });
      }
    } else {
      return res.json({ exists: false });
    }
  } catch (error) {
    return res.status(500).json({ 
      error: 'Error checking file', 
      message: error.message 
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
  
  // Log available directories for debugging
  ['assets', 'optimized_data', 'processed_data'].forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (fs.existsSync(dirPath)) {
      console.log(`${dir} directory exists`);
    } else {
      console.log(`${dir} directory does not exist`);
    }
  });
});
