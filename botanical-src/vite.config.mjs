import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Development reuses existing, unchanged PDFs and demo assets. Production keeps
// these at the same paths in the existing GitHub Pages repository.
const legacyCandidates=[fileURLToPath(new URL('../',import.meta.url)),fileURLToPath(new URL('../../portfolio-site/',import.meta.url))];
const legacyRoot=legacyCandidates.find(root=>existsSync(path.join(root,'CNAME'))&&existsSync(path.join(root,'assets')))||legacyCandidates[1];
const projectAssetRoot=fileURLToPath(new URL('./project-assets/',import.meta.url));
const legacyAssets={
  name:'portfolio-existing-assets',
  configureServer(server){
    server.middlewares.use((req,res,next)=>{
      let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return next();}
      const prefix=['/assets/','/hihi-demo/','/mood-demo/'].find(value=>pathname.startsWith(value));
      if(!prefix||!['GET','HEAD'].includes(req.method))return next();
      const assetRoot=existsSync(path.resolve(projectAssetRoot,'.'+pathname))?projectAssetRoot:legacyRoot;
      const allowed=path.resolve(assetRoot,prefix.slice(1));
      let filename=path.resolve(assetRoot,'.'+pathname);
      if(filename!==allowed&&!filename.startsWith(allowed+path.sep))return next();
      if(!existsSync(filename))return next();
      if(statSync(filename).isDirectory())filename=path.join(filename,'index.html');
      if(!existsSync(filename))return next();
      const size=statSync(filename).size;
      const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.pdf':'application/pdf','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2'};
      res.setHeader('Content-Type',types[path.extname(filename)]||'application/octet-stream');
      res.setHeader('Accept-Ranges','bytes');res.setHeader('Cache-Control','no-cache');
      let start=0,end=size-1;
      if(req.headers.range){
        const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if(!range){res.statusCode=416;res.end();return;}
        start=range[1]?Number(range[1]):Math.max(0,size-Number(range[2]));
        end=range[1]&&range[2]?Math.min(size-1,Number(range[2])):size-1;
        if(start>end||start>=size){res.statusCode=416;res.setHeader('Content-Range',`bytes */${size}`);res.end();return;}
        res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);
      }
      res.setHeader('Content-Length',end-start+1);
      if(req.method==='HEAD'){res.end();return;}
      createReadStream(filename,{start,end}).on('error',()=>res.destroy()).pipe(res);
    });
  },
};
const projectAssets={
  name:'portfolio-new-project-assets',
  closeBundle(){
    cpSync(path.join(projectAssetRoot,'assets'),fileURLToPath(new URL('./dist/client/assets/',import.meta.url)),{recursive:true});
  },
};

export default defineConfig({
  build: {
    outDir: "dist/client",
    rollupOptions:{output:{assetFileNames:asset=>{
      const name=asset.names?.[0]||asset.name||'';
      return name==='pdf.worker.min.mjs'?'assets/[name]-[hash].js':'assets/[name]-[hash][extname]';
    }}},
  },
  optimizeDeps: {
    include: ["react", "react-dom/client", "pdfjs-dist"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    proxy:{'/mood-demo':{target:'https://yaohui.me',changeOrigin:true}},
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [legacyAssets,projectAssets,react()],
});
