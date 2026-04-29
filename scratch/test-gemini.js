require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // There is no direct listModels in the SDK for node easily visible, 
    // but we can try to hit the endpoint or just try common ones.
    
    // Let's try a very basic request to gemini-1.5-flash-latest
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await model.generateContent("test");
    console.log("Success with gemini-1.5-flash-latest:", result.response.text());
  } catch (error) {
    console.error("Error with gemini-1.5-flash-latest:", error.message);
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent("test");
    console.log("Success with gemini-1.5-pro:", result.response.text());
  } catch (error) {
    console.error("Error with gemini-1.5-pro:", error.message);
  }
}

listModels();
