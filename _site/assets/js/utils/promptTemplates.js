// assets/js/utils/promptTemplates.js

/**
 * File containing all prompt templates for the OpenAI API
 */

/**
 * Creates the main system prompt with context information
 * @param {Array} selectedPatents - Patents added to the context
 * @param {Array} selectedBrefs - BREF sections added to the context
 * @param {String} selectedPollutant - Currently selected pollutant
 * @param {Object} sdgData - SDG data for the selected pollutant
 * @returns {String} - Formatted system prompt
 */
export const createSystemPrompt = (selectedPatents = [], selectedBrefs = [], selectedPollutant = '', sdgData = null) => {
  // Base system prompt that provides context about BREFs, patents, and the assistant's role
  let prompt = `You are an expert assistant analyzing pollution abatement technologies in the context of European regulatory frameworks.

CONTEXT INFORMATION:
- Current selected pollutant: ${selectedPollutant || "None"}
- Number of patents in context: ${selectedPatents.length}
- Number of BREF sections in context: ${selectedBrefs.length}

ABOUT BREFs:
A BREF is a BAT Reference Document adopted by the European Commission. The BREFs cover descriptions of industrial processes and techniques, emission levels, and applicable alternative processes that can be applied. BREF documents are the outputs of an information exchange by technical groups consisting of experts from industry, Member State authorities, research institutes, and NGOs.

In 2006, the European IPPC Bureau completed the first series of 33 BREFs and launched the review of the first documents that were finalized. Each BREF is the outcome of a multiple-year process involving up to 100 experts. The affected industries participate in such process usually through the corresponding industrial association.

ABOUT SDGs:
SDGs (Sustainable Development Goals) are 17 global goals designed to be a blueprint to achieve a better and more sustainable future for all. They address challenges including poverty, inequality, climate change, environmental degradation, peace, and justice.

YOUR TASK:
Analyze the relationships between the selected patents, BREF documents, and the pollutant in context. Provide insights on how these technologies can help reduce pollution in alignment with regulatory requirements and sustainable development goals.

YOUR OUTPUT FORMAT:
- Begin with a brief summary of the analysis.
- Use headings and subheadings to organize your response.
- When appropriate, use bullet points for better readability.
- Include specific references to the patents, BREFs, and pollutant in your analysis.
- Highlight key insights or recommendations.
`;

  // Add patent information if available
  if (selectedPatents.length > 0) {
    prompt += `\nPATENT INFORMATION:\n`;
    selectedPatents.forEach((patent, index) => {
      prompt += `Patent ${index + 1}: "${patent.title}" (ID: ${patent.id})
- Year: ${patent.year || "Unknown"}
- Abstract: ${patent.abstract || patent.text || "Not available"}
- Relevance to ${selectedPollutant}: ${Math.round((patent.score || 0) * 100)}%
${patent.bref_relevance ? `- BREF relevance: Available for ${Object.keys(patent.bref_relevance).length} sections` : "- BREF relevance: Not available"}

`;
    });
  }

  // Add BREF information if available
  if (selectedBrefs.length > 0) {
    prompt += `\nBREF SECTION INFORMATION:\n`;
    selectedBrefs.forEach((bref, index) => {
      // Limit the text length to keep the prompt concise
      const maxTextLength = 500;
      const truncatedText = bref.text.length > maxTextLength
        ? bref.text.substring(0, maxTextLength) + "..."
        : bref.text;
      
      prompt += `BREF Section ${index + 1}: "${bref.name || bref.id}"
- ID: ${bref.id}
- Content: ${truncatedText}

`;
    });
  }

  // Add SDG data if available
  if (sdgData && Object.keys(sdgData).length > 0) {
    prompt += `\nSDG RELEVANCE FOR ${selectedPollutant}:\n`;
    Object.entries(sdgData).forEach(([sdg, relevance]) => {
      prompt += `- ${sdg}: ${relevance}\n`;
    });
  }

  return prompt;
};

/**
 * Button-specific prompt templates
 */

/**
 * Create prompt for BREF-Pollutant connection analysis
 * @param {String} selectedPollutant - The selected pollutant
 * @returns {String} - Formatted prompt
 */
export const createBrefPollutantConnectionPrompt = (selectedPollutant) => {
  return `Analyze the connection between the selected BREF section(s) and the pollutant "${selectedPollutant}".

Please provide:
1. A detailed explanation of how the techniques described in these BREF sections can help reduce this pollutant
2. The specific mechanisms through which these techniques work
3. Expected reduction levels or efficiency ranges when properly implemented
4. Implementation considerations including cost factors, industry applicability, and technical requirements
5. Any limitations or constraints of these techniques

Focus on practical implementation details and real-world effectiveness.`;
};

/**
 * Create prompt for BREF-Patent synergy analysis
 * @returns {String} - Formatted prompt
 */
export const createBrefPatentConnectionPrompt = () => {
  return `Analyze the connections and synergies between the selected BREF section(s) and patent(s).

Please provide:
1. An assessment of how well the patents align with or implement the techniques described in the BREF documents
2. Identification of specific technological approaches that connect the patents to the BREF requirements
3. Areas of innovation where the patents extend beyond basic BREF requirements
4. Potential implementation strategies that combine BREF guidelines with the patented technologies
5. A comparative analysis of different approaches across the patents and BREF sections

Focus on how these technologies can work together to achieve regulatory compliance while maximizing pollution reduction.`;
};

/**
 * Create prompt for Patent-Pollutant connection analysis
 * @param {String} selectedPollutant - The selected pollutant
 * @returns {String} - Formatted prompt
 */
export const createPatentPollutantConnectionPrompt = (selectedPollutant) => {
  return `Explain the connection between the selected patent(s) and the pollutant "${selectedPollutant}".

Please provide:
1. A detailed explanation of how the technologies described in these patents help reduce this pollutant
2. The mechanisms of action for each technology (chemical, physical, biological processes)
3. Estimated reduction percentages or efficiency ranges based on the patents' descriptions
4. Implementation considerations including cost implications, scalability, and technical requirements
5. Comparative advantages of these technologies compared to conventional approaches

Focus on practical applications and real-world impact potential of these technologies.`;
};

/**
 * Create prompt for SDG impact report
 * @param {String} selectedPollutant - The selected pollutant
 * @returns {String} - Formatted prompt
 */
export const createSDGReportPrompt = (selectedPollutant) => {
  return `Create a comprehensive report connecting the pollutant "${selectedPollutant}" to the Sustainable Development Goals (SDGs), emphasizing where this pollutant is most relevant.

Please provide:
1. An analysis of how this pollutant impacts each relevant SDG
2. Specific ways the selected BREF section(s) address these SDG impacts
3. How the technologies in the selected patent(s) contribute to achieving these SDGs
4. Quantitative assessment (where possible) of potential SDG improvements
5. Strategic recommendations for maximizing SDG benefits while reducing this pollutant

Structure your report with clear sections for each relevant SDG, and prioritize SDGs where this pollutant has the most significant impact.`;
};
