// assets/js/utils/dataLoader.js

// Import papaparse at the top of the file
import Papa from 'papaparse';

// Configuration for data files with dynamic path resolution
// Determine if we need leading slashes based on the current URL
const needsLeadingSlash = window.location.pathname === '/';
const formatPath = (path) => needsLeadingSlash ? path : path.replace(/^\//, '');

const DATA_CONFIG = {
  basePath: formatPath('/optimized_data'),
  dashboardSummary: formatPath('/optimized_data/dashboard_summary.json'),
  sdgData: formatPath('/optimized_data/sdgs/sdg_data.json'),
  brefHierarchy: formatPath('/optimized_data/bref_hierarchy_optimized.json'),
  pollutantFilenames: formatPath('/optimized_data/pollutant_filenames.json'),
  patentIndex: formatPath('/optimized_data/indexes/patent_index.json'),
  patentChunksPath: formatPath('/optimized_data/patents_chunks/patents_chunk_'),
  pollutantsPath: formatPath('/optimized_data/pollutants/'),
  brefTextsPath: formatPath('/processed_data/brefs_texts_final.csv'),
  pollutantBrefHierarchiesPath: formatPath('/optimized_data/pollutant_bref_hierarchies'),
  pollutantBrefLookup: formatPath('/optimized_data/pollutant_bref_lookup.json'),
};

// Log the environment and paths for debugging
console.log('URL Info:', {
  href: window.location.href,
  pathname: window.location.pathname,
  needsLeadingSlash
});
console.log('DATA_CONFIG paths:', {
  basePath: DATA_CONFIG.basePath,
  dashboardSummary: DATA_CONFIG.dashboardSummary
});

// Client-side cache to prevent reloading the same data
const dataCache = {
  summary: { data: null, timestamp: 0 },
  sdgData: { data: null, timestamp: 0 },
  brefHierarchy: { data: null, timestamp: 0 },
  brefFlatMap: { data: null, timestamp: 0 },
  pollutantFilenames: { data: null, timestamp: 0 },
  patentIndex: { data: null, timestamp: 0 },
  patentChunks: {},
  pollutants: {},
  pollutantScores: {},
  brefTexts: {},
  brefTextsData: null,
  pollutantBrefHierarchies: {},
  pollutantBrefLookup: { data: null, timestamp: 0 },
};

// Cache expiration time in milliseconds (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

// Enhanced fetch with timeout, error handling, and path retry
async function enhancedFetch(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 15000); // 15 second timeout default
  
  console.log(`Fetching URL: ${url}`);
  
  try {
    const response = await fetch(url, { 
      ...options, 
      signal: controller.signal 
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // If the URL starts with a slash and the response fails, try without the leading slash
      if (url.startsWith('/') && !window.location.pathname.endsWith('/')) {
        console.log(`Retrying URL without leading slash: ${url.substring(1)}`);
        return enhancedFetch(url.substring(1), options);
      }
      
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    
    console.log(`Fetch successful for: ${url}`);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Enhance error with more context
    const enhancedError = new Error(`Failed to fetch ${url}: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.isTimeout = error.name === 'AbortError';
    throw enhancedError;
  }
}

// Check if cache is still valid
function isCacheValid(cacheItem) {
  if (!cacheItem || !cacheItem.data) return false;
  return (Date.now() - cacheItem.timestamp) < CACHE_EXPIRATION;
}

// Update cache with new data
function updateCache(cacheKey, data) {
  dataCache[cacheKey] = {
    data,
    timestamp: Date.now()
  };
  return data;
}

// Load the dashboard summary data
export async function loadDashboardSummary() {
  // Check cache first
  if (isCacheValid(dataCache.summary)) {
    return dataCache.summary.data;
  }
  
  try {
    const response = await enhancedFetch(DATA_CONFIG.dashboardSummary);
    const data = await response.json();
    return updateCache('summary', data);
  } catch (error) {
    console.error('Error loading dashboard summary:', error);
    
    // Fallback: If cached data exists but is expired, still use it in case of error
    if (dataCache.summary.data) {
      console.log('Using expired cache for dashboard summary');
      return dataCache.summary.data;
    }
    
    // Create minimal summary structure to avoid errors
    return {
      totalPatents: 0,
      totalPollutants: 0,
      relevanceThreshold: 0.5,
      creation_date: '',
      pollutants: [],
      totalChunks: 0
    };
  }
}

// Load the main SDG data with improved error handling
export async function loadSdgData() {
  if (isCacheValid(dataCache.sdgData)) {
    return dataCache.sdgData.data;
  }
  
  try {
    const response = await enhancedFetch(DATA_CONFIG.sdgData);
    const data = await response.json();
    return updateCache('sdgData', data);
  } catch (error) {
    console.error('Error loading SDG data:', error);
    
    // Fallback to expired cache if available
    if (dataCache.sdgData.data) {
      console.log('Using expired cache for SDG data');
      return dataCache.sdgData.data;
    }
    
    // Create minimal SDG data structure
    return {
      'SDG 6': { title: 'Clean Water and Sanitation', pollutants: [] },
      'SDG 13': { title: 'Climate Action', pollutants: [] },
      'SDG 14': { title: 'Life Below Water', pollutants: [] }
    };
  }
}

// Load combined dashboard data with optimized data structure handling
export async function loadDashboardData() {
  try {
    // Load summary, SDG data, and pollutant filenames in parallel for better performance
    const [summary, sdgData, pollutantFilenames] = await Promise.all([
      loadDashboardSummary(),
      loadSdgData(),
      loadPollutantFilenames(),
    ]);
    
    // Construct a combined data structure similar to the original format
    // but optimized for the React component's consumption
    return {
      // Convert SDG data format
      sdgs: sdgData,
      
      // Extract pollutant names from summary
      pollutants: summary.pollutants?.map(p => typeof p === 'string' ? p : p.name) || [],
      
      // Transform SDG impact data into expected format
      sdgImpact: Object.keys(sdgData || {}).reduce((acc, sdgId) => {
        const pollutants = sdgData[sdgId]?.pollutants || [];
        acc[sdgId] = pollutants.map(p => ({
          sdg: sdgId,
          pollutant: p.name,
          impact: p.impact,
        }));
        return acc;
      }, {}),
      
      // Include metadata for reference
      metadata: {
        creation_date: summary.creation_date || '',
        total_patents: summary.totalPatents || 0,
        total_pollutants: summary.totalPollutants || 0,
        relevance_threshold: summary.relevanceThreshold || 0.5,
      },
      
      // Include pollutant filename mapping for convenience
      pollutant_filenames: pollutantFilenames || {},
    };
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    // Return minimal structure to prevent UI errors
    return {
      sdgs: {},
      pollutants: [],
      sdgImpact: {},
      metadata: {},
      pollutant_filenames: {}
    };
  }
}

// Load the optimized BREF hierarchy
export async function loadBrefHierarchy() {
  if (isCacheValid(dataCache.brefHierarchy)) {
    return dataCache.brefHierarchy.data;
  }
  
  try {
    const response = await enhancedFetch(DATA_CONFIG.brefHierarchy);
    const data = await response.json();
    
    // Store both hierarchy and flat map
    updateCache('brefHierarchy', data.hierarchy || {});
    updateCache('brefFlatMap', data.flatMap || {});
    
    return data.hierarchy || {};
  } catch (error) {
    console.error('Error loading BREF hierarchy:', error);
    
    // Fallback to expired cache if available
    if (dataCache.brefHierarchy.data) {
      console.log('Using expired cache for BREF hierarchy');
      return dataCache.brefHierarchy.data;
    }
    
    // Return minimal structure
    return {};
  }
}

// Load the flat BREF map for quick lookups with improved caching
export async function loadBrefFlatMap() {
  if (isCacheValid(dataCache.brefFlatMap)) {
    return dataCache.brefFlatMap.data;
  }
  
  try {
    // If we already loaded the hierarchy but not the flat map,
    // don't fetch again - this case shouldn't happen with the new caching system
    // but keeping it for safety
    if (isCacheValid(dataCache.brefHierarchy) && !isCacheValid(dataCache.brefFlatMap)) {
      console.log('Loading hierarchy to get flat map');
      await loadBrefHierarchy();
      return dataCache.brefFlatMap.data;
    }
    
    // Standard load
    const response = await enhancedFetch(DATA_CONFIG.brefHierarchy);
    const data = await response.json();
    
    updateCache('brefHierarchy', data.hierarchy || {});
    updateCache('brefFlatMap', data.flatMap || {});
    
    return data.flatMap || {};
  } catch (error) {
    console.error('Error loading BREF flat map:', error);
    
    // Fallback to expired cache
    if (dataCache.brefFlatMap.data) {
      console.log('Using expired cache for BREF flat map');
      return dataCache.brefFlatMap.data;
    }
    
    return {};
  }
}

// Load pollutant filenames mapping
export async function loadPollutantFilenames() {
  if (isCacheValid(dataCache.pollutantFilenames)) {
    return dataCache.pollutantFilenames.data;
  }
  
  try {
    const response = await enhancedFetch(DATA_CONFIG.pollutantFilenames);
    const data = await response.json();
    return updateCache('pollutantFilenames', data);
  } catch (error) {
    console.error('Error loading pollutant filenames:', error);
    
    // Fallback to expired cache
    if (dataCache.pollutantFilenames.data) {
      return dataCache.pollutantFilenames.data;
    }
    
    return {};
  }
}

// Load patent index for fast lookups
export async function loadPatentIndex() {
  if (isCacheValid(dataCache.patentIndex)) {
    return dataCache.patentIndex.data;
  }
  
  try {
    const response = await enhancedFetch(DATA_CONFIG.patentIndex);
    const data = await response.json();
    return updateCache('patentIndex', data);
  } catch (error) {
    console.error('Error loading patent index:', error);
    
    // Fallback to expired cache
    if (dataCache.patentIndex.data) {
      return dataCache.patentIndex.data;
    }
    
    return {};
  }
}

// Load a specific chunk of patent coordinates with improved caching
export async function loadPatentChunk(chunkIndex) {
  const cacheKey = `chunk_${chunkIndex}`;
  
  if (dataCache.patentChunks[cacheKey] && 
      dataCache.patentChunks[cacheKey].data && 
      Date.now() - dataCache.patentChunks[cacheKey].timestamp < CACHE_EXPIRATION) {
    return dataCache.patentChunks[cacheKey].data;
  }
  
  try {
    const response = await enhancedFetch(`${DATA_CONFIG.patentChunksPath}${chunkIndex}.json`);
    const data = await response.json();
    
    // Update chunk cache
    dataCache.patentChunks[cacheKey] = {
      data,
      timestamp: Date.now()
    };
    
    return data;
  } catch (error) {
    console.error(`Error loading patent chunk ${chunkIndex}:`, error);
    
    // Fallback to expired cache
    if (dataCache.patentChunks[cacheKey] && dataCache.patentChunks[cacheKey].data) {
      return dataCache.patentChunks[cacheKey].data;
    }
    
    return [];
  }
}

// Load visible patents for the current viewable area with optimized filtering
export async function loadVisiblePatents(viewBounds, pollutantFilename, showAllPatents = false) {
  try {
    // First, load the patent index and pollutant scores in parallel
    const [patentIndex, pollutantScores] = await Promise.all([
      loadPatentIndex(),
      loadPollutantScores(pollutantFilename)
    ]);
    
    if (!patentIndex || Object.keys(patentIndex).length === 0) {
      console.warn('Patent index is empty or failed to load');
      return [];
    }
    
    // Filter patents within view bounds
    const { xMin, xMax, yMin, yMax } = viewBounds;
    const visiblePatents = [];
    
    // Use faster array method if available
    const patentIds = Object.keys(patentIndex);
    
    // Performance optimization: pre-check if we should always include patents
    // regardless of score (showAllPatents), to avoid checking in each iteration
    if (showAllPatents) {
      for (let i = 0; i < patentIds.length; i++) {
        const patentId = patentIds[i];
        const patent = patentIndex[patentId];
        
        if (patent.x >= xMin && patent.x <= xMax && patent.y >= yMin && patent.y <= yMax) {
          visiblePatents.push({
            id: patentId,
            x: patent.x,
            y: patent.y,
            title: patent.title || `Patent ${patentId}`,
            year: patent.year || null,
            abstract: patent.abstract || patent.text || null,
            score: pollutantScores[patentId] || 0
          });
        }
      }
    } else {
      // Only include patents with a score
      for (let i = 0; i < patentIds.length; i++) {
        const patentId = patentIds[i];
        const patent = patentIndex[patentId];
        const score = pollutantScores[patentId] || 0;
        
        if (score > 0 && patent.x >= xMin && patent.x <= xMax && patent.y >= yMin && patent.y <= yMax) {
          visiblePatents.push({
            id: patentId,
            x: patent.x,
            y: patent.y,
            title: patent.title || `Patent ${patentId}`,
            year: patent.year || null,
            abstract: patent.abstract || patent.text || null,
            score
          });
        }
      }
    }
    
    return visiblePatents;
  } catch (error) {
    console.error('Error loading visible patents:', error);
    return [];
  }
}

// Load all patent coordinates (with chunk loading progress reporting)
export async function loadPatentCoordinates() {
  try {
    // Load the dashboard summary to get total chunks
    const summary = await loadDashboardSummary();
    if (!summary || !summary.totalChunks) {
      throw new Error('Failed to load dashboard summary or totalChunks not available');
    }
    
    console.log(`Loading ${summary.totalChunks} patent chunks...`);
    
    // Load all chunks in parallel
    const chunkPromises = [];
    for (let i = 0; i < summary.totalChunks; i++) {
      // Wrap each chunk load with progress tracking
      chunkPromises.push(
        loadPatentChunk(i)
          .then(chunk => {
            const progress = Math.round(((i + 1) / summary.totalChunks) * 100);
            if (progress % 20 === 0) { // Log every 20%
              console.log(`Patent chunk loading: ${progress}% complete`);
            }
            return chunk;
          })
      );
    }
    
    const chunks = await Promise.all(chunkPromises);
    console.log('All patent chunks loaded successfully');
    
    // Combine all chunks into a single array
    return chunks.flat();
  } catch (error) {
    console.error('Error loading all patent coordinates:', error);
    return [];
  }
}

// Load top patents for a specific pollutant with improved error handling
export async function loadPollutantTopPatents(pollutantFilename) {
  if (!pollutantFilename) {
    console.error('No pollutant filename provided to loadPollutantTopPatents');
    return [];
  }
  
  const cacheKey = `${pollutantFilename}_top`;
  
  // Check cache
  if (dataCache.pollutants[cacheKey] && 
      dataCache.pollutants[cacheKey].data && 
      Date.now() - dataCache.pollutants[cacheKey].timestamp < CACHE_EXPIRATION) {
    return dataCache.pollutants[cacheKey].data;
  }
  
  try {
    const response = await enhancedFetch(`${DATA_CONFIG.pollutantsPath}${pollutantFilename}_top.json`);
    const data = await response.json();
    
    // Update cache
    dataCache.pollutants[cacheKey] = {
      data,
      timestamp: Date.now()
    };
    
    return data;
  } catch (error) {
    console.error(`Error loading top patents for ${pollutantFilename}:`, error);
    
    // Fallback to expired cache
    if (dataCache.pollutants[cacheKey] && dataCache.pollutants[cacheKey].data) {
      console.log(`Using expired cache for ${pollutantFilename} top patents`);
      return dataCache.pollutants[cacheKey].data;
    }
    
    return [];
  }
}

// Load patent scores for a specific pollutant with improved caching
export async function loadPollutantScores(pollutantFilename) {
  if (!pollutantFilename) {
    console.error('No pollutant filename provided to loadPollutantScores');
    return {};
  }
  
  // Check cache
  if (dataCache.pollutantScores[pollutantFilename] && 
      dataCache.pollutantScores[pollutantFilename].data && 
      Date.now() - dataCache.pollutantScores[pollutantFilename].timestamp < CACHE_EXPIRATION) {
    return dataCache.pollutantScores[pollutantFilename].data;
  }
  
  try {
    const response = await enhancedFetch(`${DATA_CONFIG.pollutantsPath}${pollutantFilename}_scores.json`);
    const data = await response.json();
    
    // Update cache
    dataCache.pollutantScores[pollutantFilename] = {
      data,
      timestamp: Date.now()
    };
    
    return data;
  } catch (error) {
    console.error(`Error loading scores for ${pollutantFilename}:`, error);
    
    // Fallback to expired cache
    if (dataCache.pollutantScores[pollutantFilename] && dataCache.pollutantScores[pollutantFilename].data) {
      console.log(`Using expired cache for ${pollutantFilename} scores`);
      return dataCache.pollutantScores[pollutantFilename].data;
    }
    
    return {};
  }
}

// Legacy function for backward compatibility
export async function loadPollutantPatents(pollutantFilename) {
  try {
    return await loadPollutantTopPatents(pollutantFilename);
  } catch (error) {
    console.error(`Error loading patents for ${pollutantFilename}:`, error);
    return [];
  }
}

// Load text for a specific BREF section from CSV file
export async function loadBrefText(brefId) {
  if (!brefId) {
    console.error('No BREF ID provided to loadBrefText');
    return 'Error: No BREF ID provided';
  }
  
  // Check cache first
  if (dataCache.brefTexts[brefId]) {
    console.log(`Using cached BREF text for ${brefId}`);
    return dataCache.brefTexts[brefId];
  }
  
  try {
    // Load the CSV if we haven't already
    if (!dataCache.brefTextsData) {
      console.log('Loading BREF CSV data...');
      
      const response = await enhancedFetch(DATA_CONFIG.brefTextsPath);
      const csvText = await response.text();
      
      // Debug: log a sample of the CSV
      console.log('CSV sample:', csvText.substring(0, 200) + '...');
      
      // Use PapaParse to parse the CSV
      const parsedData = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        transformHeader: (header) => header.trim(),
        // The CSV might have quoted fields with commas inside
        quoteChar: '"',
        escapeChar: '"',
      });
      
      // Check if parsing was successful
      if (parsedData.errors && parsedData.errors.length > 0) {
        console.error('CSV parsing errors:', parsedData.errors);
      }
      
      // Create a lookup object using the 'code' field as key
      dataCache.brefTextsData = {};
      if (parsedData && parsedData.data) {
        console.log(`Parsed ${parsedData.data.length} BREF entries`);
        
        parsedData.data.forEach(row => {
          if (row.code) {
            // Store the whole row for reference
            dataCache.brefTextsData[row.code] = row;
          }
        });
        
        console.log(`Created BREF text data cache with ${Object.keys(dataCache.brefTextsData).length} entries`);
      } else {
        console.error('Failed to parse BREF CSV data properly:', parsedData);
      }
    }
    
    // Get the BREF data for the requested ID
    const brefData = dataCache.brefTextsData[brefId];
    
    if (!brefData) {
      console.warn(`BREF section not found: ${brefId}`);
      return `BREF section ${brefId} not found in the data`;
    }
    
    // Use the final_texts field first (which contains the formatted text),
    // then try text field, and if neither is available, use a fallback message
    const text = brefData.final_texts || brefData.text || `No content available for BREF section ${brefId}`;
    
    // Cache the text for future use
    dataCache.brefTexts[brefId] = text;
    return text;
  } catch (error) {
    console.error(`Error loading BREF text for ${brefId}:`, error);
    return `Error loading text for BREF section ${brefId}: ${error.message}`;
  }
}

// Load BREF metadata for a specific section
export async function loadBrefMetadata(brefId) {
  try {
    // Load flat map if not already loaded
    const flatMap = await loadBrefFlatMap();
    return flatMap[brefId] || null;
  } catch (error) {
    console.error(`Error loading BREF metadata for ${brefId}:`, error);
    return null;
  }
}

// Load pollutant patent counts for sorting and display
export async function loadPollutantPatentCounts() {
  const cacheKey = `pollutant_patent_counts`;
  
  // Check cache
  if (dataCache[cacheKey] && 
      dataCache[cacheKey].data && 
      Date.now() - dataCache[cacheKey].timestamp < CACHE_EXPIRATION) {
    return dataCache[cacheKey].data;
  }
  
  try {
    // In a real implementation, we would fetch this data from an endpoint
    // For now, we'll generate it from the existing data
    
    // Get pollutant list and pollutant filenames
    const [summary, pollutantFilenames] = await Promise.all([
      loadDashboardSummary(),
      loadPollutantFilenames()
    ]);
    
    const counts = {};
    
    // First, initialize counts from the pollutants in the summary
    if (summary && summary.pollutants) {
      for (const pollutant of summary.pollutants) {
        const pollutantName = typeof pollutant === 'string' ? pollutant : pollutant.name;
        counts[pollutantName] = 0;
      }
    }
    
    // For each pollutant, try to load its patent scores file and count the entries
    if (pollutantFilenames) {
      for (const [pollutantName, filename] of Object.entries(pollutantFilenames)) {
        try {
          // Try to load the scores file which has all patents for this pollutant
          const scores = await loadPollutantScores(filename);
          
          // Count the number of patents
          counts[pollutantName] = Object.keys(scores || {}).length;
        } catch (error) {
          console.warn(`Couldn't load scores for ${pollutantName}`);
          // If we couldn't load the scores, leave the count at 0
        }
      }
    }
    
    // Cache the results
    dataCache[cacheKey] = {
      data: counts,
      timestamp: Date.now()
    };
    
    return counts;
  } catch (error) {
    console.error('Error loading pollutant patent counts:', error);
    return {};
  }
}

