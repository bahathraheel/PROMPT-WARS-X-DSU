const path = require('path');

module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/frontend/'],
  testEnvironment: 'node',
  forceExit: true,
  detectOpenHandles: true,
  collectCoverage: false,
  verbose: true,
  modulePaths: [path.resolve(__dirname, 'node_modules')],
};
