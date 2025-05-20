// assets/js/components/PollutantInfoBox.jsx

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { X, ExternalLink, Info, Droplet } from 'lucide-react';

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

const PollutantInfoBox = ({ pollutant, sdgImpactData, isOpen, onClose }) => {
  if (!isOpen || !pollutant) return null;
  
  // Format the SDG impact data for the chart
  const chartData = Object.entries(sdgImpactData || {})
    .map(([sdgId, impacts]) => {
      // Find the impact for the current pollutant
      const impact = impacts.find(imp => imp.pollutant === pollutant);
      
      return {
        sdg: sdgId,
        impact: impact ? impact.impact : 0,
        color: sdgColors[sdgId] || '#cccccc'
      };
    })
    // Filter out SDGs with no impact
    .filter(item => item.impact > 0)
    // Sort by impact (descending)
    .sort((a, b) => b.impact - a.impact);
  
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="p-2 bg-white border rounded shadow-lg">
          <p className="font-medium text-sm">{data.sdg}</p>
          <p className="text-xs text-gray-600">{sdgDescriptions[data.sdg]}</p>
          <p className="text-sm font-bold">{`Impact: ${data.impact}%`}</p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
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
              <p className="text-gray-700">
                This is a description of {pollutant} and its environmental impacts. This text would include information about 
                the pollutant's sources, its effects on ecosystems and human health, and common mitigation measures.
              </p>
              <p className="text-gray-700 mt-3">
                Additional information about regulations, historical trends, and industrial sectors most commonly 
                associated with {pollutant} emissions would be included here.
              </p>
              <div className="mt-3 text-sm text-gray-500 flex items-center">
                <ExternalLink size={14} className="mr-1" />
                <a href="#" className="text-blue-600 hover:underline">
                  Learn more about {pollutant}
                </a>
              </div>
            </div>
          </section>
          
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
                      margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
                    >
                      <XAxis type="number" domain={[0, 100]} />
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
              <div className="mt-3 text-sm text-gray-600">
                Hover over bars to see detailed information about each SDG.
              </div>
            </div>
          </section>
          
          {/* SDG Impact Explanation */}
          <section>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              How {pollutant} Affects Sustainable Development
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-gray-700">
                {pollutant} has significant impacts on multiple Sustainable Development Goals (SDGs). 
                The primary effects are on water quality (SDG 6), ecosystem health (SDG 14 and 15), 
                and human health (SDG 3).
              </p>
              
              {chartData.slice(0, 3).map((sdgData, index) => (
                <div key={index} className="mt-4">
                  <h4 className="font-medium text-gray-800 flex items-center">
                    <span 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: sdgData.color }}
                    ></span>
                    {sdgData.sdg} ({sdgDescriptions[sdgData.sdg]})
                  </h4>
                  <p className="text-gray-700 ml-5 mt-1">
                    This is a placeholder explanation of how {pollutant} specifically impacts {sdgData.sdg}. 
                    The text would detail causal relationships, relevant research findings, and potential 
                    mitigation strategies.
                  </p>
                </div>
              ))}
              
              {chartData.length > 3 && (
                <p className="text-gray-600 mt-4 italic">
                  {pollutant} also has lesser impacts on {chartData.length - 3} other SDGs, as shown in the chart above.
                </p>
              )}
            </div>
          </section>
          
          {/* Action buttons */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              onClick={() => {
                // This could link to a more detailed report
                onClose();
              }}
            >
              Explore Technologies
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PollutantInfoBox;
