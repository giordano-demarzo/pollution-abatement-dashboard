// assets/js/components/OptimizedPollutionAbatementDashboard.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { MessageSquare, Search, Trash2, Filter, Info } from 'lucide-react';

import OptimizedPatentSpace from './OptimizedPatentSpace';
import HierarchicalBrefSelector from './HierarchicalBrefSelector';
import BrefTextDisplay from './BrefTextDisplay';
import PollutantInfoBox from './PollutantInfoBox';
import PatentRankingBox from './PatentRankingBox';
import ChatInterface from './ChatInterface'; // Import the new chat interface component

import {
  loadDashboardSummary,
  loadDashboardData,
  loadBrefHierarchy,
  loadBrefFlatMap,
  loadPollutantTopPatents,
  loadPollutantPatentCounts,
  loadPollutantBrefHierarchy,
  loadBrefRelevanceScores,
  loadSdgData // Assume this function exists to load SDG data
} from '../utils/dataLoader';

import {
  getColorByScore,
  getBrefRelevanceScore,
  getCombinedRelevanceScore,
  getPatentSummary,
  getSDGContribution,
  getImpactDescription
} from '../utils/dashboardHelpers';

import { formatBrefPath } from '../utils/brefUtils';

// Main application component
const OptimizedPollutionAbatementDashboard = () => {
  // Data state with optimized loading
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [brefHierarchy, setBrefHierarchy] = useState({});
  const [brefFlatMap, setBrefFlatMap] = useState({});
  const [pollutants, setPollutants] = useState([]);
  const [pollutantPatentCounts, setPollutantPatentCounts] = useState({});
  const [selectedPollutant, setSelectedPollutant] = useState(null);
  const [selectedPollutantFilename, setSelectedPollutantFilename] = useState(null);
  const [topPollutantPatents, setTopPollutantPatents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPatents, setLoadingPatents] = useState(false);
  const [loadingBrefHierarchy, setLoadingBrefHierarchy] = useState(false); 
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sdgData, setSDGData] = useState(null); // New state for SDG data
  

  // UI interaction state
  const [selectedPatents, setSelectedPatents] = useState([]);
  const [selectedBrefs, setSelectedBrefs] = useState([]); // State for selected BREFs
  const [showPollutantInfo, setShowPollutantInfo] = useState(false);
  const [infoBoxPollutant, setInfoBoxPollutant] = useState(null);
  
  // BREF selection state with optimized loading
  const [selectedBref, setSelectedBref] = useState(null);
  const [selectedBrefPath, setSelectedBrefPath] = useState([]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Load summary data (fast, small file)
        const summary = await loadDashboardSummary();
        if (summary) {
          setDashboardSummary(summary);
          
          // Set pollutants from summary
          setPollutants(summary.pollutants || []);
        } else {
          throw new Error('Failed to load dashboard summary');
        }
        
        // Load the main dashboard data structure
        const data = await loadDashboardData();
        if (data) {
          setDashboardData(data);
          
          // Set initial pollutant selection
          if (data.pollutants && data.pollutants.length > 0) {
            setSelectedPollutant(data.pollutants[0]);
            // Get filename mapping for the selected pollutant
            if (data.pollutant_filenames && data.pollutant_filenames[data.pollutants[0]]) {
              setSelectedPollutantFilename(data.pollutant_filenames[data.pollutants[0]]);
            }
          }
        } else {
          throw new Error('Failed to load dashboard data');
        }
        
        // Load BREF hierarchy and flat map in parallel
        const [brefData, flatMap, patentCounts] = await Promise.all([
          loadBrefHierarchy(),
          loadBrefFlatMap(),
          loadPollutantPatentCounts() // New function to load patent counts by pollutant
        ]);
        
        if (brefData) {
          console.log('BREF hierarchy loaded successfully');
          setBrefHierarchy(brefData);
        }
        
        if (flatMap) {
          setBrefFlatMap(flatMap);
        }
        
        if (patentCounts) {
          setPollutantPatentCounts(patentCounts);
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, []);

  // Load pollutant-specific top patents when pollutant changes
  useEffect(() => {
    const loadPollutantData = async () => {
      if (selectedPollutantFilename) {
        try {
          setLoadingPatents(true);
          const patents = await loadPollutantTopPatents(selectedPollutantFilename);
          setTopPollutantPatents(patents || []);
          
          // Load SDG data for the selected pollutant
          try {
            const sdgs = await loadSDGData(selectedPollutantFilename);
            setSDGData(sdgs || {});
          } catch (sdgErr) {
            console.error('Error loading SDG data:', sdgErr);
            setSDGData({});
          }
        } catch (err) {
          console.error(`Error loading data for pollutant ${selectedPollutantFilename}:`, err);
        } finally {
          setLoadingPatents(false);
        }
      }
    };
    
    loadPollutantData();
  }, [selectedPollutantFilename]);

  useEffect(() => {
  const loadPollutantSpecificBref = async () => {
    if (selectedPollutantFilename) {
      try {
        setLoadingBrefHierarchy(true);
        console.log(`Loading BREF hierarchy for pollutant: ${selectedPollutantFilename}`);
        
        const brefData = await loadPollutantBrefHierarchy(selectedPollutantFilename);
        if (brefData) {
          console.log('Pollutant-specific BREF hierarchy loaded successfully');
          setBrefHierarchy(brefData);
          
          // Reset selection if current selection doesn't make sense for new pollutant
          if (selectedBref) {
            // Check if this BREF is still relevant for the new pollutant
            const hasRelevantPath = selectedBrefPath.length > 0 && 
              brefData.hasOwnProperty(selectedBrefPath[0]?.id);
            
            if (!hasRelevantPath) {
              setSelectedBref(null);
              setSelectedBrefPath([]);
            }
          }
        }
      } catch (err) {
        console.error(`Error loading BREF data for pollutant ${selectedPollutantFilename}:`, err);
        
        // Fall back to the standard BREF hierarchy
        try {
          const standardBrefData = await loadBrefHierarchy();
          setBrefHierarchy(standardBrefData);
        } catch (fallbackErr) {
          console.error('Error loading fallback BREF hierarchy:', fallbackErr);
        }
      } finally {
        setLoadingBrefHierarchy(false);
      }
    }
  };
  
  loadPollutantSpecificBref();
}, [selectedPollutantFilename]);

  // Handle BREF selection
  const handleBrefSelect = useCallback((bref, brefPath = []) => {
    console.log('BREF selected:', bref, 'Path:', brefPath);
    setSelectedBref(bref);
    setSelectedBrefPath(brefPath);
  }, []);
  
  // Get the full path name of the selected BREF
  const getSelectedBrefFullPath = useCallback(() => {
    if (!selectedBrefPath.length) return "None selected";
    return formatBrefPath(selectedBrefPath);
  }, [selectedBrefPath]);

  // Handle adding BREF to context - Updated to ensure consistent structure
  const handleAddBrefToContext = useCallback((bref, brefText) => {
    // Ensure bref has the expected structure with id, name, and text properties
    const brefToAdd = {
      id: bref.id,
      name: bref.name || bref.id,
      text: brefText
    };

    setSelectedBrefs(prev => {
      // Don't add duplicates - check by ID
      if (prev.some(b => b.id === bref.id)) {
        console.log(`BREF ${bref.id} already in context, not adding again`);
        return prev;
      }
      
      console.log(`Adding BREF to context:`, brefToAdd);
      return [...prev, brefToAdd];
    });
  }, []);

  // Handle opening the pollutant info box
  const handleOpenPollutantInfo = useCallback((pollutantName) => {
    setInfoBoxPollutant(pollutantName);
    setShowPollutantInfo(true);
  }, []);
  
  // Handle closing the pollutant info box
  const handleClosePollutantInfo = useCallback(() => {
    setShowPollutantInfo(false);
  }, []);

  // Handle pollutant selection - ENHANCED with BREF considerations
  const handlePollutantChange = (pollutant) => {
    setSelectedPollutant(pollutant);
    
    // Get the filename-safe version of the pollutant name
    if (dashboardData && dashboardData.pollutant_filenames) {
      const filename = dashboardData.pollutant_filenames[pollutant];
      if (filename) {
        setSelectedPollutantFilename(filename);
      } else {
        console.error(`No filename mapping found for pollutant: ${pollutant}`);
        setSelectedPollutantFilename(pollutant.toLowerCase().replace(/[^a-z0-9]/g, '_'));
      }
    }
    
    // Clear selected patents when pollutant changes
    setSelectedPatents([]);
    
    // Note: We don't need to clear BREF selection here
    // The useEffect for pollutant-specific BREF will check if it's still relevant
  };

  // Handle patent selection from dropdown
  const handlePatentToggle = useCallback((patent) => {
    setSelectedPatents(prev => {
      if (prev.some(p => p.id === patent.id)) {
        return prev.filter(p => p.id !== patent.id);
      } else {
        // Log the patent being added to help with debugging
        console.log("Adding patent to context:", patent);
        return [...prev, patent];
      }
    });
  }, []);
  
  // Remove specific patent from context
  const handleRemovePatent = useCallback((patentId) => {
    setSelectedPatents(prev => prev.filter(p => p.id !== patentId));
  }, []);
  
  // Remove specific BREF from context
  const handleRemoveBref = useCallback((brefId) => {
    setSelectedBrefs(prev => prev.filter(b => b.id !== brefId));
  }, []);
  
  // Clear all patents from context
  const handleClearPatents = useCallback(() => {
    setSelectedPatents([]);
  }, []);
  
  // Clear all BREFs from context
  const handleClearBrefs = useCallback(() => {
    setSelectedBrefs([]);
  }, []);
  
  // Filter pollutants by search term and sort by patent count
  const filteredAndSortedPollutants = useMemo(() => {
    // Start with all pollutants
    let result = [...pollutants];
    
    // Filter by search term if provided
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      result = result.filter(pollutant => 
        typeof pollutant === 'string' 
          ? pollutant.toLowerCase().includes(lowerSearchTerm)
          : (pollutant.name && pollutant.name.toLowerCase().includes(lowerSearchTerm))
      );
    }
    
    // Sort by patent count (descending)
    result.sort((a, b) => {
      const pollutantNameA = typeof a === 'string' ? a : a.name;
      const pollutantNameB = typeof b === 'string' ? b : b.name;
      
      const countA = pollutantPatentCounts[pollutantNameA] || 0;
      const countB = pollutantPatentCounts[pollutantNameB] || 0;
      
      return countB - countA;
    });
    
    return result;
  }, [pollutants, pollutantPatentCounts, searchTerm]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto mb-4"></div>
            <div className="text-blue-700 font-medium">Loading dashboard data...</div>
          </div>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md">
            <div className="text-red-600 font-bold text-xl mb-4">Error</div>
            <div className="text-gray-700 mb-4">{error}</div>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      )}
      
      <header className="bg-gradient-to-r from-blue-700 to-blue-600 text-white p-4 shadow-md">
        <h1 className="text-2xl font-bold">Pollution Abatement Technology Dashboard</h1>
        {dashboardSummary && (
          <div className="text-xs text-blue-100 mt-1">
            Data version: {dashboardSummary.creation_date || 'Unknown'} | 
            Total patents: {dashboardSummary.totalPatents || 'Unknown'} | 
            Pollutants: {dashboardSummary.totalPollutants || 'Unknown'}
          </div>
        )}
      </header>
      
      <div className="flex flex-1 overflow-hidden p-2">
        {/* Left panel with pollutants, BREF selection, patent dropdown, and patent space */}
        <div className="flex flex-col w-2/3 pr-2 overflow-y-auto space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-700">Select Pollutant to Analyze:</h2>
              
              {/* Search box */}
              <div className="relative w-64">
                <input
                  type="text"
                  placeholder="Search pollutants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Search className="absolute left-2 top-1.5 h-4 w-4 text-gray-400" />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            
            {/* Selected pollutant display */}
            {selectedPollutant && (
              <div className="mb-3 p-2 bg-blue-50 text-sm border border-blue-100 rounded">
                <div className="font-medium text-blue-700">Selected Pollutant: </div>
                <div className="text-gray-700">{selectedPollutant}</div>
                <div className="text-xs text-gray-600 mt-1">
                  Patents: {pollutantPatentCounts[selectedPollutant] || 'Unknown'} | 
                  The selected pollutant is a significant environmental concern addressed by various abatement technologies.
                </div>
              </div>
            )}
            
            {/* Scrollable pollutant grid */}
            <div className="max-h-60 overflow-y-auto border rounded p-2">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {filteredAndSortedPollutants.length > 0 ? 
                  filteredAndSortedPollutants.map((pollutant) => {
                    const pollutantName = typeof pollutant === 'string' ? pollutant : pollutant.name;
                    const patentCount = pollutantPatentCounts[pollutantName] || 0;
                    
                    return (
                      <div 
                        key={pollutantName} 
                        className={`rounded overflow-hidden shadow-sm border transition-all hover:shadow-md cursor-pointer
                          ${selectedPollutant === pollutantName ? 'ring-2 ring-blue-500' : ''}`}
                        style={{ borderColor: selectedPollutant === pollutantName ? '#3b82f6' : '#e5e7eb' }}
                      >
                        <div 
                          className="p-2 font-medium text-white text-sm truncate flex justify-between items-center"
                          style={{ backgroundColor: selectedPollutant === pollutantName ? '#3b82f6' : '#64748b' }}
                          title={pollutantName}
                        >
                          <span className="truncate">{pollutantName}</span>
                          <button 
                            className="p-1 bg-white bg-opacity-20 rounded-full hover:bg-opacity-30 focus:outline-none"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPollutantInfo(pollutantName);
                            }}
                            title="View pollutant information"
                          >
                            <Info size={14} className="text-white" />
                          </button>
                        </div>
                        <div 
                          className="p-2"
                          onClick={() => handlePollutantChange(pollutantName)}
                        >
                          <div className="text-center font-bold text-xl">
                            {patentCount}
                          </div>
                          <div className="text-xs text-gray-500 text-center">
                            patents available
                          </div>
                        </div>
                      </div>
                    );
                  }) : 
                  searchTerm ? (
                    <div className="col-span-3 text-center py-4 text-gray-500">
                      No pollutants found for "{searchTerm}"
                    </div>
                  ) : (
                    Array(6).fill(0).map((_, i) => (
                      <div key={i} className="rounded overflow-hidden shadow-sm border border-gray-200 animate-pulse">
                        <div className="p-2 bg-gray-300 h-8"></div>
                        <div className="p-2">
                          <div className="h-7 bg-gray-200 rounded mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded"></div>
                        </div>
                      </div>
                    ))
                  )
                }
              </div>
            </div>
            
            {/* Stats bar */}
            <div className="mt-3 text-xs text-gray-500 flex justify-between items-center">
              <div>
                {filteredAndSortedPollutants.length} pollutants displayed
                {searchTerm ? ` (filtered from ${pollutants.length})` : ''}
              </div>
              <div className="flex items-center">
                <Filter size={12} className="mr-1" />
                <span>Sorted by patent count</span>
              </div>
            </div>
          </div>
          
          {/* BREF selection and text display - UPDATED SECTION */}
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h2 className="font-semibold mb-4 text-gray-700 border-b pb-2">BREF Sections:</h2>
            
            {/* Grid layout for BREF selector and content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* BREF Hierarchy Selector */}
              <div>
                <h3 className="text-sm font-medium mb-2 text-gray-700">Select BREF:</h3>
                {/* Hierarchical BREF selector - UPDATED with new props */}
                <div className="w-full relative">
                  {/* Add the loading indicator overlay */}
                  {loadingBrefHierarchy && (
                    <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-10 rounded">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700"></div>
                    </div>
                  )}
                  
                  {/* Updated component with new props */}
                  <HierarchicalBrefSelector
                  brefHierarchy={brefHierarchy}
                  selectedBref={selectedBref}
                  onBrefSelect={handleBrefSelect}
                  selectedPollutant={selectedPollutant}
                  selectedPollutantFilename={selectedPollutantFilename} // New prop
                  isLoading={loadingBrefHierarchy}
                />
                </div>
              </div>
              
              {/* BREF Text Display */}
              <div>
                <h3 className="text-sm font-medium mb-2 text-gray-700">BREF Content:</h3>
                <BrefTextDisplay 
                  selectedBref={selectedBref}
                  onAddToContext={handleAddBrefToContext}
                />
              </div>
            </div>
          </div>
          
          {/* Patent Ranking Box - Updated to pass onBrefAdd */}
          <PatentRankingBox
            selectedPollutant={selectedPollutant}
            selectedPollutantFilename={selectedPollutantFilename}
            selectedBref={selectedBref}
            onPatentToggle={handlePatentToggle}
            selectedPatents={selectedPatents}
            maxPatents={5}
            onBrefAdd={handleAddBrefToContext} // Pass function to add BREFs to context
          />
          
          {/* Optimized Patent Space - Updated to pass onBrefAdd */}
          <OptimizedPatentSpace
            selectedPollutant={selectedPollutant}
            selectedPollutantFilename={selectedPollutantFilename}
            selectedPatents={selectedPatents}
            setSelectedPatents={setSelectedPatents}
            dashboardData={dashboardData}
            selectedBref={selectedBref}
            onBrefAdd={handleAddBrefToContext} // Only pass the BREF add to context handler
          />
        </div>
        
        {/* Right panel with new chat interface */}
        <div className="w-1/3 bg-white rounded-lg shadow-md ml-2">
          <ChatInterface
            selectedPatents={selectedPatents}
            selectedBrefs={selectedBrefs}
            selectedPollutant={selectedPollutant}
            sdgData={sdgData}
            clearPatents={handleClearPatents}
            clearBrefs={handleClearBrefs}
            removePatent={handleRemovePatent}
            removeBref={handleRemoveBref}
          />
        </div>
      </div>
      
      {/* Pollutant Info Box */}
      <PollutantInfoBox
        pollutant={infoBoxPollutant}
        sdgImpactData={dashboardData?.sdgImpact}
        isOpen={showPollutantInfo}
        onClose={handleClosePollutantInfo}
      />
    </div>
  );
};

export default OptimizedPollutionAbatementDashboard;
