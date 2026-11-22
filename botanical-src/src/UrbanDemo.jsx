import { useState } from 'react';
import screens from './content/urban-ui.json';

// Hotspots follow the author's original screens; artwork is never redrawn.
const paths=[
  [[0,0,100,100,1,'Enter Urban Wildlife']],
  [[28,76,48,18,2,'Sign in to the preview']],
  [[77,4,22,15,4,'Open community profile'],[3,27,47,44,3,'Read the owl story'],[0,86,26,14,5,'Open device map'],[37,82,26,18,6,'Choose a habitat activity']],
  [[0,0,20,15,2,'Back to the community']],
  [[0,0,22,15,2,'Back to the community']],
  [[0,0,24,15,2,'Back to the community'],[12,20,80,70,6,'Explore a habitat activity']],
  [[0,0,22,14,5,'Back to the map'],[12,23,76,72,7,'Choose a swift habitat activity']],
  [[0,0,22,14,6,'Back to activities'],[20,78,70,20,8,'Continue to appointment details']],
  [[0,0,22,14,7,'Back to the activity'],[14,77,75,22,9,'Confirm the preview appointment']],
  [[0,0,100,100,2,'Return to the community']],
];

export function UrbanDemo(){
  const [screen,setScreen]=useState(0);
  const item=screens[screen];
  const move=direction=>setScreen(value=>(value+direction+screens.length)%screens.length);
  return <section className="urban-inline-demo" aria-label="Urban Wildlife interactive preview">
    <div className="urban-inline-phone">
      <div className="urban-inline-screen">
        <img src={item.src} alt={item.label} width="390" height="844" decoding="async" />
        {paths[screen].map(([left,top,width,height,target,label])=><button key={label} type="button" aria-label={label} onClick={()=>setScreen(target)} style={{left:`${left}%`,top:`${top}%`,width:`${width}%`,height:`${height}%`}} />)}
      </div>
      <img className="urban-inline-bezel" src="/assets/iphone/Bezel.png" alt="" aria-hidden="true" />
    </div>
    <div className="urban-inline-controls">
      <button type="button" onClick={()=>move(-1)} aria-label="Previous app screen">←</button>
      <span aria-live="polite">{String(screen+1).padStart(2,'0')} / {screens.length}<small>{item.label}</small></span>
      <button type="button" onClick={()=>move(1)} aria-label="Next app screen">→</button>
    </div>
  </section>;
}
