const NS='http://www.w3.org/2000/svg';
function svgNode(tag,attributes={},text){const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attributes))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;}
export function metricChart(title,history,key,{percent=true}={}){
 const root=document.createElement('section');root.className='chart-panel';const heading=document.createElement('h3');heading.textContent=title;root.append(heading);
 const scopes=[...new Set(history.filter(p=>Number.isFinite(p[key])).map(p=>p.scope))];
 const palette=['#315f4a','#546f91','#997b4d','#8b7496'];
 const series=scopes.map((scope,i)=>({scope,color:palette[i%palette.length],points:history.filter(p=>p.scope===scope&&Number.isFinite(p[key])).sort((a,b)=>a.step-b.step)}));
 if(!series.length){const p=document.createElement('p');p.textContent='No measured points reported yet.';p.className='muted small';root.append(p);return root;}
 const all=series.flatMap(s=>s.points),maxX=Math.max(1,...all.map(p=>p.step)),maxY=percent?1:Math.max(.1,...all.map(p=>p[key]))*1.1;
 const svg=svgNode('svg',{viewBox:'0 0 560 225',role:'img','aria-label':title+' by optimizer update'});
 for(let i=0;i<=4;i++){
  const y=185-i*40;svg.append(svgNode('line',{x1:43,y1:y,x2:545,y2:y,stroke:'#e3e5dc'}));
  svg.append(svgNode('text',{x:1,y:y+4},percent?`${i*25}%`:(maxY*i/4).toFixed(2)));
 }
 for(let i=0;i<=3;i++){const value=Math.round(maxX*i/3);svg.append(svgNode('text',{x:43+i*502/3,y:205,'text-anchor':i===0?'start':i===3?'end':'middle'},value.toLocaleString()));}
 for(const s of series){
  const coords=s.points.map(p=>[43+p.step/maxX*502,185-p[key]/maxY*160]);
  svg.append(svgNode('polyline',{points:coords.map(p=>p.join(',')).join(' '),fill:'none',stroke:s.color,'stroke-width':1.8}));
  s.points.forEach((p,i)=>{const circle=svgNode('circle',{cx:coords[i][0],cy:coords[i][1],r:3,fill:s.color,tabindex:0});circle.append(svgNode('title',{},`${s.scope} · update ${p.step.toLocaleString()} · ${percent?(p[key]*100).toFixed(2)+'%':p[key].toFixed(4)}`));svg.append(circle);});
 }
 root.append(svg);const legend=document.createElement('div');legend.className='chart-legend';
 series.forEach((s,i)=>{const label=document.createElement('span');label.className=i===0?'series-source':'series-external';label.textContent=s.scope.replaceAll('_',' ');legend.append(label);});root.append(legend);return root;
}
