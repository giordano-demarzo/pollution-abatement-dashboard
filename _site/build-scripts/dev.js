// build-scripts/dev.js
const { build } = require('esbuild');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
let envVars = {};
try {
  const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      envVars[key] = value;
    }
  });
  console.log('Loaded environment variables from .env.local');
} catch (error) {
  console.warn('Could not load .env.local file:', error.message);
}

// Manually set the API URL if not found in env file
const PUBLIC_API_URL = envVars.PUBLIC_API_URL || process.env.PUBLIC_API_URL || 'http://localhost:5001/api/openai';

console.log('Using PUBLIC_API_URL:', PUBLIC_API_URL);

// Function to handle process.env variables safely
const defineEnv = () => {
  const env = {};
  
  // ONLY include environment variables that are needed in the client code
  // Do NOT include sensitive variables like OPENAI_API_KEY here
  env['process.env.PUBLIC_API_URL'] = JSON.stringify(PUBLIC_API_URL);
  
  return env;
};

// Run esbuild with watch mode for development
build({
  entryPoints: ['assets/js/index.jsx'],
  bundle: true,
  sourcemap: true,
  jsx: 'automatic',
  outfile: 'assets/dashboard.bundle.js',
  define: defineEnv(),
  // Tell esbuild this is for browser
  platform: 'browser',
  // Exclude Node.js built-in modules and problematic packages
  external: ['path', 'fs', 'os', 'crypto', 'dotenv'],
}).then(() => {
  console.log('Build started in watch mode at', new Date().toLocaleTimeString());
  console.log('Environment variables defined:', defineEnv());
  console.log('Waiting for changes...');
}).catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
