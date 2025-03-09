/**
 * Cloudflare Worker client for PostgreSQL MCP Server
 * This worker exposes REST API endpoints that interact with the MCP server
 * which in turn interacts with the PostgreSQL database
 */

// Define API routes
const routes = {
  query: '/api/query',
  tables: '/api/tables',
  tableSchema: '/api/table/:tableName',
  records: '/api/records/:tableName',
};

export default {
  async fetch(request, env, ctx) {
    try {
      // Parse the URL and extract the pathname
      const url = new URL(request.url);
      const path = url.pathname;
      
      // Set CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };
      
      // Handle CORS preflight requests
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
      }
      
      // Route the request to the appropriate handler
      if (path.match(new RegExp(`^${routes.query}$`))) {
        return await handleQuery(request, env, corsHeaders);
      } else if (path.match(new RegExp(`^${routes.tables}$`))) {
        return await handleTables(request, env, corsHeaders);
      } else if (path.match(new RegExp(`^${routes.tableSchema.replace(':tableName', '([^/]+)')}$`))) {
        const tableName = path.match(new RegExp(`^${routes.tableSchema.replace(':tableName', '([^/]+)')}$`))[1];
        return await handleTableSchema(request, env, corsHeaders, tableName);
      } else if (path.match(new RegExp(`^${routes.records.replace(':tableName', '([^/]+)')}$`))) {
        const tableName = path.match(new RegExp(`^${routes.records.replace(':tableName', '([^/]+)')}$`))[1];
        return await handleRecords(request, env, corsHeaders, tableName);
      }
      
      // Handle root path - display API documentation
      if (path === '/' || path === '') {
        return new Response(generateApiDocs(), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html',
          },
        });
      }
      
      // If no route matches, return 404
      return new Response('Not Found', {
        status: 404,
        headers: corsHeaders,
      });
    } catch (error) {
      // Handle any errors
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};

/**
 * Handle SQL query requests
 */
