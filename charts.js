const NS='http://www.w3.org/2000/svg';
function svgNode(tag,attributes={},text){const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attributes))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;}
export function metricChart(title,history,key,{percent=true}={}){
 const root=document.createElement('section');root.className='chart-panel';const heading=document.createElement('h3');heading.textContent=title;root.append(heading);
 const scopes=[...new Set(history.filter(p=>Number.isFinite(p[key])).map(p=>p.scope))];
 const palette=['var(--green)','var(--blue)','var(--amber)','#8b7496'];
 const series=scopes.map((scope,i)=>({scope,color:palette[i%palette.length],points:history.filter(p=>p.scope===scope&&Number.isFinite(p[key])).sort((a,b)=>a.step-b.step)}));
 if(!series.length){const p=document.createElement('p');p.textContent='No measured points reported yet.';p.className='muted small';root.append(p);return root;}
 const all=series.flatMap(s=>s.points),maxX=Math.max(1,...all.map(p=>p.step)),maxY=percent?1:Math.max(.1,...all.map(p=>p[key]))*1.1;
 const svg=svgNode('svg',{viewBox:'0 0 560 225',role:'img','aria-label':title+' by optimizer update'});
 for(let i=0;i<=4;i++){
  const y=185-i*40;svg.append(svgNode('line',{x1:43,y1:y,x2:545,y2:y,stroke:'var(--line)'}));
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

export function pairedCorrelation(records,key,protocol){
 const pairs=records.filter(s=>s.validation_scenario===protocol&&Number.isFinite(s[key])&&Number.isFinite(s.public_score));
 if(pairs.length<3)return {n:pairs.length,r:null};
 const mx=pairs.reduce((a,s)=>a+s[key],0)/pairs.length,my=pairs.reduce((a,s)=>a+s.public_score,0)/pairs.length;
 const xx=pairs.reduce((a,s)=>a+(s[key]-mx)**2,0),yy=pairs.reduce((a,s)=>a+(s.public_score-my)**2,0);
 return {n:pairs.length,r:xx>1e-20&&yy>1e-20?pairs.reduce((a,s)=>a+(s[key]-mx)*(s.public_score-my),0)/Math.sqrt(xx*yy):null};
}
export function submissionCharts(records){
 const root=document.createElement('section');root.className='submission-charts';
 const controls=document.createElement('div');controls.className='feature-controls';
 const label=(name,select)=>{const l=document.createElement('label');l.textContent=name;l.append(select);return l;};
 const metric=document.createElement('select');metric.setAttribute('aria-label','Local score for comparison');
 for(const [value,name]of [['local_validation','Local validation'],['local_oof','Local OOF']]){const o=document.createElement('option');o.value=value;o.textContent=name;metric.append(o);}
 const protocol=document.createElement('select');protocol.setAttribute('aria-label','Validation protocol');
 const groups=[...new Set(records.filter(s=>Number.isFinite(s.public_score)).map(s=>s.validation_scenario||'Unspecified'))];
 for(const value of ['',...groups]){const o=document.createElement('option');o.value=value;o.textContent=value||'All protocols · descriptive only';protocol.append(o);}
 controls.append(label('Compare public LB with',metric),label('Validation protocol',protocol));
 const summary=document.createElement('p');summary.className='small muted';
 const plots=document.createElement('div');plots.className='charts';root.append(controls,summary,plots);
 const draw=()=>{
  const key=metric.value,chosen=protocol.value,rows=records.filter(s=>!chosen||(s.validation_scenario||'Unspecified')===chosen).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.submission_id&&b.submission_id?Number(a.submission_id)-Number(b.submission_id):a.id.localeCompare(b.id)));
  const paired=rows.filter(s=>Number.isFinite(s[key])&&Number.isFinite(s.public_score));
  const stat=chosen?pairedCorrelation(rows,key,chosen==='Unspecified'?undefined:chosen):null;
  summary.textContent=!chosen?'Lines show the recorded scores. Select one validation protocol for a meaningful paired correlation.':`${paired.length} matched local/public pairs · ${stat.r===null?'Pearson r unavailable (needs ≥3 pairs and variation)':`Pearson r = ${stat.r.toFixed(3)}`} · correlation is descriptive, not a guarantee for future submissions.`;
  const panel=(title,aria)=>{const p=document.createElement('section');p.className='chart-panel';const h=document.createElement('h3');h.textContent=title;const svg=svgNode('svg',{viewBox:'0 0 560 260',role:'img','aria-label':aria});p.append(h,svg);plots.append(p);return {p,svg};};
  plots.replaceChildren();const line=panel('Local and public scores over submissions','Line chart of local scores and public leaderboard scores');
  const all=rows.flatMap(s=>[s[key],s.public_score]).filter(Number.isFinite),low=Math.max(0,Math.floor((Math.min(.3,...all)-.03)*10)/10),high=Math.min(1,Math.max(.7,...all)+.03);
  const X=i=>48+i*490/Math.max(1,rows.length-1),Y=v=>210-(v-low)/(high-low)*180;
  for(let i=0;i<=4;i++){const v=low+(high-low)*i/4,y=Y(v);line.svg.append(svgNode('line',{x1:48,x2:540,y1:y,y2:y,stroke:'var(--line)'}),svgNode('text',{x:0,y:y+4},(v*100).toFixed(0)+'%'));}
  for(const [field,color,name]of [[key,'var(--blue)','Local'],['public_score','var(--green)','Public LB']]){
   let segment=[];const flush=()=>{if(segment.length)line.svg.append(svgNode('polyline',{points:segment.join(' '),fill:'none',stroke:color,'stroke-width':2}));segment=[];};
   rows.forEach((s,i)=>{if(!Number.isFinite(s[field])){flush();return;}segment.push(`${X(i)},${Y(s[field])}`);});flush();
   rows.forEach((s,i)=>{if(!Number.isFinite(s[field]))return;const c=svgNode('circle',{cx:X(i),cy:Y(s[field]),r:4,fill:color,tabindex:0});c.append(svgNode('title',{},`${s.date} · ${s.title} · ${name} ${(s[field]*100).toFixed(2)}% · ${s.validation_scenario||'Unspecified protocol'}`));line.svg.append(c);});
  }
  rows.forEach((s,i)=>line.svg.append(svgNode('text',{x:X(i),y:230,'text-anchor':'middle'},String(i+1))));line.svg.append(svgNode('text',{x:280,y:253,'text-anchor':'middle'},'Submission order · hover points for date and candidate'));
  const legend=document.createElement('p');legend.className='small muted';legend.textContent='Blue: local score · Green: public LB · Missing scores leave gaps.';line.p.append(legend);
  const scatter=panel('Does local validation predict public LB?','Scatter plot of local score versus public leaderboard score');
  const vals=paired.flatMap(s=>[s[key],s.public_score]),min=Math.max(0,Math.min(.3,...vals)-.03),max=Math.min(1,Math.max(.7,...vals)+.03),sx=v=>55+(v-min)/(max-min)*475,sy=v=>210-(v-min)/(max-min)*180;
  scatter.svg.append(svgNode('line',{x1:55,y1:210,x2:530,y2:30,stroke:'var(--muted)','stroke-dasharray':'4 4'}));
  for(let i=0;i<=4;i++){const v=min+(max-min)*i/4;scatter.svg.append(svgNode('text',{x:sx(v),y:230,'text-anchor':'middle'},(v*100).toFixed(0)+'%'),svgNode('text',{x:0,y:sy(v)+4},(v*100).toFixed(0)+'%'));}
  paired.forEach(s=>{const c=svgNode('circle',{cx:sx(s[key]),cy:sy(s.public_score),r:5,fill:'var(--green)',tabindex:0});c.append(svgNode('title',{},`${s.title} · Local ${(s[key]*100).toFixed(2)}% · Public ${(s.public_score*100).toFixed(2)}%`));scatter.svg.append(c);});
  scatter.svg.append(svgNode('text',{x:280,y:253,'text-anchor':'middle'},'Local score → · Public LB ↑ · dashed line: equal scores'));
 };
 metric.onchange=draw;protocol.onchange=draw;draw();return root;
}
