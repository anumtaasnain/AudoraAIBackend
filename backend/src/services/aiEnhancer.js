const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

exports.enhancePitch = async (originalPitch, eventDetails) => {
  const prompt = `
    You are an expert event sponsorship consultant. 
    Enhance the following sponsorship pitch to be more professional, persuasive, and data-driven.
    The event is: ${eventDetails.title}.
    Description: ${eventDetails.description}.
    
    Original Pitch: "${originalPitch}"
    
    Provide ONLY the enhanced pitch text. No introductory or concluding remarks.
  `;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
};
