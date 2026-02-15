
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error('Error: GEMINI_API_KEY not found in .env.local');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
    const logFile = path.resolve(__dirname, 'gemini-test-output.txt');
    const log = (msg: string) => {
        console.log(msg);
        fs.appendFileSync(logFile, msg + '\n');
    };

    fs.writeFileSync(logFile, ''); // Clear log file

    try {
        log('Testing gemini-2.0-flash...');

        const modelNames = ['gemini-2.0-flash'];

        for (const name of modelNames) {
            log(`Testing model: ${name}`);
            try {
                const model = genAI.getGenerativeModel({ model: name });
                const result = await model.generateContent('Hello');
                const response = await result.response;
                log(`SUCCESS: ${name} works! Response: ${response.text()}`);
                process.exit(0); // Found a working model
            } catch (error: any) {
                log(`FAILED: ${name}`);
                // Try to log detailed error if available
                if (error.response) {
                    try {
                        const errBody = await error.response.json();
                        log(`Error Body: ${JSON.stringify(errBody, null, 2)}`);
                    } catch (e) {
                        log('Could not parse error body');
                    }
                }
                log(`Full Error: ${JSON.stringify(error, null, 2)}`);
                log(`Message: ${error.message}`);
            }
        }

    } catch (error) {
        log(`FAILURE: Unexpected Error: ${error}`);
    }
}

run();
