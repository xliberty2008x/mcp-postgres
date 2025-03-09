#!/usr/bin/env node
const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
app.use(bodyParser.json());

// The port the Express server will listen on
const PORT = process.env.MCP_SERVER_PORT || 3000;

// Setup CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Start the MCP server process
const mcpServerPath = path.join(__dirname, '../postgres-mcp-server/simple-server.js');
console.log(`Starting MCP server: ${mcpServerPath}`);

const mcpProcess = spawn('node', [mcpServerPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Set up error handling for the MCP process
mcpProcess.on('error', (error) => {
  console.error('Failed to start MCP server process:', error);
  process.exit(1);
});

mcpProcess.on('close', (code) => {
  console.log(`MCP server process exited with code ${code}`);
  process.exit(code);
});

// Log MCP server stdout and stderr for debugging
mcpProcess.stdout.on('data', (data) => {
  console.log(`MCP stdout: ${data}`);
});

mcpProcess.stderr.on('data', (data) => {
  console.error(`MCP stderr: ${data}`);
});

// Create a message queue to handle communication with MCP server
const messageQueue = [];
let currentId = 1;
const pendingRequests = new Map();

// Setup endpoint to forward MCP tool calls
app.post('/api/mcp', async (req, res) => {
  try {
    const requestId = currentId++;
    const request = {
      ...req.body,
      id: requestId.toString()
    };
    
    // Create a promise that will be resolved when the MCP server responds
    const responsePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error('MCP request timed out after 30 seconds'));
      }, 30000);
      
      pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout
      });
    });
    
    // Send the request to the MCP server
    mcpProcess.stdin.write(JSON.stringify(request) + '\n');
    
    // Wait for the response
    const response = await responsePromise;
    res.json(response);
  } catch (error) {
    console.error('Error processing MCP request:', error);
    res.status(500).json({
      error: {
        code: -32000,
        message: `MCP server error: ${error.message}`
      }
    });
  }
});

// Setup JSON-RPC message parser for MCP server responses
let buffer = '';
mcpProcess.stdout.on('data', (data) => {
  buffer += data.toString();
  
  // Process any complete messages in the buffer
  let newlineIndex;
  while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
    const message = buffer.substring(0, newlineIndex);
    buffer = buffer.substring(newlineIndex + 1);
    
    try {
      const response = JSON.parse(message);
      const requestId = parseInt(response.id, 10);
      const pendingRequest = pendingRequests.get(requestId);
      
      if (pendingRequest) {
        clearTimeout(pendingRequest.timeout);
        pendingRequests.delete(requestId);
        pendingRequest.resolve(response);
      }
    } catch (error) {
      console.error('Error parsing MCP response:', error, message);
    }
  }
});

// Add health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', message: 'PostgreSQL MCP server bridge is running' });
});

// Add documentation endpoint
app.get('/', (req, res) => {
  res.send(`
    <html>
    <head>
      <title>PostgreSQL MCP Server Bridge</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          line-height: 1.6;
        }
        h1 { color: #1a73e8; }
        h2 { 
          color: #174ea6;
          border-bottom: 1px solid #eee;
          padding-bottom: 8px;
        }
        code {
          background-color: #f5f5f5;
          padding: 2px 5px;
          border-radius: 4px;
        }
        pre {
          background-color: #f5f5f5;
          padding: 15px;
          border-radius: 4px;
          overflow-x: auto;
        }
      </style>
    </head>
    <body>
      <h1>PostgreSQL MCP Server Bridge</h1>
      <p>This server acts as a bridge between HTTP clients and the PostgreSQL MCP server.</p>
      
      <h2>API Endpoints</h2>
      
      <h3>MCP Tool Call</h3>
      <p><code>POST /api/mcp</code></p>
      <p>Call an MCP tool with the following JSON-RPC 2.0 format:</p>
      <pre>{
  "jsonrpc": "2.0",
  "method": "callTool",
  "params": {
    "name": "query",
    "arguments": {
      "sql": "SELECT * FROM users",
      "params": []
    }
  },
  "id": "1"
}</pre>

      <h3>Health Check</h3>
      <p><code>GET /health</code></p>
      <p>Check if the bridge server is running properly.</p>
      
      <h2>Available MCP Tools</h2>
      <ul>
        <li><code>query</code> - Execute a SQL query</li>
        <li><code>get_tables</code> - List all tables in a schema</li>
        <li><code>get_table_schema</code> - Get the schema of a specific table</li>
        <li><code>insert_record</code> - Insert a new record into a table</li>
        <li><code>update_record</code> - Update records in a table</li>
        <li><code>delete_record</code> - Delete records from a table</li>
      </ul>
      
      <p>For more detailed API documentation, see the Cloudflare Worker client.</p>
    </body>
    </html>
  `);
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`PostgreSQL MCP Bridge server listening on port ${PORT}`);
  console.log(`API endpoint available at http://localhost:${PORT}/api/mcp`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
  console.log('Press Ctrl+C to stop the server');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down MCP server...');
  mcpProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down MCP server...');
  mcpProcess.kill();
  process.exit(0);
});
