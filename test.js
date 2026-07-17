import { readFileSync } from 'fs';
import { resolve } from 'path';

const blueprint = JSON.parse(readFileSync(resolve(__dirname, 'firebase-blueprint.json'), 'utf-8'));
console.log(blueprint);
