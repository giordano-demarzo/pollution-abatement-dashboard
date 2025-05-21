// assets/js/utils/dataLoader.js
// Fixed version to ensure proper path loading

// Base paths for data - ensure consistency
const DATA_BASE_PATH = window.location.pathname === '/' ? '/optimized_data' : 'optimized_data';
const PROCESSED_DATA_PATH = window.location.pathname === '/' ? '/processed_data' : 'processed_data';

// Debug helper function
const debugFetch = async (url) => {
  console.log(`Fetching: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      
      // Try to load without leading slash
      if (url.startsWith('/') && !window.location.pathname.endsWith('/')) {
        const altUrl = url.substring(1);
        console.log(`Trying alternative path: ${altUrl}`);
        const altResponse = await fetch(altUrl);
        if (altResponse.ok) {
          console.log(`Successfully fetched from alternative path: ${altUrl}`);
          return altResponse.json();
        }
      }
      
      return null;
    }
    console.log(`Successfully fetched ${url}`);
    return response.json();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
};

// Log environment info
console.log('Environment info:', {
  hostname: window.location.hostname,
  pathname: window.location.pathname,
  href: window.location.href,
  dataBasePath: DATA_BASE_PATH
});

// Export data loading functions
export const loadDashboardSummary = async () => {
  return await debugFetch(`${DATA_BASE_PATH}/dashboard_summary.json`);
};

export const loadDashboardData = async () => {
  return await debugFetch(`${DATA_BASE_PATH}/dashboard_summary.json`);
};

export const loadBrefHierarchy = async () => {
  return await debugFetch(`${DATA_BASE_PATH}/bref_hierarchy_optimized.json`);
};

export const loadBrefFlatMap = async () => {
  return await debugFetch(`${DATA_BASE_PATH}/bref_hierarchy_optimized.json`);
};

export const loadPollutantPatentCounts = async () => {
  return await debugFetch(`${DATA_BASE_PATH}/pollutant_patent_counts.json`);
};

export const loadPollutantTopPatents = async (pollutantFilename) => {
  // Try the standard path first
  let result = await debugFetch(`${DATA_BASE_PATH}/pollutants/${pollutantFilename}_top.json`);
  
  // If that fails, try without the pollutants/ directory
  if (!result) {
    result = await debugFetch(`${DATA_BASE_PATH}/${pollutantFilename}_top.json`);
  }
  
  return result;
};

export const loadPollutantBrefHierarchy = async (pollutantFilename) => {
  // Try the standard path first
  let result = await debugFetch(`${DATA_BASE_PATH}/pollutant_bref_hierarchies/${pollutantFilename}_bref_hierarchy.json`);
  
  // If that fails, try without the subdirectory
  if (!result) {
    result = await debugFetch(`${DATA_BASE_PATH}/${pollutantFilename}_bref_hierarchy.json`);
  }
  
  return result;
};

export const loadBrefRelevanceScores = async (pollutantFilename) => {
  // Try the standard path first
  let result = await debugFetch(`${DATA_BASE_PATH}/bref_relevance/${pollutantFilename}_bref_relevance.json`);
  
  // If that fails, try without the subdirectory
  if (!result) {
    result = await debugFetch(`${DATA_BASE_PATH}/${pollutantFilename}_bref_relevance.json`);
  }
  
  return result;
};

export const loadSdgData = async (pollutantFilename) => {
  // Try the standard path first
  let result = await debugFetch(`${DATA_BASE_PATH}/sdgs/${pollutantFilename}_sdg_data.json`);
  
  // If that fails, try without the subdirectory
  if (!result) {
    result = await debugFetch(`${DATA_BASE_PATH}/${pollutantFilename}_sdg_data.json`);
  }
  
  return result;
};
