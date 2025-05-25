// assets/js/components/PollutantInfoBox.jsx

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { X, ExternalLink, Info, Droplet, AlertTriangle, Building2, TreePine } from 'lucide-react';

// SDG colors for the chart
const sdgColors = {
  'SDG 1': '#e5243b', // No Poverty - Red
  'SDG 2': '#dda63a', // Zero Hunger - Yellow
  'SDG 3': '#4c9f38', // Good Health and Well-being - Green  
  'SDG 4': '#c5192d', // Quality Education - Red
  'SDG 5': '#ff3a21', // Gender Equality - Red
  'SDG 6': '#26bde2', // Clean Water and Sanitation - Light Blue
  'SDG 7': '#fcc30b', // Affordable and Clean Energy - Yellow
  'SDG 8': '#a21942', // Decent Work and Economic Growth - Maroon
  'SDG 9': '#fd6925', // Industry, Innovation and Infrastructure - Orange
  'SDG 10': '#dd1367', // Reduced Inequality - Magenta
  'SDG 11': '#fd9d24', // Sustainable Cities and Communities - Orange
  'SDG 12': '#bf8b2e', // Responsible Consumption and Production - Brown
  'SDG 13': '#3f7e44', // Climate Action - Dark Green
  'SDG 14': '#0a97d9', // Life Below Water - Blue
  'SDG 15': '#56c02b', // Life on Land - Green
  'SDG 16': '#00689d', // Peace, Justice and Strong Institutions - Blue
  'SDG 17': '#19486a', // Partnerships for the Goals - Navy Blue
};

// SDG descriptions for the tooltips
const sdgDescriptions = {
  'SDG 1': 'End poverty in all its forms everywhere',
  'SDG 2': 'End hunger, achieve food security and improved nutrition and promote sustainable agriculture',
  'SDG 3': 'Ensure healthy lives and promote well-being for all at all ages',
  'SDG 4': 'Ensure inclusive and equitable quality education and promote lifelong learning opportunities for all',
  'SDG 5': 'Achieve gender equality and empower all women and girls',
  'SDG 6': 'Ensure availability and sustainable management of water and sanitation for all',
  'SDG 7': 'Ensure access to affordable, reliable, sustainable and modern energy for all',
  'SDG 8': 'Promote sustained, inclusive and sustainable economic growth, full and productive employment and decent work for all',
  'SDG 9': 'Build resilient infrastructure, promote inclusive and sustainable industrialization and foster innovation',
  'SDG 10': 'Reduce inequality within and among countries',
  'SDG 11': 'Make cities and human settlements inclusive, safe, resilient and sustainable',
  'SDG 12': 'Ensure sustainable consumption and production patterns',
  'SDG 13': 'Take urgent action to combat climate change and its impacts',
  'SDG 14': 'Conserve and sustainably use the oceans, seas and marine resources for sustainable development',
  'SDG 15': 'Protect, restore and promote sustainable use of terrestrial ecosystems, sustainably manage forests, combat desertification, and halt and reverse land degradation and halt biodiversity loss',
  'SDG 16': 'Promote peaceful and inclusive societies for sustainable development, provide access to justice for all and build effective, accountable and inclusive institutions at all levels',
  'SDG 17': 'Strengthen the means of implementation and revitalize the global partnership for sustainable development'
};

// Helper function to convert SDG format from "SDG1_No_Poverty" to "SDG 1"
const convertSdgFormat = (sdgKey) => {
  const match = sdgKey.match(/SDG(\d+)_/);
  return match ? `SDG ${match[1]}` : sdgKey;
};

// Helper function to get SDG title from the key
const getSdgTitle = (sdgKey) => {
  const parts = sdgKey.split('_');
  if (parts.length > 1) {
    return parts.slice(1).join(' ').replace(/_/g, ' ');
  }
  return sdgKey;
};

