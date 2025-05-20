// assets/js/utils/chatApiService.js

/**
 * Service for handling communication with the OpenAI API
 */

// Get API URL from environment or use default
const API_URL = process.env.PUBLIC_API_URL || '/api/openai';

// Function to call the OpenAI API
export const callOpenAI = async (userMessage, systemPrompt, chatHistory = []) => {
  try {
    // Create the request body for the OpenAI API
    const requestBody = {
      model: "gpt-4o",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: systemPrompt
            }
          ]
        }
      ],
      text: {
        format: {
          type: "text"
        }
      },
      reasoning: {},
      tools: [],
      temperature: 0.7,
      max_output_tokens: 2048,
      top_p: 1,
      store: true
    };
    
    // Add chat history if provided
    if (chatHistory.length > 0) {
      const formattedHistory = chatHistory.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: [
          {
            type: msg.sender === 'user' ? 'input_text' : 'output_text',
            text: msg.text
          }
        ]
      }));
      
      requestBody.input = [
        requestBody.input[0],
        ...formattedHistory
      ];
    }
    
    // Add the new user message
    requestBody.input.push({
      role: "user",
      content: [
        {
          type: "input_text",
          text: userMessage
        }
      ]
    });
    
    // Make the API call to our backend endpoint (not directly to OpenAI)
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract the assistant's response
    const assistantResponse = data.text || 
                             data.response?.text ||
                             "I'm sorry, I couldn't process your request.";
    
    return assistantResponse;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
};
