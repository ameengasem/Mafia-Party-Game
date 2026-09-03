import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.join(projectDir, '..', 'dist', 'public');
const destinationDir = path.join(projectDir, '..', 'android', 'app', 'src', 'main', 'assets', 'www');

await rm(destinationDir, { recursive: true, force: true });
await mkdir(destinationDir, { recursive: true });
await cp(sourceDir, destinationDir, { recursive: true });
console.log(`Copied Android web assets to ${destinationDir}`);