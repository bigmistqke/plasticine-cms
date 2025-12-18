import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";

interface MigrateOptions {
  config: string;
  content: string;
  dryRun?: boolean;
}

interface CollectionConfig {
  name: string;
  schema: {
    parse: (value: unknown) => unknown;
  };
  filenameField?: string;
}

interface CMSConfig {
  collections: Record<string, CollectionConfig>;
}

export async function migrate(options: MigrateOptions) {
  const configPath = resolve(options.config);
  const contentPath = resolve(options.content);

  console.log(`Loading config from: ${configPath}`);
  console.log(`Content directory: ${contentPath}`);
  console.log(`Dry run: ${options.dryRun ? "yes" : "no"}`);
  console.log("");

  // Dynamically import the config
  let config: CMSConfig;
  try {
    const module = await import(configPath);
    config = module.cmsConfig;
    if (!config) {
      console.error("Error: cmsConfig not found in config file");
      process.exit(1);
    }
  } catch (err) {
    console.error(`Error loading config: ${err}`);
    process.exit(1);
  }

  let totalFiles = 0;
  let migratedFiles = 0;
  let errorFiles = 0;

  // Process each collection
  for (const [collectionKey, collectionConfig] of Object.entries(config.collections)) {
    const collectionPath = join(contentPath, collectionKey);

    console.log(`\n📁 Collection: ${collectionConfig.name} (${collectionKey})`);

    if (!existsSync(collectionPath)) {
      console.log(`   Directory doesn't exist, skipping`);
      continue;
    }

    // Read all JSON files in the collection
    const files = await readdir(collectionPath);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    if (jsonFiles.length === 0) {
      console.log(`   No JSON files found`);
      continue;
    }

    for (const filename of jsonFiles) {
      const filePath = join(collectionPath, filename);
      totalFiles++;

      try {
        // Read original content
        const content = await readFile(filePath, "utf-8");
        const original = JSON.parse(content);

        // Parse through versioned schema (auto-migrates)
        const migrated = collectionConfig.schema.parse(original);

        // Check if data changed
        const originalStr = JSON.stringify(original, null, 2);
        const migratedStr = JSON.stringify(migrated, null, 2);

        if (originalStr !== migratedStr) {
          migratedFiles++;
          console.log(`   ✨ ${filename} - migrated`);

          if (!options.dryRun) {
            await writeFile(filePath, migratedStr, "utf-8");
          }
        } else {
          console.log(`   ✓ ${filename} - up to date`);
        }
      } catch (err) {
        errorFiles++;
        console.log(`   ✗ ${filename} - error: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log(`Total files: ${totalFiles}`);
  console.log(`Migrated: ${migratedFiles}`);
  console.log(`Errors: ${errorFiles}`);
  console.log(`Up to date: ${totalFiles - migratedFiles - errorFiles}`);

  if (options.dryRun && migratedFiles > 0) {
    console.log("\n⚠️  Dry run - no files were actually modified");
    console.log("   Run without --dry-run to apply changes");
  }
}
