// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  use: { baseURL: 'http://localhost:5173', headless: true },
  timeout: 120000,
  reporter: 'list',
});