/**
 * Load BREF hierarchy for a specific pollutant with match information
 * @param {string} pollutantFilename - The filename-safe version of the pollutant name
 * @returns {Promise<Object>} The pollutant-specific BREF hierarchy
 */
export async function loadPollutantBrefHierarchy(pollutantFilename) {
  if (!pollutantFilename) {
    console.error('No pollutant filename provided to loadPollutantBrefHierarchy');
    return null;
  }
  
  const cacheKey = `${pollutantFilename}`;
  
  // Check cache first
  if (dataCache.pollutantBrefHierarchies[cacheKey] && 
      dataCache.pollutantBrefHierarchies[cacheKey].data && 
      Date.now() - dataCache.pollutantBrefHierarchies[cacheKey].timestamp < CACHE_EXPIRATION) {
    return dataCache.pollutantBrefHierarchies[cacheKey].data;
  }
  
  try {
    const response = await enhancedFetch(`${DATA_CONFIG.pollutantBrefHierarchiesPath}/${pollutantFilename}_bref_hierarchy.json`);
    const data = await response.json();
    
    // Update cache
    dataCache.pollutantBrefHierarchies[cacheKey] = {
      data,
      timestamp: Date.now()
    };
    
    return data;
  } catch (error) {
    console.error(`Error loading BREF hierarchy for pollutant ${pollutantFilename}:`, error);
    
    // Fallback to the standard BREF hierarchy
    console.log('Falling back to standard BREF hierarchy');
    const standardHierarchy = await loadBrefHierarchy();
    return standardHierarchy || {};
  }
}

