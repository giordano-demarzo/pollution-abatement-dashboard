// PatentRankingBox.jsx - Final version with proper empty state handling and BREF handling

import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, Filter, AlertCircle, BookOpen, Eye } from 'lucide-react';
import {
  loadPollutantTopPatents,
  loadBrefRelevanceScores,
  loadPatentIndex
} from '../utils/dataLoader';
import PatentDetailsBox from './PatentDetailsBox';

/**
 * Component for displaying and interacting with top patents for a selected pollutant
 * with improved support for BREF relevance-based ranking
 */
const PatentRankingBox = ({
  selectedPollutant,
  selectedPollutantFilename,
  selectedBref,
  onPatentToggle,
  selectedPatents = [],
  maxPatents = 5,
  onBrefAdd = null // Add the prop for BREF handling
}) => {
  // Component state
  const [loadingPatents, setLoadingPatents] = useState(false);
  const [loadingBrefScores, setLoadingBrefScores] = useState(false);
  const [topPatents, setTopPatents] = useState([]);
  const [brefRelevanceScores, setBrefRelevanceScores] = useState({});
  const [patentIndex, setPatentIndex] = useState(null);
  const [error, setError] = useState(null);
  const [selectedPatentForDetails, setSelectedPatentForDetails] = useState(null);
  
  // Reliability threshold for patent filtering - ensure consistency
  const RELIABILITY_THRESHOLD = 0.68;

  // Load top patents for the selected pollutant
  useEffect(() => {
    const fetchTopPatents = async () => {
      if (!selectedPollutantFilename) return;

      try {
        setLoadingPatents(true);
        setError(null);
        
        // Load the patents for this pollutant
        const patents = await loadPollutantTopPatents(selectedPollutantFilename);
        
        if (patents && Array.isArray(patents)) {
          setTopPatents(patents);
        } else {
          console.error('Invalid patent data returned:', patents);
          setError('Failed to load patents for this pollutant');
          setTopPatents([]);
        }
      } catch (err) {
        console.error(`Error loading patents for ${selectedPollutantFilename}:`, err);
        setError(`Error: ${err.message || 'Failed to load patents'}`);
        setTopPatents([]);
      } finally {
        setLoadingPatents(false);
      }
    };

    fetchTopPatents();
  }, [selectedPollutantFilename]);

  // Load the patent index for BREF-specific patents
  useEffect(() => {
    const loadIndex = async () => {
      try {
        const index = await loadPatentIndex();
        setPatentIndex(index);
      } catch (err) {
        console.error("Error loading patent index:", err);
      }
    };
    
    loadIndex();
  }, []);

  // Load BREF relevance scores when both pollutant and BREF are selected
  useEffect(() => {
    const fetchBrefScores = async () => {
      if (!selectedPollutantFilename) {
        setBrefRelevanceScores({});
        return;
      }

      try {
        setLoadingBrefScores(true);
        
        // Load BREF relevance scores for this pollutant
        const scores = await loadBrefRelevanceScores(selectedPollutantFilename);
        
        if (scores) {
          console.log(`Loaded BREF relevance scores for ${selectedPollutantFilename}`, 
            Object.keys(scores).length + " patents have scores");
          setBrefRelevanceScores(scores);
        } else {
          console.warn('No BREF relevance scores available');
          setBrefRelevanceScores({});
        }
      } catch (err) {
        console.error(`Error loading BREF relevance data:`, err);
        setBrefRelevanceScores({});
      } finally {
        setLoadingBrefScores(false);
      }
    };

    fetchBrefScores();
  }, [selectedPollutantFilename]);

  // Get color based on score
  const getColorByScore = (score) => {
    if (score >= 0.8) return '#22c55e'; // Green
    if (score >= 0.6) return '#84cc16'; // Lime green
    if (score >= 0.4) return '#eab308'; // Yellow
    if (score >= 0.2) return '#f97316'; // Orange
    return '#ef4444'; // Red
  };

  // Get the most appropriate relevance score for a patent based on context
  const getRelevanceScore = (patent, brefId) => {
    // When a BREF is selected, prioritize BREF relevance score
    if (patent && brefId) {
      // First check if we have pre-calculated relevance in the patent object
      if (patent.bref_relevance && patent.bref_relevance[brefId] !== undefined) {
        return patent.bref_relevance[brefId];
      }
      
      // Then check if we loaded BREF relevance scores separately
      if (brefRelevanceScores && 
          patent.id in brefRelevanceScores && 
          brefId in brefRelevanceScores[patent.id]) {
        return brefRelevanceScores[patent.id][brefId];
      }
      
      // If no specific BREF score found, return base pollutant score as fallback
      return 0;
    }
    
    // When only pollutant is selected, use pollutant score
    return patent.score || 0;
  };

  // Count patents that are relevant to the selected BREF
  const getBrefRelevantPatentCount = useMemo(() => {
    if (!selectedBref || !brefRelevanceScores || Object.keys(brefRelevanceScores).length === 0) {
      return -1; // Not applicable 
    }
    
    let count = 0;
    for (const patentId in brefRelevanceScores) {
      const patentBrefScores = brefRelevanceScores[patentId];
      if (patentBrefScores[selectedBref.id] && patentBrefScores[selectedBref.id] >= RELIABILITY_THRESHOLD) {
        count++;
      }
    }
    return count;
  }, [selectedBref, brefRelevanceScores, RELIABILITY_THRESHOLD]);

  // Get ranked patents based on pollutant and optional BREF selection
  // ENHANCED: Now uses a more comprehensive approach for BREF-based ranking
  const rankedPatents = useMemo(() => {
    if (!topPatents.length) return [];

    // If we have a BREF selected and BREF relevance scores are loaded
    if (selectedBref && selectedBref.id && Object.keys(brefRelevanceScores).length > 0) {
      // If no patents are relevant to this BREF section above threshold, return empty array
      if (getBrefRelevantPatentCount === 0) {
        return [];
      }
      
      // Find all patents that have a relevance score for this BREF
      let brefRelevantPatents = [];
      
      // First, consider all patents in the topPatents list
      const topPatentsWithScores = [...topPatents]
        .map(patent => ({
          ...patent,
          relevanceScore: getRelevanceScore(patent, selectedBref.id)
        }))
        .filter(patent => patent.relevanceScore >= RELIABILITY_THRESHOLD);
      
      // Then look through all available patents in the brefRelevanceScores
      // This is the key enhancement - we now consider ALL patents, not just the top ones
      if (patentIndex) {
        for (const patentId in brefRelevanceScores) {
          // Skip patents already in topPatents to avoid duplicates
          if (topPatents.some(p => p.id === patentId)) continue;
          
          // Get BREF score for this patent
          const brefScore = brefRelevanceScores[patentId][selectedBref.id];
          
          // Only include patents with a meaningful relevance to this BREF
          if (brefScore && brefScore >= RELIABILITY_THRESHOLD) { // Using >= to be consistent
            const patentDetails = patentIndex[patentId];
            if (patentDetails) {
              brefRelevantPatents.push({
                id: patentId,
                title: patentDetails.title || `Patent ${patentId}`,
                year: patentDetails.year,
                abstract: patentDetails.abstract || patentDetails.text,
                score: 0, // Base pollutant score might be 0
                relevanceScore: brefScore,
                bref_relevance: { [selectedBref.id]: brefScore }
              });
            }
          }
        }
      }
      
      // Combine both lists and sort by BREF relevance
      const combinedPatents = [...topPatentsWithScores, ...brefRelevantPatents];
      const uniquePatents = Array.from(new Map(combinedPatents.map(p => [p.id, p])).values());
      
      // Sort by relevance score and take top maxPatents
      return uniquePatents
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, maxPatents);
    }
    
    // If no BREF selected, just use the base pollutant score
    return [...topPatents]
      .map(patent => ({
        ...patent,
        relevanceScore: patent.score
      }))
      .filter(patent => patent.relevanceScore >= RELIABILITY_THRESHOLD)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxPatents);
  }, [topPatents, selectedBref, brefRelevanceScores, patentIndex, maxPatents, getBrefRelevantPatentCount, RELIABILITY_THRESHOLD]);

  // Get ranking basis description
  const getRankingBasis = () => {
    if (selectedBref && selectedBref.id) {
      return `Patents ranked by relevance to ${selectedBref.name || selectedBref.id}`;
    }
    return `Patents ranked by relevance to ${selectedPollutant}`;
  };

  // Load full patent details when selecting for details view
  const handleShowPatentDetails = async (patent) => {
    try {
      // Load the complete patent details from the index
      const { loadPatentDetails } = await import('../utils/dataLoader');
      const fullPatentDetails = await loadPatentDetails(patent.id);
      
      // Get BREF relevance data for this patent if available
      let brefRelevanceData = {};
      if (brefRelevanceScores && brefRelevanceScores[patent.id]) {
        brefRelevanceData = {
          bref_relevance: brefRelevanceScores[patent.id]
        };
      }
      
      // Merge the detailed patent info with the current patent object
      const enhancedPatent = {
        ...patent,
        ...fullPatentDetails,
        ...brefRelevanceData
      };
      
      setSelectedPatentForDetails(enhancedPatent);
    } catch (error) {
      console.error("Error loading full patent details:", error);
      // Fallback to just using the basic patent info we already have
      // Include any available BREF relevance data
      let brefRelevanceData = {};
      if (brefRelevanceScores && brefRelevanceScores[patent.id]) {
        brefRelevanceData = {
          bref_relevance: brefRelevanceScores[patent.id]
        };
      }
      
      setSelectedPatentForDetails({
        ...patent,
        ...brefRelevanceData
      });
    }
  };

  // Check if a patent is already in context
  const isPatentInContext = (patentId) => {
    return selectedPatents.some(p => p.id === patentId);
  };
  
  // Check if we're showing BREF-specific patents
  const isShowingBrefSpecificPatents = selectedBref && Object.keys(brefRelevanceScores).length > 0;
  
  // Check if we have a BREF selected but no patents above threshold
  const hasBrefButNoPatents = selectedBref && rankedPatents.length === 0 && !loadingPatents && !loadingBrefScores;

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h2 className="font-semibold mb-4 text-gray-700 border-b pb-2">
        Top Patents for {selectedPollutant || 'Selected Pollutant'} Reduction
        {selectedBref && ` + ${selectedBref.name || selectedBref.id}`}:
      </h2>
      
      {/* Loading or error state */}
      {(loadingPatents || loadingBrefScores) ? (
        <div className="animate-pulse space-y-3">
          {Array(maxPatents).fill(0).map((_, i) => (
            <div key={i} className="flex items-center p-2">
              <div className="h-4 w-4 bg-gray-200 mr-3 rounded"></div>
              <div className="flex-1">
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-3 text-red-600 bg-red-50 rounded border border-red-200 text-sm">
          <AlertCircle className="inline-block mr-2 h-4 w-4" />
          {error}
        </div>
      ) : hasBrefButNoPatents ? (
        <div className="p-3 bg-amber-50 rounded border border-amber-200 text-sm">
          <AlertCircle className="inline-block mr-2 h-4 w-4 text-amber-500" />
          No patents with reliability score above {RELIABILITY_THRESHOLD * 100}% found for this BREF section.
          <p className="mt-2 text-xs text-gray-600">
            Try selecting a different BREF section or pollutant to find relevant patents.
          </p>
        </div>
      ) : rankedPatents.length > 0 ? (
        <>
          <ul className="space-y-2">
            {rankedPatents.map(patent => (
              <li key={patent.id} className="flex items-center p-2 hover:bg-gray-50 rounded transition-colors">
                <input
                  type="checkbox"
                  id={`patent-${patent.id}`}
                  checked={selectedPatents.some(p => p.id === patent.id)}
                  onChange={() => onPatentToggle(patent)}
                  className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
                />
                <label htmlFor={`patent-${patent.id}`} className="flex-1 cursor-pointer text-gray-700">
                  <div className="flex items-center justify-between">
                    <span 
                      className="font-medium text-blue-600 hover:underline cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        handleShowPatentDetails(patent);
                      }}
                    >
                      {patent.title}
                    </span>
                    <button
                      className="text-gray-400 hover:text-blue-600 p-1 rounded-full hover:bg-blue-50"
                      onClick={(e) => {
                        e.preventDefault();
                        handleShowPatentDetails(patent);
                      }}
                      title="View details"
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                  <div className="text-sm text-gray-500 mt-1 flex items-center">
                    <span className="mr-2">Relevance:</span>
                    <div className="w-32 h-2 bg-gray-200 rounded overflow-hidden">
                      <div 
                        className="h-full" 
                        style={{ 
                          width: `${patent.relevanceScore * 100}%`,
                          backgroundColor: getColorByScore(patent.relevanceScore)
                        }}
                      ></div>
                    </div>
                    <span className="ml-2">{Math.round(patent.relevanceScore * 100)}%</span>
                  </div>
                  
                  {/* BREF relevance note - only shown when BREF is selected */}
                  {selectedBref && (
                    <div className="text-xs text-gray-500 mt-1 italic">
                      {patent.bref_relevance && patent.bref_relevance[selectedBref.id] ? 
                        `This patent is specifically related to this BREF section` : 
                        `This patent may be applicable to this regulatory context`}
                    </div>
                  )}
                </label>
              </li>
            ))}
          </ul>
          
          {/* Ranking explanation */}
          <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-gray-600 border border-blue-100">
            <div className="flex items-center">
              <Filter size={12} className="mr-1 text-blue-500" />
              <span>{getRankingBasis()}</span>
            </div>
            
            {isShowingBrefSpecificPatents && (
              <div className="mt-1 flex items-center">
                <BookOpen size={12} className="mr-1 text-blue-500" />
                <span>
                  Showing patents specifically relevant to this BREF section
                </span>
              </div>
            )}
            
            <div className="mt-1 text-gray-500">
              Only showing patents with reliability score above {RELIABILITY_THRESHOLD * 100}%
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-6 text-gray-500">
          {selectedPollutant 
            ? `No patents found for ${selectedPollutant} with reliability above ${RELIABILITY_THRESHOLD * 100}%. Please select a different pollutant.` 
            : 'Please select a pollutant to view patents.'}
        </div>
      )}
      
      {/* Patent Details Modal - Updated to pass onBrefAdd */}
      {selectedPatentForDetails && (
        <PatentDetailsBox
          patent={selectedPatentForDetails}
          onClose={() => setSelectedPatentForDetails(null)}
          onAddToContext={onPatentToggle}
          isInContext={isPatentInContext(selectedPatentForDetails.id)}
          selectedBref={selectedBref}
          selectedPollutant={selectedPollutant}
          brefRelevanceScores={brefRelevanceScores}
          onBrefAdd={onBrefAdd} // Pass the onBrefAdd handler
        />
      )}
    </div>
  );
};

export default PatentRankingBox;
