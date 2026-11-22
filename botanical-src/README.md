# Hui Yao portfolio source

The live site uses GitHub Pages from the main branch at the repository root.

Build with npm ci and npm run build in this directory. Before building a fresh source checkout, run python3 scripts/prepare-pdf-pages.py (requires pypdf) to create the inline reader assets from the original PDFs in ../assets. All encoded page streams are verified unchanged; the original PDF files stay intact. Stage the build with node scripts/stage-github-release.mjs .., review the exact files listed in release-files.json, then commit and push through the existing repository.

Keep root CNAME, assets (including all photography variants and PDFs), hihi-demo and mood-demo. The model uses procedural materials only; never project artwork onto its surfaces.