/**
 * Load the lookup table that shows which BREF sections match each pollutant
 * @returns {Promise<Object>} The pollutant-BREF lookup table
 */
export async function loadPollutantBrefLookup() {
  // Check cache first
  if (isCacheValid(dataCache.pollutantBrefLookup)) {
    return dataCache.pollutantBrefLookup.data;
  }
  
  try {
    const response = await enhancedFetch(DATA_CONFIG.pollutantBrefLookup);
    const data = await response.json();
    return updateCache('pollutantBrefLookup', data);
  } catch (error) {
    console.error('Error loading pollutant-BREF lookup:', error);
    
    // Fallback to expired cache if available
    if (dataCache.pollutantBrefLookup.data) {
      console.log('Using expired cache for pollutant-BREF lookup');
      return dataCache.pollutantBrefLookup.data;
    }
    
    return {};
  }
}

/**
 * Load BREF relevance scores for a specific pollutant with improved debugging
 * @param {string} pollutantFilename - The filename-safe version of the pollutant name
 * @returns {Promise<Object>} Dictionary mapping patent IDs to BREF relevance scores
 */
export async function loadBrefRelevanceScores(pollutantFilename) {
  if (!pollutantFilename) {
    console.error('No pollutant filename provided to loadBrefRelevanceScores');
    return {};
  }
  
  const cacheKey = `${pollutantFilename}_bref_relevance`;
  
  // Check cache first
  if (dataCache.pollutants[cacheKey] && 
      dataCache.pollutants[cacheKey].data && 
      Date.now() - dataCache.pollutants[cacheKey].timestamp < CACHE_EXPIRATION) {
    console.log(`Using cached BREF relevance scores for ${pollutantFilename}`);
    return dataCache.pollutants[cacheKey].data;
  }
  
  try {
    console.log(`Loading BREF relevance scores for ${pollutantFilename}`);
    // Try multiple potential paths
    let response;
    try {
      response = await enhancedFetch(`${DATA_CONFIG.pollutantsPath}../bref_relevance/${pollutantFilename}_bref_relevance.json`);
    } catch (err) {
      console.log('First path failed, trying alternative path...');
      response = await enhancedFetch(`${DATA_CONFIG.basePath}/bref_relevance/${pollutantFilename}_bref_relevance.json`);
    }
    
    const data = await response.json();
    
    // Debug log for structure verification
    const samplePatentId = Object.keys(data)[0];
    if (samplePatentId) {
      console.log(`Sample BREF relevance structure for patent ${samplePatentId}:`, 
        data[samplePatentId]);
    }
    
    // Update cache
    dataCache.pollutants[cacheKey] = {
      data,
      timestamp: Date.now()
    };
    
    return data;
  } catch (error) {
    console.error(`Error loading BREF relevance scores for ${pollutantFilename}:`, error);
    
    // Fallback to expired cache
    if (dataCache.pollutants[cacheKey] && dataCache.pollutants[cacheKey].data) {
      console.log(`Using expired cache for ${pollutantFilename} BREF relevance scores`);
      return dataCache.pollutants[cacheKey].data;
    }
    
    return {};
  }
}

