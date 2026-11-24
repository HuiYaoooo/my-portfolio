import * as THREE from 'three';
import {Pass, FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import upstreamShader from '../vendor/cosmos-museum/pegasus.frag?raw';

// Pegasus by Frank Hugenroth; Three.js adaptation by Sebastián Vasquez.
// The original cloud/star algorithm is vendored unchanged; see SOURCE.md.
export function createGalaxyDepth({camera,depthTexture,mobile=false}={}){
  const group=new THREE.Group();group.name='Cosmos Museum full-screen Pegasus sky';
  const framing={center:mobile?[.36,.53]:[.465,.5],scale:mobile?.68:.74};
  const stats={provider:'CosmosMuseum/galaxy',rendering:'raymarch',fullscreen:true,palette:'blue-violet',coreExposure:1,outerExposure:.55,center:framing.center,scale:framing.scale,mistPreservation:true,phase:0,readingMix:0,visibility:1,renderWidth:0,renderHeight:0,renderedFrames:0};
  group.userData=stats;
  // The demo's timed fade/glow envelope ends after150s. Continuous portfolio
  // playback keeps only that envelope steady, retaining its original renderer.
  const fragmentShader=upstreamShader
    .replace('uniform float uCamRoll;','uniform float uCamRoll;\n    uniform vec2 uViewOffset;\n    uniform float uViewScale;')
    // Reframe the original camera rays, rather than shrinking a bitmap or
    // exposing the edges of an offset texture. The starfield stays full-screen.
    .replace('vec2 xy = -1.0 + 2.0*fragCoord.xy / iResolution.xy;','vec2 xy = (-1.0 + 2.0*fragCoord.xy / iResolution.xy - uViewOffset) / uViewScale;')
    .replace(/float fade = [^\n]+/,'float fade = 1.;')
    .replace(/float fade2= [^\n]+/,'float fade2= 0.;')
    .replace(/float glow = [^\n]+/,'float glow = 1.;')
    .replace(/vec3\(0\.6,\s*0\.3,\s*0\.6\)/g,'vec3(0.30, 0.38, 0.82)')
    .replace(/vec3\(0\.6,\s*0\.0,\s*0\.0\)/g,'vec3(0.12, 0.08, 0.36)')
    // Carry the shader's own galactic radius in alpha, so the warm luminous
    // core can keep its original exposure while the surrounding sky stays dim.
    .replace('fragColor = vec4(col,1.0);','fragColor = vec4(col,1.0-smoothstep(.06,.40,radius));');
  const skyUniforms={iTime:{value:20},iResolution:{value:new THREE.Vector2(1,1)},uCamPos:{value:new THREE.Vector3(500,850,1800)},uCamTarget:{value:new THREE.Vector3()},uCamRoll:{value:.34},uViewOffset:{value:new THREE.Vector2()},uViewScale:{value:framing.scale}};
  const skyMaterial=new THREE.ShaderMaterial({uniforms:skyUniforms,fragmentShader,vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.NoBlending});
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,stencilBuffer:false});
  target.texture.name='Original Cosmos Museum galaxy';
  const skyQuad=new FullScreenQuad(skyMaterial);
  const uniforms={tDiffuse:{value:null},tGalaxy:{value:target.texture},tDepth:{value:depthTexture},uVisibility:{value:.9},uSkyCover:{value:new THREE.Vector2(1,1)},uQuietRect:{value:new THREE.Vector4(-2,-2,-1,-1)},uQuietFeather:{value:new THREE.Vector2(.02,.02)},uSubjectCenter:{value:new THREE.Vector2(.5,.5)},uSubjectRadius:{value:new THREE.Vector2(mobile?.37:.23,.48)}};
  const compositeMaterial=new THREE.ShaderMaterial({
    uniforms,depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.NoBlending,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`
      #include <packing>
      varying vec2 vUv;
      uniform sampler2D tDiffuse,tGalaxy,tDepth;
      uniform float uVisibility;
      uniform vec4 uQuietRect;
      uniform vec2 uQuietFeather;
      uniform vec2 uSkyCover;
      uniform vec2 uSubjectCenter,uSubjectRadius;
      void main(){
        vec4 foreground=texture2D(tDiffuse,vUv);
        vec2 skyUv=(vUv-.5)*uSkyCover+.5;
        vec4 galaxy=texture2D(tGalaxy,skyUv);
        vec3 sky=max(galaxy.rgb,vec3(0.))*mix(.55,1.,galaxy.a);
        float depth=unpackRGBAToDepth(texture2D(tDepth,vUv));
        float background=step(.99999,depth);
        vec2 quietCenter=(uQuietRect.xy+uQuietRect.zw)*.5;
        vec2 quietRadius=(uQuietRect.zw-uQuietRect.xy)*.5+uQuietFeather*2.;
        vec2 quietPosition=(vUv-quietCenter)/quietRadius;
        float quiet=1.-.45*exp(-dot(quietPosition,quietPosition)*1.2);
        // Keep the original C-stage mist/light wells visible around the
        // specimen, ahead of this distant sky. Wide soft falloff has no border.
        vec2 subjectPosition=(vUv-uSubjectCenter)/uSubjectRadius;
        float mistWindow=exp(-dot(subjectPosition,subjectPosition)*1.5);
        float skyThroughMist=1.-.68*mistWindow;
        vec3 colour=mix(foreground.rgb,max(foreground.rgb,sky),background*uVisibility*quiet*skyThroughMist);
        gl_FragColor=vec4(colour,foreground.a);
      }`,
  });
  const compositeQuad=new FullScreenQuad(compositeMaterial);
  let phase=0,readingMix=0,disposed=false,lastDraw=-Infinity,lastPhase=-1,hasFrame=false;
  const lastPosition=new THREE.Vector3(Infinity,Infinity,Infinity);
  const lastOffset=new THREE.Vector2(Infinity,Infinity);
  const subjectPoint=new THREE.Vector3();
  class CosmosPass extends Pass{
    constructor(){super();this.needsSwap=true;}
    render(renderer,writeBuffer,readBuffer){
      if(disposed)return;
      const oldTarget=renderer.getRenderTarget(),oldAutoClear=renderer.autoClear;
      const width=readBuffer.width,height=readBuffer.height;
      const aspect=width/height;
      uniforms.uSkyCover.value.set(Math.min(1,aspect/1.6),Math.min(1,1.6/aspect));
      skyUniforms.uViewOffset.value.set((framing.center[0]-.5)*2*uniforms.uSkyCover.value.x,(framing.center[1]-.5)*2*uniforms.uSkyCover.value.y);
      // Render near native display size instead of enlarging the former
      // 650k/300k sky. Cache the expensive raymarch; all 3D motion stays live.
      const scale=Math.min(1,(mobile?1440:2048)/Math.max(width,height),Math.sqrt((mobile?800000:2000000)/(width*height)));
      const renderWidth=Math.max(1,Math.floor(width*scale)),renderHeight=Math.max(1,Math.floor(height*scale));
      if(target.width!==renderWidth||target.height!==renderHeight){target.setSize(renderWidth,renderHeight);hasFrame=false;}
      skyUniforms.iResolution.value.set(renderWidth,renderHeight);
      stats.renderWidth=renderWidth;stats.renderHeight=renderHeight;
      const now=performance.now(),changed=phase!==lastPhase||lastPosition.distanceToSquared(skyUniforms.uCamPos.value)>.0001||lastOffset.distanceToSquared(skyUniforms.uViewOffset.value)>.0000001;
      try{
        renderer.autoClear=false;
        if(!hasFrame||(changed&&now-lastDraw>=1000/(mobile?20:24))){
          renderer.setRenderTarget(target);skyQuad.render(renderer);
          lastDraw=now;lastPhase=phase;lastPosition.copy(skyUniforms.uCamPos.value);lastOffset.copy(skyUniforms.uViewOffset.value);hasFrame=true;stats.renderedFrames++;
        }
        uniforms.tDiffuse.value=readBuffer.texture;
        renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);
        compositeQuad.render(renderer);
      }finally{renderer.autoClear=oldAutoClear;renderer.setRenderTarget(oldTarget);}
    }
    dispose(){dispose();}
  }
  const pass=new CosmosPass();pass.name='Selected Cosmos Museum Galaxy Shader';
  function update(_time,delta=0,{playing=true,reading=false,subjectScale=1}={}){
    if(disposed)return;
    const dt=Math.min(.12,Math.max(0,delta));
    if(playing)phase+=dt;
    readingMix=THREE.MathUtils.lerp(readingMix,reading?1:0,1-Math.exp(-dt*4));
    skyUniforms.iTime.value=20+phase*.35;
    skyUniforms.uCamPos.value.set(500+(camera.position.x-.25)*38,850+(camera.position.y-4.65)*38,1800);
    subjectPoint.set(0,4.1*subjectScale,0).project(camera);
    uniforms.uSubjectCenter.value.set(subjectPoint.x*.5+.5,subjectPoint.y*.5+.5);
    framing.center[0]=uniforms.uSubjectCenter.value.x;
    framing.center[1]=uniforms.uSubjectCenter.value.y;
    uniforms.uVisibility.value=.9*(1-readingMix*.8);
    stats.phase=phase;stats.readingMix=readingMix;stats.visibility=uniforms.uVisibility.value;
  }
  function setQuietRect(rect){
    if(!rect||!(rect.width>0&&rect.height>0)){uniforms.uQuietRect.value.set(-2,-2,-1,-1);return;}
    const {left,top,right,bottom,width,height}=rect;
    uniforms.uQuietRect.value.set(left/width,1-bottom/height,right/width,1-top/height);
    uniforms.uQuietFeather.value.set(20/width,20/height);
  }
  function dispose(){
    if(disposed)return;disposed=true;pass.enabled=false;
    target.dispose();skyMaterial.dispose();compositeMaterial.dispose();skyQuad.dispose();compositeQuad.dispose();group.clear();
  }
  return {pass,group,update,setQuietRect,dispose,stats};
}
