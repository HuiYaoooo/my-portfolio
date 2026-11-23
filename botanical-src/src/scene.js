import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { createMorningGlory } from './flower-model.js';
import { createSpatialStage } from './spatial-stage.js';

const noiseGLSL = `
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*noise2(p);p=mat2(1.6,1.2,-1.2,1.6)*p;a*=.5;}return s;}`;

function botanicalMaterial(kind, uniforms) {
  const options = {
    petal: { color: 0x6684ea, roughness: .42, metalness: .13, emissive: 0x060d2a },
    leaf: { color: 0x7c9494, roughness: .57, metalness: .2, emissive: 0x020810 },
    stem: { color: 0x789196, roughness: .47, metalness: .35 },
    pot: { color: 0x101d34, roughness: .25, metalness: .64 },
    detail: { color: 0xc6d5b9, roughness: .43, metalness: .25 },
  };
  const material = new THREE.MeshStandardMaterial({ ...options[kind], side: THREE.DoubleSide });
  material.userData.baseRoughness=material.roughness;
  material.userData.baseMetalness=material.metalness;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\nvarying vec3 vBotanicalWorld;varying vec3 vBotanicalNormal;varying vec2 vBotanicalUv;`)
      .replace('#include <project_vertex>', `vBotanicalWorld=(modelMatrix*vec4(transformed,1.)).xyz;vBotanicalNormal=normalize(mat3(modelMatrix)*normal);vBotanicalUv=uv;\n#include <project_vertex>`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n
      varying vec3 vBotanicalWorld;varying vec3 vBotanicalNormal;varying vec2 vBotanicalUv;
      uniform float uTime;uniform float uSpectral;uniform vec3 uAccent;
      uniform float uIridescence;uniform float uFlow;uniform float uRipple;
      uniform vec3 uTouch;uniform float uTouchTime;
      ${noiseGLSL}
      float scanBand(){float y=mod(uTime*.72,10.)-1.;return exp(-pow((vBotanicalWorld.y-y)*3.6,2.));}
      float rippleBand(){float age=mod(uTime,5.);float distanceFromTouch=length(vBotanicalWorld-uTouch);return exp(-pow((distanceFromTouch-age*1.5)*11.,2.))*exp(-age*.24);}
      float hoverBand(){float age=uTime-uTouchTime;if(age<0.||age>3.)return 0.;float distanceFromTouch=length(vBotanicalWorld-uTouch);return exp(-pow((distanceFromTouch-age*1.5)*11.,2.))*(1.-smoothstep(1.8,3.,age));}
    `).replace('#include <color_fragment>', `#include <color_fragment>\n
      vec2 buv=vBotanicalUv;float grain=noise2(buv*vec2(210.,80.));float scan=scanBand();
      ${kind === 'petal' ? `
      float radial=buv.y;float angle=buv.x*6.283185;
      float fineVein=pow(abs(cos(angle*63.+radial*3.1)),24.);
      float mainVein=pow(abs(cos(angle*2.5)),25.);
      float fold=.5+.5*cos(angle*5.+radial*.7);
      vec3 petalBlue=mix(vec3(.018,.045,.22),uAccent*.30,.3);
      vec3 tone=mix(vec3(.62,.69,.63),petalBlue,smoothstep(.18,.84,radial));
      tone=mix(tone,vec3(.42,.55,.83),mainVein*.24+fineVein*.10);
      tone*=.78+fold*.18+grain*.06;
      tone=mix(tone,tone*vec3(.8,.94,1.2),uSpectral*.45);
      diffuseColor.rgb=mix(tone,vec3(.70,.86,1.),scan*uSpectral*.64);
      ` : kind === 'leaf' ? `
      vec3 tone=mix(vec3(.055,.105,.074),vec3(.21,.32,.37),uSpectral*.82);
      tone*=.78+grain*.15;
      diffuseColor.rgb=mix(tone,vec3(.62,.80,.89),scan*uSpectral*.6);
      ` : kind === 'stem' ? `
      diffuseColor.rgb=mix(vec3(.12,.17,.11),vec3(.37,.49,.50),uSpectral*.7)+scan*uSpectral*.20;
      ` : kind === 'pot' ? `
      float pattern=pow(abs(sin(buv.x*6.283185*12.+sin(buv.y*31.)*1.8)),20.);
      float ceramic=.66+noise2(buv*vec2(80.,120.))*.30;
      diffuseColor.rgb=vec3(.045,.075,.13)*ceramic+vec3(.04,.085,.12)*pattern;
      diffuseColor.rgb+=scan*uSpectral*vec3(.12,.22,.37);
      ` : ''}
      vec3 surfaceNormal=normalize(vBotanicalNormal);
      float facing=abs(dot(surfaceNormal,normalize(cameraPosition-vBotanicalWorld)));
      float rim=pow(1.-facing,2.2);
      float film=.5+.5*sin(facing*9.+vBotanicalWorld.y*.45-uTime*.19);
      vec3 pearl=mix(vec3(.07,.16,.36),vec3(.27,.075,.30),film);
      pearl=mix(pearl,vec3(.35,.62,.60),rim*.70)+vec3(.24,.31,.43)*pow(facing,6.);
      diffuseColor.rgb=mix(diffuseColor.rgb,pearl,uIridescence*${kind === 'petal' ? '.86' : '.65'});
      diffuseColor.rgb+=(uRipple*rippleBand()+hoverBand())*vec3(.24,.47,.64);
    `).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n
      totalEmissiveRadiance+=uSpectral*(scanBand()*${kind === 'petal' ? '1.45' : '.6'}+.018)*mix(vec3(.46,.65,1.),uAccent,.35);
      ${kind === 'petal' ? `totalEmissiveRadiance+=uSpectral*.075*pow(buv.y,12.)*vec3(.40,.57,1.);` : ''}
      float flowPhase=fract(buv.y*.82-uTime*.19+vBotanicalWorld.y*.035);
      float flowFront=exp(-pow((flowPhase-.30)*18.,2.));
      ${kind === 'petal' ? `
      float flowVeins=pow(abs(cos(buv.x*6.283185*2.5)),22.)*.8+pow(abs(cos(buv.x*6.283185*25.)),65.)*.35;
      totalEmissiveRadiance+=uFlow*flowFront*flowVeins*vec3(.40,.78,1.3)*1.6;
      ` : kind === 'leaf' ? `
      float leafVein=exp(-pow((buv.x-.5)*40.,2.));
      totalEmissiveRadiance+=uFlow*flowFront*leafVein*vec3(.2,.62,.77)*1.4;
      ` : `totalEmissiveRadiance+=uFlow*pow(max(0.,sin(vBotanicalWorld.y*5.-uTime*2.)),18.)*vec3(.03,.17,.24);`}
      totalEmissiveRadiance+=(uRipple*rippleBand()+hoverBand())*vec3(.35,.74,1.2)*1.55;
      totalEmissiveRadiance+=uIridescence*rim*vec3(.07,.12,.18)*.35;
    `);
  };
  material.customProgramCacheKey = () => `botanical-${kind}`;
  return material;
}

