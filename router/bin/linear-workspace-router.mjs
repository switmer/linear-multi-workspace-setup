#!/usr/bin/env node

import { main } from "../src/index.mjs";

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = error.exitCode ?? 1;
});
