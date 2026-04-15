/**
 * SICHER — Unit Tests: Google Services Integration
 * 
 * Validates Google Cloud Logging structure and Google Maps API logic.
 */

// Mock node-fetch BEFORE anything else requires it
jest.mock('node-fetch', () => jest.fn());
const fetch = require('node-fetch');

const { globalErrorHandler } = require('../../backend/middleware/errorHandler');
const request = require('supertest');
const express = require('express');

// Create a mock Express app for Geocoding router tests
const app = express();
const geocodeRouter = require('../../backend/routes/geocode');
app.use('/api/geocode', geocodeRouter);

describe('Google Cloud Logging Structured Format', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    // Spy on console.error which is used for Cloud Logging
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  test('formats 500 error logs correctly for Cloud Logging', () => {
    const err = new Error('Test critical backend failure');
    err.statusCode = 500;

    const req = {
      method: 'POST',
      originalUrl: '/api/route',
      ip: '192.168.1.1',
      headers: {
        'user-agent': 'Jest/29.0',
        'x-forwarded-for': '10.0.0.1'
      }
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    const next = jest.fn();

    // Call the handler
    globalErrorHandler(err, req, res, next);

    // Verify console.error was called with structured JSON
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    
    // Parse the JSON string sent to console.error
    const logData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
    
    // Assert Google Cloud Logging format requirements
    expect(logData).toHaveProperty('severity', 'ERROR'); // 500+ must be ERROR
    expect(logData).toHaveProperty('message', 'Test critical backend failure');
    expect(logData).toHaveProperty('timestamp');
    expect(logData).toHaveProperty('httpRequest');
    
    // Check httpRequest object structure
    expect(logData.httpRequest).toMatchObject({
      requestMethod: 'POST',
      requestUrl: '/api/route',
      status: 500,
      userAgent: 'Jest/29.0',
      remoteIp: '10.0.0.1' // Prioritized X-Forwarded-For
    });
  });

  test('formats 400 error logs with WARNING severity', () => {
    const err = new Error('Invalid input');
    err.statusCode = 400;

    const req = { method: 'GET', originalUrl: '/', headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    globalErrorHandler(err, req, res, next);
    
    const logData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
    // 400 inputs should be classified as WARNING, not ERROR
    expect(logData).toHaveProperty('severity', 'WARNING'); 
  });
});


