// assets/js/components/ChatInterface.jsx

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Trash2, Send, AlertCircle } from 'lucide-react';
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
    { sender: 'system', text: 'Select patents to analyze technologies for pollution abatement.' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
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

  // Handle sending a message
  const handleSendMessage = async (message) => {
    if (!message.trim() && !isLoading) return;
    
    // If no patents selected, show warning
    if (selectedPatents.length === 0 && selectedBrefs.length === 0) {
      setMessages(prev => [...prev, {
        sender: 'system',
        text: 'Please select at least one patent or BREF section before asking questions.'
      }]);
      return;
    }

    // Add user message to chat
    setMessages(prev => [...prev, { sender: 'user', text: message }]);
    
    // Clear input
    setInputMessage('');
    
    // Call OpenAI API with the system prompt
    const systemPrompt = createContextSystemPrompt();
    await callChatAPI(message, systemPrompt);
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
    
    setInputMessage(message);
    handleSendMessage(message);
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
    
    setInputMessage(message);
    handleSendMessage(message);
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
    
    setInputMessage(message);
    handleSendMessage(message);
  };

  // Handle predefined button click for SDG report
  const handleSDGReport = async () => {
    const message = createSDGReportPrompt(selectedPollutant);
    
    setInputMessage(message);
    handleSendMessage(message);
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
      <div className="bg-gradient-to-r from-blue-700 to-blue-600 text-white p-3 rounded-t-lg">
        <h2 className="font-semibold flex items-center">
          <MessageSquare className="mr-2" size={16} />
          AI Chat Analysis
        </h2>
      </div>
      
      {/* Selected patents context area */}
      {selectedPatents.length > 0 && (
        <div className="bg-blue-50 p-3 border-b">
          <h3 className="text-sm font-medium mb-2 flex items-center justify-between text-gray-700">
            <span>Patents in Context:</span>
            <button 
              onClick={clearPatents}
              className="text-xs text-red-600 hover:text-red-800 flex items-center"
            >
              <Trash2 size={12} className="mr-1" />
              Clear All
            </button>
          </h3>
          <div className="flex flex-wrap gap-2">
            {selectedPatents.map(patent => (
              <div 
                key={`context-${patent.id}`} 
                className="bg-white text-xs py-1 px-2 rounded border flex items-center shadow-sm"
              >
                <span className="mr-1">{patent.title}</span>
                <button 
                  onClick={() => removePatent(patent.id)}
                  className="text-gray-500 hover:text-red-600 ml-1"
                  title="Remove from context"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Selected BREFs context area */}
      {selectedBrefs.length > 0 && (
        <div className="bg-indigo-50 p-3 border-b">
          <h3 className="text-sm font-medium mb-2 flex items-center justify-between text-gray-700">
            <span>BREF Sections in Context:</span>
            <button 
              onClick={clearBrefs}
              className="text-xs text-red-600 hover:text-red-800 flex items-center"
            >
              <Trash2 size={12} className="mr-1" />
              Clear All
            </button>
          </h3>
          <div className="flex flex-wrap gap-2">
            {selectedBrefs.map(bref => (
              <div 
                key={`bref-context-${bref.id}`} 
                className="bg-white text-xs py-1 px-2 rounded border flex items-center shadow-sm"
              >
                <span className="mr-1">{bref.name || bref.id}</span>
                <button 
                  onClick={() => removeBref(bref.id)}
                  className="text-gray-500 hover:text-red-600 ml-1"
                  title="Remove from context"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`${
              msg.sender === 'user' 
                ? 'bg-blue-50 ml-6 border-blue-100' 
                : msg.sender === 'system' 
                  ? 'bg-gray-100 border-gray-200' 
                  : 'bg-green-50 mr-6 border-green-100'
            } p-3 rounded-lg border shadow-sm`}
          >
            <MessageContent message={msg} />
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center justify-center p-4">
            <div className="animate-bounce h-2 w-2 rounded-full bg-blue-600 mr-1"></div>
            <div className="animate-bounce h-2 w-2 rounded-full bg-blue-600 mr-1 animation-delay-200"></div>
            <div className="animate-bounce h-2 w-2 rounded-full bg-blue-600 animation-delay-400"></div>
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-start">
            <AlertCircle size={18} className="mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Error</div>
              <div className="text-sm">{error}</div>
            </div>
          </div>
        )}
        
        {/* Invisible element for scrolling to bottom */}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Predefined buttons */}
      <div className="p-3 border-t">
        <h3 className="text-sm font-medium mb-3 text-gray-700">Analysis Options:</h3>
        
        <div className="flex flex-col gap-2 mb-3">
          <button
            onClick={handleBrefPollutantConnection}
            className="p-3 text-sm bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 rounded-md border border-blue-200 hover:shadow-md transition-all text-left flex items-center disabled:opacity-60 disabled:pointer-events-none"
            disabled={selectedBrefs.length === 0 || !selectedPollutant}
          >
            <div className="rounded-full bg-blue-600 text-white w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className="font-medium">BREF-Pollutant Connection</div>
              <div className="text-xs text-blue-600 mt-0.5">Explain how BREF techniques can reduce the pollutant</div>
            </div>
          </button>
          
          <button
            onClick={handleBrefPatentConnection}
            className="p-3 text-sm bg-gradient-to-r from-green-50 to-green-100 text-green-700 rounded-md border border-green-200 hover:shadow-md transition-all text-left flex items-center disabled:opacity-60 disabled:pointer-events-none"
            disabled={selectedBrefs.length === 0 || selectedPatents.length === 0}
          >
            <div className="rounded-full bg-green-600 text-white w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1z" clipRule="evenodd" />
                <path d="M12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" />
              </svg>
            </div>
            <div>
              <div className="font-medium">BREF-Patent Synergies</div>
              <div className="text-xs text-green-600 mt-0.5">Analyze connections between BREFs and patents</div>
            </div>
          </button>
          
          <button
            onClick={handlePatentPollutantConnection}
            className="p-3 text-sm bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 rounded-md border border-purple-200 hover:shadow-md transition-all text-left flex items-center disabled:opacity-60 disabled:pointer-events-none"
            disabled={selectedPatents.length === 0 || !selectedPollutant}
          >
            <div className="rounded-full bg-purple-600 text-white w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className="font-medium">Patent-Pollutant Impact</div>
              <div className="text-xs text-purple-600 mt-0.5">Evaluate how patents can reduce the pollutant</div>
            </div>
          </button>
          
          <button
            onClick={handleSDGReport}
            className="p-3 text-sm bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-700 rounded-md border border-indigo-200 hover:shadow-md transition-all text-left flex items-center disabled:opacity-60 disabled:pointer-events-none"
            disabled={!selectedPollutant}
          >
            <div className="rounded-full bg-indigo-600 text-white w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className="font-medium">SDG Impact Report</div>
              <div className="text-xs text-indigo-600 mt-0.5">
                Connect pollutant to SDGs and analyze technologies' contributions
              </div>
            </div>
          </button>
        </div>
      </div>
      
      {/* Chat input */}
      <div className="p-3 border-t bg-gray-50">
        <div className="flex">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputMessage)}
            placeholder="Ask a question about the selected technologies..."
            className="flex-1 border border-gray-300 rounded-l-md py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={() => handleSendMessage(inputMessage)}
            disabled={!inputMessage.trim() || isLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-r-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        {selectedPatents.length === 0 && selectedBrefs.length === 0 && (
          <div className="text-xs text-amber-600 mt-2 flex items-center justify-center bg-amber-50 p-2 rounded border border-amber-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Please select patents or BREF sections before asking questions
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
