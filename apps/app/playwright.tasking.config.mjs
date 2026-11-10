import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./e2e/tasking',workers:1,fullyParallel:false,timeout:30000,
 use:{browserName:process.env.TASKING_BROWSER||'chromium',baseURL:'http://127.0.0.1:8816',trace:'retain-on-failure',serviceWorkers:'block'},
 webServer:[{command:'npm run dev:e2e:tasking',cwd:'../..',url:'http://127.0.0.1:8816/healthz',reuseExistingServer:false,timeout:120000},{command:'npm run dev:e2e:tasking-move',cwd:'../..',url:'http://127.0.0.1:8817/healthz',reuseExistingServer:false,timeout:120000}],
});
