#!/usr/bin/env node
import { main } from "../src/cli.mjs";

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(`keyword-gap: ${err && err.message ? err.message : err}`);
    process.exitCode = 1;
  }
);
