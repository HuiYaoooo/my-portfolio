// Package the existing published journal frontend without duplicating shared art.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(path.join(source, 'index.html'))) {
  throw new Error('Pass the existing mood journal dist/client directory.');
}
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(project, 'mood-demo');
const html = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
const bundles = [...html.matchAll(/(?:src|href)="\/(assets\/[^" ]+\.(?:js|css))"/g)].map(match => match[1]);
if (bundles.length !== 2) throw new Error('Expected the original JS and CSS bundles.');
const content = bundles.map(file => fs.readFileSync(path.join(source, file), 'utf8'));
const references = new Set(content.flatMap(text => [...text.matchAll(/\/assets\/[A-Za-z0-9_./-]+/g)].map(match => match[0])));
const replacements = new Map();
let copied = 0, shared = 0;
for (const reference of references) {
  const relative = reference.slice(1);
  if (relative.includes('..')) throw new Error('Invalid asset path');
  const bytes = fs.readFileSync(path.join(source, relative));
  const existing = path.join(project, 'hihi-demo', relative);
  if (fs.existsSync(existing) && fs.readFileSync(existing).equals(bytes)) {
    replacements.set(reference, '/hihi-demo/' + relative);
    shared += 1;
  } else {
    const output = path.join(destination, relative);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(path.join(source, relative), output);
    replacements.set(reference, '/mood-demo/' + relative);
    copied += 1;
  }
}
bundles.forEach((file, index) => {
  const output = path.join(destination, file);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, content[index].replace(/\/assets\/[A-Za-z0-9_./-]+/g, reference => replacements.get(reference)));
});
console.log(`Packaged original journal bundles; ${shared} identical assets reused and ${copied} original assets copied.`);
