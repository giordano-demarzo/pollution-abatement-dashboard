// assets/js/index.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import OptimizedPollutionAbatementDashboard from './components/OptimizedPollutionAbatementDashboard';
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    root.render(<OptimizedPollutionAbatementDashboard />);
  }
});
