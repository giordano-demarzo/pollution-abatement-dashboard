// build-scripts/dev.js
const { build } = require('esbuild');

// Manually load any environment variables needed
// Instead of using dotenv which causes issues with esbuild
const PUBLIC_API_URL = process.env.PUBLIC_API_URL || '/api/openai';

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
  console.log('Waiting for changes...');
}).catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