const PollutantInfoBox = ({ pollutant, pollutantSdgData, isOpen, onClose }) => {
  if (!isOpen || !pollutant) return null;
  
  // Extract data from the new structure
  const summary = pollutantSdgData?.summary || {};
  const sdgScores = pollutantSdgData?.sdg_scores || {};
  const topSdgImpacts = pollutantSdgData?.top_sdg_impacts || {};
  
  // Format the SDG data for the chart
  const chartData = Object.entries(sdgScores)
    .map(([sdgKey, score]) => {
      const standardSdgKey = convertSdgFormat(sdgKey);
      return {
        sdg: standardSdgKey,
        originalKey: sdgKey,
        impact: score,
        color: sdgColors[standardSdgKey] || '#cccccc',
        title: getSdgTitle(sdgKey)
      };
    })
    // Filter out SDGs with no impact (score = 0)
    .filter(item => item.impact > 0)
    // Sort by impact (descending)
    .sort((a, b) => b.impact - a.impact);
  
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="p-3 bg-white border rounded shadow-lg max-w-xs">
          <p className="font-medium text-sm">{data.sdg}</p>
          <p className="text-xs text-gray-600 mt-1">{data.title}</p>
          <p className="text-xs text-gray-500 mt-1">{sdgDescriptions[data.sdg]}</p>
          <p className="text-sm font-bold mt-2 text-blue-600">{`Impact Score: ${data.impact}/10`}</p>
        </div>
      );
    }
    return null;
  };
  
  // Get the top 3 SDGs for detailed explanations
  const topSdgs = chartData.slice(0, 3);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header with pollutant name and close button */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 rounded-t-lg flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center">
            <Droplet className="mr-2" size={20} />
            {pollutant}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 focus:outline-none"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6">
          {/* Pollutant description section */}
          <section className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
              <Info className="mr-2" size={18} />
              About this Pollutant
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              {summary.description ? (
                <p className="text-gray-700 leading-relaxed">
                  {summary.description}
                </p>
              ) : (
                <p className="text-gray-500 italic">
                  No description available for this pollutant.
                </p>
              )}
            </div>
          </section>
          
          {/* Emission Sources and Environmental Impact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Emission Sources */}
            {summary.emission_sources && summary.emission_sources.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                  <Building2 className="mr-2" size={18} />
                  Emission Sources
                </h3>
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <ul className="space-y-2">
                    {summary.emission_sources.map((source, index) => (
                      <li key={index} className="text-gray-700 flex items-start">
                        <span className="w-2 h-2 bg-orange-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                        {source}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
            
            {/* Environmental Impact */}
            {summary.environmental_impact && summary.environmental_impact.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                  <TreePine className="mr-2" size={18} />
                  Environmental Impact
                </h3>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <ul className="space-y-2">
                    {summary.environmental_impact.map((impact, index) => (
                      <li key={index} className="text-gray-700 flex items-start">
                        <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                        <span className="text-sm">{impact}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
          </div>
          
          {/* SDG Impact Visualization */}
          <section className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Sustainable Development Goal Impacts
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              {chartData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 20, right: 30, left: 60, bottom: 5 }}
                    >
                      <XAxis type="number" domain={[0, 10]} />
                      <YAxis 
                        dataKey="sdg" 
                        type="category" 
                        width={60}
                        tick={{ fontSize: 12 }} 
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  No SDG impact data available for this pollutant.
                </div>
              )}
              {chartData.length > 0 && (
                <div className="mt-3 text-sm text-gray-600">
                  Hover over bars to see detailed information about each SDG. Scores range from 1-10.
                </div>
              )}
            </div>
          </section>
          
          {/* Detailed SDG Impact Explanations */}
          {Object.keys(topSdgImpacts).length > 0 && (
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                How {pollutant} Affects Sustainable Development
              </h3>
              <div className="space-y-4">
                {Object.entries(topSdgImpacts).map(([sdgKey, explanation], index) => {
                  const standardSdgKey = convertSdgFormat(sdgKey);
                  const sdgTitle = getSdgTitle(sdgKey);
                  const sdgColor = sdgColors[standardSdgKey] || '#cccccc';
                  const sdgScore = sdgScores[sdgKey] || 0;
                  
                  return (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex items-center mb-2">
                        <span 
                          className="w-4 h-4 rounded-full mr-3" 
                          style={{ backgroundColor: sdgColor }}
                        ></span>
                        <h4 className="font-medium text-gray-800">
                          {standardSdgKey}: {sdgTitle}
                        </h4>
                        <span className="ml-auto bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                          Score: {sdgScore}/10
                        </span>
                      </div>
                      <p className="text-gray-700 ml-7 leading-relaxed">
                        {explanation}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          
          {/* Summary statistics */}
          {chartData.length > 0 && (
            <section className="mb-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{chartData.length}</div>
                    <div className="text-sm text-gray-600">SDGs Impacted</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.round(chartData.reduce((sum, item) => sum + item.impact, 0) / chartData.length * 10) / 10}
                    </div>
                    <div className="text-sm text-gray-600">Average Impact</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.max(...chartData.map(item => item.impact))}
                    </div>
                    <div className="text-sm text-gray-600">Highest Impact</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {chartData.filter(item => item.impact >= 7).length}
                    </div>
                    <div className="text-sm text-gray-600">High Priority SDGs</div>
                  </div>
                </div>
              </div>
            </section>
          )}
          
          {/* Action buttons */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Data based on environmental impact analysis and SDG framework alignment
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center"
                onClick={() => {
                  // This could link to a more detailed report
                  onClose();
                }}
              >
                <ExternalLink size={16} className="mr-2" />
                Explore Technologies
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PollutantInfoBox;
