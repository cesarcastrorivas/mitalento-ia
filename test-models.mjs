import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const testModel = async (modelName) => {
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        await model.generateContent('hello');
        fs.appendFileSync('test-models-output2.txt', `${modelName} SUCCESS\n`);
    } catch (e) {
        fs.appendFileSync('test-models-output2.txt', `${modelName} FAILED: ${e.message}\n`);
    }
}
async function run() {
    if (fs.existsSync('test-models-output2.txt')) fs.unlinkSync('test-models-output2.txt');
    await testModel('gemini-3-flash-preview');
    await testModel('gemini-3.0-flash');
    await testModel('gemini-2.5-flash');
    await testModel('gemini-2.0-flash');
}
run();
