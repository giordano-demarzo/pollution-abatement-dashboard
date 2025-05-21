// start.js - A simple script to start the backend server in production
require('dotenv').config({ path: '.env.local' });
require('./server');

console.log('Starting Pollution Abatement Dashboard backend server...');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Using API URL:', process.env.PUBLIC_API_URL);
