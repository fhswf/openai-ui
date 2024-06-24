import { defineConfig } from "cypress";
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  defaultCommandTimeout: 10000, // Timeout in Millisekunden (hier 10 Sekunden)
  video: true,
  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
  env: {
    "CYPRESS_USER_NAME": process.env.CYPRESS_USER_NAME,
    "CYPRESS_USER_PASSWORD": process.env.CYPRESS_USER_PASSWORD,
    "TESTENV":  process.env.TESTENV
  }
});
