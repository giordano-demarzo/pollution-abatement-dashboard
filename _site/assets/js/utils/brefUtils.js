// assets/js/utils/brefUtils.js

/**
 * Helper functions for working with BREF data
 */

/**
 * Formats BREF text with section highlighting and improved formatting
 * @param {string} text - The raw BREF text content
 * @returns {string} HTML-formatted text
 */
export function formatBrefText(text) {
  if (!text) return '';
  
  // Replace double spaces with a paragraph break
  let formatted = text
    .replace(/\s{2,}/g, '\n\n')
    // Format section headings (based on typical BREF section structure)
    .replace(/(Description|Technical description|Achieved environmental benefits|Environmental performance|Cross-media effects|Technical considerations|Economics|Driving force|Example plants|Reference literature):/g, 
      '<strong class="text-blue-700 block mt-3 mb-1">$1:</strong>')
    // Replace newlines with <br> tags
    .replace(/\n/g, '<br>');
  
  return formatted;
}

/**
 * Extracts a clean section name from a BREF ID
 * @param {string} brefId - The full BREF ID (e.g., "LVOC:::4.4.5.2.2")
 * @returns {string} The clean section name
 */
export function getBrefSectionName(brefId) {
  if (!brefId) return '';
  
  // Split by ":::" and take the last part
  const parts = brefId.split(':::');
  let sectionName = parts.length > 1 ? parts[parts.length - 1] : brefId;
  
  // Clean up section name (remove underscores, etc.)
  sectionName = sectionName.replace(/_/g, ' ');
  
  return sectionName;
}

/**
 * Gets the BREF type from a BREF ID
 * @param {string} brefId - The full BREF ID (e.g., "LVOC:::4.4.5.2.2")
 * @returns {string} The BREF type (e.g., "LVOC")
 */
export function getBrefType(brefId) {
  if (!brefId) return '';
  
  // Split by ":::" and take the first part
  const parts = brefId.split(':::');
  return parts.length > 0 ? parts[0] : '';
}

/**
 * Formats a BREF path for display
 * @param {Array} path - Array of path objects with id and name
 * @returns {string} Formatted path string
 */
export function formatBrefPath(path) {
  if (!path || !Array.isArray(path) || path.length === 0) return '';
  
  return path
    .map(segment => segment.name || getBrefSectionName(segment.id))
    .join(' > ');
}

/**
 * Checks if BREF text exists and has meaningful content
 * @param {string} text - BREF text to check
 * @returns {boolean} True if the text has meaningful content
 */
export function hasMeaningfulBrefText(text) {
  if (!text) return false;
  
  // Strip any HTML tags for content checking
  const strippedText = text.replace(/<[^>]*>/g, '');
  
  // Check if there's some actual content (more than just a few chars)
  return strippedText.trim().length > 20;
}

/**
 * Extracts a title from the BREF text if available
 * @param {string} text - The BREF text content
 * @returns {string} The extracted title or empty string
 */
export function extractBrefTitle(text) {
  if (!text) return '';
  
  // Try to find the first line which usually contains the title
  const lines = text.split(/\n|\r|\r\n/);
  if (lines.length > 0) {
    return lines[0].trim();
  }
  
  return '';
}

/**
 * Determines if a BREF node is a leaf node (end document)
 * @param {Object} node - BREF node to check
 * @returns {boolean} True if the node is a leaf
 */
export function isBrefLeafNode(node) {
  if (!node) return false;
  
  // Check the is_leaf property if available
  if (typeof node.is_leaf === 'boolean') {
    return node.is_leaf;
  }
  
  // Otherwise check if it has no children
  return !node.children || 
    (Array.isArray(node.children) && node.children.length === 0) ||
    (typeof node.children === 'object' && Object.keys(node.children).length === 0);
}

// Export all functions as a default object
export default {
  formatBrefText,
  getBrefSectionName,
  getBrefType,
  formatBrefPath,
  hasMeaningfulBrefText,
  extractBrefTitle,
  isBrefLeafNode
};
