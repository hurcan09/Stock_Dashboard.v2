import { copyFile, mkdir } from 'node:fs/promises';
// Publish the tested V6 bundle shipped in this release with explicit ESM semantics.
await mkdir('build-v6', {recursive:true});
await copyFile('v6/dist/server/index.js', 'build-v6/app.mjs');
console.log('Ege Envanter V6 paketi hazır.');
