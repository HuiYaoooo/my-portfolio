# Cosmos Museum Galaxy source

Selected by the user for the independent portfolio preview on 2026-11-24.

- Repository: https://github.com/CosmosMuseum/cosmos-museum-galaxy
- Repository revision inspected: d8b67c90d5601ecff6b84201fa69db63474ad052
- Original shader: **Pegasus Galaxy**, Frank Hugenroth (frankenburgh), Nordlicht 2015
- Original shader link: https://www.shadertoy.com/view/lty3Rt
- Three.js adaptation: **Sebastián Vasquez / CosmosMuseum**
- Official demo: https://cosmos-museum-galaxy.vercel.app/

`main.upstream.js` is the unmodified retrieved upstream source. Its SHA-256 is
`6a6823b2c2c98bbfe5e745350593c8c248f72bd2dcbe9d08f8d8b4e125e7b557`.
`pegasus.frag` is the exact fragment-shader template extracted from that file.

The portfolio adapter imports this shader rather than recreating the effect.
Integration changes are confined to continuous playback, camera framing,
render resolution/cadence, foreground compositing, palette/exposure controls
and interface attenuation. The user requested blue-violet outer clouds and a
bright white/gold core. The adapter adjusts two nebula color constants and
carries the existing galactic radius in alpha for separate core exposure;
the upstream files and raymarching/cloud structure remain unchanged.

The latest framing update centers the original camera rays behind the projected
botanical model, retaining the reduced spiral size without scaling a bitmap
or leaving texture borders. A soft, model-centered attenuation preserves
the existing C mist/light wells ahead of the distant sky. Render budgets are
2 million pixels on desktop and 800k on phones (cached at 24/20 Hz), replacing
the previous 650k/300k upscaled sky.

Visible credits are retained at the bottom of Contact under Information,
including the original author, Three.js adapter, and repository link. The
homepage credit is removed to keep the scene uncluttered.

## License status

The upstream README describes the original shader as released under the
"Shadertoy community license". The repository has no separate LICENSE file
and does not identify a specific license version. No MIT license or commercial
clearance is asserted here. The exact original license remains unverified.
The original license remains incompletely specified by the source repository;
this record does not assert commercial clearance or a verified license version.
On 2026-11-24 the portfolio owner explicitly approved publishing the selected
integration. Original source files, the adaptation description and authorship
credits are retained; Contact links back to the upstream project.
