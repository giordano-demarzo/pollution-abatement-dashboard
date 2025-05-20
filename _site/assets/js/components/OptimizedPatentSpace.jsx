import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, ZoomIn, ZoomOut, Move } from 'lucide-react';
import PatentDetailsBox from './PatentDetailsBox';

import { loadVisiblePatents, loadPollutantScores, loadPatentDetails, loadBrefRelevanceScores } from '../utils/dataLoader';

// Constants for patent space visualization
const INITIAL_ZOOM = 0.9; // Slightly reduced to show more patents
const MIN_ZOOM = 0.3;    // Lower minimum zoom to see more patents at once
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.15;  // Smaller steps for smoother zooming
const POINT_RADIUS = 6;
const SELECTED_RADIUS = 8;
const HOVER_RADIUS = 7;

// Custom continuous gradient color based on score - using a more visually pleasing color scheme
const getPointColor = (score, opacity = 1) => {
  // If score is below threshold, return gray with reduced opacity
  if (score < 0.5) {
    return `rgba(156, 163, 175, ${opacity * 0.5})`;  // Gray with reduced opacity
  }
  
  // Normalize score between 0.5 and 1.0 to create a smooth transition
  const normalizedScore = (score - 0.5) * 2; // Map 0.5-1.0 to 0-1
  
  // Use a scientifically proven appealing colormap (based on viridis/inferno)
  let r, g, b;
  
  // Start with blue for lower scores, transition to purple, then orange/yellow for high scores
  if (normalizedScore < 0.5) {
    // Blue to purple transition
    const t = normalizedScore * 2;
    r = Math.round(30 + 120 * t);
    g = Math.round(60 + 70 * t);
    b = Math.round(160 + 10 * t);
  } else {
    // Purple to yellow/orange transition
    const t = (normalizedScore - 0.5) * 2;
    r = Math.round(150 + 105 * t);
    g = Math.round(130 + 125 * t);
    b = Math.round(170 - 170 * t);
  }
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const OptimizedPatentSpace = ({ 
  selectedPollutant,
  selectedPollutantFilename,
  selectedPatents = [],
  setSelectedPatents,
  dashboardData,
  selectedBref = null,
  onBrefSelect = null,
  onBrefAdd = null
}) => {
  // Canvas and state refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  // Visualization state
  const [viewState, setViewState] = useState({
    zoom: INITIAL_ZOOM,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    currentOffsetX: 0,
    currentOffsetY: 0
  });
  
  // Patent data state
  const [allPatents, setAllPatents] = useState([]);
  const [visiblePatents, setVisiblePatents] = useState([]);
  const [hoveredPatent, setHoveredPatent] = useState(null);
  const [loadingPatents, setLoadingPatents] = useState(false);
  const [patentScores, setPatentScores] = useState({});
  const [viewBounds, setViewBounds] = useState({ xMin: 0, xMax: 1, yMin: 0, yMax: 1 });
  
  // Patent details modal state
  const [selectedPatentForDetails, setSelectedPatentForDetails] = useState(null);
  
  // BREF relevance scores for patent-BREF relationships
  const [brefRelevanceScores, setBrefRelevanceScores] = useState({});
  const [loadingBrefScores, setLoadingBrefScores] = useState(false);
  
  // Tool state
  const [activeTool, setActiveTool] = useState('move'); // 'move', 'zoom-in', 'zoom-out'
  
  // Calculate view bounds with FIXED ASPECT RATIO
  const calculateViewBounds = useCallback(() => {
    if (!containerRef.current) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
    
    const { width, height } = containerRef.current.getBoundingClientRect();
    const containerAspectRatio = width / height;
    
    // Fixed aspect ratio - always maintain a 1:1 data aspect ratio
    // This prevents distortion when zooming or panning
    const dataAspectRatio = 1.0;
    
    // Calculate the view size based on zoom
    const viewSize = 1 / viewState.zoom;
    
    // Ensure the view size respects the container aspect ratio
    const viewWidth = viewSize;
    const viewHeight = viewSize / containerAspectRatio;
    
    // Calculate center based on offsets
    const centerX = 0.5 - viewState.offsetX / (width * viewState.zoom);
    const centerY = 0.5 - viewState.offsetY / (height * viewState.zoom);
    
    // Calculate bounds ensuring they maintain correct aspect ratio
    const xMin = Math.max(0, centerX - viewWidth / 2);
    const xMax = Math.min(1, centerX + viewWidth / 2);
    const yMin = Math.max(0, centerY - viewHeight / 2);
    const yMax = Math.min(1, centerY + viewHeight / 2);
    
    return { xMin, xMax, yMin, yMax };
  }, [viewState.zoom, viewState.offsetX, viewState.offsetY]);
  
  // Load patent scores when pollutant changes
  useEffect(() => {
    const loadScores = async () => {
      if (!selectedPollutantFilename) return;
      
      try {
        const scores = await loadPollutantScores(selectedPollutantFilename);
        setPatentScores(scores || {});
      } catch (error) {
        console.error('Error loading pollutant scores:', error);
      }
    };
    
    loadScores();
  }, [selectedPollutantFilename]);
  
  // Load BREF relevance scores when pollutant changes
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
          console.log(`Loaded BREF relevance scores for visualization`, 
            Object.keys(scores).length + " patents have scores");
          setBrefRelevanceScores(scores);
        } else {
          console.warn('No BREF relevance scores available for visualization');
          setBrefRelevanceScores({});
        }
      } catch (err) {
        console.error(`Error loading BREF relevance data for visualization:`, err);
        setBrefRelevanceScores({});
      } finally {
        setLoadingBrefScores(false);
      }
    };

    fetchBrefScores();
  }, [selectedPollutantFilename]);
  
  // Load all patents for the selected pollutant
  useEffect(() => {
    if (!selectedPollutantFilename) return;
    
    const loadAllPatentsForPollutant = async () => {
      setLoadingPatents(true);
      try {
        // Load all patents for this pollutant
        // Note: We'll need to expand the loadVisiblePatents to get all patents
        // This might require a new API function, but we can use the existing one 
        // with a full view for now
        const fullViewBounds = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
        const patents = await loadVisiblePatents(fullViewBounds, selectedPollutantFilename);
        setAllPatents(patents || []);
        updateVisiblePatents(patents || [], calculateViewBounds());
      } catch (error) {
        console.error('Error loading patents:', error);
      } finally {
        setLoadingPatents(false);
      }
    };
    
    loadAllPatentsForPollutant();
  }, [selectedPollutantFilename]);
  
  // Filter visible patents when view bounds change
  const updateVisiblePatents = useCallback((patents, bounds) => {
    const { xMin, xMax, yMin, yMax } = bounds;
    const visible = patents.filter(patent => 
      patent.x >= xMin && patent.x <= xMax && patent.y >= yMin && patent.y <= yMax
    );
    setVisiblePatents(visible);
  }, []);
  
  // Update visible patents when view bounds or all patents change
  useEffect(() => {
    const bounds = calculateViewBounds();
    setViewBounds(bounds);
    
    if (allPatents.length > 0) {
      updateVisiblePatents(allPatents, bounds);
    }
  }, [calculateViewBounds, updateVisiblePatents, allPatents, viewState.zoom, viewState.offsetX, viewState.offsetY]);
  
  // Draw the patent space
  const drawPatentSpace = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // No patents to display
    if (!allPatents.length) {
      ctx.fillStyle = '#9ca3af';
      ctx.textAlign = 'center';
      ctx.font = '14px sans-serif';
      
      if (loadingPatents) {
        ctx.fillText('Loading patents...', width / 2, height / 2);
      } else if (!selectedPollutant) {
        ctx.fillText('Select a pollutant to view patents', width / 2, height / 2);
      } else {
        ctx.fillText('No patents found for this pollutant', width / 2, height / 2);
      }
      return;
    }
    
    // Draw coordinate system grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    
    // Draw grid lines
    const gridSize = 0.1;
    
    // Convert data coordinates to screen coordinates
    const dataToScreenX = (x) => {
      const { xMin, xMax } = viewBounds;
      return ((x - xMin) / (xMax - xMin)) * width;
    };
    
    const dataToScreenY = (y) => {
      const { yMin, yMax } = viewBounds;
      return height - ((y - yMin) / (yMax - yMin)) * height;
    };
    
    // Draw grid lines
    ctx.beginPath();
    for (let x = 0; x <= 1; x += gridSize) {
      const screenX = dataToScreenX(x);
      if (screenX >= 0 && screenX <= width) {
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, height);
      }
    }
    for (let y = 0; y <= 1; y += gridSize) {
      const screenY = dataToScreenY(y);
      if (screenY >= 0 && screenY <= height) {
        ctx.moveTo(0, screenY);
        ctx.lineTo(width, screenY);
      }
    }
    ctx.stroke();
    
    // Sort patents so that more relevant ones are drawn on top
    // and selected ones are drawn last (on top)
    const sortedPatents = [...allPatents].sort((a, b) => {
      // First compare selection state
      const aSelected = selectedPatents.some(p => p.id === a.id);
      const bSelected = selectedPatents.some(p => p.id === b.id);
      if (aSelected && !bSelected) return 1;
      if (!aSelected && bSelected) return -1;
      
      // Then compare score
      return a.score - b.score;
    });
    
    // Draw all patents
    sortedPatents.forEach(patent => {
      // Convert data coordinates to screen coordinates
      const x = dataToScreenX(patent.x);
      const y = dataToScreenY(patent.y);
      
      // Skip if outside the view
      if (x < -20 || x > width + 20 || y < -20 || y > height + 20) return;
      
      const score = patent.score || 0;
      
      // Determine if patent is selected or hovered
      const isSelected = selectedPatents.some(p => p.id === patent.id);
      const isHovered = hoveredPatent && hoveredPatent.id === patent.id;
      const isVisible = visiblePatents.some(p => p.id === patent.id);
      const isRelevant = score >= 0.5;
      
      // Set point size based on state
      let radius = POINT_RADIUS;
      if (isSelected) radius = SELECTED_RADIUS;
      else if (isHovered) radius = HOVER_RADIUS;
      
      // Set opacity based on relevance and view
      let opacity = 1.0;
      if (!isRelevant) opacity = 0.3;
      
      // Draw point
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = getPointColor(score, opacity);
      ctx.fill();
      
      // Draw border for selected/hovered patents
      if (isSelected || isHovered) {
        ctx.strokeStyle = isSelected ? '#2563eb' : '#64748b';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
    
    // Draw patent tooltip if hovered
    if (hoveredPatent) {
      const x = dataToScreenX(hoveredPatent.x);
      const y = dataToScreenY(hoveredPatent.y) - 15;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.textAlign = 'center';
      ctx.font = '12px sans-serif';
      
      // Measure text width
      const text = hoveredPatent.title || `Patent ${hoveredPatent.id}`;
      const textWidth = ctx.measureText(text).width;
      const padding = 6;
      
      // Draw tooltip background
      ctx.fillRect(
        x - textWidth / 2 - padding,
        y - 20 - padding,
        textWidth + padding * 2,
        20 + padding * 2
      );
      
      // Draw tooltip text
      ctx.fillStyle = 'white';
      ctx.fillText(text, x, y);
      
      // Draw year and relevance if available
      if (hoveredPatent.year || hoveredPatent.score) {
        const yearText = hoveredPatent.year ? `(${hoveredPatent.year})` : '';
        const scoreText = hoveredPatent.score ? ` - ${Math.round(hoveredPatent.score * 100)}% relevance` : '';
        ctx.fillText(
          `${yearText}${scoreText}`,
          x,
          y + 15
        );
      }
    }
  }, [allPatents, visiblePatents, selectedPatents, hoveredPatent, viewBounds, selectedPollutant, loadingPatents]);
  
  // Set canvas dimensions when component mounts or container resizes
  useEffect(() => {
    const updateCanvasDimensions = () => {
      if (!containerRef.current || !canvasRef.current) return;
      
      const { width, height } = containerRef.current.getBoundingClientRect();
      
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      
      // Redraw after resize
      drawPatentSpace();
    };
    
    // Update dimensions initially
    updateCanvasDimensions();
    
    // Set up resize observer to handle container size changes
    const observer = new ResizeObserver(updateCanvasDimensions);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    // Clean up observer on unmount
    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, [drawPatentSpace]);
  
  // Draw canvas whenever relevant state changes
  useEffect(() => {
    drawPatentSpace();
  }, [drawPatentSpace]);
  
  // Handle mouse movement for hover effects and dragging with TRULY FIXED DIRECTION
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || !allPatents.length) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Convert screen coordinates to data coordinates
    const screenToDataX = (x) => {
      const { xMin, xMax } = viewBounds;
      return xMin + (x / canvas.width) * (xMax - xMin);
    };
    
    const screenToDataY = (y) => {
      const { yMin, yMax } = viewBounds;
      return yMin + ((canvas.height - y) / canvas.height) * (yMax - yMin);
    };
    
    const dataX = screenToDataX(mouseX);
    const dataY = screenToDataY(mouseY);
    
    // Handle dragging for panning (FIXED DIRECTION - CORRECTED)
    if (viewState.isDragging && activeTool === 'move') {
      const dx = e.clientX - viewState.dragStartX;
      const dy = e.clientY - viewState.dragStartY;
      
      // TRULY FIXED: Moving in the correct direction by REVERSING the sign for offsetX
      setViewState(prev => ({
        ...prev,
        offsetX: prev.currentOffsetX + dx, // REVERSED sign for natural left-right movement
        offsetY: prev.currentOffsetY - dy
      }));
      return;
    }
    
    // Find patent under mouse cursor
    const hoverThreshold = 10 / viewState.zoom;
    let nearestPatent = null;
    let nearestDistance = hoverThreshold;
    
    // Only check patents that are reasonably near the cursor
    allPatents.forEach(patent => {
      const distance = Math.sqrt(
        Math.pow(dataX - patent.x, 2) + Math.pow(dataY - patent.y, 2)
      );
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPatent = patent;
      }
    });
    
    setHoveredPatent(nearestPatent);
    
    // Change cursor based on tool and hover state
    if (nearestPatent) {
      canvas.style.cursor = 'pointer';
    } else {
      switch (activeTool) {
        case 'move':
          canvas.style.cursor = viewState.isDragging ? 'grabbing' : 'grab';
          break;
        case 'zoom-in':
          canvas.style.cursor = 'zoom-in';
          break;
        case 'zoom-out':
          canvas.style.cursor = 'zoom-out';
          break;
        default:
          canvas.style.cursor = 'default';
      }
    }
  }, [allPatents, viewState, viewBounds, activeTool]);
  
  // Handle patent details display
  const handleShowPatentDetails = useCallback(async (patent) => {
    if (!patent) return;
    
    try {
      // Load the complete patent details
      const fullPatentDetails = await loadPatentDetails(patent.id);
      
      // Get BREF relevance data for this patent if available
      let brefRelevanceData = {};
      if (brefRelevanceScores && brefRelevanceScores[patent.id]) {
        brefRelevanceData = {
          bref_relevance: brefRelevanceScores[patent.id] 
        };
      }
      
      // Merge with current data and BREF relevance data
      const enhancedPatent = {
        ...patent,
        ...fullPatentDetails,
        ...brefRelevanceData
      };
      
      // Open the details modal
      setSelectedPatentForDetails(enhancedPatent);
    } catch (error) {
      console.error('Error loading patent details:', error);
      // Fallback to basic patent data with any available BREF relevance
      let brefRelevanceData = {};
      if (brefRelevanceScores && brefRelevanceScores[patent.id]) {
        brefRelevanceData = {
          bref_relevance: brefRelevanceScores[patent.id]
        };
      }
      
      // Use what we have with BREF data
      setSelectedPatentForDetails({
        ...patent,
        ...brefRelevanceData
      });
    }
  }, [brefRelevanceScores]);
  
  // Handle viewing BREF section from the patent details box
  const handleBrefView = useCallback((bref) => {
    if (onBrefSelect) {
      // If parent component provided a handler, use it to display BREF content
      onBrefSelect(bref);
      
      // Close the patent details modal after selecting a BREF
      setSelectedPatentForDetails(null);
    }
  }, [onBrefSelect]);
  
  // Check if a patent is in the current context
  const isPatentInContext = useCallback((patentId) => {
    return selectedPatents.some(p => p.id === patentId);
  }, [selectedPatents]);
  
  // Handle mouse down for pan and selection
  const handleMouseDown = useCallback((e) => {
    if (activeTool === 'move') {
      setViewState(prev => ({
        ...prev,
        isDragging: true,
        dragStartX: e.clientX,
        dragStartY: e.clientY,
        currentOffsetX: prev.offsetX,
        currentOffsetY: prev.offsetY
      }));
    }
  }, [activeTool]);
  
  // Handle mouse up for pan, zoom, and selection with drag detection
  const handleMouseUp = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Calculate distance moved during potential drag
    const dragDistance = Math.sqrt(
      Math.pow(e.clientX - viewState.dragStartX, 2) + 
      Math.pow(e.clientY - viewState.dragStartY, 2)
    );
    
    // End dragging
    const wasDragging = viewState.isDragging;
    if (viewState.isDragging) {
      setViewState(prev => ({
        ...prev,
        isDragging: false
      }));
    }
    
    // If we moved more than a few pixels, it was a drag not a click
    const isDragThreshold = 3; // pixels
    if (wasDragging && dragDistance > isDragThreshold) {
      return; // Don't treat as a click
    }
    
    // Handle click on patent - OPEN DETAILS BOX (for all tools)
    if (hoveredPatent) {
      // Show patent details when clicked (primary action)
      handleShowPatentDetails(hoveredPatent);
      return;
    }
    
    // Handle zoom tools when not clicking on a patent
    if (!hoveredPatent) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      if (activeTool === 'zoom-in') {
        zoomAt(mouseX, mouseY, ZOOM_STEP);
      } else if (activeTool === 'zoom-out') {
        zoomAt(mouseX, mouseY, -ZOOM_STEP);
      }
    }
  }, [hoveredPatent, viewState.isDragging, viewState.dragStartX, viewState.dragStartY, activeTool, handleShowPatentDetails]);
  
  // Handle double-click to add patent to context
  const handleDoubleClick = useCallback((e) => {
    if (!hoveredPatent) return;
    
    // Toggle selection on double-click
    setSelectedPatents(prev => {
      const isSelected = prev.some(p => p.id === hoveredPatent.id);
      
      if (isSelected) {
        return prev.filter(p => p.id !== hoveredPatent.id);
      } else {
        return [...prev, hoveredPatent];
      }
    });
  }, [hoveredPatent, setSelectedPatents]);
  
  // Zoom at specific point with locked aspect ratio
  const zoomAt = useCallback((x, y, zoomDelta) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setViewState(prev => {
      // Use multiplicative zoom for smoother scaling
      const zoomFactor = 1 + zoomDelta;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom * zoomFactor));
      
      // No change if hitting zoom limits
      if (newZoom === prev.zoom) return prev;
      
      // Calculate how much the offset should change
      // This ensures we zoom centered on the cursor position
      const zoomRatio = newZoom / prev.zoom;
      
      // Convert screen coordinates to be relative to center
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const relativeX = x - centerX;
      const relativeY = y - centerY;
      
      // Calculate new offset - ensuring we maintain aspect ratio
      // by applying the same zoom factor to both dimensions
      const newOffsetX = prev.offsetX + relativeX * (zoomRatio - 1);
      const newOffsetY = prev.offsetY + relativeY * (zoomRatio - 1);
      
      return {
        ...prev,
        zoom: newZoom,
        offsetX: newOffsetX,
        offsetY: newOffsetY
      };
    });
  }, []);
  
  // Handle wheel event with locked aspect ratio zooming
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    
    // Determine zoom direction and amount (smoother zoom)
    const delta = Math.sign(e.deltaY) * -ZOOM_STEP * 0.7;
    
    // Get mouse position
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Zoom centered on mouse position, maintaining aspect ratio
    zoomAt(mouseX, mouseY, delta);
  }, [zoomAt]);
  
  // Handle zooming with buttons
  const handleZoomIn = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Zoom centered on canvas
    zoomAt(canvas.width / 2, canvas.height / 2, ZOOM_STEP);
  }, [zoomAt]);
  
  const handleZoomOut = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Zoom centered on canvas
    zoomAt(canvas.width / 2, canvas.height / 2, -ZOOM_STEP);
  }, [zoomAt]);
  
  // Handle reset view - improved to correctly fit all patents
  const handleResetView = useCallback(() => {
    if (allPatents.length === 0) {
      // Default reset if no patents
      setViewState({
        zoom: INITIAL_ZOOM,
        offsetX: 0,
        offsetY: 0,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        currentOffsetX: 0,
        currentOffsetY: 0
      });
      return;
    }
    
    // Find min/max coordinates of all patents to create a bounding box
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    
    allPatents.forEach(patent => {
      minX = Math.min(minX, patent.x);
      minY = Math.min(minY, patent.y);
      maxX = Math.max(maxX, patent.x);
      maxY = Math.max(maxY, patent.y);
    });
    
    // Add more padding for better visibility
    const padding = 0.1;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(1, maxX + padding);
    maxY = Math.min(1, maxY + padding);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const { width, height } = canvas;
    const aspectRatio = width / height;
    const dataWidth = maxX - minX;
    const dataHeight = maxY - minY;
    const dataAspectRatio = dataWidth / dataHeight;
    
    // Calculate zoom required for each dimension
    let zoom;
    let offsetX = 0;
    let offsetY = 0;
    
    // Calculate padding in data coordinates
    const dataXCenter = (minX + maxX) / 2;
    const dataYCenter = (minY + maxY) / 2;
    
    // Determine if we're constrained by width or height
    if (dataAspectRatio > aspectRatio) {
      // Width constrained (wider data than canvas aspect)
      zoom = 0.8 / dataWidth;
      // Center vertically
      const visibleHeight = 1 / (zoom * aspectRatio);
      offsetY = (dataYCenter - 0.5) * height * zoom;
    } else {
      // Height constrained (taller data than canvas aspect)
      zoom = 0.8 / (dataHeight * aspectRatio);
      // Center horizontally
      const visibleWidth = aspectRatio / zoom;
      offsetX = (dataXCenter - 0.5) * width * zoom;
    }
    
    // Ensure zoom is within bounds
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    
    // Set the new view state
    setViewState({
      zoom,
      offsetX,
      offsetY,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      currentOffsetX: 0,
      currentOffsetY: 0
    });
    
    console.log("Reset view to show all patents", {
      minX, maxX, minY, maxY, zoom, offsetX, offsetY
    });
  }, [allPatents]);
  
  // Handle clicking on a tool button
  const handleToolClick = useCallback((tool) => {
    setActiveTool(tool);
    
    // Reset dragging state when changing tools
    setViewState(prev => ({
      ...prev,
      isDragging: false
    }));
  }, []);
  
  // Add the handlePatentToggle for the patent details box
  const handlePatentToggle = useCallback((patent) => {
    if (!patent) return;
    
    setSelectedPatents(prev => {
      const isSelected = prev.some(p => p.id === patent.id);
      
      if (isSelected) {
        return prev.filter(p => p.id !== patent.id);
      } else {
        return [...prev, patent];
      }
    });
  }, [setSelectedPatents]);
  
  // Attach event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('dblclick', handleDoubleClick);
    
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [handleMouseMove, handleMouseDown, handleMouseUp, handleWheel, handleDoubleClick]);
  
  // Call reset view once when all patents are loaded with improved timing
  useEffect(() => {
    // Only reset view when patents first load or when pollutant changes
    if (allPatents.length > 0 && !loadingPatents) {
      // Short delay to ensure patents are fully processed
      const timer = setTimeout(() => {
        handleResetView();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [allPatents.length, loadingPatents, selectedPollutantFilename]);
  
  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-gray-700 border-b pb-2">
          Patent Space Visualization {selectedPollutant ? `for ${selectedPollutant}` : ''}
        </h2>
        
        {/* Tool controls */}
        <div className="flex space-x-2">
          <button
            className={`p-2 rounded transition-colors ${activeTool === 'move' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            onClick={() => handleToolClick('move')}
            title="Pan tool (drag to move view)"
          >
            <Move size={16} />
          </button>
          <button
            className={`p-2 rounded transition-colors ${activeTool === 'zoom-in' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            onClick={() => handleToolClick('zoom-in')}
            title="Zoom in (click to zoom in)"
          >
            <ZoomIn size={16} />
          </button>
          <button
            className={`p-2 rounded transition-colors ${activeTool === 'zoom-out' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            onClick={() => handleToolClick('zoom-out')}
            title="Zoom out (click to zoom out)"
          >
            <ZoomOut size={16} />
          </button>
          <button
            className="p-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            onClick={handleResetView}
            title="Reset view (show all patents)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Information bar */}
      <div className="flex justify-between items-center mb-2 text-xs text-gray-500">
        <div>
          {loadingPatents ? 'Loading patents...' : 
            allPatents.length ? 
              `${allPatents.length} total patents | ${visiblePatents.length} in current view` : 
              'No patents available'
          }
          {selectedPatents.length > 0 && ` | ${selectedPatents.length} selected`}
        </div>
        <div className="flex items-center space-x-4">
          <span>Zoom: {Math.round(viewState.zoom * 100)}%</span>
          <div className="text-xs text-blue-600">
            Click: view details | Double-click: select patent | Wheel: zoom
          </div>
        </div>
      </div>
      
      {/* Canvas container - INCREASED HEIGHT FOR MORE SQUARE PROPORTIONS */}
      <div 
        ref={containerRef}
        className="w-full h-96 border rounded bg-white overflow-hidden relative"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
        />
        
        {/* Loading overlay */}
        {loadingPatents && (
          <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center">
            <div className="text-blue-600 animate-pulse">Loading patents...</div>
          </div>
        )}
        
        {/* Empty state */}
        {!selectedPollutant && !loadingPatents && allPatents.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <div>Select a pollutant to visualize patents</div>
            </div>
          </div>
        )}
      </div>
      
      {/* Legend with continuous gradient */}
      <div className="mt-3 border-t pt-3">
        <div className="text-xs font-medium text-gray-500 mb-2">Relevance score:</div>
        <div className="flex flex-col items-center">
          {/* Continuous gradient bar with better colors */}
          <div className="w-full h-6 rounded-md mb-2 relative" 
               style={{
                 background: 'linear-gradient(to right, rgba(30,60,160,1) 0%, rgba(150,130,170,1) 50%, rgba(255,230,0,1) 100%)'
               }}>
            {/* Tick marks */}
            <div className="absolute inset-y-0 left-0 flex items-center">
              <span className="text-xs ml-1">50%</span>
            </div>
            <div className="absolute inset-y-0 left-1/4 flex items-center">
              <span className="text-xs">62.5%</span>
            </div>
            <div className="absolute inset-y-0 left-1/2 flex items-center">
              <span className="text-xs">75%</span>
            </div>
            <div className="absolute inset-y-0 left-3/4 flex items-center">
              <span className="text-xs">87.5%</span>
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center">
              <span className="text-xs mr-1">100%</span>
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Patents with relevance below 50% are shown in gray with reduced opacity
          </div>
        </div>
      </div>
      
      {/* Patent Details Modal - Updated to pass handlers for BREF viewing and adding */}
      {selectedPatentForDetails && (
        <PatentDetailsBox
          patent={selectedPatentForDetails}
          onClose={() => setSelectedPatentForDetails(null)}
          onAddToContext={handlePatentToggle}
          isInContext={isPatentInContext(selectedPatentForDetails.id)}
          selectedBref={selectedBref}
          selectedPollutant={selectedPollutant}
          brefRelevanceScores={brefRelevanceScores}
          onBrefView={handleBrefView}
          onBrefAdd={onBrefAdd}
        />
      )}
    </div>
  );
};

export default OptimizedPatentSpace;
