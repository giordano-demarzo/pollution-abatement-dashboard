// HierarchicalBrefSelector.jsx - Final version with proper node selection

import { useState, useCallback, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronDown, AlertCircle, BookOpen, Filter } from 'lucide-react';
import { getBrefSectionName } from '../utils/brefUtils';
import { loadBrefRelevanceScores } from '../utils/dataLoader';

/**
 * Component for selecting BREFs in a hierarchical tree view with pollutant match indicators
 * and pollutant-specific patent count display
 */
const HierarchicalBrefSelector = ({ 
  brefHierarchy, 
  selectedBref, 
  onBrefSelect,
  className = '',
  selectedPollutant = null,
  selectedPollutantFilename = null,
  isLoading = false
}) => {
  // Track expanded state for each node
  const [expandedNodes, setExpandedNodes] = useState({});
  // Toggle to only show relevant documents
  const [showOnlyRelevant, setShowOnlyRelevant] = useState(false);
  // Store BREF relevance scores for patent counting
  const [brefRelevanceScores, setBrefRelevanceScores] = useState({});
  // Cache for patent counts by BREF ID
  const [patentCountCache, setPatentCountCache] = useState({});
  // Cache for pollutant-relevant nodes
  const [relevantNodesCache, setRelevantNodesCache] = useState({});
  // Loading state for relevance scores
  const [loadingRelevanceScores, setLoadingRelevanceScores] = useState(false);
  
  // Reliability threshold for patent counting
  const RELIABILITY_THRESHOLD = 0.68;
  
  // Load BREF relevance scores for patent counting
  useEffect(() => {
    const fetchBrefScores = async () => {
      if (!selectedPollutantFilename) {
        setPatentCountCache({});
        setRelevantNodesCache({});
        return;
      }

      try {
        setLoadingRelevanceScores(true);
        const scores = await loadBrefRelevanceScores(selectedPollutantFilename);
        if (scores) {
          console.log(`Loaded BREF relevance scores for patent counting`, 
            Object.keys(scores).length + " patents have scores");
          setBrefRelevanceScores(scores);
          
          // Find all relevant nodes from the hierarchy
          const relevantNodes = findRelevantNodes(brefHierarchy);
          setRelevantNodesCache(relevantNodes);
          
          // Calculate and cache all patent counts for each BREF ID
          calculateAllPatentCounts(scores, brefHierarchy, relevantNodes);
        } else {
          console.warn('No BREF relevance scores available for patent counting');
          setBrefRelevanceScores({});
          setPatentCountCache({});
          setRelevantNodesCache({});
        }
      } catch (err) {
        console.error(`Error loading BREF relevance data for patent counting:`, err);
        setBrefRelevanceScores({});
        setPatentCountCache({});
        setRelevantNodesCache({});
      } finally {
        setLoadingRelevanceScores(false);
      }
    };

    fetchBrefScores();
  }, [selectedPollutantFilename, brefHierarchy]);
  
  // Find all nodes relevant to the current pollutant
  const findRelevantNodes = (hierarchy) => {
    const relevantNodes = {};
    
    const traverseNode = (node) => {
      // If this is an array of nodes
      if (Array.isArray(node)) {
        node.forEach(childNode => traverseNode(childNode));
        return;
      }
      
      // If this is not an object, skip it
      if (!node || typeof node !== 'object') {
        return;
      }
      
      // Get the ID of this node
      const nodeId = node.id;
      
      // Skip nodes without an ID
      if (!nodeId) {
        // Check if this is an object with child objects (like the root level)
        if (node.children) {
          traverseNode(node.children);
        } else {
          // Iterate through each child if this is a plain object
          Object.values(node).forEach(childNode => {
            if (childNode && typeof childNode === 'object') {
              traverseNode(childNode);
            }
          });
        }
        return;
      }
      
      // Check if this node matches the pollutant
      const hasMatchForPollutant = node.hasMatchForPollutant === true;
      const hasChildrenWithMatchForPollutant = node.hasChildrenWithMatchForPollutant === true;
      
      // Mark node as relevant if it or its children match the pollutant
      if (hasMatchForPollutant || hasChildrenWithMatchForPollutant) {
        relevantNodes[nodeId] = true;
      }
      
      // Traverse children
      if (node.children) {
        traverseNode(node.children);
      }
    };
    
    traverseNode(hierarchy);
    return relevantNodes;
  };
  
  // Calculate patent counts for the entire hierarchy
  const calculateAllPatentCounts = (relevanceScores, hierarchy, relevantNodes) => {
    if (!relevanceScores || !hierarchy) {
      setPatentCountCache({});
      return;
    }
    
    // First, calculate direct matches for each BREF ID
    const directMatches = {};
    
    // Check each patent's relevance to each BREF ID
    for (const patentId in relevanceScores) {
      const patentBrefScores = relevanceScores[patentId];
      
      // For each BREF ID in this patent's scores
      for (const brefId in patentBrefScores) {
        const score = patentBrefScores[brefId];
        
        // Only count patents above the reliability threshold AND if the BREF is relevant to the pollutant
        if (score >= RELIABILITY_THRESHOLD && relevantNodes[brefId]) {
          if (!directMatches[brefId]) {
            directMatches[brefId] = 0;
          }
          directMatches[brefId]++;
        }
      }
    }
    
    console.log("Direct patent matches calculated:", Object.keys(directMatches).length);
    
    // Then calculate cumulative counts by traversing the hierarchy
    const cumulativeCounts = calculateCumulativeCounts(hierarchy, directMatches, relevantNodes);
    
    // Store all counts in the cache
    setPatentCountCache(cumulativeCounts);
  };
  
  // Calculate cumulative counts by traversing the hierarchy - UPDATED to filter by relevant nodes
  const calculateCumulativeCounts = (node, directMatches, relevantNodes, result = {}) => {
    // If this is an array of nodes
    if (Array.isArray(node)) {
      node.forEach(childNode => {
        calculateCumulativeCounts(childNode, directMatches, relevantNodes, result);
      });
      return result;
    }
    
    // If this is not an object, skip it
    if (!node || typeof node !== 'object') {
      return result;
    }
    
    // Get the ID of this node
    const nodeId = node.id;
    
    // Skip nodes without an ID
    if (!nodeId) {
      // Check if this is an object with child objects (like the root level)
      if (node.children) {
        calculateCumulativeCounts(node.children, directMatches, relevantNodes, result);
      } else {
        // Iterate through each child if this is a plain object
        Object.values(node).forEach(childNode => {
          if (childNode && typeof childNode === 'object') {
            calculateCumulativeCounts(childNode, directMatches, relevantNodes, result);
          }
        });
      }
      return result;
    }
    
    // Calculate cumulative count for this node
    let cumulativeCount = directMatches[nodeId] || 0;
    
    // Add counts from children - KEY CHANGE: Only add children that are relevant to pollutant
    if (node.children) {
      // Handle array children
      if (Array.isArray(node.children)) {
        node.children.forEach(child => {
          const childId = child.id;
          if (childId && relevantNodes[childId]) {  // Only count relevant children
            // Recursively calculate counts for this child first
            calculateCumulativeCounts(child, directMatches, relevantNodes, result);
            // Then add its count to the parent
            cumulativeCount += (result[childId] || 0);
          }
        });
      } 
      // Handle object children
      else if (typeof node.children === 'object') {
        Object.entries(node.children).forEach(([childKey, child]) => {
          const childId = child.id || childKey;
          if (relevantNodes[childId]) {  // Only count relevant children
            // Recursively calculate counts for this child first
            calculateCumulativeCounts(child, directMatches, relevantNodes, result);
            // Then add its count to the parent
            cumulativeCount += (result[childId] || 0);
          }
        });
      }
    }
    
    // Store the cumulative count
    result[nodeId] = cumulativeCount;
    return result;
  };
  
  // Helper function to get the patent count for a specific BREF ID
  const getPatentCountForBref = useCallback((brefId) => {
    if (!brefId || !patentCountCache) return 0;
    return patentCountCache[brefId] || 0;
  }, [patentCountCache]);
  
  // Check if a node is relevant to the selected pollutant
  const isNodeRelevantToPollutant = useCallback((nodeId) => {
    return relevantNodesCache[nodeId] === true;
  }, [relevantNodesCache]);
  
  // Debug log when filter changes
  useEffect(() => {
    if (showOnlyRelevant) {
      console.log("Filter enabled - showing only relevant BREFs");
    } else {
      console.log("Filter disabled - showing all BREFs");
    }
  }, [showOnlyRelevant]);
  
  // Toggle expanded state for a specific node
  const toggleExpanded = useCallback((nodeId, event) => {
    event.stopPropagation();
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  }, []);
  
  // Check if a node is a leaf node (no children)
  const isLeafNode = useCallback((node) => {
    if (!node || !node.children) return true;
    
    if (Array.isArray(node.children)) {
      return node.children.length === 0;
    } else if (typeof node.children === 'object') {
      return Object.keys(node.children).length === 0;
    }
    
    return true;
  }, []);
  
  // Check if a node has matches for the selected pollutant
  const checkNodeMatches = useCallback((node) => {
    if (!node) return { direct: false, children: false };
    
    const hasDirectMatch = node.hasMatchForPollutant === true;
    const hasChildrenMatch = node.hasChildrenWithMatchForPollutant === true;
    
    // Return early if we have explicit matches
    if (hasDirectMatch || hasChildrenMatch) {
      return { direct: hasDirectMatch, children: hasChildrenMatch };
    }
    
    // Otherwise, check children recursively (fallback)
    let childrenHaveMatches = false;
    
    if (node.children) {
      if (Array.isArray(node.children)) {
        childrenHaveMatches = node.children.some(child => {
          const childMatches = checkNodeMatches(child);
          return childMatches.direct || childMatches.children;
        });
      } else if (typeof node.children === 'object') {
        childrenHaveMatches = Object.values(node.children).some(child => {
          const childMatches = checkNodeMatches(child);
          return childMatches.direct || childMatches.children;
        });
      }
    }
    
    return { direct: hasDirectMatch, children: childrenHaveMatches };
  }, []);
  
  // Select a BREF node - FIXED to allow selection of leaf nodes without patents
  const handleSelectNode = useCallback((node, path, isRelevant, isLeaf) => {
    // Only allow selection of leaf nodes that are relevant when a pollutant is selected
    if (!isLeaf) {
      console.log("Ignoring selection of non-leaf node:", node.id);
      return;
    }
    
    // Only allow selection of relevant nodes when a pollutant is selected
    if (selectedPollutant && !isRelevant) {
      console.log("Ignoring selection of non-relevant node:", node.id);
      return;
    }
    
    // Ensure proper path is tracked
    const currentPath = path || [];
    
    // Check for patent count - but don't require patents if node is relevant
    const patentCount = getPatentCountForBref(node.id);
    console.log(`Node ${node.id} has ${patentCount} matching patents above threshold`);

    // Call the parent component's handler - now allows all relevant leaf nodes
    onBrefSelect(node, currentPath);
    
  }, [onBrefSelect, selectedPollutant, getPatentCountForBref]);
  
  // COMPLETELY REVISED FILTERING FUNCTION
  const filteredBrefHierarchy = useMemo(() => {
    // If not filtering or no pollutant selected, return full hierarchy
    if (!showOnlyRelevant || !selectedPollutant || !brefHierarchy) {
      return brefHierarchy;
    }
    
    // Create a new filtered hierarchy
    const filtered = {};
    
    // Helper function to check if a BREF or its children match the pollutant
    const doesBrefMatch = (brefContent) => {
      // Check for direct match at the top level
      if (brefContent.hasMatchForPollutant === true) {
        return true;
      }
      
      // Check for children with matches at the top level
      if (brefContent.hasChildrenWithMatchForPollutant === true) {
        return true;
      }
      
      // Special case: If it's an array, check each item
      if (Array.isArray(brefContent)) {
        return brefContent.some(item => {
          return item.hasMatchForPollutant === true || 
                 item.hasChildrenWithMatchForPollutant === true;
        });
      }
      
      // Check for children recursively
      if (brefContent.children) {
        if (Array.isArray(brefContent.children)) {
          return brefContent.children.some(child => {
            return child.hasMatchForPollutant === true || 
                   child.hasChildrenWithMatchForPollutant === true || 
                   doesBrefMatch(child);
          });
        } else if (typeof brefContent.children === 'object') {
          return Object.values(brefContent.children).some(child => {
            return child.hasMatchForPollutant === true || 
                   child.hasChildrenWithMatchForPollutant === true || 
                   doesBrefMatch(child);
          });
        }
      }
      
      return false;
    };
    
    // Loop through all top-level BREF documents
    Object.entries(brefHierarchy).forEach(([brefType, brefContent]) => {
      if (doesBrefMatch(brefContent)) {
        filtered[brefType] = brefContent;
      }
    });
    
    console.log(`Filtered from ${Object.keys(brefHierarchy).length} to ${Object.keys(filtered).length} BREF documents`);
    
    return filtered;
  }, [brefHierarchy, selectedPollutant, showOnlyRelevant]);
  
  // Render the top-level BREF types
  const renderTopLevelBref = useCallback(() => {
    if (!filteredBrefHierarchy) return null;
    
    return Object.entries(filteredBrefHierarchy).map(([brefType, brefContent]) => {
      const isExpanded = expandedNodes[brefType];
      const isSelected = selectedBref && selectedBref.id === brefType;
      
      // Check if this top-level node is relevant to the selected pollutant
      const matches = checkNodeMatches(brefContent);
      const isRelevant = matches.direct || matches.children;
      
      // Top-level documents are never directly clickable - they're just containers
      const isLeaf = false;
      
      // Get patent count for this document - only show if relevant to pollutant
      const patentCount = isRelevant ? getPatentCountForBref(brefType) : 0;
      const showPatentCount = isRelevant;
      
      return (
        <div key={brefType} className="mb-2">
          {/* Top-level BREF type heading */}
          <div 
            className={`flex items-center p-3 rounded-t font-medium ${
              isSelected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
            } border-b cursor-default`}
          >
            {/* Expand/collapse button */}
            <button 
              onClick={(e) => toggleExpanded(brefType, e)}
              className="p-0.5 mr-1.5 focus:outline-none text-gray-500"
            >
              {isExpanded ? 
                <ChevronDown size={16} /> : 
                <ChevronRight size={16} />
              }
            </button>
            
            {/* BREF document icon */}
            <BookOpen size={16} className="mr-2 flex-shrink-0 text-gray-500" />
            
            {/* BREF type name */}
            <span className="flex-1">{brefType}</span>
            
            {/* Patent count badge - only show for relevant nodes */}
            {!loadingRelevanceScores && showPatentCount && (
              <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full font-medium ${
                patentCount > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
              }`}>
                {patentCount}
              </span>
            )}
          </div>
          
          {/* BREF content when expanded */}
          {isExpanded && (
            <div className="border border-t-0 rounded-b p-1 bg-white">
              {renderNodeChildren(brefContent, 1, [{ id: brefType, name: brefType }])}
            </div>
          )}
        </div>
      );
    });
  }, [filteredBrefHierarchy, expandedNodes, selectedBref, toggleExpanded, checkNodeMatches, getPatentCountForBref, loadingRelevanceScores]);
  
  // Recursive function to render a single node and its children
  const renderNode = useCallback((node, level = 0, path = []) => {
    // Skip non-node items
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      return null;
    }
    
    // Handle both node formats (with id/name properties or with direct child objects)
    const nodeId = node.id || null;
    const nodeName = node.name || (nodeId ? getBrefSectionName(nodeId) : 'Unknown');
    
    // Determine if node has children
    const hasChildren = node.children && (
      Array.isArray(node.children) ? 
        node.children.length > 0 : 
        typeof node.children === 'object' && Object.keys(node.children).length > 0
    );
    
    // Is this node expanded?
    const isExpanded = expandedNodes[nodeId];
    
    // Is this node selected?
    const isSelected = selectedBref && selectedBref.id === nodeId;
    
    // Check if this node matches the selected pollutant
    const matches = checkNodeMatches(node);
    const hasMatchForPollutant = matches.direct;
    const hasChildrenWithMatchForPollutant = matches.children;
    const isRelevant = hasMatchForPollutant || hasChildrenWithMatchForPollutant;
    
    // Determine if this is a leaf node (no children)
    const isLeaf = !hasChildren;
    
    // Current path including this node
    const currentPath = [...path, { id: nodeId, name: nodeName }];
    
    // If node is not relevant to the selected pollutant and we're filtering, skip it
    if (selectedPollutant && !isRelevant && showOnlyRelevant) {
      return null;
    }
    
    // Only show patent count if node is relevant to the pollutant
    const patentCount = isRelevant ? getPatentCountForBref(nodeId) : 0;
    const showPatentCount = isRelevant;
    
    // Determine styling based on node type and relevance
    let backgroundClass = "";
    let textClass = "text-gray-700";
    let cursorClass = "cursor-default"; // Default to not clickable
    
    // Style for selection state
    if (isSelected) {
      backgroundClass = "bg-blue-50 border-l-2 border-blue-500";
      textClass = "text-blue-700 font-medium";
    } 
    // Style for relevant nodes
    else if (hasMatchForPollutant) {
      backgroundClass = "bg-amber-100 border-l-2 border-amber-500";
      // Make leaf nodes with direct matches clickable even if no patents
      if (isLeaf) {
        cursorClass = "cursor-pointer";
      }
    } 
    // Style for nodes with matching children
    else if (hasChildrenWithMatchForPollutant) {
      backgroundClass = "bg-amber-50 border-l-2 border-amber-300";
    }
    // Style for non-relevant nodes
    else if (selectedPollutant) {
      textClass = "text-gray-400";
    }
    
    return (
      <div key={nodeId || `level-${level}-${nodeName}`} className="text-sm relative">
        <div 
          className={`flex items-center p-1.5 ${cursorClass} ${
            isLeaf && isRelevant ? 'hover:bg-gray-100' : ''
          } rounded transition-colors ${backgroundClass}`}
          style={{ paddingLeft: `${(level * 16) + 8}px` }}
          onClick={() => handleSelectNode(node, currentPath, isRelevant, isLeaf)}
        >
          {/* Expand/collapse arrow for nodes with children */}
          {hasChildren ? (
            <button 
              onClick={(e) => toggleExpanded(nodeId, e)}
              className="p-0.5 mr-1.5 text-gray-500 hover:text-gray-800 focus:outline-none"
            >
              {isExpanded ? 
                <ChevronDown size={14} className="transform transition-transform"/> : 
                <ChevronRight size={14} className="transform transition-transform"/>
              }
            </button>
          ) : (
            <span className="w-5 h-5 mr-1.5"></span> // Spacer for alignment
          )}
          
          {/* Node name with appropriate styling */}
          <span className={`${textClass} truncate`}>
            {nodeName}
          </span>
          
          {/* Badge with patent count - only show for relevant nodes */}
          {!loadingRelevanceScores && showPatentCount && (
            <span 
              className={`ml-2 px-1.5 py-0.5 text-xs rounded-full font-medium ${
                patentCount > 0 
                  ? (isLeaf ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800')
                  : 'bg-gray-100 text-gray-600'
              }`}
              title={`${patentCount > 0 
                ? `${patentCount} patent${patentCount !== 1 ? 's' : ''} above ${RELIABILITY_THRESHOLD * 100}% relevance${!isLeaf ? ' (including sub-sections)' : ''}`
                : 'No patents above threshold'
              }`}
            >
              {patentCount}
            </span>
          )}
          
          {/* Indicators container */}
          <div className="ml-auto flex items-center space-x-1">
            {/* Pollutant match indicator */}
            {hasMatchForPollutant && (
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500" title={`Matches selected pollutant: ${selectedPollutant}`}></span>
            )}
            
            {/* Children with pollutant matches indicator */}
            {!hasMatchForPollutant && hasChildrenWithMatchForPollutant && (
              <span className="inline-block w-2 h-2 rounded-full bg-amber-300" title="Children match selected pollutant"></span>
            )}
            
            {/* Leaf node indicator for relevant nodes - show for all relevant leaves */}
            {isLeaf && isRelevant && (
              <span title="Clickable BREF section">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
            )}
          </div>
        </div>
        
        {/* Render children if node is expanded */}
        {hasChildren && isExpanded && (
          <div className="mt-0.5">
            {renderNodeChildren(node.children, level + 1, currentPath)}
          </div>
        )}
      </div>
    );
  }, [
    expandedNodes, 
    selectedBref, 
    selectedPollutant, 
    showOnlyRelevant,
    handleSelectNode, 
    toggleExpanded, 
    checkNodeMatches, 
    isLeafNode, 
    getPatentCountForBref, 
    loadingRelevanceScores, 
    RELIABILITY_THRESHOLD
  ]);
  
  // Helper function to render children based on their format
  const renderNodeChildren = function(children, level, path) {
    if (!children) return null;
    
    if (Array.isArray(children)) {
      // Handle array of child nodes
      return children.map(child => renderNode(child, level, path));
    } else if (typeof children === 'object') {
      // Check if it's a numerically indexed object (like {0: {...}, 1: {...}})
      const keys = Object.keys(children);
      const isNumericIndexed = keys.every(key => !isNaN(parseInt(key)));
      
      if (isNumericIndexed) {
        // Render as ordered list of children
        return keys.map(key => renderNode(children[key], level, path));
      } else {
        // Handle complex child object with mixed keys
        return Object.entries(children).map(([childKey, childValue]) => {
          // Create a synthetic node if the child value doesn't have an ID
          const childNode = typeof childValue === 'object' ? 
            (childValue.id ? childValue : { id: childKey, name: childKey, ...childValue }) : 
            { id: childKey, name: childKey };
          
          return renderNode(childNode, level, path);
        });
      }
    }
    
    return null;
  };
  
  return (
    <div className={`bref-selector ${className} relative`}>
      {/* Header with filter control */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 flex items-center">
          <BookOpen size={14} className="mr-1.5 text-gray-500" />
          BREF Documents
        </h3>
        
        <div className="flex space-x-2">
          {/* Show Reset button when a BREF is selected */}
          {selectedBref && (
            <button
              onClick={() => onBrefSelect(null, [])}
              className="text-xs px-2 py-1 rounded flex items-center bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
              title="Clear BREF selection"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Clear selection
            </button>
          )}
          
          {/* Filter toggle button */}
          {selectedPollutant && (
            <button
              onClick={() => setShowOnlyRelevant(!showOnlyRelevant)}
              className={`text-xs px-2 py-1 rounded flex items-center ${
                showOnlyRelevant 
                  ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}
            >
              <Filter size={12} className="mr-1" />
              {showOnlyRelevant ? "Showing relevant only" : "Show all documents"}
            </button>
          )}
        </div>
      </div>
      
      {/* Selected BREF indicator */}
      {selectedBref && (
        <div className="mb-3 p-2 bg-blue-50 border border-blue-100 rounded text-sm flex items-center justify-between">
          <div>
            <span className="font-medium text-blue-700">Selected BREF:</span>
            <span className="ml-2 text-gray-800">{selectedBref.name || selectedBref.id}</span>
          </div>
          <button 
            onClick={() => onBrefSelect(null, [])}
            className="text-blue-700 hover:text-red-600"
            title="Clear selection but keep in context"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
      
      <div className="mb-3 text-xs text-gray-600 bg-gray-50 rounded p-2 border">
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          <div className="flex items-center">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1"></span>
            <span>Matches selected pollutant</span>
          </div>
          
          <div className="flex items-center">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-300 mr-1"></span>
            <span>Children match pollutant</span>
          </div>
          
          <div className="flex items-center">
            <span className="inline-block bg-green-100 text-green-800 text-xs rounded-full px-1.5 py-0.5 mr-1 font-medium">5</span>
            <span>Direct patent matches</span>
          </div>
          
          <div className="flex items-center">
            <span className="inline-block bg-blue-100 text-blue-800 text-xs rounded-full px-1.5 py-0.5 mr-1 font-medium">12</span>
            <span>Total patents in section + subsections</span>
          </div>
          
          <div className="flex items-center">
            <span className="inline-block bg-gray-100 text-gray-600 text-xs rounded-full px-1.5 py-0.5 mr-1 font-medium">0</span>
            <span>No patents above threshold</span>
          </div>
          
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-500 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>Clickable BREF section</span>
          </div>
        </div>
        
        {selectedPollutant && (
          <div className="mt-2 pt-1 border-t text-amber-700 flex items-center">
            <AlertCircle size={12} className="mr-1" />
            <span>Showing matches for: <strong>{selectedPollutant}</strong></span>
            <span className="ml-1 text-gray-500">(all relevant sections are clickable)</span>
          </div>
        )}
      </div>
      
      {/* Loading overlay - now combines general loading and relevance scores loading */}
      {(isLoading || loadingRelevanceScores) && (
        <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-10 rounded">
          <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-700 mx-auto"></div>
            <div className="text-sm text-blue-700 mt-2">
              {isLoading ? 'Loading BREF data...' : 'Loading patent relevance data...'}
            </div>
          </div>
        </div>
      )}
      
      {/* BREF tree container */}
      <div className="max-h-80 overflow-y-auto border rounded bg-white">
        {filteredBrefHierarchy && Object.keys(filteredBrefHierarchy).length > 0 ? (
          <div className="p-2">
            {renderTopLevelBref()}
          </div>
        ) : isLoading ? (
          <div className="text-center py-6 text-gray-500">
            Loading BREF hierarchy...
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            {showOnlyRelevant && selectedPollutant
              ? `No relevant BREF documents found for ${selectedPollutant}.`
              : 'No BREF hierarchy available'}
          </div>
        )}
      </div>
      
      {/* Footer info */}
      <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
        <span>BREF = Best Available Techniques Reference Document</span>
        
        {selectedPollutant && (
          <span className="text-amber-600 flex items-center">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1"></span>
            Filters active for {selectedPollutant}
          </span>
        )}
      </div>
    </div>
  );
};

export default HierarchicalBrefSelector;
