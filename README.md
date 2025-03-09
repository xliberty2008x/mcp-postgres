# PostgreSQL MCP Server

This project provides a Model Context Protocol (MCP) server for PostgreSQL that can be integrated with Cursor, Cline, and Claude to perform database operations directly from your AI assistant. It also includes a Cloudflare Worker client that exposes the database operations through a REST API.

## Contents

- [Overview](#overview)
- [Project Components](#project-components)
- [Setup Instructions](#setup-instructions)
- [Using with Cursor](#using-with-cursor)
- [Using with Cline](#using-with-cline)
- [Using with Claude Desktop](#using-with-claude-desktop)
- [Cloudflare Worker Setup](#cloudflare-worker-setup)
- [Available MCP Tools](#available-mcp-tools)
- [Express Bridge API](#express-bridge-api)
- [Example Usage](#example-usage)
- [Security Considerations](#security-considerations)

## Overview

This MCP server connects to a PostgreSQL database and provides tools for executing queries, listing tables, retrieving schema information, and performing CRUD operations. When integrated with AI assistants like Claude (via Cursor, Cline, or Claude Desktop), it enables natural language interactions with your database.

## Project Components

1. **PostgreSQL MCP Server** (`src/postgres-mcp-server/`):
   - Implements the MCP protocol for PostgreSQL database operations
   - Connects directly to your database using connection details from `.env`
   - Provides tools for querying, listing tables, getting schema information, and CRUD operations

2. **Express Bridge** (`src/express-bridge/`):
   - HTTP server that bridges between web clients and the MCP server
   - Handles incoming HTTP requests and translates them to MCP requests
   - Provides API documentation at the root endpoint

3. **Cloudflare Worker Client** (`src/cloudflare-client/`):
   - REST API implementation that can be deployed to Cloudflare Workers
   - Provides endpoints for all database operations
   - Includes detailed API documentation with examples

## Setup Instructions

1. **Clone the repository and navigate to the project directory**

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy the example environment file and update it with your PostgreSQL database credentials:

   ```bash
   cp .env.example .env
   ```

   Edit the `.env` file with your actual database credentials:

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
   
   # Optional: Set to 'true' to use mock mode (no real database connection required)
   DB_MOCK_MODE=false
   ```

   If you don't have a PostgreSQL database available, you can set `DB_MOCK_MODE=true` to use mock data for testing.

## Using with Cursor

To add the PostgreSQL MCP server to Cursor:

1. **Create or modify the MCP settings file**:
   - For macOS: `~/Library/Application Support/Cursor/cursor_config.json`
   - For Windows: `%APPDATA%\Cursor\cursor_config.json`
   - For Linux: `~/.config/Cursor/cursor_config.json`

2. **Add the following configuration to the `mcpServers` section**:

   ```json
   {
     "mcpServers": {
       "postgres": {
         "command": "node",
         "args": ["<FULL_PATH_TO_PROJECT>/src/postgres-mcp-server/index.js"],
         "env": {
           "DB_HOST": "your_db_host",
           "DB_PORT": "your_db_port",
           "DB_NAME": "your_db_name",
           "DB_USER": "your_db_username",
           "DB_PASSWORD": "your_db_password",
           "DB_SCHEMA": "public",
           "DB_MOCK_MODE": "false"
         },
         "disabled": false,
         "autoApprove": []
       }
     }
   }
   ```

   Replace:
   - `<FULL_PATH_TO_PROJECT>` with the actual absolute path to your project
   - Update the database credentials with your actual values

3. **Restart Cursor**

4. **Interact with your database** by using natural language:
   - "Show me all tables in my database"
   - "Get the schema for the users table"
   - "Find all records in the orders table where the amount is greater than 100"

## Using with Cline

To add the PostgreSQL MCP server to Cline:

1. **Locate or create the MCP settings file**:
   - For macOS: `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
   - For Windows: `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`
   - For Linux: `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

2. **Add the following configuration to the `mcpServers` section**:

   ```json
   {
     "mcpServers": {
       "postgres": {
         "command": "node",
         "args": ["<FULL_PATH_TO_PROJECT>/src/postgres-mcp-server/index.js"],
         "env": {
           "DB_HOST": "your_db_host",
           "DB_PORT": "your_db_port",
           "DB_NAME": "your_db_name",
           "DB_USER": "your_db_username",
           "DB_PASSWORD": "your_db_password",
           "DB_SCHEMA": "public",
           "DB_MOCK_MODE": "false"
         },
         "disabled": false,
         "autoApprove": []
       }
     }
   }
   ```

   Replace:
   - `<FULL_PATH_TO_PROJECT>` with the actual absolute path to your project
   - Update the database credentials with your actual values

3. **Restart VS Code**

4. **Interact with your database** using Cline by sending natural language queries:
   - "Show me all tables in my database"
   - "Query the users table and get the 10 most recent records"
   - "Update the email for the user with ID 123"

## Using with Claude Desktop

To add the PostgreSQL MCP server to Claude Desktop:

1. **Locate or create the MCP settings file**:
   - For macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - For Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - For Linux: `~/.config/Claude/claude_desktop_config.json`

2. **Add the following configuration to the `mcpServers` section**:

   ```json
   {
     "mcpServers": {
       "postgres": {
         "command": "node",
         "args": ["<FULL_PATH_TO_PROJECT>/src/postgres-mcp-server/index.js"],
         "env": {
           "DB_HOST": "your_db_host",
           "DB_PORT": "your_db_port",
           "DB_NAME": "your_db_name",
           "DB_USER": "your_db_username",
           "DB_PASSWORD": "your_db_password",
           "DB_SCHEMA": "public",
           "DB_MOCK_MODE": "false"
         },
         "disabled": false,
         "autoApprove": []
       }
     }
   }
   ```

   Replace:
   - `<FULL_PATH_TO_PROJECT>` with the actual absolute path to your project
   - Update the database credentials with your actual values

3. **Restart Claude Desktop**

4. **Interact with your database** using natural language:
   - "Show me all tables in my database"
   - "Insert a new record into the products table with name 'New Product' and price 99.99"
   - "Delete the user with ID 5"

## Cloudflare Worker Setup

You can also deploy the PostgreSQL MCP client as a Cloudflare Worker to access your database via a REST API:

1. **Install Wrangler** (Cloudflare Workers CLI):

   ```bash
   npm install -g wrangler
   ```

2. **Log in to your Cloudflare account**:

   ```bash
   wrangler login
   ```

3. **Configure the Cloudflare client**:

   Edit the `src/cloudflare-client/wrangler.toml` file:

   ```toml
   name = "postgres-mcp-client"
   main = "src/index.js"
   compatibility_date = "2024-01-01"

   [vars]
   MCP_SERVER_URL = "https://your-express-bridge-url.com"

   # Uncomment and add your domain if needed
   # [[routes]]
   # pattern = "postgres-api.yourdomain.com/*"
   # zone_name = "yourdomain.com"
   ```

   Replace `MCP_SERVER_URL` with the URL where your Express Bridge server is running. If you're using a local server for testing, you'll need to expose it with a tool like ngrok.

4. **Deploy the Cloudflare Worker**:

   ```bash
   cd src/cloudflare-client
   wrangler publish
   ```

5. **Access your API** at the URL provided by Cloudflare after deployment.

## Available MCP Tools

The PostgreSQL MCP Server provides the following tools:

1. **query** - Execute any SQL query against the database
   ```json
   {
     "sql": "SELECT * FROM users WHERE id = $1",
     "params": [1]
   }
   ```

2. **get_tables** - List all tables in a schema (defaults to public)
   ```json
   {
     "schema": "public"
   }
   ```

3. **get_table_schema** - Get detailed information about a table's structure
   ```json
   {
     "table": "users",
     "schema": "public"
   }
   ```

4. **insert_record** - Add a new record to a table
   ```json
   {
     "table": "users",
     "data": {
       "name": "John Doe",
       "email": "john@example.com"
     },
     "returning": ["id"]
   }
   ```

5. **update_record** - Update existing records
   ```json
   {
     "table": "users",
     "data": {
       "email": "updated@example.com"
     },
     "conditions": {
       "id": 1
     },
     "returning": ["id", "email"]
   }
   ```

6. **delete_record** - Remove records from a table
   ```json
   {
     "table": "users",
     "conditions": {
       "id": 5
     }
   }
   ```

## Express Bridge API

If you prefer to use the MCP server via HTTP API instead of directly through AI assistants:

1. **Start the Express Bridge server**:

   ```bash
   npm start
   ```

2. **Access the API** at `http://localhost:3000/` (or the port you configured)

   - API Documentation: `http://localhost:3000/`
   - Health Check: `http://localhost:3000/health`
   - MCP Tool Endpoint: `http://localhost:3000/api/mcp`

3. **Example API request**:

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

## Example Usage

Here are some examples of natural language commands you can use with Claude once the MCP server is set up:

### Basic Queries

- "Show me all tables in my database"
- "What's the schema for the users table?"
- "Get me the first 10 records from the orders table"

### Advanced Queries

- "How many users registered in the last month?"
- "Find all orders with a total amount greater than $100 and show me the customer name and order date"
- "Count how many records are in each table in my database"

### Data Manipulation

- "Insert a new user named John Smith with email john@example.com into the users table"
- "Update the email address for user with ID 5 to new.email@example.com"
- "Delete all products that have been out of stock for more than 30 days"

### Schema Analysis

- "What tables have a foreign key relationship with the users table?"
- "Show me all tables that have a timestamp column"
- "What indexes exist on the orders table?"

## Security Considerations

- This implementation doesn't include authentication. For production use, add appropriate authentication to the Express Bridge and Cloudflare Worker.
- Protect your database credentials in the `.env` file and MCP settings files.
- Never expose the MCP server directly to the internet; always use the Express Bridge or Cloudflare Worker with proper security measures.
- Consider using a read-only database account for querying if you're concerned about accidental data modifications.
- For Cloudflare Worker deployments, use environment secrets for storing sensitive information instead of putting them directly in the wrangler.toml file.