/**
 * Load patent details by ID from the patent index
 * @param {string} patentId - The ID of the patent to load
 * @returns {Promise<Object>} The patent details
 */
export async function loadPatentDetails(patentId) {
  if (!patentId) {
    console.error('No patent ID provided to loadPatentDetails');
    return null;
  }
  
  try {
    // Load the patent index
    const patentIndex = await loadPatentIndex();
    
    if (!patentIndex || !patentIndex[patentId]) {
      console.error(`Patent ${patentId} not found in index`);
      return null;
    }
    
    return patentIndex[patentId];
  } catch (error) {
    console.error(`Error loading patent details for ${patentId}:`, error);
    return null;
  }
}

/**
 * Check if a BREF section matches the selected pollutant
 * @param {string} brefId - The BREF section ID
 * @param {string} pollutant - The pollutant name
 * @returns {Promise<boolean>} Whether the BREF matches the pollutant
 */
export async function checkBrefPollutantMatch(brefId, pollutant) {
  if (!brefId || !pollutant) return false;
  
  try {
    const lookup = await loadPollutantBrefLookup();
    return lookup[pollutant]?.includes(brefId) || false;
  } catch (error) {
    console.error('Error checking BREF-pollutant match:', error);
    return false;
  }
}

// New function: Clear cache to free memory
export function clearCache(cacheType = null) {
  if (!cacheType) {
    // Clear all caches
    Object.keys(dataCache).forEach(key => {
      if (typeof dataCache[key] === 'object' && dataCache[key] !== null) {
        if ('data' in dataCache[key]) {
          dataCache[key].data = null;
        } else {
          dataCache[key] = {};
        }
      }
    });
    console.log('All data caches cleared');
  } else if (cacheType in dataCache) {
    // Clear specific cache
    if (typeof dataCache[cacheType] === 'object' && dataCache[cacheType] !== null) {
      if ('data' in dataCache[cacheType]) {
        dataCache[cacheType].data = null;
      } else {
        dataCache[cacheType] = {};
      }
      console.log(`Cache for ${cacheType} cleared`);
    }
  } else {
    console.warn(`Unknown cache type: ${cacheType}`);
  }
}

