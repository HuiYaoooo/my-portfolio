import { cpSync, copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv[2])throw new Error('Pass the existing portfolio repository path.');
const repository=path.resolve(process.argv[2]);
if(!existsSync(path.join(repository,'CNAME')))throw new Error('Expected the existing domain repository.');
const client=path.join(root,'dist/client');
if(!existsSync(path.join(client,'index.html')))throw new Error('Build the confirmed source before staging.');
const files=['index.html','.nojekyll','botanical-src'];
copyFileSync(path.join(client,'index.html'),path.join(repository,'index.html'));
mkdirSync(path.join(repository,'assets'),{recursive:true});
for(const name of readdirSync(path.join(client,'assets'))){
  cpSync(path.join(client,'assets',name),path.join(repository,'assets',name),{recursive:true});
  files.push(`assets/${name}`);
}
writeFileSync(path.join(repository,'.nojekyll'),'');

// Retain reproducible source without QA captures, private instructions or
// inspiration/reference images. Existing PDFs, demos and photographs are kept.
const source=path.join(repository,'botanical-src');mkdirSync(source,{recursive:true});
if(source!==root){
for(const name of ['src','package.json','package-lock.json','index.html','vite.config.js','vite.config.mjs','worker','scripts','tests']){
  if(existsSync(path.join(root,name)))cpSync(path.join(root,name),path.join(source,name),{recursive:true});
}
mkdirSync(path.join(source,'public'),{recursive:true});
cpSync(path.join(root,'public/assets'),path.join(source,'public/assets'),{recursive:true});
mkdirSync(path.join(source,'.openai'),{recursive:true});
copyFileSync(path.join(root,'.openai/hosting.json'),path.join(source,'.openai/hosting.json'));
}
writeFileSync(path.join(source,'.gitignore'),'node_modules/\ndist/\n');
writeFileSync(path.join(source,'README.md'),`# Hui Yao portfolio source\n\nThe live site uses GitHub Pages from the main branch at the repository root.\n\nBuild with npm ci and npm run build in this directory. Stage the build with node scripts/stage-github-release.mjs .., review the exact files listed in release-files.json, then commit and push through the existing repository.\n\nKeep root CNAME, assets (including all photography variants and PDFs), hihi-demo and mood-demo. The model uses procedural materials only; never project artwork onto its surfaces.\n`);
mkdirSync(path.join(root,'qa'),{recursive:true});
writeFileSync(path.join(root,'qa/release-files.json'),JSON.stringify(files,null,2));
console.log(`Prepared ${files.length} release paths; existing site assets were not removed.`);
