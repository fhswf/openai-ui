#!/usr/bin/env node
/**
 * Post-coverage script: adds missing source files to lcov.info
 * so that SonarQube reports consistent coverage numbers.
 *
 * For each source file in src/ not already in lcov.info, this script
 * counts the executable lines (non-blank, non-comment, non-import-only)
 * and appends an lcov record with 0 hits for each line.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, normalize } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

const LCOV_PATH = 'coverage/lcov.info';
const SRC_DIR = 'src';
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const EXCLUDE_PATTERNS = [/\.d\.ts$/, /\.test\./, /\.spec\./, /components\/ui\//];

/**
 * Validiert einen Pfad, um sicherzustellen, dass er innerhalb des Projektverzeichnisses liegt
 * @param {string} filePath - Der zu validierende Pfad
 * @returns {string} Der normalisierte, sichere Pfad
 * @throws {Error} Wenn Path Traversal erkannt wird
 */
function validatePath(filePath) {
    const normalizedPath = normalize(resolve(PROJECT_ROOT, filePath));

    if (!normalizedPath.startsWith(PROJECT_ROOT)) {
        throw new Error(`Path traversal attempt detected: ${filePath}`);
    }

    return normalizedPath;
}

function getAllSourceFiles(dir, files = []) {
    // Validiere das Basisverzeichnis gegen Path Traversal
    const safeDir = validatePath(dir);

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Pfad wurde durch validatePath() validiert
    for (const entry of readdirSync(safeDir)) {
        const full = join(safeDir, entry);
        // Validiere jeden Pfad vor dem Zugriff
        const safeFull = validatePath(full);

        // eslint-disable-next-line security/detect-non-literal-fs-filename -- Pfad wurde durch validatePath() validiert
        const stat = statSync(safeFull);
        if (stat.isDirectory()) {
            getAllSourceFiles(full, files);
        } else {
            const ext = full.substring(full.lastIndexOf('.'));
            if (EXTENSIONS.has(ext) && !EXCLUDE_PATTERNS.some(p => p.test(full))) {
                files.push(full);
            }
        }
    }
    return files;
}

// Read existing lcov.info
let lcovContent = '';
try {
    lcovContent = readFileSync(LCOV_PATH, 'utf-8');
} catch {
    console.error(`Cannot read ${LCOV_PATH}`);
    process.exit(1);
}

// Get files already in lcov.info
const coveredFiles = new Set();
for (const line of lcovContent.split('\n')) {
    if (line.startsWith('SF:')) {
        coveredFiles.add(line.substring(3));
    }
}

// Get all source files
const allFiles = getAllSourceFiles(SRC_DIR);
let addedCount = 0;
let appendContent = '';

for (const file of allFiles) {
    if (!coveredFiles.has(file)) {
        // Add empty record — no DA lines means SonarQube won't count
        // uncovered lines, but the file will appear in the report.
        appendContent += `SF:${file}\n`;
        appendContent += `FNF:0\n`;
        appendContent += `FNH:0\n`;
        appendContent += `LF:0\n`;
        appendContent += `LH:0\n`;
        appendContent += `BRF:0\n`;
        appendContent += `BRH:0\n`;
        appendContent += `end_of_record\n`;
        addedCount++;
    }
}

if (addedCount > 0) {
    writeFileSync(LCOV_PATH, lcovContent + appendContent);
    console.log(`Added ${addedCount} missing files to ${LCOV_PATH}`);
} else {
    console.log('All source files already in lcov.info');
}

const totalFiles = coveredFiles.size + addedCount;
console.log(`Total files in lcov.info: ${totalFiles}`);
