// Helper functions file - assets/js/utils/dashboardHelpers.js

/**
 * Gets color based on relevance score
 * @param {number} score Relevance score (0-1)
 * @returns {string} Color hex code
 */
export const getColorByScore = (score) => {
  if (score > 0.8) return '#22c55e'; // Green for high relevance
  if (score > 0.6) return '#a3e635'; // Light green
  if (score > 0.4) return '#fbbf24'; // Yellow
  if (score > 0.2) return '#f97316'; // Orange
  return '#ef4444'; // Red for low relevance
};

/**
 * Calculate BREF relevance score for patents
 * @param {Object} patent Patent object
 * @param {string} brefId BREF section ID 
 * @returns {number} Relevance score (0-1)
 */
export const getBrefRelevanceScore = (patent, brefId) => {
  // Simplified calculation - in reality, this would use data from the BREF-patent matching file
  // or could be a pre-computed value in your dataset
  // For now, we'll use a simple heuristic based on the patent score and a random factor
  
  // Base score from the patent's overall relevance
  const baseScore = patent.score || 0.5;
  
  // Add a small variation based on the BREF ID to simulate different relevance to different BREFs
  // In production, this would come from your actual data
  const brefFactor = brefId ? 
    (brefId.charCodeAt(0) % 20) / 100 : 0; // Simple hash-like function
  
  return Math.min(0.95, Math.max(0.1, baseScore + brefFactor - 0.1));
};

/**
 * Calculate combined relevance score based on pollutant and BREF
 * @param {Object} patent Patent object
 * @param {string} selectedPollutant Selected pollutant name
 * @param {Object} selectedBref Selected BREF section object
 * @returns {number} Combined relevance score (0-1)
 */
export const getCombinedRelevanceScore = (patent, selectedPollutant, selectedBref) => {
  // Base score from pollutant relevance
  const pollutantScore = patent.score || 0.5;
  
  if (!selectedBref) {
    return pollutantScore; // If no BREF selected, use only pollutant score
  }
  
  // Get BREF relevance score
  const brefScore = getBrefRelevanceScore(patent, selectedBref.id);
  
  // Calculate weighted average (giving more weight to the more specific BREF)
  return (pollutantScore * 0.3) + (brefScore * 0.7);
};

/**
 * Get impact label based on score
 * @param {number} impact Impact score (0-100)
 * @returns {string} Impact label
 */
export const getImpactLabel = (impact) => {
  if (impact >= 80) return 'Very High Impact';
  if (impact >= 60) return 'High Impact';
  if (impact >= 40) return 'Medium Impact';
  if (impact >= 20) return 'Low Impact';
  return 'Very Low Impact';
};

/**
 * Get a summary description for a patent
 * @param {string} title Patent title
 * @param {string} pollutant Pollutant name 
 * @returns {string} Patent summary
 */
export const getPatentSummary = (title, pollutant) => {
  // This would ideally come from your data
  // For now, using the abstract if available or a generic description
  return `This patent describes a technology for ${pollutant} reduction or mitigation.`;
};

/**
 * Get SDG contribution for a patent
 * @param {string} sdg SDG name or ID
 * @param {string} patentTitle Patent title
 * @returns {string} Contribution description
 */
export const getSDGContribution = (sdg, patentTitle) => {
  // This would ideally come from your data
  return `Contributing to ${sdg} through innovative pollution reduction technology.`;
};

/**
 * Get impact description for SDG and pollutant
 * @param {string} sdg SDG name or ID
 * @param {string} pollutant Pollutant name
 * @returns {string} Impact description
 */
export const getImpactDescription = (sdg, pollutant) => {
  return `${pollutant} reduction technologies impact ${sdg} through improved environmental performance.`;
};
