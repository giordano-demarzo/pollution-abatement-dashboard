// assets/js/components/BrefTextDisplay.jsx

import React, { useState, useEffect } from 'react';
import { AlertCircle, BookOpen, PlusCircle } from 'lucide-react';
import { loadBrefText } from '../utils/dataLoader';
import { formatBrefText, hasMeaningfulBrefText } from '../utils/brefUtils';

/**
 * Component to display BREF text content
 */
const BrefTextDisplay = ({ 
  selectedBref, 
  className = '', 
  onAddToContext  // Removed the hasPatentMatches prop
}) => {
  const [brefText, setBrefText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load BREF text when selectedBref changes
  useEffect(() => {
    const fetchBrefText = async () => {
      if (!selectedBref || !selectedBref.id) {
        setBrefText('');
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        console.log(`Fetching BREF text for: ${selectedBref.id}`);
        const text = await loadBrefText(selectedBref.id);
        setBrefText(text);
      } catch (err) {
        console.error('Error loading BREF text:', err);
        setError(`Failed to load BREF text: ${err.message}`);
        setBrefText('');
      } finally {
        setLoading(false);
      }
    };

    fetchBrefText();
  }, [selectedBref]);

  // If no BREF is selected, show default message
  if (!selectedBref || !selectedBref.id) {
    return (
      <div className={`bg-white border rounded p-4 h-64 overflow-auto ${className}`}>
        <div className="flex items-center justify-center h-full text-gray-500">
          <BookOpen className="mr-2" size={18} />
          <span>Select a BREF section to view its content</span>
        </div>
      </div>
    );
  }

  // If loading, show loading indicator
  if (loading) {
    return (
      <div className={`bg-white border rounded p-4 h-64 overflow-auto ${className}`}>
        <div className="flex items-center justify-center h-full">
          <div className="flex items-center text-blue-600">
            <div className="animate-spin h-5 w-5 mr-2 border-2 border-blue-600 rounded-full border-t-transparent"></div>
            <span>Loading BREF text...</span>
          </div>
        </div>
      </div>
    );
  }

  // If error occurred, show error message
  if (error) {
    return (
      <div className={`bg-white border rounded p-4 h-64 overflow-auto ${className}`}>
        <div className="text-red-600 p-4 flex items-start">
          <AlertCircle className="mr-2 flex-shrink-0" size={20} />
          <div>
            <div className="font-medium">Error loading BREF text</div>
            <div className="mt-1 text-sm">{error}</div>
            <div className="mt-3 text-sm text-gray-600">
              Try selecting a different BREF section or refreshing the page.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if the text has meaningful content
  const hasContent = hasMeaningfulBrefText(brefText);

  // Display BREF text with formatting
  return (
    <div className={`bg-white border rounded p-4 h-64 overflow-auto ${className}`}>
      <div className="mb-4">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-medium text-gray-800">
            {selectedBref.name || selectedBref.id.split(':::').pop()}
          </h3>
          
          {/* Add to Context Button */}
          {onAddToContext && hasContent && (
            <button 
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
              onClick={() => onAddToContext(selectedBref, brefText)}
              title="Add this BREF section to chat context"
            >
              <PlusCircle size={14} className="mr-1" />
              Add to Context
            </button>
          )}
        </div>
        
        {/* Path information if available */}
        {selectedBref.path && (
          <div className="text-xs text-gray-500 mt-1">
            {selectedBref.path.map(p => p.name || p.id).join(' > ')}
          </div>
        )}
        
        {/* BAT badge removed */}
      </div>
      
      <div className="prose max-w-none text-sm">
        {hasContent ? (
          <div dangerouslySetInnerHTML={{ __html: formatBrefText(brefText) }} />
        ) : (
          <div className="text-gray-500 italic">
            No detailed content is available for this BREF section. 
            Try selecting a more specific section.
          </div>
        )}
      </div>
    </div>
  );
};

export default BrefTextDisplay;