export function createBotanicalScene(host,callbacks={}) {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile=host.clientWidth<700;
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x060b12);
  scene.fog=new THREE.FogExp2(0x060b12,.028);
  const camera=new THREE.PerspectiveCamera(40,host.clientWidth/host.clientHeight,.1,90);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.5:1.8));
  renderer.setSize(host.clientWidth,host.clientHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.22;
  renderer.domElement.setAttribute('aria-hidden','true');
  host.appendChild(renderer.domElement);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const environment=new RoomEnvironment();
  const envTarget=pmrem.fromScene(environment,.03);
  scene.environment=envTarget.texture;scene.environmentIntensity=.38;environment.dispose();
  const uniforms={uTime:{value:0},uSpectral:{value:0},uIridescence:{value:0},uFlow:{value:1},uRipple:{value:0},uTouch:{value:new THREE.Vector3(.1,4.3,.2)},uTouchTime:{value:-100},uAccent:{value:new THREE.Color('#6384ff')}};
  const materials=Object.fromEntries(['petal','leaf','stem','pot','detail'].map(kind=>[kind,botanicalMaterial(kind,uniforms)]));
  const plant=createMorningGlory({materials});
  const stage=new THREE.Group();stage.name='Morning glory specimen';stage.add(plant.group);scene.add(stage);
  const spatial=createSpatialStage({THREE,uniforms,mobile});scene.add(spatial.group);
  scene.add(new THREE.AmbientLight(0x7186b1,.55));
  const key=new THREE.DirectionalLight(0xcbdcff,1.9);key.position.set(-3,8,7);scene.add(key);
  const fill=new THREE.DirectionalLight(0x375ecb,1.6);fill.position.set(4,5,-3);scene.add(fill);
  const top=new THREE.PointLight(0x90d5ff,17,18,2);top.position.set(0,7,3);scene.add(top);
  const edge=new THREE.PointLight(0x6e67ff,24,14,2);edge.position.set(-3,3,-1);scene.add(edge);
  const reflector=new Reflector(new THREE.PlaneGeometry(120,120),{clipBias:.003,textureWidth:mobile?512:1024,textureHeight:mobile?512:1024,color:0x182535});
  reflector.material.uniforms.uOpenFloor={value:0};
  reflector.material.transparent=true;
  reflector.material.depthWrite=false;
  reflector.material.vertexShader=reflector.material.vertexShader
    .replace('varying vec4 vUv;','varying vec4 vUv;varying vec3 vFloorWorld;')
    .replace('vUv = textureMatrix * vec4( position, 1.0 );','vUv = textureMatrix * vec4( position, 1.0 );vFloorWorld=(modelMatrix*vec4(position,1.)).xyz;');
  reflector.material.fragmentShader=reflector.material.fragmentShader
    .replace('varying vec4 vUv;','varying vec4 vUv;varying vec3 vFloorWorld;uniform float uOpenFloor;')
    .replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );','gl_FragColor = vec4( blendOverlay( base.rgb, color ), mix(1.,.17*exp(-dot(vFloorWorld.xz,vFloorWorld.xz)*.16),uOpenFloor) );');
  reflector.rotation.x=-Math.PI/2;reflector.position.y=-.025;scene.add(reflector);
  const reflectColour=reflector.onBeforeRender;
  reflector.onBeforeRender=function(renderer,renderScene,...args){if(renderScene.overrideMaterial)return;reflectColour.call(this,renderer,renderScene,...args);};
  const floorMaterial=new THREE.ShaderMaterial({
    uniforms:{uTime:uniforms.uTime,uReflection:{value:.76}},transparent:true,depthWrite:false,
    vertexShader:'varying vec3 vFloor;void main(){vFloor=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 vFloor;uniform float uTime;uniform float uReflection;${noiseGLSL}void main(){float n=fbm(vFloor.xz*.18+vec2(uTime*.008,0.));float distanceFade=smoothstep(1.,25.,length(vFloor.xz));vec3 col=mix(vec3(.002,.004,.008),vec3(.0018,.0033,.006),distanceFade);col+=vec3(.001,.002,.004)*n*(1.-distanceFade);gl_FragColor=vec4(col,mix(uReflection,1.,distanceFade));}`,
  });
  const floorOverlay=new THREE.Mesh(new THREE.PlaneGeometry(120,120),floorMaterial);
  floorOverlay.rotation.x=-Math.PI/2;floorOverlay.position.y=-.021;scene.add(floorOverlay);

  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  const bokeh=new BokehPass(scene,camera,{focus:14.7,aperture:mobile?.00045:.0007,maxblur:mobile?.0035:.0045});
  bokeh.materialDepth.side=THREE.DoubleSide;
  // Keep a clear focal volume around the plant. Reject nearer samples when
  // blurring distant scenery so bright petals do not bleed into background fog.
  bokeh.materialBokeh.fragmentShader=`
    #include <common>
    #include <packing>
    varying vec2 vUv;
    uniform sampler2D tColor;uniform sampler2D tDepth;
    uniform float focus;uniform float aperture;uniform float maxblur;
    uniform float nearClip;uniform float farClip;uniform float aspect;
    float viewDepth(vec2 uv){return perspectiveDepthToViewZ(unpackRGBAToDepth(texture2D(tDepth,uv)),nearClip,farClip);}
    void main(){
      float z=viewDepth(vUv);float difference=focus+z;
      float radius=min(max(abs(difference)-2.2,0.)*aperture,maxblur);
      if(radius<.00001){gl_FragColor=texture2D(tColor,vUv);return;}
      for(int i=0;i<8;i++){
        float a=float(i)*6.283185/8.;
        vec2 edgeUv=clamp(vUv+vec2(cos(a),sin(a)*aspect)*maxblur*1.35,vec2(.001),vec2(.999));
        if(abs(focus+viewDepth(edgeUv))<2.2){gl_FragColor=texture2D(tColor,vUv);return;}
      }
      vec3 sum=texture2D(tColor,vUv).rgb;float weight=1.;
      for(int i=0;i<24;i++){
        float a=float(i)*6.283185/12.;float ring=i<12?1.:.5;
        vec2 uv=clamp(vUv+vec2(cos(a),sin(a)*aspect)*radius*ring,vec2(.001),vec2(.999));
        float sampleZ=viewDepth(uv);
        float accepted=(z < -focus-2.2 && sampleZ>z+2.5)?0.:1.;
        sum+=texture2D(tColor,uv).rgb*accepted;weight+=accepted;
      }
      gl_FragColor=vec4(sum/weight,1.);
    }`;
  // Translucent light veils should not masquerade as opaque focal surfaces.
  const renderBokeh=bokeh.render.bind(bokeh),depthExclusions=[];
  spatial.group.traverse(item=>{if(item.isSprite||(item.material?.transparent&&!item.isLine))depthExclusions.push(item);});
  bokeh.render=(...args)=>{
    const visibility=depthExclusions.map(item=>item.visible);
    const colourBackground=scene.background;
    const floorVisibility=reflector.visible;
    if(depthVariant==='mist')reflector.visible=false;
    depthExclusions.forEach(item=>{item.visible=false;});
    scene.background=null;
    try{renderBokeh(...args);}finally{reflector.visible=floorVisibility;scene.background=colourBackground;depthExclusions.forEach((item,index)=>{item.visible=visibility[index];});}
  };
  composer.addPass(bokeh);
  const bloom=new UnrealBloomPass(new THREE.Vector2(host.clientWidth,host.clientHeight),.36,.5,1.05);composer.addPass(bloom);
  const grain=new ShaderPass({
    uniforms:{tDiffuse:{value:null},time:uniforms.uTime,uAccent:uniforms.uAccent,uView:{value:new THREE.Vector2()},uDepth:{value:1},uHaze:{value:.28},uAir:{value:0},tSceneDepth:{value:null},uCameraWorld:{value:new THREE.Matrix4()},uInverseProjection:{value:new THREE.Matrix4()},uFocus:{value:14.7}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`
      #include <packing>
      uniform sampler2D tDiffuse;uniform float time;uniform vec3 uAccent;uniform vec2 uView;uniform float uDepth;uniform float uHaze;
      uniform sampler2D tSceneDepth;uniform mat4 uCameraWorld;uniform mat4 uInverseProjection;uniform float uAir;uniform float uFocus;
      varying vec2 vUv;${noiseGLSL}
      void main(){vec3 col=texture2D(tDiffuse,vUv).rgb;
      vec2 farUv=vUv+uView*.009*uDepth;
      vec2 nearUv=vUv+uView*.042*uDepth;
      float base=fbm(farUv*vec2(4.,3.)+vec2(time*.009,-time*.004));
      float vapor=fbm(nearUv*vec2(7.,4.)+base*2.7-vec2(time*.006,0.));
      float ribbons=pow(max(0.,1.-abs(vapor-base-.13)*4.),5.);
      float sideMask=smoothstep(.04,.42,abs(vUv.x-.46));
      float haze=(ribbons*.23+pow(vapor,3.)*.7)*(.3+sideMask*.7)*(1.+uDepth*.28);
      vec3 hazeColor=mix(vec3(.010,.024,.065),uAccent*.07,.15);
      col=mix(col,hazeColor,haze*uHaze);
      float groundMist=exp(-pow((vUv.y-.36)*6.,2.))*(.2+base*.3);
      col=mix(col,vec3(.003,.007,.015),groundMist*.3*uHaze);
      if(uAir>.001 && uDepth>.5){
        vec4 viewPoint=uInverseProjection*vec4(vUv*2.-1.,1.,1.);
        vec3 viewRay=normalize(viewPoint.xyz/viewPoint.w);
        vec3 worldRay=normalize((uCameraWorld*vec4(viewRay,0.)).xyz);
        vec3 origin=uCameraWorld[3].xyz;
        float sceneZ=-perspectiveDepthToViewZ(unpackRGBAToDepth(texture2D(tSceneDepth,vUv)),.1,90.);
        float rayLength=sceneZ/max(.05,-viewRay.z);
        float optical=0.;
        // Integrate low mist along the actual camera ray, ending at the opaque
        // scene surface. Ground and sky share the same air at the horizon.
        for(int i=0;i<7;i++){
          float distance=1.+float(i)*7.;
          float path=clamp(rayLength-distance,0.,7.);
          if(path>0.){
            vec3 point=origin+worldRay*(distance+path*.5);
            float layer=exp(-pow((point.y-2.)*.19,2.));
            float cloud=noise2(point.xz*.13+vec2(point.y*.12+time*.008,time*.006));
            optical+=(.065+cloud*.055)*layer*path;
          }
        }
        vec3 surface=origin+worldRay*rayLength;
        float preserveSubject=mix(1.,smoothstep(1.8,3.8,abs(sceneZ-uFocus)),smoothstep(-.3,.5,surface.y));
        float air=(1.-exp(-optical))*preserveSubject*uAir;
        col=mix(col,vec3(.006,.016,.039)*(.88+base*.25),air);
      }
      float n=hash21(vUv*2000.+fract(time*.01));col+=(n-.5)*.002;
      float vignette=1.-smoothstep(.2,.85,length((vUv-.5)*vec2(1.1,.85)));
      col*=.66+.34*vignette;gl_FragColor=vec4(col,1.);}`,
  });
  grain.uniforms.time=uniforms.uTime;grain.uniforms.uAccent=uniforms.uAccent;
  grain.uniforms.tSceneDepth.value=bokeh.renderTargetDepth.texture;
  composer.addPass(grain);composer.addPass(new OutputPass());

  let width=host.clientWidth,height=host.clientHeight,zoom=1;
  let angle=-.1,pitch=0,dragging=false,lastX=0,lastY=0;
  let pointer={x:0,y:0},playing=!reduced,disposed=false,clock=4.5,previous=performance.now(),frame;
  let spectralTarget=0,activeIndex=-1,transitionStart=-1,transitionFrom=0;
  let iridescenceTarget=0,flowTarget=1,rippleTarget=0,depthEnabled=true,currentMode='flow',lastTouch=-1;
  const depthProfiles={
    gallery:{fov:44,x:.85,y:4.9,parallax:1.05,aperture:.00055,blur:.004,haze:.28,fog:.023,reflection:.76,air:0},
    foreground:{fov:40,x:.15,y:4.15,parallax:1.25,aperture:.0026,blur:.012,haze:.20,fog:.031,reflection:.83,air:0},
    mist:{fov:48,x:.25,y:4.65,parallax:1.15,aperture:.0008,blur:.005,haze:.07,fog:.018,reflection:.70,air:.45},
  };
  let depthVariant='mist';
  const cameraProfile={...depthProfiles.mist};
  let readingTarget=0,readingMix=0,workspaceTarget=0,workspaceMix=0;
  spatial.setVariant('mist');host.dataset.depthVariant='mist';
  const accentTarget=uniforms.uAccent.value.clone();
  let firstFrame=true;
  const positionTarget=new THREE.Vector3(),projected=new THREE.Vector3();
  // Cache the approved specimen envelope once. Eight projected corners are
  // enough to keep every branch out of the reading column while it rotates.
  const specimenBox=new THREE.Box3().setFromObject(plant.group).expandByScalar(.04);
  const specimenCorners=[];
  for(const x of [specimenBox.min.x,specimenBox.max.x])for(const y of [specimenBox.min.y,specimenBox.max.y])for(const z of [specimenBox.min.z,specimenBox.max.z])specimenCorners.push(new THREE.Vector3(x,y,z));
  const boundsPoint=new THREE.Vector3();
  let readingElement=null,readingRail=null;
  const measureReadingRail=()=>{
    if(!readingElement?.isConnected){readingRail=null;return;}
    const pane=readingElement.getBoundingClientRect(),hostRect=host.getBoundingClientRect();
    readingRail={left:pane.right-hostRect.left+40,right:width-Math.max(24,width*.04),top:Math.max(100,pane.top-hostRect.top-12),bottom:Math.min(height-105,pane.bottom-hostRect.top+5)};
  };
  const readingObserver=new ResizeObserver(measureReadingRail);
  function specimenBounds(){
    stage.updateWorldMatrix(true,false);
    const bounds={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
    for(const corner of specimenCorners){
      boundsPoint.copy(corner).applyMatrix4(stage.matrixWorld).project(camera);
      const x=(boundsPoint.x*.5+.5)*width,y=(-boundsPoint.y*.5+.5)*height;
      bounds.left=Math.min(bounds.left,x);bounds.right=Math.max(bounds.right,x);bounds.top=Math.min(bounds.top,y);bounds.bottom=Math.max(bounds.bottom,y);
    }
    return bounds;
  }
  const smoothPointer=new THREE.Vector2(),raycaster=new THREE.Raycaster(),pointerNdc=new THREE.Vector2();
  const controller=new AbortController(),eventOptions={signal:controller.signal};
  function cameraPlacement(){
    const narrow=width<700;
    const selected=depthProfiles[depthVariant];
    Object.keys(selected).forEach(key=>{cameraProfile[key]=THREE.MathUtils.lerp(cameraProfile[key],selected[key],.065);});
    camera.fov=cameraProfile.fov;camera.updateProjectionMatrix();
    // Change the lens without changing the approved plant's apparent size.
    const lensScale=Math.tan(THREE.MathUtils.degToRad(20))/Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    let distance=(narrow?19.3:Math.max(14.7,12.5/(width/height)))*lensScale/zoom;
    const parallax=depthEnabled?(narrow?.45:cameraProfile.parallax):.22;
    camera.position.set((narrow?.15:cameraProfile.x)+smoothPointer.x*parallax,(narrow?4.15:cameraProfile.y)+smoothPointer.y*parallax*.34,distance);
    positionTarget.set(.15,narrow?3.65:4.13,0);camera.lookAt(positionTarget);
    readingMix=THREE.MathUtils.lerp(readingMix,readingTarget,.065);
    workspaceMix=THREE.MathUtils.lerp(workspaceMix,workspaceTarget,.065);
    camera.setViewOffset(width,height,((narrow?.1:.035)-readingMix*(narrow?.16:.30+workspaceMix*.10))*width,0,width,height);
    // Reading views share a real right-hand rail, rather than a percentage
    // nudge that lets wider branches drift back over the text. Home framing
    // and narrow-screen composition remain the approved original treatment.
    if(readingTarget&&width>=1000&&readingRail&&readingRail.right-readingRail.left>100){
      camera.clearViewOffset();camera.updateMatrixWorld();
      const railWidth=readingRail.right-readingRail.left-10,railHeight=readingRail.bottom-readingRail.top-10;
      let bounds=specimenBounds();
      for(let pass=0;pass<4;pass++){
        const ratio=Math.max((bounds.right-bounds.left)/railWidth,(bounds.bottom-bounds.top)/railHeight);
        if(ratio<=1)break;
        distance*=ratio*1.015;
        camera.position.z=distance;camera.lookAt(positionTarget);camera.updateMatrixWorld();
        bounds=specimenBounds();
      }
      const centerX=(bounds.left+bounds.right)/2,centerY=(bounds.top+bounds.bottom)/2;
      camera.setViewOffset(width,height,centerX-(readingRail.left+readingRail.right)/2,centerY-(readingRail.top+readingRail.bottom)/2,width,height);
    }
    bokeh.uniforms.focus.value=camera.position.distanceTo(positionTarget);
    bokeh.uniforms.aperture.value=cameraProfile.aperture*(narrow?.7:1);
    bokeh.uniforms.maxblur.value=cameraProfile.blur*(narrow?.7:1);
    grain.uniforms.uHaze.value=cameraProfile.haze;
    grain.uniforms.uAir.value=cameraProfile.air;
    grain.uniforms.uFocus.value=bokeh.uniforms.focus.value;
    camera.updateMatrixWorld();
    grain.uniforms.uCameraWorld.value.copy(camera.matrixWorld);
    grain.uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);
    scene.fog.density=cameraProfile.fog;
    floorMaterial.uniforms.uReflection.value=cameraProfile.reflection;
    reflector.material.uniforms.uOpenFloor.value=depthVariant==='mist'?1:0;
    floorOverlay.visible=depthVariant!=='mist';
    grain.uniforms.uView.value.copy(smoothPointer);
  }
  function resize(){width=host.clientWidth;height=host.clientHeight;camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height);composer.setSize(width,height);measureReadingRail();cameraPlacement();}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  let downX=0,downY=0,touchGesture=false,wheelDistance=0,lastNavigation=-Infinity;
  host.addEventListener('pointerdown',event=>{dragging=true;touchGesture=event.pointerType==='touch';downX=lastX=event.clientX;downY=lastY=event.clientY;host.setPointerCapture(event.pointerId);},eventOptions);
  host.addEventListener('pointermove',event=>{
    const rect=host.getBoundingClientRect();pointer.x=(event.clientX-rect.left)/width*2-1;pointer.y=-((event.clientY-rect.top)/height*2-1);
    if(dragging&&!touchGesture){angle+=(event.clientX-lastX)*.006;pitch=THREE.MathUtils.clamp(pitch+(event.clientY-lastY)*.003,-.23,.23);lastX=event.clientX;lastY=event.clientY;}
    if(playing&&performance.now()-lastTouch>150){
      pointerNdc.set(pointer.x,pointer.y);raycaster.setFromCamera(pointerNdc,camera);
      const hit=raycaster.intersectObjects(plant.flowerHeads,true)[0];
      if(hit){uniforms.uTouch.value.copy(hit.point);uniforms.uTouchTime.value=clock;lastTouch=performance.now();}
    }
  },eventOptions);
  function release(event){if(dragging&&touchGesture&&!readingTarget&&event.type==='pointerup'){const dx=event.clientX-downX,dy=event.clientY-downY;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.2)callbacks.onNavigate?.(dx<0?1:-1);}dragging=false;touchGesture=false;if(host.hasPointerCapture(event.pointerId))host.releasePointerCapture(event.pointerId);}
  host.addEventListener('pointerup',release,eventOptions);host.addEventListener('pointercancel',release,eventOptions);
  host.addEventListener('pointerleave',event=>{if(!dragging&&(!event.relatedTarget||!host.parentElement.contains(event.relatedTarget)))pointer={x:0,y:0};},eventOptions);
  host.addEventListener('wheel',event=>{if(event.ctrlKey||readingTarget)return;event.preventDefault();const now=performance.now();if(now-lastNavigation<1300)return;wheelDistance+=event.deltaY*(event.deltaMode===1?16:1);if(Math.abs(wheelDistance)>55){callbacks.onNavigate?.(Math.sign(wheelDistance));wheelDistance=0;lastNavigation=now;}},{...eventOptions,passive:false});
  host.addEventListener('keydown',event=>{if(readingTarget)return;if(event.key==='ArrowLeft'){callbacks.onNavigate?.(-1);event.preventDefault();}if(event.key==='ArrowRight'){callbacks.onNavigate?.(1);event.preventDefault();}if(event.key==='Home'){angle=-.1;pitch=0;zoom=1;event.preventDefault();}},eventOptions);
  function reportAnchors(){
    stage.updateMatrixWorld();const result={};
    for(const [name,anchor] of Object.entries(plant.anchors)){projected.copy(anchor).applyMatrix4(stage.matrixWorld).project(camera);result[name]={x:(projected.x*.5+.5)*width,y:(-.5*projected.y+.5)*height,visible:projected.z<1};}
    if(result.corolla)result.corolla.x-=12;
    if(result.vine)result.vine.x+=12;if(result.vessel)result.vessel.x+=15;
    const bounds=specimenBounds();
    host.dataset.modelBounds=JSON.stringify(Object.fromEntries(Object.entries(bounds).map(([key,value])=>[key,Math.round(value*10)/10])));
    host.dataset.readingRail=readingTarget&&width>=1000&&readingRail?JSON.stringify(readingRail):'';
    callbacks.onAnchors?.(result);
  }
  function animate(now){
    if(disposed)return;const delta=Math.min((now-previous)/1000,.04);previous=now;
    if(playing&&!document.hidden)clock+=delta;
    uniforms.uTime.value=clock;
    uniforms.uSpectral.value=THREE.MathUtils.lerp(uniforms.uSpectral.value,spectralTarget,.07);
    uniforms.uIridescence.value=THREE.MathUtils.lerp(uniforms.uIridescence.value,iridescenceTarget,.07);
    uniforms.uFlow.value=THREE.MathUtils.lerp(uniforms.uFlow.value,flowTarget,.07);
    uniforms.uRipple.value=THREE.MathUtils.lerp(uniforms.uRipple.value,rippleTarget,.07);
    uniforms.uAccent.value.lerp(accentTarget,.025);
    if(transitionStart>=0){const p=Math.min(1,(now-transitionStart)/1250);const eased=p<.5?p*p*2:1-Math.pow(-2*p+2,2)/2;stage.rotation.y=transitionFrom+eased*Math.PI*2;if(p>=1){angle=transitionFrom+Math.PI*2;transitionStart=-1;}}
    else stage.rotation.y=THREE.MathUtils.lerp(stage.rotation.y,angle+pointer.x*.065+Math.sin(clock*.17)*.045,.07);
    stage.rotation.x=THREE.MathUtils.lerp(stage.rotation.x,pitch+pointer.y*.014,.06);
    pointerNdc.set(pointer.x,pointer.y);smoothPointer.lerp(pointerNdc,.045);
    spatial.update(clock);plant.update(clock,playing?.12:0);cameraPlacement();composer.render();reportAnchors();
    if(firstFrame){firstFrame=false;callbacks.onReady?.();}frame=requestAnimationFrame(animate);
  }
  frame=requestAnimationFrame(animate);
  return {
    setMode(mode){
      currentMode=mode;spectralTarget=mode==='spectral'?.9:mode==='structure'?.3:0;
      iridescenceTarget=mode==='iridescent'?1:0;flowTarget=mode==='flow'?1:0;rippleTarget=mode==='ripple'?1:0;
      Object.entries(materials).forEach(([kind,material])=>{
        material.wireframe=mode==='structure';
        material.metalness=mode==='iridescent'?(kind==='pot'?.88:.62):material.userData.baseMetalness;
        material.roughness=mode==='iridescent'?(kind==='pot'?.16:.24):material.userData.baseRoughness;
      });
      bloom.strength=mode==='porcelain'?.16:mode==='structure'?.25:mode==='iridescent'?.28:.36;
    },
    setDepth(value){depthEnabled=value;spatial.group.visible=value;bokeh.enabled=value;grain.uniforms.uDepth.value=value?1:0;},
    setDepthVariant(value){if(!depthProfiles[value])return;depthVariant=value;spatial.setVariant(value);host.dataset.depthVariant=value;},
    setReadingMode(value,workspace=false){
      readingTarget=value?1:0;workspaceTarget=workspace?1:0;
      readingObserver.disconnect();readingElement=value?document.querySelector('.content-view'):null;
      if(readingElement)readingObserver.observe(readingElement);
      measureReadingRail();
    },
    setPlaying(value){playing=value;},
    setProject(project,index){
      accentTarget.set(project.color);if(index!==activeIndex){transitionFrom=stage.rotation.y;transitionStart=reduced?-1:performance.now();activeIndex=index;}
    },
    reset(){angle=-.1;pitch=0;zoom=1;pointer={x:0,y:0};transitionStart=-1;},
    dispose(){
      disposed=true;cancelAnimationFrame(frame);controller.abort();observer.disconnect();readingObserver.disconnect();scene.remove(spatial.group);spatial.dispose();const geometries=new Set(),materialSet=new Set();
      scene.traverse(item=>{if(item.geometry)geometries.add(item.geometry);if(item.material)(Array.isArray(item.material)?item.material:[item.material]).forEach(m=>materialSet.add(m));});
      geometries.forEach(g=>g.dispose());materialSet.forEach(m=>m.dispose());reflector.getRenderTarget().dispose();envTarget.dispose();pmrem.dispose();bokeh.dispose();bloom.dispose();grain.dispose();composer.dispose();renderer.dispose();host.replaceChildren();
    },
  };
}
