# Hui Yao portfolio source

The live site uses GitHub Pages from the main branch at the repository root.

Build with npm ci and npm run build in this directory. The seven works include the Philippines group project and BabyLM poster. Their unchanged delivery assets and normalized, lossless PDF pages are retained in project-assets; existing assets, original PDFs, photography and demos stay at the repository root. If regenerating the original readers, run python3 scripts/prepare-pdf-pages.py (requires pypdf). Stage the build with node scripts/stage-github-release.mjs .. and review qa/release-files.json before committing and pushing.

Keep root CNAME, assets (including all photography variants and PDFs), hihi-demo and mood-demo. The model uses procedural materials only; never project artwork onto its surfaces. Geist Sans is locally hosted under SIL OFL 1.1; source and license records are in src/fonts/geist. Galaxy source and adaptation attribution are recorded in src/vendor/cosmos-museum/SOURCE.md and shown at the bottom of Contact.
