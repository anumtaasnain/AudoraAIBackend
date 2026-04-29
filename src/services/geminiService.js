const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Analyze attendee relevance using Gemini AI.
 * @param {Object} profile - Attendee profile details
 * @param {Object} event - Event details
 * @returns {Promise<Object>} - AI analysis result
 */
exports.analyzeAttendeeRelevance = async (profile, event) => {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
      You are an expert event curator and audience intelligence analyst for "Audora AI".
      Your task is to analyze an attendee's professional profile and determine their relevance to a specific event.

      ### Attendee Profile:
      - Name: ${profile.firstName} ${profile.lastName}
      - Job Title: ${profile.jobTitle}
      - Company: ${profile.company}
      - Industry: ${profile.industryIds?.map(i => i.name).join(', ') || 'N/A'}
      - Company Size: ${profile.companySize}
      - Interests: ${profile.interestIds?.map(i => i.name).join(', ') || 'N/A'}

      ### Event Details:
      - Title: ${event.title}
      - Description: ${event.description}
      - Event Type: ${event.eventType || 'N/A'}
      - Industry: ${event.industryId?.name || 'N/A'}

      ### Instructions:
      1. Provide a **relevanceScore** between 0 and 100.
      2. Provide a short **analysis** (max 2 sentences) explaining why the attendee is relevant or not.
      3. Classify **relevanceStatus** as "high" (score >= 80), "moderate" (60-79), or "low" (< 60).
      4. Estimate **engagementPrediction** as a percentage (0-100).

      Return ONLY a valid JSON object in this format:
      {
        "relevanceScore": number,
        "relevanceStatus": "high" | "moderate" | "low",
        "analysis": "string",
        "engagementPrediction": number
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean JSON if needed (sometimes LLMs wrap in ```json)
    const jsonStr = text.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Gemini Analysis Error:', error);
    throw error;
  }
};
