# PostgreSQL MCP Server with Cloudflare Client

This project provides a Model Context Protocol (MCP) server that connects to a PostgreSQL database, allowing you to perform all query and CRUD operations through MCP tools. It also includes a Cloudflare Worker client that exposes these database operations through a REST API.

## Project Components

1. **PostgreSQL MCP Server** (`src/postgres-mcp-server/index.js`):
   - Implements MCP protocol for database operations
   - Connects to PostgreSQL database using connection details from `.env`
   - Provides tools for querying, listing tables, getting schema information, and CRUD operations

2. **Express Bridge** (`src/express-bridge/index.js`):
   - HTTP server that bridges between web clients and the MCP server
   - Handles incoming HTTP requests and translates them to MCP requests
   - Provides API documentation at the root endpoint

3. **Cloudflare Worker Client** (`src/cloudflare-client/`):
   - REST API implementation that can be deployed to Cloudflare Workers
   - Provides endpoints for all database operations
   - Includes detailed API documentation with examples

## Prerequisites

- Node.js (v14+)
- PostgreSQL database server
- Python 3.7+ (for potential future extensions)

## Setup Instructions

1. **Clone the repository and navigate to the project directory**

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Update the `.env` file with your PostgreSQL database credentials:

   ```
   # PostgreSQL Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=your_database_name
   DB_USER=your_username
   DB_PASSWORD=your_password
   DB_SCHEMA=public

   # MCP Server Configuration
   MCP_SERVER_PORT=3000
   ```

4. **Start the Express Bridge server**

   ```bash
   node src/express-bridge/index.js
   ```

   This will:
   - Start the PostgreSQL MCP server
   - Start the Express Bridge server on port 3000 (or the port specified in .env)
   - You should see output confirming the server is running

5. **For Cloudflare Workers deployment (optional)**

   Install Wrangler (Cloudflare Workers CLI):

   ```bash
   npm install -g wrangler
   ```

   Navigate to the Cloudflare client directory and deploy:

   ```bash
   cd src/cloudflare-client
   wrangler publish
   ```

## Using the API

### Express Bridge API

Once the Express Bridge server is running, you can interact with it using HTTP requests:

- API Documentation: http://localhost:3000/
- Health Check: http://localhost:3000/health
- MCP Tool Endpoint: http://localhost:3000/api/mcp

Example request to execute a SQL query:

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "callTool",
    "params": {
      "name": "query",
      "arguments": {
        "sql": "SELECT * FROM users LIMIT 10"
      }
    },
    "id": "1"
  }'
```

### Cloudflare Worker API

If you've deployed the Cloudflare Worker, you can interact with it using the following endpoints:

- `GET /api/tables` - List all tables
- `GET /api/table/:tableName` - Get table schema
- `GET /api/records/:tableName` - Query records with optional filtering
- `POST /api/records/:tableName` - Insert a new record
- `PUT /api/records/:tableName` - Update records
- `DELETE /api/records/:tableName` - Delete records
- `POST /api/query` - Execute a custom SQL query

See the API documentation at the root of the Worker URL for detailed usage examples.

## Available MCP Tools

The PostgreSQL MCP Server exposes the following tools:

- **query** - Execute a SQL query against the PostgreSQL database
- **get_tables** - Get a list of tables in the database
- **get_table_schema** - Get the schema definition for a specific table
- **insert_record** - Insert a new record into a table
- **update_record** - Update records in a table
- **delete_record** - Delete records from a table

## Security Considerations

- This implementation does not include authentication. For production use, add appropriate authentication and authorization.
- Protect your database credentials in the `.env` file.
- Consider using prepared statements for all SQL queries to prevent SQL injection.
- Set up proper network security if exposing the API publicly.

## License

MIT
