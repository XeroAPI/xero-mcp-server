import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to update a handler file
function updateHandlerFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace import statement
    content = content.replace(
        /import \{ xeroClient \} from "\.\.\/clients\/xero-client\.js";/g,
        'import { createXeroClient } from "../clients/xero-client.js";'
    );

    // Find all function definitions that use xeroClient
    const functionRegex = /(async function \w+\([^)]*\): Promise<[^>]+> \{[\s\S]*?)(await xeroClient\.authenticate\(\);)/g;

    content = content.replace(functionRegex, (match, before, authenticateCall) => {
        // Extract function name and parameters
        const funcMatch = before.match(/async function (\w+)\(([^)]*)\)/);
        if (!funcMatch) return match;

        const funcName = funcMatch[1];
        const params = funcMatch[2];

        // Add bearerToken parameter if not present
        let newParams = params;
        if (!params.includes('bearerToken')) {
            newParams = params ? `${params}, bearerToken: string` : 'bearerToken: string';
        }

        // Replace the function signature and add client creation
        const newBefore = before.replace(
            /async function \w+\([^)]*\)/,
            `async function ${funcName}(${newParams})`
        );

        const newAuthenticateCall = `  const xeroClient = createXeroClient(bearerToken);
  ${authenticateCall}`;

        return newBefore + newAuthenticateCall;
    });

    // Update export function signatures
    const exportRegex = /(export async function \w+\([^)]*\): Promise<[^>]+> \{[\s\S]*?)(const \w+ = await \w+\([^)]*\);)/g;

    content = content.replace(exportRegex, (match, before, functionCall) => {
        // Extract function name and parameters
        const funcMatch = before.match(/export async function (\w+)\(([^)]*)\)/);
        if (!funcMatch) return match;

        const funcName = funcMatch[1];
        const params = funcMatch[2];

        // Add bearerToken parameter if not present
        let newParams = params;
        if (!params.includes('bearerToken')) {
            newParams = params ? `${params}, bearerToken: string` : 'bearerToken: string';
        }

        // Replace the function signature
        const newBefore = before.replace(
            /export async function \w+\([^)]*\)/,
            `export async function ${funcName}(${newParams})`
        );

        // Update the function call to include bearerToken
        const callMatch = functionCall.match(/const (\w+) = await (\w+)\(([^)]*)\);/);
        if (callMatch) {
            const varName = callMatch[1];
            const funcCallName = callMatch[2];
            const callParams = callMatch[3];

            let newCallParams = callParams;
            if (!callParams.includes('bearerToken')) {
                newCallParams = callParams ? `${callParams}, bearerToken` : 'bearerToken';
            }

            const newFunctionCall = `const ${varName} = await ${funcCallName}(${newCallParams});`;

            return newBefore + newFunctionCall;
        }

        return match;
    });

    fs.writeFileSync(filePath, content);
    console.log(`Updated: ${filePath}`);
}

// Function to update a tool file
function updateToolFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Find handler calls and add bearerToken parameter
    const handlerCallRegex = /(const response = await \w+\([^)]*\);)/g;

    content = content.replace(handlerCallRegex, (match) => {
        if (match.includes('bearerToken')) {
            return match; // Already updated
        }

        // Extract function name and parameters
        const callMatch = match.match(/const response = await (\w+)\(([^)]*)\);/);
        if (!callMatch) return match;

        const funcName = callMatch[1];
        const params = callMatch[2];

        // Add bearerToken parameter
        let newParams = params;
        if (!params.includes('bearerToken')) {
            newParams = params ? `${params}, bearerToken` : 'bearerToken';
        }

        return `const response = await ${funcName}(${newParams});`;
    });

    // Update function parameters to destructure bearerToken
    const functionRegex = /(async \([^)]*\) => \{[\s\S]*?)(const response = await \w+\([^)]*\);)/g;

    content = content.replace(functionRegex, (match, before, responseCall) => {
        // Extract parameters
        const paramMatch = before.match(/async \(([^)]*)\) => \{/);
        if (!paramMatch) return match;

        const params = paramMatch[1];

        // Check if bearerToken is already destructured
        if (params.includes('bearerToken')) {
            return match;
        }

        // Add bearerToken to destructuring
        let newParams = params;
        if (params.includes('{')) {
            // Already has destructuring, add bearerToken
            newParams = params.replace('{', '{ bearerToken, ');
        } else {
            // No destructuring, add it
            newParams = `{ bearerToken, ...params }`;
        }

        const newBefore = before.replace(/async \([^)]*\) => \{/, `async (${newParams}) => {`);

        return newBefore + responseCall;
    });

    fs.writeFileSync(filePath, content);
    console.log(`Updated: ${filePath}`);
}

// Update all handler files
const handlersDir = path.join(__dirname, 'src', 'handlers');
const handlerFiles = fs.readdirSync(handlersDir).filter(file => file.endsWith('.ts'));

console.log('Updating handler files...');
handlerFiles.forEach(file => {
    const filePath = path.join(handlersDir, file);
    updateHandlerFile(filePath);
});

// Update all tool files
const toolsDir = path.join(__dirname, 'src', 'tools');
const toolCategories = ['list', 'get', 'create', 'update', 'delete'];

console.log('\nUpdating tool files...');
toolCategories.forEach(category => {
    const categoryDir = path.join(toolsDir, category);
    if (fs.existsSync(categoryDir)) {
        const toolFiles = fs.readdirSync(categoryDir).filter(file => file.endsWith('.ts') && file !== 'index.ts');
        toolFiles.forEach(file => {
            const filePath = path.join(categoryDir, file);
            updateToolFile(filePath);
        });
    }
});

console.log('\nUpdate complete!'); 