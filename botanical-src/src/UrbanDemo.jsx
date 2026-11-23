import { useEffect, useState } from 'react';
import screens from './content/urban-ui.json';
import { useLanguage } from './i18n.jsx';

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

const screenLabelsZh=['北京开场','登录','动物友好社区','长耳鸮的故事','社区个人主页','装置地图','选择预约项目','关于雨燕','预约详情','预约成功'];
const hotspotLabelsZh={'Enter Urban Wildlife':'进入城市野生动物回归计划','Sign in to the preview':'登录预览','Open community profile':'打开社区个人主页','Read the owl story':'阅读长耳鸮的故事','Open device map':'打开装置地图','Choose a habitat activity':'选择栖息地活动','Back to the community':'返回社区','Explore a habitat activity':'探索栖息地活动','Back to the map':'返回地图','Choose a swift habitat activity':'选择雨燕栖息地活动','Back to activities':'返回活动列表','Continue to appointment details':'查看预约详情','Back to the activity':'返回活动','Confirm the preview appointment':'确认预览预约','Return to the community':'返回社区'};

export function UrbanDemo(){
  const {t}=useLanguage();
  const [screen,setScreen]=useState(0);
  const item=screens[screen];
  useEffect(()=>{
    // Warm only the next original screen; retain the native PNG pixels.
    const next=new Image();next.decoding='async';next.src=screens[(screen+1)%screens.length].src;
  },[screen]);
  const move=direction=>setScreen(value=>(value+direction+screens.length)%screens.length);
  return <section className="urban-inline-demo" aria-label={t("Urban Wildlife interactive preview","城市野生动物回归计划交互预览")}>
    <div className="urban-inline-phone">
      <div className="urban-inline-screen">
        <img src={item.src} alt={t(item.label,screenLabelsZh[screen])} width="786" height="1704" decoding="async" fetchPriority="high" />
        {paths[screen].map(([left,top,width,height,target,label])=><button key={label} type="button" aria-label={t(label,hotspotLabelsZh[label]||label)} onClick={()=>setScreen(target)} style={{left:`${left}%`,top:`${top}%`,width:`${width}%`,height:`${height}%`}} />)}
      </div>
      <img className="urban-inline-bezel" src="/assets/iphone/Bezel.png" alt="" aria-hidden="true" />
    </div>
    <div className="urban-inline-controls">
      <button type="button" onClick={()=>move(-1)} aria-label={t("Previous app screen","上一张应用页面")}>←</button>
      <span aria-live="polite">{String(screen+1).padStart(2,'0')} / {screens.length}<small>{t(item.label,screenLabelsZh[screen])}</small></span>
      <button type="button" onClick={()=>move(1)} aria-label={t("Next app screen","下一张应用页面")}>→</button>
    </div>
  </section>;
}
