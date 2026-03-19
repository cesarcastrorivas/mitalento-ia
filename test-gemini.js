const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function test() {
    try {
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-3.1-flash-lite-preview',
            systemInstruction: 'Eres un bot amigable.'
        });
        const chat = model.startChat({ history: [] });
        const result = await chat.sendMessage('Hola');
        console.log(result.response.text());
    } catch (e) {
        console.error('Error:', e);
    }
}
test();
