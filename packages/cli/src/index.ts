#!/usr/bin/env node --experimental-strip-types
import { Command } from "commander";
import { migrate } from "./commands/migrate.ts";

const program = new Command();

program
  .name("plasticine")
  .description("CLI for managing Plasticine CMS")
  .version("0.0.1");

program
  .command("migrate")
  .description("Run schema migrations on content files")
  .option("-c, --config <path>", "Path to plasticine.config.ts", "./plasticine.config.ts")
  .option("-d, --content <path>", "Path to content directory", "./content")
  .option("--dry-run", "Show what would be migrated without making changes")
  .action(migrate);

program.parse();