// New function: Get cached data status
export function getCacheStatus() {
  const status = {};
  
  Object.keys(dataCache).forEach(key => {
    if (typeof dataCache[key] === 'object' && dataCache[key] !== null) {
      if ('data' in dataCache[key] && 'timestamp' in dataCache[key]) {
        const timeSinceUpdate = Date.now() - dataCache[key].timestamp;
        const expiresIn = Math.max(0, CACHE_EXPIRATION - timeSinceUpdate);
        
        status[key] = {
          isCached: !!dataCache[key].data,
          age: timeSinceUpdate,
          expiresIn,
          isExpired: timeSinceUpdate > CACHE_EXPIRATION
        };
      } else if (key === 'patentChunks' || key === 'pollutants' || key === 'pollutantScores' || key === 'pollutantBrefHierarchies') {
        const entries = Object.keys(dataCache[key]).length;
        status[key] = {
          isCached: entries > 0,
          entries
        };
      }
    }
  });
  
  return status;
}

// Export all functions for use in the application
export default {
  loadDashboardSummary,
  loadSdgData,
  loadDashboardData,
  loadBrefHierarchy,
  loadBrefFlatMap,
  loadPollutantFilenames,
  loadPatentIndex,
  loadPatentChunk,
  loadVisiblePatents,
  loadPatentCoordinates,
  loadPollutantTopPatents,
  loadPollutantScores,
  loadPollutantPatents,
  loadBrefText,
  loadBrefMetadata,
  loadPollutantPatentCounts,
  loadPollutantBrefHierarchy,
  loadPollutantBrefLookup,
  checkBrefPollutantMatch,
  clearCache,
  getCacheStatus,
  loadBrefRelevanceScores,
  loadPatentDetails
};
