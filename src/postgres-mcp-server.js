#!/usr/bin/env node
const { Server } = require('@modelcontextprotocol/sdk').Server;
const { StdioServerTransport } = require('@modelcontextprotocol/sdk').StdioServerTransport;
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} = require('@modelcontextprotocol/sdk');
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// PostgreSQL database configuration
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  schema: process.env.DB_SCHEMA,
};

console.error('PostgreSQL Database Configuration:', JSON.stringify({
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.user,
  // Mask password for security
  password: '********',
  schema: dbConfig.schema,
}));

const pool = new Pool(dbConfig);

class PostgresMcpServer {
  constructor() {
    this.server = new Server(
      {
        name: 'postgres-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Set up connection to the database
    this.setupDatabaseConnection();
    
    // Set up tool handlers
    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.closeDbConnection();
      await this.server.close();
      process.exit(0);
    });
  }

  async setupDatabaseConnection() {
    try {
      // Test database connection
      const client = await pool.connect();
      console.error('Successfully connected to PostgreSQL database');
      client.release();
    } catch (error) {
      console.error('Error connecting to PostgreSQL database:', error.message);
      console.error('Will continue running in case of transient connection issues.');
    }
  }

  async closeDbConnection() {
    try {
      await pool.end();
      console.error('Database connection closed');
    } catch (error) {
      console.error('Error closing database connection:', error.message);
    }
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'query',
          description: 'Execute a SQL query against the PostgreSQL database',
          inputSchema: {
            type: 'object',
            properties: {
              sql: {
                type: 'string',
                description: 'SQL query to execute',
              },
              params: {
                type: 'array',
                description: 'Query parameters (optional)',
                items: {
                  type: ['string', 'number', 'boolean', 'null'],
                },
              },
            },
            required: ['sql'],
          },
        },
        {
          name: 'get_tables',
          description: 'Get a list of tables in the database',
          inputSchema: {
            type: 'object',
            properties: {
              schema: {
                type: 'string',
                description: 'Database schema (optional, defaults to public)',
              },
            },
          },
        },
        {
          name: 'get_table_schema',
          description: 'Get the schema definition for a specific table',
          inputSchema: {
            type: 'object',
            properties: {
              table: {
                type: 'string',
                description: 'Table name',
              },
              schema: {
                type: 'string',
                description: 'Database schema (optional, defaults to public)',
              },
            },
            required: ['table'],
          },
        },
        {
          name: 'insert_record',
          description: 'Insert a new record into a table',
          inputSchema: {
            type: 'object',
            properties: {
              table: {
                type: 'string',
                description: 'Table name',
              },
              data: {
                type: 'object',
                description: 'Record data (column name -> value)',
              },
              schema: {
                type: 'string',
                description: 'Database schema (optional, defaults to public)',
              },
              returning: {
                type: 'array',
                description: 'Columns to return after insertion (optional)',
                items: {
                  type: 'string',
                },
              },
            },
            required: ['table', 'data'],
          },
        },
        {
          name: 'update_record',
          description: 'Update records in a table',
          inputSchema: {
            type: 'object',
            properties: {
              table: {
                type: 'string',
                description: 'Table name',
              },
              data: {
                type: 'object',
                description: 'Record data to update (column name -> value)',
              },
              conditions: {
                type: 'object',
                description: 'Conditions for update (column name -> value)',
              },
              schema: {
                type: 'string',
                description: 'Database schema (optional, defaults to public)',
              },
              returning: {
                type: 'array',
                description: 'Columns to return after update (optional)',
                items: {
                  type: 'string',
                },
              },
            },
            required: ['table', 'data', 'conditions'],
          },
        },
        {
          name: 'delete_record',
          description: 'Delete records from a table',
          inputSchema: {
            type: 'object',
            properties: {
              table: {
                type: 'string',
                description: 'Table name',
              },
              conditions: {
                type: 'object',
                description: 'Conditions for deletion (column name -> value)',
              },
              schema: {
                type: 'string',
                description: 'Database schema (optional, defaults to public)',
              },
              returning: {
                type: 'array',
                description: 'Columns to return from deleted records (optional)',
                items: {
                  type: 'string',
                },
              },
            },
            required: ['table', 'conditions'],
          },
        },
      ],
    }));

    // Handle tool call requests
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'query':
            return await this.executeQuery(args);
          case 'get_tables':
            return await this.getTables(args);
          case 'get_table_schema':
            return await this.getTableSchema(args);
          case 'insert_record':
            return await this.insertRecord(args);
          case 'update_record':
            return await this.updateRecord(args);
          case 'delete_record':
            return await this.deleteRecord(args);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        
        console.error(`Error executing tool ${name}:`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Database operation error: ${error.message}`
        );
      }
    });
  }

  async executeQuery({ sql, params = [] }) {
    try {
      console.error(`Executing SQL query: ${sql} with params:`, params);
      const result = await pool.query(sql, params);
      console.error(`Query returned ${result.rowCount} rows`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              rows: result.rows,
              rowCount: result.rowCount,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('SQL error:', error);
      return {
        content: [
          {
            type: 'text',
            text: `SQL error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async getTables({ schema = 'public' }) {
    try {
      console.error(`Getting tables for schema: ${schema}`);
      const sql = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
        ORDER BY table_name;
      `;
      
      const result = await pool.query(sql, [schema]);
      console.error(`Found ${result.rowCount} tables`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              tables: result.rows.map(row => row.table_name),
              count: result.rowCount,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('Error getting tables:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error getting tables: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async getTableSchema({ table, schema = 'public' }) {
    try {
      console.error(`Getting schema for table: ${schema}.${table}`);
      const sql = `
        SELECT 
          column_name, 
          data_type, 
          is_nullable, 
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position;
      `;
      
      const result = await pool.query(sql, [schema, table]);
      
      if (result.rowCount === 0) {
        console.error(`Table '${table}' not found in schema '${schema}'`);
        return {
          content: [
            {
              type: 'text',
              text: `Table '${table}' not found in schema '${schema}'`,
            },
          ],
          isError: true,
        };
      }
      
      // Get primary key information
      const pkSql = `
        SELECT a.attname as column_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass AND i.indisprimary;
      `;
      
      const pkResult = await pool.query(pkSql, [`${schema}.${table}`]);
      const primaryKeys = pkResult.rows.map(row => row.column_name);
      console.error(`Found ${result.rowCount} columns and ${primaryKeys.length} primary keys`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              table,
              schema,
              columns: result.rows,
              primaryKeys,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('Error getting table schema:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error getting table schema: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async insertRecord({ table, data, schema = 'public', returning = [] }) {
    try {
      console.error(`Inserting record into ${schema}.${table}:`, data);
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      
      let sql = `
        INSERT INTO ${schema}.${table} (${columns.join(', ')})
        VALUES (${placeholders})
      `;
      
      if (returning.length > 0) {
        sql += ` RETURNING ${returning.join(', ')}`;
      }
      
      const result = await pool.query(sql, values);
      console.error(`Insert successful, ${result.rowCount} rows affected`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              rowCount: result.rowCount,
              returning: returning.length > 0 ? result.rows : undefined,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('Error inserting record:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error inserting record: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async updateRecord({ table, data, conditions, schema = 'public', returning = [] }) {
    try {
      console.error(`Updating record in ${schema}.${table} with data:`, data, 'and conditions:', conditions);
      const updates = Object.entries(data).map(([column, _], i) => `${column} = $${i + 1}`);
      const dataValues = Object.values(data);
      
      const whereConditions = Object.entries(conditions).map(([column, _], i) => 
        `${column} = $${i + 1 + dataValues.length}`
      );
      const conditionValues = Object.values(conditions);
      
      let sql = `
        UPDATE ${schema}.${table}
        SET ${updates.join(', ')}
        WHERE ${whereConditions.join(' AND ')}
      `;
      
      if (returning.length > 0) {
        sql += ` RETURNING ${returning.join(', ')}`;
      }
      
      const values = [...dataValues, ...conditionValues];
      const result = await pool.query(sql, values);
      console.error(`Update successful, ${result.rowCount} rows affected`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              rowCount: result.rowCount,
              returning: returning.length > 0 ? result.rows : undefined,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('Error updating record:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error updating record: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async deleteRecord({ table, conditions, schema = 'public', returning = [] }) {
    try {
      console.error(`Deleting record from ${schema}.${table} with conditions:`, conditions);
      const whereConditions = Object.entries(conditions).map(([column, _], i) => 
        `${column} = $${i + 1}`
      );
      const values = Object.values(conditions);
      
      let sql = `
        DELETE FROM ${schema}.${table}
        WHERE ${whereConditions.join(' AND ')}
      `;
      
      if (returning.length > 0) {
        sql += ` RETURNING ${returning.join(', ')}`;
      }
      
      const result = await pool.query(sql, values);
      console.error(`Delete successful, ${result.rowCount} rows affected`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              rowCount: result.rowCount,
              returning: returning.length > 0 ? result.rows : undefined,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('Error deleting record:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error deleting record: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('PostgreSQL MCP server running on stdio');
  }
}

// Initialize and run the server
const server = new PostgresMcpServer();
server.run().catch(console.error);