async function handleQuery(request, env, corsHeaders) {
  // Only accept POST requests for queries
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
  
  try {
    const { sql, params } = await request.json();
    
    // Call the MCP server to execute the query
    const mcpResponse = await callMcpServer(env, 'query', { sql, params });
    
    return new Response(JSON.stringify(mcpResponse), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * Handle requests to list all tables
 */
async function handleTables(request, env, corsHeaders) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
  
  try {
    const url = new URL(request.url);
    const schema = url.searchParams.get('schema') || 'public';
    
    // Call the MCP server to get tables
    const mcpResponse = await callMcpServer(env, 'get_tables', { schema });
    
    return new Response(JSON.stringify(mcpResponse), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * Handle requests to get table schema
 */
async function handleTableSchema(request, env, corsHeaders, tableName) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
  
  try {
    const url = new URL(request.url);
    const schema = url.searchParams.get('schema') || 'public';
    
    // Call the MCP server to get table schema
    const mcpResponse = await callMcpServer(env, 'get_table_schema', { 
      table: tableName, 
      schema 
    });
    
    return new Response(JSON.stringify(mcpResponse), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * Handle CRUD operations on table records
 */
async function handleRecords(request, env, corsHeaders, tableName) {
  try {
    const url = new URL(request.url);
    const schema = url.searchParams.get('schema') || 'public';
    
    // Handle different HTTP methods for CRUD operations
    switch (request.method) {
      case 'GET':
        // Get records (query with conditions from query params)
        const queryParams = {};
        for (const [key, value] of url.searchParams.entries()) {
          if (key !== 'schema' && key !== 'limit' && key !== 'offset') {
            queryParams[key] = value;
          }
        }
        
        // Build SQL query with conditions
        let whereClause = '';
        const params = [];
        if (Object.keys(queryParams).length > 0) {
          whereClause = 'WHERE ' + Object.keys(queryParams)
            .map((key, index) => `${key} = $${index + 1}`)
            .join(' AND ');
          Object.values(queryParams).forEach(val => params.push(val));
        }
        
        const limit = url.searchParams.get('limit') ? 
          `LIMIT ${url.searchParams.get('limit')}` : '';
        const offset = url.searchParams.get('offset') ? 
          `OFFSET ${url.searchParams.get('offset')}` : '';
        
        const sql = `SELECT * FROM ${schema}.${tableName} ${whereClause} ${limit} ${offset}`.trim();
        
        // Execute the query via MCP server
        const getResponse = await callMcpServer(env, 'query', { 
          sql, 
          params 
        });
        
        return new Response(JSON.stringify(getResponse), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
        
      case 'POST':
        // Insert a new record
        const insertData = await request.json();
        const insertResponse = await callMcpServer(env, 'insert_record', {
          table: tableName,
          schema,
          data: insertData,
          returning: ['*']
        });
        
        return new Response(JSON.stringify(insertResponse), {
          status: 201,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
        
      case 'PUT':
        // Update records
        const { data, conditions } = await request.json();
        const updateResponse = await callMcpServer(env, 'update_record', {
          table: tableName,
          schema,
          data,
          conditions,
          returning: ['*']
        });
        
        return new Response(JSON.stringify(updateResponse), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
        
      case 'DELETE':
        // Delete records
        const deleteConditions = await request.json();
        const deleteResponse = await callMcpServer(env, 'delete_record', {
          table: tableName,
          schema,
          conditions: deleteConditions,
          returning: ['*']
        });
        
        return new Response(JSON.stringify(deleteResponse), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
        
      default:
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * Call the MCP server with the specified tool and arguments
 */
async function callMcpServer(env, toolName, args) {
  const mcpServerUrl = env.MCP_SERVER_URL || 'http://localhost:3000';
  
  try {
    const response = await fetch(`${mcpServerUrl}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'callTool',
        params: {
          name: toolName,
          arguments: args
        },
        id: Date.now().toString()
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MCP Server error: ${errorText}`);
    }
    
    const jsonResponse = await response.json();
    
    if (jsonResponse.error) {
      throw new Error(`MCP Server error: ${jsonResponse.error.message}`);
    }
    
    return jsonResponse.result || {};
  } catch (error) {
    console.error('Error calling MCP server:', error);
    throw new Error(`Failed to call MCP server: ${error.message}`);
  }
}

/**
 * Generate HTML documentation for the API
 */
function generateApiDocs() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>PostgreSQL MCP API Documentation</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        h1 { color: #1a73e8; }
        h2 { 
          color: #174ea6;
          margin-top: 30px; 
          padding-bottom: 5px;
          border-bottom: 1px solid #ddd;
        }
        code {
          background-color: #f5f5f5;
          padding: 2px 5px;
          border-radius: 3px;
          font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
        }
        pre {
          background-color: #f5f5f5;
          padding: 15px;
          border-radius: 5px;
          overflow-x: auto;
        }
        table {
          border-collapse: collapse;
          width: 100%;
          margin: 20px 0;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 10px;
          text-align: left;
        }
        th {
          background-color: #f2f2f2;
        }
        .endpoint {
          background-color: #e7f2fa;
          padding: 10px;
          border-radius: 5px;
          margin-bottom: 10px;
        }
        .method {
          font-weight: bold;
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          margin-right: 10px;
        }
        .get { background-color: #61affe; color: white; }
        .post { background-color: #49cc90; color: white; }
        .put { background-color: #fca130; color: white; }
        .delete { background-color: #f93e3e; color: white; }
      </style>
    </head>
    <body>
      <h1>PostgreSQL MCP API Documentation</h1>
      <p>This API allows you to interact with a PostgreSQL database through the Model Context Protocol (MCP) server.</p>
      
      <h2>Endpoints</h2>
      
      <div class="endpoint">
        <div><span class="method post">POST</span> <code>/api/query</code></div>
        <p>Execute a SQL query against the database.</p>
        <p><strong>Request Body:</strong></p>
        <pre>{
  "sql": "SELECT * FROM users WHERE age > $1",
  "params": [18]
}</pre>
      </div>
      
      <div class="endpoint">
        <div><span class="method get">GET</span> <code>/api/tables</code></div>
        <p>Get a list of all tables in the database.</p>
        <p><strong>Query Parameters:</strong></p>
        <ul>
          <li><code>schema</code> - Database schema (optional, defaults to 'public')</li>
        </ul>
      </div>
      
      <div class="endpoint">
        <div><span class="method get">GET</span> <code>/api/table/:tableName</code></div>
        <p>Get the schema for a specific table.</p>
        <p><strong>Path Parameters:</strong></p>
        <ul>
          <li><code>tableName</code> - Name of the table</li>
        </ul>
        <p><strong>Query Parameters:</strong></p>
        <ul>
          <li><code>schema</code> - Database schema (optional, defaults to 'public')</li>
        </ul>
      </div>
      
      <div class="endpoint">
        <div><span class="method get">GET</span> <code>/api/records/:tableName</code></div>
        <p>Query records from a table with optional filtering.</p>
        <p><strong>Path Parameters:</strong></p>
        <ul>
          <li><code>tableName</code> - Name of the table</li>
        </ul>
        <p><strong>Query Parameters:</strong></p>
        <ul>
          <li><code>schema</code> - Database schema (optional, defaults to 'public')</li>
          <li><code>limit</code> - Maximum number of records to return (optional)</li>
          <li><code>offset</code> - Number of records to skip (optional)</li>
          <li>Any column name can be used as a filter parameter</li>
        </ul>
      </div>
      
      <div class="endpoint">
        <div><span class="method post">POST</span> <code>/api/records/:tableName</code></div>
        <p>Insert a new record into a table.</p>
        <p><strong>Path Parameters:</strong></p>
        <ul>
          <li><code>tableName</code> - Name of the table</li>
        </ul>
        <p><strong>Query Parameters:</strong></p>
        <ul>
          <li><code>schema</code> - Database schema (optional, defaults to 'public')</li>
        </ul>
        <p><strong>Request Body:</strong></p>
        <pre>{
  "column1": "value1",
  "column2": "value2"
}</pre>
      </div>
      
      <div class="endpoint">
        <div><span class="method put">PUT</span> <code>/api/records/:tableName</code></div>
        <p>Update records in a table that match the specified conditions.</p>
        <p><strong>Path Parameters:</strong></p>
        <ul>
          <li><code>tableName</code> - Name of the table</li>
        </ul>
        <p><strong>Query Parameters:</strong></p>
        <ul>
          <li><code>schema</code> - Database schema (optional, defaults to 'public')</li>
        </ul>
        <p><strong>Request Body:</strong></p>
        <pre>{
  "data": {
    "column1": "new_value1",
    "column2": "new_value2"
  },
  "conditions": {
    "id": 1
  }
}</pre>
      </div>
      
      <div class="endpoint">
        <div><span class="method delete">DELETE</span> <code>/api/records/:tableName</code></div>
        <p>Delete records from a table that match the specified conditions.</p>
        <p><strong>Path Parameters:</strong></p>
        <ul>
          <li><code>tableName</code> - Name of the table</li>
        </ul>
        <p><strong>Query Parameters:</strong></p>
        <ul>
          <li><code>schema</code> - Database schema (optional, defaults to 'public')</li>
        </ul>
        <p><strong>Request Body:</strong></p>
        <pre>{
  "id": 1
}</pre>
      </div>
      
      <h2>Examples</h2>
      
      <h3>Query All Users</h3>
      <pre>GET /api/records/users</pre>
      
      <h3>Get Users with Age > 30</h3>
      <pre>GET /api/records/users?age=>30</pre>
      
      <h3>Insert a New User</h3>
      <pre>POST /api/records/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "age": 35
}</pre>
      
      <h3>Update a User's Email</h3>
      <pre>PUT /api/records/users
Content-Type: application/json

{
  "data": {
    "email": "new.email@example.com"
  },
  "conditions": {
    "id": 1
  }
}</pre>
      
      <h3>Delete a User</h3>
      <pre>DELETE /api/records/users
Content-Type: application/json

{
  "id": 1
}</pre>
      
      <h3>Custom SQL Query</h3>
      <pre>POST /api/query
Content-Type: application/json

{
  "sql": "SELECT u.name, COUNT(o.id) AS order_count FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.name HAVING COUNT(o.id) > $1",
  "params": [5]
}</pre>
    </body>
    </html>
  `;
}
