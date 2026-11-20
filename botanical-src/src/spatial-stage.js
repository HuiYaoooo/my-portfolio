import * as ThreeModule from 'three';

const noiseGLSL = `
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*noise2(p);p=mat2(1.6,1.2,-1.2,1.6)*p;a*=.5;}return s;}`;

/** Three mutually exclusive, genuinely separated world-space environments. */
export function createSpatialStage({ THREE = ThreeModule, uniforms = {}, mobile = false } = {}) {
  const group = new THREE.Group();
  group.name = 'Spatial studies — gallery / foreground / mist';
  const variantGroups = Object.fromEntries(['gallery','foreground','mist'].map(key => {
    const variant = new THREE.Group();
    variant.name = `Spatial variant — ${key}`;
    group.add(variant);
    return [key,variant];
  }));
  const foreground = new THREE.Group();
  foreground.name = 'Opaque near-camera curves';
  variantGroups.foreground.add(foreground);

  const geometries = new Set();
  const materials = new Set();
  const animations = [];
  const clock = uniforms.uTime || { value: 0 };
  const ownGeometry = value => { geometries.add(value); return value; };
  const ownMaterial = value => { materials.add(value); return value; };
  const vector = point => new THREE.Vector3(...point);

  function material(color, roughness=.65, metalness=.25) {
    return ownMaterial(new THREE.MeshStandardMaterial({
      color,roughness,metalness,side:THREE.DoubleSide,
      emissive:0x020611,emissiveIntensity:.16,
    }));
  }
  const deepStone = material(0x101c31,.65,.24);
  const nearMetal = material(0x0a1322,.44,.43);
  const backMetal = material(0x0b192b,.70,.18);
  const edgeLine = ownMaterial(new THREE.LineBasicMaterial({
    color:0x7899c6,transparent:true,opacity:.18,depthWrite:false,
  }));
  const floorLine = ownMaterial(new THREE.LineBasicMaterial({
    color:0x466d9c,transparent:true,opacity:.14,depthWrite:false,
  }));

  function box(parent,width,height,depth,x,y,z,mat=deepStone,rotation=0) {
    const mesh = new THREE.Mesh(ownGeometry(new THREE.BoxGeometry(width,height,depth)),mat);
    mesh.position.set(x,y,z);
    mesh.rotation.y=rotation;
    parent.add(mesh);
    return mesh;
  }
  function line(parent,points,mat=floorLine) {
    const mesh = new THREE.Line(ownGeometry(new THREE.BufferGeometry().setFromPoints(points.map(vector))),mat);
    parent.add(mesh);
    return mesh;
  }
  function curve(parent,points,radius,mat=nearMetal) {
    const path = new THREE.CatmullRomCurve3(points.map(vector));
    const mesh = new THREE.Mesh(ownGeometry(new THREE.TubeGeometry(path,mobile?42:70,radius,mobile?10:16,false)),mat);
    parent.add(mesh);
    return mesh;
  }

  // Ground pools are actual XZ surfaces. Their long footprint shrinks in
  // perspective and therefore remains useful even with depth of field disabled.
  function groundPool(parent,x,z,width,depth,strength,seed=0) {
    const mat = ownMaterial(new THREE.ShaderMaterial({
      uniforms:{uTime:clock,uStrength:{value:strength},uSeed:{value:seed}},
      vertexShader:'varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;varying vec3 vWorld;uniform float uTime;uniform float uStrength;uniform float uSeed;${noiseGLSL}
        void main(){vec2 p=(vUv-.5)*2.;float falloff=exp(-p.x*p.x*3.7-p.y*p.y*2.7);float edge=smoothstep(0.,.18,vUv.x)*smoothstep(0.,.18,1.-vUv.x)*smoothstep(0.,.15,vUv.y)*smoothstep(0.,.15,1.-vUv.y);float flow=.8+.2*fbm(vWorld.xz*.3+vec2(uTime*.009,uSeed));gl_FragColor=vec4(vec3(.023,.059,.12),falloff*edge*uStrength*flow);}`,
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    }));
    const mesh = new THREE.Mesh(ownGeometry(new THREE.PlaneGeometry(width,depth)),mat);
    mesh.rotation.x=-Math.PI/2;
    mesh.position.set(x,.003,z);
    parent.add(mesh);
    return mesh;
  }

  function lightVeil(parent,{x,y,z,width,height,opacity=.2,seed=0,tilt=0}) {
    const mat = ownMaterial(new THREE.ShaderMaterial({
      uniforms:{uTime:clock,uOpacity:{value:opacity},uSeed:{value:seed}},
      vertexShader:'varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;varying vec3 vWorld;uniform float uTime;uniform float uOpacity;uniform float uSeed;${noiseGLSL}
        void main(){vec2 p=vUv-.5;float core=exp(-p.x*p.x*24.);float vertical=pow(max(0.,1.-abs(p.y)*2.),1.7);float grain=.68+.32*fbm(vWorld.xy*.31+vec2(uTime*.006,uSeed));float breathe=.95+.05*sin(uTime*.11+uSeed);gl_FragColor=vec4(vec3(.035,.09,.22),core*vertical*grain*uOpacity*breathe);}`,
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    }));
    const mesh = new THREE.Mesh(ownGeometry(new THREE.PlaneGeometry(width,height)),mat);
    mesh.position.set(x,y,z);
    mesh.rotation.z=tilt;
    parent.add(mesh);
    return mesh;
  }

  // A — deep gallery. Five narrow opaque forms at staggered distances create
  // clear occlusion and perspective; their widths stay subordinate to the vine.
  const gallery = variantGroups.gallery;
  const piers = [
    [-5.4,-4.8,8.7,.32,.58,.18],
    [-5.8,-12.5,11.5,.42,.72,-.13],
    [-4.4,-23.0,15.2,.55,.88,.16],
    [5.8,-10.0,10.7,.28,.54,-.22],
    [7.6,-25.0,17.5,.54,.91,.12],
  ];
  piers.forEach(([x,z,height,width,depth,rotation],index) => {
    if(mobile && (index===1 || index===4))return;
    const mesh=box(gallery,width,height,depth,x,height/2,z,deepStone,rotation);
    mesh.name=`Gallery pier — depth ${z}`;
    // One fine lit edge, rather than a full luminous rectangle.
    line(gallery,[[x-width*.51,.05,z+depth*.51],[x-width*.51,height*.97,z+depth*.51]],edgeLine);
  });
  line(gallery,[[-12,.007,-3.0],[-4.1,.007,-3.0]]);
  line(gallery,[[3.9,.007,-10.5],[14,.007,-10.5]]);
  line(gallery,[[-11,.007,-21.0],[-3.8,.007,-21.0]]);
  line(gallery,[[-6.5,.007,-1.8],[-3.4,.007,-24.0]]);
  groundPool(gallery,-2.6,-7.5,10,23,.17,1);
  lightVeil(gallery,{x:-5.5,y:5.3,z:-14.5,width:3.8,height:14,opacity:.26,seed:1});
  lightVeil(gallery,{x:7.1,y:7.8,z:-27,width:6.8,height:20,opacity:.23,seed:3});

  // B — a photographed, near-framed view. These close objects are opaque meshes
  // so the depth prepass measures them; a sprite would not supply the same cues.
  const nearLeft=curve(foreground,[[-6.2,-.5,6.2],[-4.5,.8,7.0],[-3.9,2.8,7.05],[-4.02,5.2,7.1],[-4.8,7.1,6.7],[-6.4,8.4,6.2]],.16);
  nearLeft.name='Near left dark curve';
  const nearRight=curve(foreground,[[6.0,-2.4,6.3],[4.7,-.4,7.2],[4.15,.8,7.5],[4.75,2.0,7.35],[6.15,2.7,6.8]],.14);
  nearRight.name='Near right dark curve';
  animations.push({object:nearLeft,axis:'x',base:0,amplitude:.025,speed:.08,seed:0});
  animations.push({object:nearRight,axis:'x',base:0,amplitude:.025,speed:.07,seed:2});
  const framed=variantGroups.foreground;
  curve(framed,[[-9.5,0,-15.5],[-8.2,4,-16.5],[-7.1,9,-15.9],[-7.9,14,-15.2]],.075,backMetal);
  curve(framed,[[8.6,0,-20],[7.4,5,-20.8],[7.8,11,-20.2]],.10,backMetal);
  groundPool(framed,.3,-1.5,7.5,12,.11,2);
  lightVeil(framed,{x:-7.8,y:6.0,z:-18.5,width:5,height:17,opacity:.22,seed:5});

  // C — an open light well. The drifting fields inhabit distinct world-space
  // planes; lateral camera movement therefore reveals their differing depths.
  const mist=variantGroups.mist;
  const fogConfig=[
    {x:-2.5,y:3.5,z:-6.5,w:16,h:29,opacity:.12,seed:0},
    {x:4.0,y:5.0,z:-12.5,w:25,h:36,opacity:.20,seed:2.4},
    {x:-5.0,y:5.5,z:-20.5,w:34,h:42,opacity:.25,seed:5.7},
    {x:3.5,y:6.5,z:-28.0,w:43,h:50,opacity:.31,seed:8.9},
  ];
  fogConfig.forEach((config,index)=>{
    if(mobile && index===1)return;
    const mat=ownMaterial(new THREE.ShaderMaterial({
      uniforms:{uTime:clock,uOpacity:{value:config.opacity},uSeed:{value:config.seed}},
      vertexShader:'varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;varying vec3 vWorld;uniform float uTime;uniform float uOpacity;uniform float uSeed;${noiseGLSL}
        void main(){vec2 p=vWorld.xy*vec2(.17,.22)+vec2(uSeed*.31,uTime*.008);float base=fbm(p);float billow=fbm(p*1.8+base*2.+vec2(-uTime*.006,uSeed));float density=smoothstep(.30,.77,billow)*(.6+.4*base);vec2 edge=vUv*(1.-vUv);float envelope=smoothstep(0.,.07,edge.x)*smoothstep(0.,.13,edge.y);float valley=.7+.3*sin(vWorld.y*.20+uSeed);gl_FragColor=vec4(vec3(.025,.070,.16),density*envelope*valley*uOpacity);}`,
      transparent:true,depthWrite:false,side:THREE.DoubleSide,
    }));
    const mesh=new THREE.Mesh(ownGeometry(new THREE.PlaneGeometry(config.w,config.h)),mat);
    mesh.name=`World mist layer ${index+1} — depth ${config.z}`;
    mesh.position.set(config.x,config.y,config.z);
    mesh.rotation.y=index%2===0?.10:-.08;
    mist.add(mesh);
    animations.push({object:mesh,axis:'x',base:config.x,amplitude:.13,speed:.035,seed:config.seed});
  });
  lightVeil(mist,{x:-5.7,y:8.0,z:-23.0,width:7.7,height:26,opacity:.55,seed:4,tilt:-.43});
  lightVeil(mist,{x:4.6,y:7.0,z:-14.0,width:4.3,height:21,opacity:.27,seed:7,tilt:-.38});
  lightVeil(mist,{x:-1.3,y:5.5,z:-7.0,width:2.5,height:13,opacity:.12,seed:9,tilt:-.35});
  groundPool(mist,1.3,-3.0,12,23,.13,5);
  groundPool(mist,-3.4,-13.5,18,29,.12,8);

  let activeVariant='gallery';
  function setVariant(key){
    activeVariant=Object.hasOwn(variantGroups,key)?key:'gallery';
    Object.entries(variantGroups).forEach(([name,variant])=>{variant.visible=name===activeVariant;});
  }
  setVariant('gallery');
  function update(time){
    clock.value=time;
    for(const item of animations){
      item.object.position[item.axis]=item.base+Math.sin(time*item.speed+item.seed)*item.amplitude;
    }
  }
  function dispose(){
    geometries.forEach(geometry=>geometry.dispose());
    materials.forEach(mat=>mat.dispose());
  }
  return {group,foreground,variantGroups,setVariant,update,dispose};
}
