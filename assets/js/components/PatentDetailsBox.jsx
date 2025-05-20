// PatentDetailsBox.jsx - Component for displaying detailed patent information with BREF integration

import React, { useEffect, useState } from 'react';
import { X, PlusCircle, Calendar, AlertCircle, FileText, BarChart2, BookOpen, Eye, PlusSquare } from 'lucide-react';
import { loadBrefFlatMap, loadBrefText } from '../utils/dataLoader';

/**
 * Component for displaying detailed patent information
 * @param {Object} patent - The patent object to display
 * @param {Function} onClose - Function to call when closing the details box
 * @param {Function} onAddToContext - Function to add patent to context
 * @param {Boolean} isInContext - Whether the patent is already in context
 * @param {Object} selectedBref - Currently selected BREF section (if any)
 * @param {String} selectedPollutant - Currently selected pollutant
 * @param {Object} brefRelevanceScores - Map of BREF relevance scores by patent ID
 * @param {Function} onBrefAdd - Function to add a BREF to context
 */
const PatentDetailsBox = ({
  patent,
  onClose,
  onAddToContext,
  isInContext = false,
  selectedBref = null,
  selectedPollutant = '',
  brefRelevanceScores = {},
  onBrefAdd = null
}) => {
  if (!patent) return null;
  
  // State for loaded BREF data and loading state
  const [brefFlatMap, setBrefFlatMap] = useState({});
  const [loadingBrefData, setLoadingBrefData] = useState(false);
  const [topBrefSections, setTopBrefSections] = useState([]);
  const [loadingBrefText, setLoadingBrefText] = useState(false);
  const [viewingBrefId, setViewingBrefId] = useState(null);
  const [brefText, setBrefText] = useState('');
  const [addedBrefs, setAddedBrefs] = useState({});
  
  // Helper function to get color based on score
  const getColorByScore = (score) => {
    if (score >= 0.8) return '#22c55e'; // Green
    if (score >= 0.6) return '#84cc16'; // Lime green
    if (score >= 0.4) return '#eab308'; // Yellow
    if (score >= 0.2) return '#f97316'; // Orange
    return '#ef4444'; // Red
  };
  
  // Load BREF data when component mounts or when patent changes
  useEffect(() => {
    const fetchBrefMap = async () => {
      try {
        setLoadingBrefData(true);
        const map = await loadBrefFlatMap();
        setBrefFlatMap(map || {});
      } catch (err) {
        console.error('Error loading BREF flat map:', err);
      } finally {
        setLoadingBrefData(false);
      }
    };
    
    fetchBrefMap();
  }, [patent.id]);
  
  // Process BREF relevance scores to find top 5 sections
  useEffect(() => {
    if (!patent || !patent.id || !brefRelevanceScores) return;
    
    try {
      // Get this patent's BREF relevance scores
      const patentBrefScores = brefRelevanceScores[patent.id] || {};
      
      if (Object.keys(patentBrefScores).length === 0) {
        console.log('No BREF relevance scores available for this patent');
        setTopBrefSections([]);
        return;
      }
      
      // Convert to array, sort by score (descending) and take top 5
      const topSections = Object.entries(patentBrefScores)
        .map(([brefId, score]) => ({ brefId, score }))
        .filter(item => item.score >= 0.68) // Apply same reliability threshold as in other components
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      
      setTopBrefSections(topSections);
    } catch (err) {
      console.error('Error processing BREF relevance scores:', err);
      setTopBrefSections([]);
    }
  }, [patent.id, brefRelevanceScores]);
  
  // Load BREF text when a BREF section is selected for viewing
  useEffect(() => {
    if (!viewingBrefId) {
      setBrefText('');
      return;
    }
    
    const fetchBrefText = async () => {
      try {
        setLoadingBrefText(true);
        const text = await loadBrefText(viewingBrefId);
        setBrefText(text || `No content available for BREF section ${viewingBrefId}`);
      } catch (err) {
        console.error(`Error loading BREF text for ${viewingBrefId}:`, err);
        setBrefText(`Error loading text for BREF section ${viewingBrefId}`);
      } finally {
        setLoadingBrefText(false);
      }
    };
    
    fetchBrefText();
  }, [viewingBrefId]);
  
  // Get the appropriate score to display based on context
  const getRelevanceInfo = () => {
    // When a BREF is selected, show BREF-specific relevance
    if (selectedBref && selectedBref.id && patent.bref_relevance && patent.bref_relevance[selectedBref.id]) {
      const brefScore = patent.bref_relevance[selectedBref.id];
      return {
        score: brefScore,
        description: `Relevance to BREF section "${selectedBref.name || selectedBref.id}"`,
        color: getColorByScore(brefScore)
      };
    }
    
    // Otherwise show pollutant relevance
    return {
      score: patent.score,
      description: `Relevance to pollutant "${selectedPollutant}"`,
      color: getColorByScore(patent.score)
    };
  };
  
  // Get BREF section name from ID
  const getBrefSectionName = (brefId) => {
    if (!brefFlatMap || !brefId) return brefId;
    
    const brefInfo = brefFlatMap[brefId];
    return brefInfo ? (brefInfo.name || brefId) : brefId;
  };
  
  // Handler for viewing BREF content
  const handleViewBref = (brefId) => {
    // Always show BREF content in this modal, not in external viewer
    setViewingBrefId(brefId);
  };
  
  // Handler for adding BREF to context - Using the same approach as other modules
  const handleAddBrefToContext = async (brefId) => {
    if (!onBrefAdd) return;
    
    // Mark this BREF as added to visually indicate it to the user
    setAddedBrefs(prev => ({
      ...prev,
      [brefId]: true
    }));
    
    // Load BREF text if needed
    let brefContent = brefText;
    if (viewingBrefId !== brefId) {
      try {
        brefContent = await loadBrefText(brefId);
      } catch (err) {
        console.error(`Error loading BREF text for ${brefId}:`, err);
        brefContent = `Error loading text for BREF section ${brefId}`;
      }
    }
    
    // Get BREF name
    const brefName = getBrefSectionName(brefId);
    
    // Create a BREF object with the expected structure
    const brefObject = {
      id: brefId,
      name: brefName,
      text: brefContent
    };
    
    // Call parent handler with BREF object and text
    onBrefAdd(brefObject, brefContent);
  };
  
  const relevanceInfo = getRelevanceInfo();
  
  // Check if we're viewing BREF content
  const isViewingBref = viewingBrefId !== null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-lg flex items-center justify-between">
          <h3 className="font-semibold text-lg">
            {isViewingBref ? 
              `BREF Section: ${getBrefSectionName(viewingBrefId)}` : 
              patent.title
            }
          </h3>
          <button 
            onClick={() => {
              if (isViewingBref) {
                setViewingBrefId(null);
              } else {
                onClose();
              }
            }}
            className="text-white hover:text-red-200 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content - Show either BREF content or patent details */}
        {isViewingBref ? (
          <div className="p-4 overflow-y-auto flex-1">
            {loadingBrefText ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
                <span className="ml-3 text-blue-700">Loading BREF content...</span>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 p-3 mb-4 rounded border border-blue-200 flex items-center justify-between">
                  <div>
                    <span className="text-blue-700 font-medium">BREF ID: </span>
                    <span className="text-gray-700">{viewingBrefId}</span>
                  </div>
                  <button
                    onClick={() => handleAddBrefToContext(viewingBrefId)}
                    disabled={addedBrefs[viewingBrefId]}
                    className={`px-3 py-1 rounded-md flex items-center text-sm ${
                      addedBrefs[viewingBrefId] ? 
                      'bg-green-100 text-green-700 cursor-default' : 
                      'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {addedBrefs[viewingBrefId] ? (
                      <>
                        <span className="mr-1">✓</span>
                        Added to context
                      </>
                    ) : (
                      <>
                        <PlusCircle size={14} className="mr-1" />
                        Add to context
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-gray-50 p-4 rounded border border-gray-200 text-sm whitespace-pre-wrap">
                  {brefText}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="p-4 overflow-y-auto flex-1">
            {/* Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Year */}
              <div className="flex items-center">
                <Calendar size={16} className="text-gray-500 mr-2" />
                <span className="text-sm text-gray-700">
                  {patent.year ? `Published: ${patent.year}` : 'Publication year unknown'}
                </span>
              </div>
              
              {/* Patent ID */}
              <div className="flex items-center">
                <FileText size={16} className="text-gray-500 mr-2" />
                <span className="text-sm text-gray-700">
                  ID: {patent.id}
                </span>
              </div>
            </div>
            
            {/* Relevance Score */}
            <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: `${relevanceInfo.color}15` }}>
              <div className="flex items-center">
                <BarChart2 size={18} style={{ color: relevanceInfo.color }} className="mr-2" />
                <span className="font-medium text-gray-800">{relevanceInfo.description}</span>
              </div>
              <div className="mt-2 flex items-center">
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full" 
                    style={{ 
                      width: `${relevanceInfo.score * 100}%`,
                      backgroundColor: relevanceInfo.color
                    }}
                  ></div>
                </div>
                <span className="ml-3 font-bold" style={{ color: relevanceInfo.color }}>
                  {Math.round(relevanceInfo.score * 100)}%
                </span>
              </div>
            </div>
            
            {/* Abstract */}
            <div className="mb-4">
              <h4 className="font-medium text-gray-700 mb-2">Abstract</h4>
              <div className="bg-gray-50 p-3 rounded border border-gray-200 text-sm text-gray-800">
                {patent.abstract ? (
                  <p>{patent.abstract}</p>
                ) : patent.text ? (
                  <p>{patent.text}</p>
                ) : (
                  <p className="text-gray-500 italic">No abstract available for this patent.</p>
                )}
              </div>
            </div>
            
            {/* Top BREF Sections - ENHANCED with action buttons */}
            <div className="mb-4">
              <h4 className="font-medium text-gray-700 mb-2 flex items-center">
                <BookOpen size={16} className="mr-2 text-blue-600" />
                Top BREF Sections for this Patent
              </h4>
              
              {loadingBrefData ? (
                <div className="bg-blue-50 p-3 rounded border border-blue-200 animate-pulse">
                  <div className="h-4 bg-blue-100 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-blue-100 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-blue-100 rounded w-2/3"></div>
                </div>
              ) : topBrefSections.length > 0 ? (
                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                  <ul className="space-y-3">
                    {topBrefSections.map(({ brefId, score }) => (
                      <li key={brefId} className="flex items-center justify-between">
                        <div className="flex items-center flex-grow">
                          <div className="mr-2 w-12 text-sm font-medium text-center py-0.5 rounded-full" 
                            style={{ 
                              backgroundColor: `${getColorByScore(score)}25`,
                              color: getColorByScore(score)
                            }}>
                            {Math.round(score * 100)}%
                          </div>
                          <span className="text-sm text-gray-800 flex-1 mr-2">
                            {getBrefSectionName(brefId)}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => handleViewBref(brefId)}
                            className="p-1 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50"
                            title="View BREF content"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => handleAddBrefToContext(brefId)}
                            disabled={addedBrefs[brefId]}
                            className={`p-1 rounded ${
                              addedBrefs[brefId] ? 
                              'text-green-600 cursor-default' : 
                              'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                            title={addedBrefs[brefId] ? "Added to context" : "Add to context"}
                          >
                            {addedBrefs[brefId] ? (
                              <span className="text-green-600">✓</span>
                            ) : (
                              <PlusSquare size={16} />
                            )}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  
                  <div className="mt-3 text-xs text-gray-600 border-t border-blue-200 pt-2">
                    <div className="flex items-center">
                      <AlertCircle size={12} className="mr-1 text-blue-600" />
                      <span>These BREF sections are most relevant to this patent's technology.</span>
                    </div>
                    <div className="mt-1 flex items-center">
                      <Eye size={12} className="mr-1 text-blue-600" /> 
                      <span>Click the eye icon to view section content</span>
                    </div>
                    <div className="mt-1 flex items-center">
                      <PlusSquare size={12} className="mr-1 text-blue-600" /> 
                      <span>Click the plus icon to add section to context</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 p-3 rounded border border-gray-200 text-sm text-gray-500">
                  <div className="flex items-center">
                    <AlertCircle size={16} className="mr-2 text-amber-500" />
                    <span>
                      No specific BREF sections with high relevance found for this patent.
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* BREF Relevance Note (if a BREF is selected) */}
            {selectedBref && patent.bref_relevance && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-700 mb-2">BREF Relationship</h4>
                <div className="bg-blue-50 p-3 rounded border border-blue-200 text-sm">
                  {patent.bref_relevance[selectedBref.id] ? (
                    <div className="flex items-start">
                      <AlertCircle size={16} className="text-blue-500 mr-2 mt-0.5" />
                      <p>
                        This patent is particularly relevant to the selected BREF section 
                        "{selectedBref.name || selectedBref.id}" and addresses technologies 
                        that can help meet the specified regulatory requirements.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-start">
                      <AlertCircle size={16} className="text-amber-500 mr-2 mt-0.5" />
                      <p>
                        This patent is primarily focused on {selectedPollutant} reduction 
                        but doesn't specifically address the selected BREF section.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Footer with action buttons */}
        <div className="border-t p-4 bg-gray-50 rounded-b-lg">
          <div className="flex justify-end">
            <button
              onClick={() => {
                if (isViewingBref) {
                  setViewingBrefId(null);
                } else {
                  onClose();
                }
              }}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 mr-2"
            >
              {isViewingBref ? "Back to Patent" : "Close"}
            </button>
            
            {!isViewingBref && (
              <button
                onClick={() => onAddToContext(patent)}
                disabled={isInContext}
                className={`px-4 py-2 rounded-md flex items-center ${
                  isInContext ? 
                  'bg-green-100 text-green-700 cursor-default' : 
                  'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isInContext ? (
                  <>
                    <span className="mr-1">✓</span>
                    Added to context
                  </>
                ) : (
                  <>
                    <PlusCircle size={16} className="mr-2" />
                    Add to context
                  </>
                )}
              </button>
            )}
            
            {isViewingBref && !addedBrefs[viewingBrefId] && (
              <button
                onClick={() => handleAddBrefToContext(viewingBrefId)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
              >
                <PlusCircle size={16} className="mr-2" />
                Add to context
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatentDetailsBox;
