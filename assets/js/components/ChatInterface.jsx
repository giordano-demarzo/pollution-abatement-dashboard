// assets/js/components/ChatInterface.jsx

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Trash2, RotateCcw, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { callOpenAI } from '../utils/chatApiService';
import {
  createSystemPrompt,
  createBrefPollutantConnectionPrompt,
  createBrefPatentConnectionPrompt,
  createPatentPollutantConnectionPrompt,
  createSDGReportPrompt
} from '../utils/promptTemplates';

/**
 * Component for handling chat interactions with OpenAI API
 * @param {Array} selectedPatents - Patents added to the context
 * @param {Array} selectedBrefs - BREF sections added to the context
 * @param {String} selectedPollutant - Currently selected pollutant
 * @param {Object} sdgData - SDG data for the selected pollutant
 * @param {Function} clearPatents - Function to clear selected patents
 * @param {Function} clearBrefs - Function to clear selected BREFs
 * @param {Function} removePatent - Function to remove a specific patent
 * @param {Function} removeBref - Function to remove a specific BREF
 */
const ChatInterface = ({
  selectedPatents = [],
  selectedBrefs = [],
  selectedPollutant = '',
  sdgData = null,
  clearPatents,
  clearBrefs,
  removePatent,
  removeBref
}) => {
  // Chat state
  const [messages, setMessages] = useState([
    { sender: 'system', text: 'Select patents and BREF sections, then choose an analysis option below.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Ref for auto-scrolling chat
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Function to call the OpenAI API
  const callChatAPI = async (userMessage, systemPrompt) => {
    setIsLoading(true);
    setError(null);

    try {
      // Get messages to provide as chat history (excluding system messages)
      const chatHistory = messages.filter(msg => msg.sender !== 'system');
      
      // Call the API service
      const response = await callOpenAI(userMessage, systemPrompt, chatHistory);
      
      // Add assistant response to messages
      setMessages(prev => [...prev, { sender: 'assistant', text: response }]);
    } catch (err) {
      console.error('Error calling OpenAI API:', err);
      setError(`Failed to get response: ${err.message}`);
      
      // Add error message to chat
      setMessages(prev => [...prev, { 
        sender: 'system', 
        text: `Error: Unable to process your request. ${err.message}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Create the system prompt based on context
  const createContextSystemPrompt = () => {
    return createSystemPrompt(selectedPatents, selectedBrefs, selectedPollutant, sdgData);
  };

  // Handle sending a message (now only used by predefined buttons)
  const handleSendMessage = async (message) => {
    if (!message.trim() || isLoading) return;
    
    // Add user message to chat
    setMessages(prev => [...prev, { sender: 'user', text: message }]);
    
    // Call OpenAI API with the system prompt
    const systemPrompt = createContextSystemPrompt();
    await callChatAPI(message, systemPrompt);
  };

  // Handle reset chat context
  const handleResetChat = () => {
    setMessages([
      { sender: 'system', text: 'Chat context reset. Select patents and BREF sections, then choose an analysis option below.' }
    ]);
    setError(null);
  };

  // Handle predefined button click for BREF-pollutant connection
  const handleBrefPollutantConnection = async () => {
    if (selectedBrefs.length === 0) {
      setMessages(prev => [...prev, {
        sender: 'system',
        text: 'Please select at least one BREF section before analyzing BREF-pollutant connections.'
      }]);
      return;
    }

    const message = createBrefPollutantConnectionPrompt(selectedPollutant);
    await handleSendMessage(message);
  };

  // Handle predefined button click for BREF-patent connection
  const handleBrefPatentConnection = async () => {
    if (selectedBrefs.length === 0 || selectedPatents.length === 0) {
      setMessages(prev => [...prev, {
        sender: 'system',
        text: 'Please select at least one BREF section and one patent before analyzing BREF-patent connections.'
      }]);
      return;
    }

    const message = createBrefPatentConnectionPrompt();
    await handleSendMessage(message);
  };

  // Handle predefined button click for patent-pollutant connection
  const handlePatentPollutantConnection = async () => {
    if (selectedPatents.length === 0) {
      setMessages(prev => [...prev, {
        sender: 'system',
        text: 'Please select at least one patent before analyzing patent-pollutant connections.'
      }]);
      return;
    }

    const message = createPatentPollutantConnectionPrompt(selectedPollutant);
    await handleSendMessage(message);
  };

  // Handle predefined button click for SDG report
  const handleSDGReport = async () => {
    const message = createSDGReportPrompt(selectedPollutant);
    await handleSendMessage(message);
  };

  // Custom renderer for message content - uses markdown for assistant messages only
  const MessageContent = ({ message }) => {
    if (message.sender === 'assistant') {
      return (
        <div className="markdown-content">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]} 
            components={{
              h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
              h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-3 mb-2" {...props} />,
              h3: ({ node, ...props }) => <h3 className="text-md font-bold mt-2 mb-1" {...props} />,
              h4: ({ node, ...props }) => <h4 className="font-bold mt-2 mb-1" {...props} />,
              p: ({ node, ...props }) => <p className="mb-2" {...props} />,
              ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-2" {...props} />,
              ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-2" {...props} />,
              li: ({ node, ...props }) => <li className="mb-1" {...props} />,
              a: ({ node, ...props }) => <a className="text-blue-600 hover:underline" {...props} />,
              blockquote: ({ node, ...props }) => (
                <blockquote className="border-l-4 border-gray-300 pl-3 italic my-2" {...props} />
              ),
              code: ({ node, inline, ...props }) => 
                inline ? 
                  <code className="bg-gray-100 px-1 rounded" {...props} /> : 
                  <code className="block bg-gray-100 p-2 rounded my-2 whitespace-pre-wrap overflow-x-auto" {...props} />,
              strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
              em: ({ node, ...props }) => <em className="italic" {...props} />,
              table: ({ node, ...props }) => (
                <div className="overflow-x-auto my-2">
                  <table className="min-w-full border border-gray-300" {...props} />
                </div>
              ),
              thead: ({ node, ...props }) => <thead className="bg-gray-100" {...props} />,
              tbody: ({ node, ...props }) => <tbody {...props} />,
              tr: ({ node, ...props }) => <tr className="border-b border-gray-300" {...props} />,
              th: ({ node, ...props }) => <th className="px-4 py-2 text-left font-bold" {...props} />,
              td: ({ node, ...props }) => <td className="px-4 py-2" {...props} />
            }}
          >
            {message.text}
          </ReactMarkdown>
        </div>
      );
    }
    
    // For non-assistant messages, just return the text
    return <div>{message.text}</div>;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gradient-to-r from-blue-700 to-blue-600 text-white p-3 rounded-t-lg flex justify-between items-center">
        <h2 className="font-semibold flex items-center">
          <MessageSquare className="mr-2" size={16} />
          AI Chat Analysis
        </h2>
        <button
          onClick={handleResetChat}
          className="text-white hover:text-gray-200 focus:outline-none p-1 rounded transition-colors"
          title="Reset chat context"
        >
          <RotateCcw size={16} />
        </button>
      </div>
      
      {/* Compact context summary */}
      {(selectedPatents.length > 0 || selectedBrefs.length > 0) && (
        <div className="bg-gray-50 p-2 border-b text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {selectedPatents.length > 0 && (
                <span className="text-blue-700">
                  📄 {selectedPatents.length} patent{selectedPatents.length !== 1 ? 's' : ''}
                </span>
              )}
              {selectedBrefs.length > 0 && (
                <span className="text-indigo-700">
                  📋 {selectedBrefs.length} BREF{selectedBrefs.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {selectedPatents.length > 0 && (
                <button 
                  onClick={clearPatents}
                  className="text-xs text-red-600 hover:text-red-800"
                  title="Clear patents"
                >
                  Clear Patents
                </button>
              )}
              {selectedBrefs.length > 0 && (
                <button 
                  onClick={clearBrefs}
                  className="text-xs text-red-600 hover:text-red-800"
                  title="Clear BREFs"
                >
                  Clear BREFs
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Chat messages - now gets priority space */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`${
              msg.sender === 'user' 
                ? 'bg-blue-50 ml-4 border-blue-100' 
                : msg.sender === 'system' 
                  ? 'bg-gray-100 border-gray-200' 
                  : 'bg-green-50 mr-4 border-green-100'
            } p-2 rounded-lg border shadow-sm text-sm`}
          >
            <MessageContent message={msg} />
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center justify-center p-3">
            <div className="animate-bounce h-2 w-2 rounded-full bg-blue-600 mr-1"></div>
            <div className="animate-bounce h-2 w-2 rounded-full bg-blue-600 mr-1 animation-delay-200"></div>
            <div className="animate-bounce h-2 w-2 rounded-full bg-blue-600 animation-delay-400"></div>
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded-lg flex items-start text-sm">
            <AlertCircle size={16} className="mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Error</div>
              <div className="text-xs">{error}</div>
            </div>
          </div>
        )}
        
        {/* Invisible element for scrolling to bottom */}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Compact Analysis Buttons */}
      <div className="p-2 border-t bg-gray-50">
        <div className="grid grid-cols-2 gap-1.5">
          {/* BREF-Pollutant Connection */}
          <button
            onClick={handleBrefPollutantConnection}
            className="p-1.5 text-xs bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 rounded border border-blue-200 hover:shadow-sm transition-all disabled:opacity-60 disabled:pointer-events-none"
            disabled={selectedBrefs.length === 0 || !selectedPollutant || isLoading}
          >
            <div className="flex items-center">
              <div className="rounded-full bg-blue-600 text-white w-4 h-4 flex items-center justify-center mr-1.5 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-left leading-tight">BREF-Pollutant</div>
                <div className="text-xs text-blue-600 text-left leading-tight">Reduction methods</div>
              </div>
            </div>
          </button>
          
          {/* BREF-Patent Connection */}
          <button
            onClick={handleBrefPatentConnection}
            className="p-1.5 text-xs bg-gradient-to-r from-green-50 to-green-100 text-green-700 rounded border border-green-200 hover:shadow-sm transition-all disabled:opacity-60 disabled:pointer-events-none"
            disabled={selectedBrefs.length === 0 || selectedPatents.length === 0 || isLoading}
          >
            <div className="flex items-center">
              <div className="rounded-full bg-green-600 text-white w-4 h-4 flex items-center justify-center mr-1.5 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1z" clipRule="evenodd" />
                  <path d="M12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-left leading-tight">BREF-Patent</div>
                <div className="text-xs text-green-600 text-left leading-tight">Synergies</div>
              </div>
            </div>
          </button>
          
          {/* Patent-Pollutant Connection */}
          <button
            onClick={handlePatentPollutantConnection}
            className="p-1.5 text-xs bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 rounded border border-purple-200 hover:shadow-sm transition-all disabled:opacity-60 disabled:pointer-events-none"
            disabled={selectedPatents.length === 0 || !selectedPollutant || isLoading}
          >
            <div className="flex items-center">
              <div className="rounded-full bg-purple-600 text-white w-4 h-4 flex items-center justify-center mr-1.5 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-left leading-tight">Patent-Pollutant</div>
                <div className="text-xs text-purple-600 text-left leading-tight">Impact analysis</div>
              </div>
            </div>
          </button>
          
          {/* SDG Report */}
          <button
            onClick={handleSDGReport}
            className="p-1.5 text-xs bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-700 rounded border border-indigo-200 hover:shadow-sm transition-all disabled:opacity-60 disabled:pointer-events-none"
            disabled={!selectedPollutant || isLoading}
          >
            <div className="flex items-center">
              <div className="rounded-full bg-indigo-600 text-white w-4 h-4 flex items-center justify-center mr-1.5 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-left leading-tight">SDG Report</div>
                <div className="text-xs text-indigo-600 text-left leading-tight">Sustainability</div>
              </div>
            </div>
          </button>
        </div>
        
        {/* Minimal status warning */}
        {selectedPatents.length === 0 && selectedBrefs.length === 0 && (
          <div className="text-xs text-amber-600 mt-2 text-center bg-amber-50 p-1.5 rounded border border-amber-200">
            Select patents or BREFs to enable analysis
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
