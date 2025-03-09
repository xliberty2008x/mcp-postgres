#!/usr/bin/env node
const axios = require('axios');

// Base URL for the MCP bridge service
const BASE_URL = 'http://localhost:3000';

// Helper function to call the MCP API
async function callMcpApi(toolName, args) {
  try {
    const response = await axios.post(`${BASE_URL}/api/mcp`, {
      jsonrpc: '2.0',
      method: 'callTool',
      params: {
        name: toolName,
        arguments: args
      },
      id: Date.now().toString()
    });
    
    return response.data;
  } catch (error) {
    console.error('API call error:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Test functions for each MCP tool
async function testGetTables() {
  console.log('\n--- Testing get_tables ---');
  const result = await callMcpApi('get_tables', {});
  console.log('Tables in database:');
  console.log(JSON.parse(result.result.content[0].text).tables);
  return result;
}

async function testGetTableSchema() {
  console.log('\n--- Testing get_table_schema ---');
  const result = await callMcpApi('get_table_schema', { table: 'users' });
  console.log('Users table schema:');
  console.log(JSON.parse(result.result.content[0].text));
  return result;
}

async function testQuery() {
  console.log('\n--- Testing query ---');
  const result = await callMcpApi('query', { sql: 'SELECT * FROM users' });
  console.log('Query results:');
  console.log(JSON.parse(result.result.content[0].text).rows);
  return result;
}

async function testInsertRecord() {
  console.log('\n--- Testing insert_record ---');
  const result = await callMcpApi('insert_record', {
    table: 'users',
    data: {
      name: 'Test User',
      email: 'test@example.com',
      created_at: new Date().toISOString()
    },
    returning: ['id', 'name', 'email']
  });
  console.log('Insert result:');
  console.log(JSON.parse(result.result.content[0].text));
  return result;
}

async function testUpdateRecord() {
  console.log('\n--- Testing update_record ---');
  const result = await callMcpApi('update_record', {
    table: 'users',
    data: {
      email: 'updated@example.com',
      updated_at: new Date().toISOString()
    },
    conditions: {
      id: 1
    },
    returning: ['id', 'name', 'email', 'updated_at']
  });
  console.log('Update result:');
  console.log(JSON.parse(result.result.content[0].text));
  return result;
}

async function testDeleteRecord() {
  console.log('\n--- Testing delete_record ---');
  const result = await callMcpApi('delete_record', {
    table: 'users',
    conditions: {
      id: 2
    },
    returning: ['id', 'name', 'email']
  });
  console.log('Delete result:');
  console.log(JSON.parse(result.result.content[0].text));
  return result;
}

async function runAllTests() {
  console.log('Starting API tests for PostgreSQL MCP server...');
  
  try {
    // Test the health endpoint
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('Health check response:', healthResponse.data);
    
    // Run all the tool tests
    await testGetTables();
    await testGetTableSchema();
    await testQuery();
    await testInsertRecord();
    await testUpdateRecord();
    await testDeleteRecord();
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run all tests
runAllTests();
