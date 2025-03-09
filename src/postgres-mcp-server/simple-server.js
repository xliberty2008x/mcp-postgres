#!/usr/bin/env node
const { Pool } = require('pg');
const dotenv = require('dotenv');
const readline = require('readline');

// Load environment variables from .env file
dotenv.config();

// PostgreSQL database configuration
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  schema: process.env.DB_SCHEMA,
});

// Create a readline interface to read stdin
const rl = readline.createInterface({
  input: process.stdin,
  output: null, // No stdout, we'll handle output manually
  terminal: false
});

// Check if we're in mock mode
const MOCK_MODE = process.env.DB_MOCK_MODE === 'true';

// Mock data for testing
const mockTables = [
  'users',
  'products',
  'orders',
  'order_items',
  'categories'
];

const mockSchemas = {
  users: [
    { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: "nextval('users_id_seq'::regclass)" },
    { column_name: 'name', data_type: 'character varying', is_nullable: 'NO', character_maximum_length: 255 },
    { column_name: 'email', data_type: 'character varying', is_nullable: 'NO', character_maximum_length: 255 },
    { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO' },
    { column_name: 'updated_at', data_type: 'timestamp with time zone', is_nullable: 'YES' }
  ],
  products: [
    { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: "nextval('products_id_seq'::regclass)" },
    { column_name: 'name', data_type: 'character varying', is_nullable: 'NO', character_maximum_length: 255 },
    { column_name: 'description', data_type: 'text', is_nullable: 'YES' },
    { column_name: 'price', data_type: 'numeric', is_nullable: 'NO' },
    { column_name: 'category_id', data_type: 'integer', is_nullable: 'YES' },
    { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO' }
  ]
};

const mockPrimaryKeys = {
  users: ['id'],
  products: ['id'],
  orders: ['id'],
  order_items: ['id'],
  categories: ['id']
};

// Mock data for query results
const mockData = {
  users: [
    { id: 1, name: 'John Doe', email: 'john@example.com', created_at: '2023-01-01T12:00:00Z' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', created_at: '2023-01-02T12:00:00Z' }
  ],
  products: [
    { id: 1, name: 'Product 1', description: 'Description 1', price: 19.99, category_id: 1, created_at: '2023-01-01T12:00:00Z' },
    { id: 2, name: 'Product 2', description: 'Description 2', price: 29.99, category_id: 2, created_at: '2023-01-02T12:00:00Z' }
  ]
};

// Test database connection on startup
async function testConnection() {
  if (MOCK_MODE) {
    console.error('Running in mock mode - no actual database connection');
    return true;
  }

  try {
    const client = await pool.connect();
    console.error('Successfully connected to PostgreSQL database');
    client.release();
    return true;
  } catch (error) {
    console.error('Error connecting to PostgreSQL database:', error.message);
    return false;
  }
}

// Handle SQL query execution
async function executeQuery(sql, params = []) {
  if (MOCK_MODE) {
    console.error('Mock query execution:', sql);
    
    // Simple mock query handling based on query content
    if (sql.toLowerCase().includes('select') && sql.toLowerCase().includes('from users')) {
      return {
        rows: mockData.users,
        rowCount: mockData.users.length,
      };
    } else if (sql.toLowerCase().includes('select') && sql.toLowerCase().includes('from products')) {
      return {
        rows: mockData.products,
        rowCount: mockData.products.length,
      };
    } else {
      // Generic response for other queries
      return {
        rows: [],
        rowCount: 0,
      };
    }
  }
  
  try {
    const result = await pool.query(sql, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount,
    };
  } catch (error) {
    throw new Error(`SQL error: ${error.message}`);
  }
}

// Get a list of tables in the database
async function getTables(schema = 'public') {
  if (MOCK_MODE) {
    console.error('Mock getTables for schema:', schema);
    return {
      tables: mockTables,
      count: mockTables.length,
    };
  }
  
  try {
    const sql = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1
      ORDER BY table_name;
    `;
    
    const result = await pool.query(sql, [schema]);
    
    return {
      tables: result.rows.map(row => row.table_name),
      count: result.rowCount,
    };
  } catch (error) {
    throw new Error(`Error getting tables: ${error.message}`);
  }
}

// Get schema definition for a table
async function getTableSchema(table, schema = 'public') {
  if (MOCK_MODE) {
    console.error('Mock getTableSchema for table:', table);
    
    if (!mockSchemas[table]) {
      throw new Error(`Table '${table}' not found in schema '${schema}'`);
    }
    
    return {
      table,
      schema,
      columns: mockSchemas[table],
      primaryKeys: mockPrimaryKeys[table] || [],
    };
  }
  
  try {
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
      throw new Error(`Table '${table}' not found in schema '${schema}'`);
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
    
    return {
      table,
      schema,
      columns: result.rows,
      primaryKeys,
    };
  } catch (error) {
    throw new Error(`Error getting table schema: ${error.message}`);
  }
}

// Insert a record into a table
async function insertRecord(table, data, schema = 'public', returning = []) {
  if (MOCK_MODE) {
    console.error('Mock insertRecord for table:', table, 'with data:', data);
    
    // Create a mock returning result if requested
    let returningResult;
    if (returning.length > 0) {
      returningResult = [{ ...data, id: Math.floor(Math.random() * 1000) }];
    }
    
    return {
      success: true,
      rowCount: 1,
      returning: returningResult,
    };
  }
  
  try {
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
    
    return {
      success: true,
      rowCount: result.rowCount,
      returning: returning.length > 0 ? result.rows : undefined,
    };
  } catch (error) {
    throw new Error(`Error inserting record: ${error.message}`);
  }
}

// Update records in a table
async function updateRecord(table, data, conditions, schema = 'public', returning = []) {
  if (MOCK_MODE) {
    console.error('Mock updateRecord for table:', table, 'with data:', data, 'and conditions:', conditions);
    
    // Create a mock returning result if requested
    let returningResult;
    if (returning.length > 0) {
      returningResult = [{ ...data, ...conditions }];
    }
    
    return {
      success: true,
      rowCount: 1,
      returning: returningResult,
    };
  }
  
  try {
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
    
    return {
      success: true,
      rowCount: result.rowCount,
      returning: returning.length > 0 ? result.rows : undefined,
    };
  } catch (error) {
    throw new Error(`Error updating record: ${error.message}`);
  }
}

// Delete records from a table
async function deleteRecord(table, conditions, schema = 'public', returning = []) {
  if (MOCK_MODE) {
    console.error('Mock deleteRecord for table:', table, 'with conditions:', conditions);
    
    // Create a mock returning result if requested
    let returningResult;
    if (returning.length > 0) {
      returningResult = [{ ...conditions, id: 1 }];
    }
    
    return {
      success: true,
      rowCount: 1,
      returning: returningResult,
    };
  }
  
  try {
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
    
    return {
      success: true,
      rowCount: result.rowCount,
      returning: returning.length > 0 ? result.rows : undefined,
    };
  } catch (error) {
    throw new Error(`Error deleting record: ${error.message}`);
  }
}

// Process incoming requests
async function processRequest(request) {
  try {
    const { method, params, id } = request;
    
    if (method !== 'callTool') {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'Method not found'
        },
        id
      };
    }
    
    const { name, arguments: args } = params;
    let result;
    
    switch (name) {
      case 'query':
        result = await executeQuery(args.sql, args.params);
        break;
      case 'get_tables':
        result = await getTables(args.schema);
        break;
      case 'get_table_schema':
        result = await getTableSchema(args.table, args.schema);
        break;
      case 'insert_record':
        result = await insertRecord(args.table, args.data, args.schema, args.returning);
        break;
      case 'update_record':
        result = await updateRecord(args.table, args.data, args.conditions, args.schema, args.returning);
        break;
      case 'delete_record':
        result = await deleteRecord(args.table, args.conditions, args.schema, args.returning);
        break;
      default:
        return {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Unknown tool: ${name}`
          },
          id
        };
    }
    
    return {
      jsonrpc: '2.0',
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      },
      id
    };
  } catch (error) {
    return {
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: error.message
      },
      id: request.id
    };
  }
}

// Handle line-delimited JSON-RPC requests
rl.on('line', async (line) => {
  try {
    const request = JSON.parse(line);
    const response = await processRequest(request);
    console.log(JSON.stringify(response));
  } catch (error) {
    console.error('Error processing request:', error);
    const errorResponse = {
      jsonrpc: '2.0',
      error: {
        code: -32700,
        message: 'Parse error'
      },
      id: null
    };
    console.log(JSON.stringify(errorResponse));
  }
});

// Start the server
async function main() {
  const connectionSuccess = await testConnection();
  if (!connectionSuccess) {
    process.exit(1);
  }
  
  console.error('PostgreSQL Simple MCP server running on stdio');
  
  // List available tools for reference
  console.error('Available tools:');
  console.error('- query: Execute SQL query');
  console.error('- get_tables: List tables in database');
  console.error('- get_table_schema: Get table schema');
  console.error('- insert_record: Insert a record');
  console.error('- update_record: Update a record');
  console.error('- delete_record: Delete a record');
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('Shutting down...');
  await pool.end();
  process.exit(0);
});

// Run the server
main().catch(error => {
  console.error('Error starting server:', error);
  process.exit(1);
});
