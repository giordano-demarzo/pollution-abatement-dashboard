import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, ZoomIn, ZoomOut, Move, Sliders } from 'lucide-react';
import PatentDetailsBox from './PatentDetailsBox';

import { loadVisiblePatents, loadPollutantScores, loadPatentDetails, loadBrefRelevanceScores } from '../utils/dataLoader';

// Constants for patent space visualization
const INITIAL_ZOOM = 0.9;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.15;
const POINT_RADIUS = 5;
const SELECTED_RADIUS = 8;
const HOVER_RADIUS = 7;

// Enhanced color scheme with better aesthetics
const getPointColor = (score, opacity = 1) => {
  // Enhanced color scheme using modern gradient
  let r, g, b;
  
  if (score < 0.3) {
    // Very low scores: Cool gray-blue
    r = 148;
    g = 163;
    b = 184;
    opacity *= 0.4;
  } else if (score < 0.5) {
    // Low scores: Soft blue
    const t = (score - 0.3) / 0.2;
    r = Math.round(148 + (59 - 148) * t);   // 148 -> 59
    g = Math.round(163 + (130 - 163) * t);  // 163 -> 130
    b = Math.round(184 + (246 - 184) * t);  // 184 -> 246
    opacity *= 0.6 + 0.3 * t;
  } else if (score < 0.7) {
    // Medium scores: Vibrant teal to purple
    const t = (score - 0.5) / 0.2;
    r = Math.round(59 + (147 - 59) * t);    // 59 -> 147
    g = Math.round(130 + (51 - 130) * t);   // 130 -> 51
    b = Math.round(246 + (234 - 246) * t);  // 246 -> 234
  } else if (score < 0.85) {
    // High scores: Purple to orange
    const t = (score - 0.7) / 0.15;
    r = Math.round(147 + (251 - 147) * t);  // 147 -> 251
    g = Math.round(51 + (146 - 51) * t);    // 51 -> 146
    b = Math.round(234 + (60 - 234) * t);   // 234 -> 60
  } else {
    // Very high scores: Bright orange to red
    const t = (score - 0.85) / 0.15;
    r = Math.round(251 + (239 - 251) * t);  // 251 -> 239
    g = Math.round(146 + (68 - 146) * t);   // 146 -> 68
    b = Math.round(60 + (68 - 60) * t);     // 60 -> 68
  }
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Generate CSS gradient for the color bar
const generateColorBarGradient = () => {
  const stops = [];
  for (let i = 0; i <= 100; i += 5) {
    const score = i / 100;
    const color = getPointColor(score, 1);
    // Extract RGB values to convert to hex
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      stops.push(`${hex} ${i}%`);
    }
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
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
  const [activeTool, setActiveTool] = useState('move');
  
  // NEW: Score filtering state
  const [scoreThreshold, setScoreThreshold] = useState(0.5);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  
  // Filter patents based on score threshold
  const filteredPatents = useMemo(() => {
    return allPatents.filter(patent => (patent.score || 0) >= scoreThreshold);
  }, [allPatents, scoreThreshold]);
  
  // Calculate view bounds with FIXED ASPECT RATIO
  const calculateViewBounds = useCallback(() => {
    if (!containerRef.current) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
    
    const { width, height } = containerRef.current.getBoundingClientRect();
    const containerAspectRatio = width / height;
    
    // Fixed aspect ratio - always maintain a 1:1 data aspect ratio
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
  
  // Update visible patents when view bounds or filtered patents change
  useEffect(() => {
    const bounds = calculateViewBounds();
    setViewBounds(bounds);
    
    if (filteredPatents.length > 0) {
      updateVisiblePatents(filteredPatents, bounds);
    }
  }, [calculateViewBounds, updateVisiblePatents, filteredPatents, viewState.zoom, viewState.offsetX, viewState.offsetY]);
  
  // Draw the patent space with enhanced aesthetics
  const drawPatentSpace = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    // Clear canvas with a subtle background
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, width, height);
    
    // No patents to display
    if (!filteredPatents.length) {
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'center';
      ctx.font = '14px Inter, system-ui, sans-serif';
      
      if (loadingPatents) {
        ctx.fillText('Loading patents...', width / 2, height / 2);
      } else if (!selectedPollutant) {
        ctx.fillText('Select a pollutant to view patents', width / 2, height / 2);
      } else if (allPatents.length > 0 && filteredPatents.length === 0) {
        ctx.fillText(`No patents with score ≥ ${Math.round(scoreThreshold * 100)}%`, width / 2, height / 2);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '12px Inter, system-ui, sans-serif';
        ctx.fillText('Adjust the score filter below', width / 2, height / 2 + 20);
      } else {
        ctx.fillText('No patents found for this pollutant', width / 2, height / 2);
      }
      return;
    }
    
    // Draw enhanced grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    
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
    
    // Draw grid lines with subtle style
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
    
    // Sort patents for better rendering order
    const sortedPatents = [...filteredPatents].sort((a, b) => {
      const aSelected = selectedPatents.some(p => p.id === a.id);
      const bSelected = selectedPatents.some(p => p.id === b.id);
      if (aSelected && !bSelected) return 1;
      if (!aSelected && bSelected) return -1;
      return a.score - b.score;
    });
    
    // Draw patents with enhanced styling
    sortedPatents.forEach(patent => {
      const x = dataToScreenX(patent.x);
      const y = dataToScreenY(patent.y);
      
      // Skip if outside the view
      if (x < -20 || x > width + 20 || y < -20 || y > height + 20) return;
      
      const score = patent.score || 0;
      const isSelected = selectedPatents.some(p => p.id === patent.id);
      const isHovered = hoveredPatent && hoveredPatent.id === patent.id;
      
      // Set point size and style
      let radius = POINT_RADIUS;
      if (isSelected) radius = SELECTED_RADIUS;
      else if (isHovered) radius = HOVER_RADIUS;
      
      // Enhanced point rendering with border
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      
      // Fill with enhanced color
      ctx.fillStyle = getPointColor(score, 0.9);
      ctx.fill();
      
      // Add attractive border
      ctx.strokeStyle = isSelected ? '#1d4ed8' : 
                       isHovered ? '#374151' : 
                       'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = isSelected ? 2.5 : isHovered ? 2 : 1.5;
      ctx.stroke();
      
      // Add subtle shadow for depth
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(x + 1, y + 1, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fill();
        
        // Redraw the main point on top
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = getPointColor(score, 0.95);
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#1d4ed8' : '#374151';
        ctx.lineWidth = isSelected ? 2.5 : 2;
        ctx.stroke();
      }
    });
    
    // Enhanced tooltip
    if (hoveredPatent) {
      const x = dataToScreenX(hoveredPatent.x);
      const y = dataToScreenY(hoveredPatent.y) - 15;
      
      const text = hoveredPatent.title || `Patent ${hoveredPatent.id}`;
      const score = Math.round((hoveredPatent.score || 0) * 100);
      const yearText = hoveredPatent.year ? ` (${hoveredPatent.year})` : '';
      
      ctx.font = '12px Inter, system-ui, sans-serif';
      const textWidth = Math.max(
        ctx.measureText(text).width,
        ctx.measureText(`${score}% relevance${yearText}`).width
      );
      const padding = 8;
      
      // Enhanced tooltip background with gradient
      const gradient = ctx.createLinearGradient(0, y - 35, 0, y + 5);
      gradient.addColorStop(0, 'rgba(17, 24, 39, 0.95)');
      gradient.addColorStop(1, 'rgba(31, 41, 55, 0.95)');
      
      ctx.fillStyle = gradient;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      
      const tooltipX = Math.max(padding, Math.min(width - textWidth - padding * 2, x - textWidth / 2 - padding));
      
      // Rounded rectangle for tooltip
      const rectX = tooltipX;
      const rectY = y - 35 - padding;
      const rectW = textWidth + padding * 2;
      const rectH = 35 + padding * 2;
      const radius = 6;
      
      ctx.beginPath();
      ctx.moveTo(rectX + radius, rectY);
      ctx.lineTo(rectX + rectW - radius, rectY);
      ctx.quadraticCurveTo(rectX + rectW, rectY, rectX + rectW, rectY + radius);
      ctx.lineTo(rectX + rectW, rectY + rectH - radius);
      ctx.quadraticCurveTo(rectX + rectW, rectY + rectH, rectX + rectW - radius, rectY + rectH);
      ctx.lineTo(rectX + radius, rectY + rectH);
      ctx.quadraticCurveTo(rectX, rectY + rectH, rectX, rectY + rectH - radius);
      ctx.lineTo(rectX, rectY + radius);
      ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
      ctx.closePath();
      
      ctx.fill();
      ctx.stroke();
      
      // Enhanced tooltip text
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.fillText(text, x, y - 15);
      
      ctx.fillStyle = '#d1d5db';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillText(`${score}% relevance${yearText}`, x, y);
    }
  }, [filteredPatents, visiblePatents, selectedPatents, hoveredPatent, viewBounds, selectedPollutant, loadingPatents, allPatents.length, scoreThreshold]);
  
  // Set canvas dimensions when component mounts or container resizes
  useEffect(() => {
    const updateCanvasDimensions = () => {
      if (!containerRef.current || !canvasRef.current) return;
      
      const { width, height } = containerRef.current.getBoundingClientRect();
      
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      
      drawPatentSpace();
    };
    
    updateCanvasDimensions();
    
    const observer = new ResizeObserver(updateCanvasDimensions);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
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
  
  // Handle mouse movement for hover effects and dragging
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || !filteredPatents.length) return;
    
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
    
    // Handle dragging for panning
    if (viewState.isDragging && activeTool === 'move') {
      const dx = e.clientX - viewState.dragStartX;
      const dy = e.clientY - viewState.dragStartY;
      
      setViewState(prev => ({
        ...prev,
        offsetX: prev.currentOffsetX + dx,
        offsetY: prev.currentOffsetY - dy
      }));
      return;
    }
    
    // Find patent under mouse cursor
    const hoverThreshold = 10 / viewState.zoom;
    let nearestPatent = null;
    let nearestDistance = hoverThreshold;
    
    filteredPatents.forEach(patent => {
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
  }, [filteredPatents, viewState, viewBounds, activeTool]);
  
  // Handle patent details display
  const handleShowPatentDetails = useCallback(async (patent) => {
    if (!patent) return;
    
    try {
      const fullPatentDetails = await loadPatentDetails(patent.id);
      
      let brefRelevanceData = {};
      if (brefRelevanceScores && brefRelevanceScores[patent.id]) {
        brefRelevanceData = {
          bref_relevance: brefRelevanceScores[patent.id] 
        };
      }
      
      const enhancedPatent = {
        ...patent,
        ...fullPatentDetails,
        ...brefRelevanceData
      };
      
      setSelectedPatentForDetails(enhancedPatent);
    } catch (error) {
      console.error('Error loading patent details:', error);
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
  }, [brefRelevanceScores]);
  
  // Handle viewing BREF section from the patent details box
  const handleBrefView = useCallback((bref) => {
    if (onBrefSelect) {
      onBrefSelect(bref);
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
    
    const dragDistance = Math.sqrt(
      Math.pow(e.clientX - viewState.dragStartX, 2) + 
      Math.pow(e.clientY - viewState.dragStartY, 2)
    );
    
    const wasDragging = viewState.isDragging;
    if (viewState.isDragging) {
      setViewState(prev => ({
        ...prev,
        isDragging: false
      }));
    }
    
    const isDragThreshold = 3;
    if (wasDragging && dragDistance > isDragThreshold) {
      return;
    }
    
    if (hoveredPatent) {
      handleShowPatentDetails(hoveredPatent);
      return;
    }
    
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
      const zoomFactor = 1 + zoomDelta;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom * zoomFactor));
      
      if (newZoom === prev.zoom) return prev;
      
      const zoomRatio = newZoom / prev.zoom;
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const relativeX = x - centerX;
      const relativeY = y - centerY;
      
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
    
    const delta = Math.sign(e.deltaY) * -ZOOM_STEP * 0.7;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    zoomAt(mouseX, mouseY, delta);
  }, [zoomAt]);
  
  // Handle zooming with buttons
  const handleZoomIn = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    zoomAt(canvas.width / 2, canvas.height / 2, ZOOM_STEP);
  }, [zoomAt]);
  
  const handleZoomOut = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    zoomAt(canvas.width / 2, canvas.height / 2, -ZOOM_STEP);
  }, [zoomAt]);
  
  // Handle reset view
  const handleResetView = useCallback(() => {
    if (filteredPatents.length === 0) {
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
    
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    
    filteredPatents.forEach(patent => {
      minX = Math.min(minX, patent.x);
      minY = Math.min(minY, patent.y);
      maxX = Math.max(maxX, patent.x);
      maxY = Math.max(maxY, patent.y);
    });
    
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
    
    let zoom;
    let offsetX = 0;
    let offsetY = 0;
    
    const dataXCenter = (minX + maxX) / 2;
    const dataYCenter = (minY + maxY) / 2;
    
    if (dataAspectRatio > aspectRatio) {
      zoom = 0.8 / dataWidth;
      const visibleHeight = 1 / (zoom * aspectRatio);
      offsetY = (dataYCenter - 0.5) * height * zoom;
    } else {
      zoom = 0.8 / (dataHeight * aspectRatio);
      const visibleWidth = aspectRatio / zoom;
      offsetX = (dataXCenter - 0.5) * width * zoom;
    }
    
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    
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
  }, [filteredPatents]);
  
  // Handle clicking on a tool button
  const handleToolClick = useCallback((tool) => {
    setActiveTool(tool);
    
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
  
  // Call reset view once when filtered patents are loaded
  useEffect(() => {
    if (filteredPatents.length > 0 && !loadingPatents) {
      const timer = setTimeout(() => {
        handleResetView();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [filteredPatents.length, loadingPatents, selectedPollutantFilename]);
  
  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-gray-700 border-b pb-2">
          Patent Space Visualization {selectedPollutant ? `for ${selectedPollutant}` : ''}
        </h2>
        
        {/* Tool controls */}
        <div className="flex space-x-2">
          <button
            className={`p-2 rounded transition-colors ${showFilterPanel ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            title="Show/hide score filter"
          >
            <Sliders size={16} />
          </button>
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
      
      {/* Filter Panel */}
      {showFilterPanel && (
        <div className="mb-4 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-indigo-900">Score Filter</h3>
            <span className="text-xs text-indigo-700">
              {filteredPatents.length} of {allPatents.length} patents shown
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-xs text-gray-600 min-w-max">Min Score:</span>
            <div className="flex-1 relative">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={scoreThreshold}
                onChange={(e) => setScoreThreshold(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${scoreThreshold * 100}%, #e5e7eb ${scoreThreshold * 100}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
            <span className="text-sm font-medium text-indigo-900 min-w-max">
              {Math.round(scoreThreshold * 100)}%
            </span>
          </div>
        </div>
      )}
      
      {/* Information bar */}
      <div className="flex justify-between items-center mb-2 text-xs text-gray-500">
        <div>
          {loadingPatents ? 'Loading patents...' : 
            allPatents.length ? 
              `${filteredPatents.length} patents displayed | ${visiblePatents.length} in current view` : 
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
      
      {/* Canvas container */}
      <div 
        ref={containerRef}
        className="w-full h-96 border-2 border-gray-200 rounded-lg bg-white overflow-hidden relative shadow-inner"
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
      
      {/* Enhanced Interactive Color Bar */}
      <div className="mt-4 border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-gray-700">Relevance Score Legend</div>
          <button
            onClick={() => setScoreThreshold(0.5)}
            className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Reset Filter
          </button>
        </div>
        
        <div className="relative">
          {/* Interactive gradient bar */}
          <div 
            className="w-full h-8 rounded-lg cursor-pointer shadow-inner border border-gray-200 relative"
            style={{ background: generateColorBarGradient() }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = x / rect.width;
              setScoreThreshold(Math.max(0, Math.min(1, percentage)));
            }}
          >
            {/* Threshold indicator */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-lg border border-gray-400 rounded"
              style={{ left: `${scoreThreshold * 100}%`, transform: 'translateX(-50%)' }}
            />
            
            {/* Score labels */}
            <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-medium text-white drop-shadow">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
          
          <div className="text-xs text-gray-600 mt-2 text-center">
            Click on the bar to set minimum score threshold • Current: {Math.round(scoreThreshold * 100)}%
          </div>
        </div>
      </div>
      
      {/* Patent Details Modal */}
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
