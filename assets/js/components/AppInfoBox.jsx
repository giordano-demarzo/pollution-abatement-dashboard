// assets/js/components/AppInfoBox.jsx

import React, { useState } from 'react';
import { X, HelpCircle, Target, Filter, BookOpen, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

/**
 * Component for displaying app information and usage instructions
 */
const AppInfoBox = ({ isOpen, onClose }) => {
  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    usage: false,
    brefs: false,
    filtering: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-green-600 to-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center">
            <HelpCircle className="mr-2" size={20} />
            How to Use This Application
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 focus:outline-none"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* App Overview Section */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('overview')}
              className="w-full p-4 text-left flex items-center justify-between bg-green-50 hover:bg-green-100 transition-colors rounded-t-lg"
            >
              <h3 className="text-lg font-semibold text-green-800 flex items-center">
                <Target className="mr-2" size={18} />
                Application Overview
              </h3>
              {expandedSections.overview ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            {expandedSections.overview && (
              <div className="p-4 bg-white border-t border-gray-200">
                <div className="space-y-3 text-gray-700">
                  <p className="text-base leading-relaxed">
                    This <strong>Pollution Abatement Technology Dashboard</strong> is an advanced tool that connects 
                    pollution reduction technologies with regulatory frameworks and Sustainable Development Goals (SDGs).
                  </p>
                  <p className="text-base leading-relaxed">
                    The application analyzes relationships between:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Pollutants</strong> - Environmental contaminants with specific reduction technologies</li>
                    <li><strong>Patents</strong> - Technical solutions and innovations for pollution abatement</li>
                    <li><strong>BREF Documents</strong> - EU regulatory frameworks defining Best Available Techniques (BAT)</li>
                    <li><strong>SDGs</strong> - UN Sustainable Development Goals impacted by pollution reduction</li>
                  </ul>
                  <div className="bg-blue-50 p-3 rounded border border-blue-200 mt-4">
                    <p className="text-blue-800 font-medium">
                      💡 Key Feature: Click on any pollutant to see its connections to the UN Sustainable Development Goals!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Usage Instructions Section */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('usage')}
              className="w-full p-4 text-left flex items-center justify-between bg-blue-50 hover:bg-blue-100 transition-colors rounded-t-lg"
            >
              <h3 className="text-lg font-semibold text-blue-800 flex items-center">
                <BookOpen className="mr-2" size={18} />
                How to Use the Dashboard
              </h3>
              {expandedSections.usage ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            {expandedSections.usage && (
              <div className="p-4 bg-white border-t border-gray-200">
                <div className="space-y-4 text-gray-700">
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Step 1: Select a Pollutant</h4>
                    <p>Choose from the grid of pollutants. Each card shows the number of available patents. 
                    Click the info button (ℹ️) to see how the pollutant connects to SDGs.</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Step 2: Explore BREF Documents (Optional)</h4>
                    <p>Browse the hierarchical BREF tree to select specific regulatory sections. 
                    BREFs help identify patents that meet regulatory requirements.</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Step 3: Review Top Patents</h4>
                    <p>Examine the ranked list of patents most relevant to your selected pollutant/BREF. 
                    Click the eye icon to view detailed patent information.</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Step 4: Build Context</h4>
                    <p>Add patents and BREF sections to your analysis context by clicking checkboxes or "Add to Context" buttons.</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Step 5: AI Analysis</h4>
                    <p>Use the AI Chat Analysis panel to explore connections between your selected patents, 
                    BREFs, and pollutants. Choose from predefined analysis types or ask custom questions.</p>
                  </div>
                  
                  <div className="bg-amber-50 p-3 rounded border border-amber-200 mt-4">
                    <h4 className="font-semibold text-amber-800 mb-2">Interactive Features:</h4>
                    <ul className="list-disc pl-5 space-y-1 text-amber-700">
                      <li>Double-click patents in the visualization to add them to context</li>
                      <li>Use mouse wheel to zoom in/out of the patent space</li>
                      <li>Filter patents by relevance score using the score threshold slider</li>
                      <li>Search for specific pollutants using the search box</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* BREF Information Section */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('brefs')}
              className="w-full p-4 text-left flex items-center justify-between bg-purple-50 hover:bg-purple-100 transition-colors rounded-t-lg"
            >
              <h3 className="text-lg font-semibold text-purple-800 flex items-center">
                <BookOpen className="mr-2" size={18} />
                What are BREF Documents?
              </h3>
              {expandedSections.brefs ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            {expandedSections.brefs && (
              <div className="p-4 bg-white border-t border-gray-200">
                <div className="space-y-4 text-gray-700">
                  <p className="text-base leading-relaxed">
                    A <strong>BREF</strong> is a <strong>BAT Reference Document</strong> adopted by the European Commission. 
                    BREFs cover descriptions of industrial processes and the Best Available Techniques (BAT) 
                    that can be applied for pollution prevention and control.
                  </p>
                  
                  <div className="bg-blue-50 p-4 rounded border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2">Key Characteristics:</h4>
                    <ul className="list-disc pl-5 space-y-1 text-blue-700">
                      <li>Developed through multi-year processes involving up to 100 experts</li>
                      <li>Include industry representatives, Member State authorities, research institutes, and NGOs</li>
                      <li>Cover emission levels, alternative processes, and applicable techniques</li>
                      <li>Used for Integrated Environmental Permit applications</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Types of BREFs:</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-green-50 p-3 rounded border border-green-200">
                        <h5 className="font-medium text-green-800">Vertical BREFs</h5>
                        <p className="text-sm text-green-700">Industry-specific documents (e.g., Cement Manufacturing, Textiles Industry)</p>
                      </div>
                      <div className="bg-orange-50 p-3 rounded border border-orange-200">
                        <h5 className="font-medium text-orange-800">Horizontal BREFs</h5>
                        <p className="text-sm text-orange-700">Cross-sectoral issues (e.g., Energy Efficiency, Emissions from Storage)</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                    <p className="text-sm text-gray-600">
                      <strong>Note:</strong> Currently, 34 BREF documents are available, covering major industrial sectors 
                      under the EU Industrial Emissions Directive.
                    </p>
                    <a 
                      href="http://eippcb.jrc.ec.europa.eu/reference/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm mt-2"
                    >
                      <ExternalLink size={14} className="mr-1" />
                      View official BREF documents
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Filtering Options Section */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('filtering')}
              className="w-full p-4 text-left flex items-center justify-between bg-indigo-50 hover:bg-indigo-100 transition-colors rounded-t-lg"
            >
              <h3 className="text-lg font-semibold text-indigo-800 flex items-center">
                <Filter className="mr-2" size={18} />
                Filtering and Visualization Options
              </h3>
              {expandedSections.filtering ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            {expandedSections.filtering && (
              <div className="p-4 bg-white border-t border-gray-200">
                <div className="space-y-4 text-gray-700">
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Patent Relevance Filtering</h4>
                    <p>Use the score threshold slider to filter patents by relevance (80-100%).
                    Only patents above the threshold are displayed in rankings and visualizations.</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">BREF Document Filtering</h4>
                    <p>Toggle "Show only relevant documents" to display only BREF sections 
                    that match your selected pollutant based on our AI analysis.</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Patent Space Visualization</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Patents are positioned using machine learning embeddings</li>
                      <li>Color intensity indicates relevance score</li>
                      <li>Use zoom and pan tools for detailed exploration</li>
                      <li>Hover over patents to see quick information</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Relevance Indicators</h4>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div className="flex items-center">
                        <span className="w-3 h-3 rounded-full bg-amber-500 mr-2"></span>
                        <span className="text-sm">Matches selected pollutant</span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-3 h-3 rounded-full bg-green-500 mr-2"></span>
                        <span className="text-sm">High patent relevance</span>
                      </div>
                      <div className="flex items-center">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded mr-2">12</span>
                        <span className="text-sm">Patent count indicators</span>
                      </div>
                      <div className="flex items-center">
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded mr-2">0</span>
                        <span className="text-sm">No matching patents</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 p-3 rounded border border-green-200">
                    <h4 className="font-semibold text-green-800 mb-2">Quality Assurance:</h4>
                    <p className="text-green-700 text-sm">
                      All patent-pollutant and patent-BREF relationships are established using 
                      fine-tuned AI models with reliability thresholds to ensure high-quality matches.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              Got it, let's explore!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppInfoBox;
