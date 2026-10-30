// Shared research pages. All content and mutations go through the private API.
export function createFeatures(ctx){
 const {api,el,link,heading,prose,notice,table,metrics,integer,date,state}=ctx;
 const statuses=[['backlog','Idea'],['ready','To do'],['in_progress','In progress'],['review','Review'],['blocked','Blocked'],['done','Done']];
 const button=(title,click,primary=false)=>{const b=el('button',title,primary?'primary':'reader-button');b.type='button';b.onclick=click;return b;};
 const select=(label,options,value)=>{const field=el('label',label),s=el('select');s.setAttribute('aria-label',label);for(const [v,t]of options){const o=el('option',t);o.value=v;s.append(o);}s.value=value;field.append(s);return {field,input:s};};
 async function allIdeas(){let cursor='',items=[];do{const page=await api('/v1/ideas'+(cursor?'?cursor='+encodeURIComponent(cursor):''));items.push(...page.items);cursor=page.next_cursor;}while(cursor);return items;}
 async function ideaBoard(){
  const root=el('div');root.append(heading('Ideas & to-do.','A shared notebook for questions, plans, and findings. Open any page to read, write, or discuss it.'));
  const controls=el('div',null,'feature-controls'),search=el('input');search.type='search';search.placeholder='Find an idea or task…';search.setAttribute('aria-label','Search ideas');controls.append(search);
  if(state.viewer.can_write_ideas)controls.append(link('Write a page →','#/board/new','button-link'));root.append(controls);
  const items=(await allIdeas()).sort((a,b)=>b.updated_at.localeCompare(a.updated_at)),grid=el('div',null,'idea-board');
  const draw=()=>{grid.replaceChildren();const matching=items.filter(x=>`${x.title} ${x.markdown} ${x.author}`.toLowerCase().includes(search.value.toLowerCase()));
   for(const [name,values]of [['Ideas',['backlog']],['To do',['ready','blocked']],['In progress',['in_progress','review']],['Done',['done']]]){
    const column=el('section',null,'idea-column');const rows=matching.filter(x=>values.includes(x.status));column.append(el('h2',`${name} · ${rows.length}`));
    for(const x of rows){const card=link('',`#/board/${x.id}`,'idea-card');card.append(el('small',x.kind==='todo'?'TO-DO':'IDEA','eyebrow'),el('h3',x.title),el('p',x.markdown.replace(/[#*`>]/g,'').slice(0,150)),el('small',`${x.author} · ${date(x.updated_at)} · ${x.comments.length} replies`));column.append(card);}if(!rows.length)column.append(el('p','No pages yet.','small muted'));grid.append(column);
   }
  };search.oninput=draw;draw();root.append(grid);
  const tasks=el('details',null,'section');tasks.append(el('summary',`Agent work board · ${state.tasks.filter(t=>!t.archived&&t.status!=='done').length} open tasks`));
  for(const t of state.tasks.filter(t=>!t.archived)){const row=el('article',null,'task-item');row.append(el('h3',t.title),el('p',t.notes||''),el('small',`${t.status.replaceAll('_',' ')} · ${t.owner||'Unclaimed'}`,'muted'));tasks.append(row);}root.append(tasks);return root;
 }
 async function ideaPage(id){
  const fresh=id==='new',root=el('div');let record=fresh?{id:'idea-'+crypto.randomUUID(),title:'',markdown:'',status:'backlog',kind:'idea',revision:0,comments:[]}:await api('/v1/ideas/'+encodeURIComponent(id));
  root.append(link('← Ideas & to-do','#/board','back-link'));let header=heading(fresh?'A new page.':record.title,fresh?'Write a question, hypothesis, or plan.':`Started by ${record.author} · Last edited by ${record.updated_by} · ${date(record.updated_at)}`);root.append(header);
  const draftKey='research.draft.'+(fresh?'new':record.id);let draft;try{draft=JSON.parse(sessionStorage.getItem(draftKey)||'null');}catch{}
  const canEdit=state.viewer.can_write_ideas;
  const readView=el('div');readView.append(prose(record.markdown));root.append(readView);
  const editor=el('form',null,'idea-editor'),title=el('input'),body=el('textarea');title.required=true;title.maxLength=240;title.placeholder='Page title';title.setAttribute('aria-label','Page title');body.placeholder='Your thoughts, evidence, and next steps…\n\nMarkdown is supported.';body.maxLength=100000;body.setAttribute('aria-label','Page thoughts');
  const type=select('Page type',[['idea','Idea'],['todo','To-do']],draft?.kind||record.kind),phase=select('State',statuses,draft?.status||record.status);title.value=draft?.title??record.title;body.value=draft?.markdown??record.markdown;
  const fields=el('div',null,'feature-controls');fields.append(type.field,phase.field);const message=el('p','','small muted');message.setAttribute('role','status');const preview=el('div');preview.className='hidden';
  const toolbar=el('div',null,'feature-controls'),save=el('button',fresh?'Create page':'Save page','primary');save.type='submit';toolbar.append(save,button('Preview',()=>{preview.replaceChildren(prose(body.value));preview.classList.toggle('hidden');}),button('Read page',()=>{if(fresh)return;editor.classList.add('hidden');readView.classList.remove('hidden');}));
  editor.append(title,fields,body,toolbar,message,preview);editor.classList.toggle('hidden',!fresh&&!draft);if(fresh||draft)readView.classList.add('hidden');
  const remember=()=>{editor.dataset.dirty='true';sessionStorage.setItem(draftKey,JSON.stringify({title:title.value,markdown:body.value,kind:type.input.value,status:phase.input.value}));message.textContent='Unsaved draft kept in this browser tab.';};editor.oninput=remember;editor.onchange=remember;
  editor.onsubmit=async event=>{
   event.preventDefault();save.disabled=true;message.textContent='Saving…';
   try{
    record=await api('/v1/ideas/'+record.id,{method:'PUT',body:JSON.stringify({title:title.value.trim(),markdown:body.value,kind:type.input.value,status:phase.input.value,revision:record.revision})});
    sessionStorage.removeItem(draftKey);delete editor.dataset.dirty;message.textContent='Saved to the shared workspace.';
    if(fresh){location.hash='#/board/'+record.id;return;}
    const nextHeader=heading(record.title,`Started by ${record.author} · Last edited by ${record.updated_by} · ${date(record.updated_at)}`);header.replaceWith(nextHeader);header=nextHeader;readView.replaceChildren(prose(record.markdown));editor.classList.add('hidden');readView.classList.remove('hidden');
   }catch(error){
    message.textContent=error.message;
    if(error.status===409){const latest=await api('/v1/ideas/'+record.id);record=latest;const conflict=el('details',null,'notice');conflict.open=true;conflict.append(el('summary','The latest shared page — merge these changes into your draft before saving again'),prose(latest.markdown));editor.append(conflict);}
   }finally{save.disabled=false;}
  };
  if(canEdit){if(!fresh)root.append(button('Edit page',()=>{editor.classList.remove('hidden');readView.classList.add('hidden');title.focus();}));root.append(editor);}
  const discussion=el('section',null,'section');discussion.append(el('h2','Discussion'));
  for(const c of record.comments){const item=el('article',null,'idea-comment');item.append(el('small',`${c.author} · ${date(c.created_at)}`,'muted'),prose(c.markdown));discussion.append(item);}
  if(!record.comments.length)discussion.append(el('p','No replies yet.','small muted'));
  if(canEdit&&!fresh){const form=el('form',null,'comment-form'),comment=el('textarea'),send=el('button','Add reply','reader-button'),error=el('p','','error');comment.setAttribute('aria-label','Reply');comment.placeholder='Add a thought or a question…';comment.required=true;comment.maxLength=16000;send.type='submit';form.append(comment,send,error);form.onsubmit=async e=>{e.preventDefault();send.disabled=true;try{await api('/v1/ideas/'+record.id+'/comments',{method:'POST',body:JSON.stringify({id:crypto.randomUUID(),markdown:comment.value})});location.reload();}catch(e){error.textContent=e.message;send.disabled=false;}};discussion.append(form);}
  if(!fresh)root.append(discussion);return root;
 }
 async function dataPage(){
  const inventory=await api('/v1/data'),root=el('div'),sources=inventory.sources||[];
  root.append(heading('The data shelf.','What we have, where it came from, and what has been screened.',inventory.as_of?'AUDITED '+date(inventory.as_of):'NOT AUDITED'));
  root.append(metrics([['Competition responses',integer(inventory.official_rows),'Includes the frozen holdout'],['Open Pool v7',integer(inventory.open_pool_rows),'Aggregate; source rows are included'],['Our generations',integer(inventory.generated_rows),'Candidates, not automatically approved'],['Source records',integer(sources.length),'Overlapping datasets and training views']]));
  root.append(notice(inventory.notes||'Sources overlap. Do not sum raw sources, public aggregates, and derived training views.'));
  const controls=el('div',null,'feature-controls'),search=el('input');search.type='search';search.placeholder='Find a source…';search.setAttribute('aria-label','Search data sources');
  const kind=select('Source type',[['','All types'],['competition','Competition'],['public','Public'],['generated','Our generations'],['derived','Derived training views']],''),quality=select('Quality',[['','All quality states'],['unreviewed','Unreviewed'],['mixed','Mixed'],['approved','Approved'],['quarantined','Quarantined']], '');controls.append(search,kind.field,quality.field);root.append(controls);
  const list=el('div',null,'source-list');const draw=()=>{
   list.replaceChildren();
   for(const s of sources.filter(s=>(!kind.input.value||s.kind===kind.input.value)&&(!quality.input.value||s.quality===quality.input.value)&&`${s.name} ${s.path} ${s.source_ref||''}`.toLowerCase().includes(search.value.toLowerCase()))){
    const card=el('details',null,'source-card'),summary=el('summary'),name=el('div');name.append(el('h3',s.name),el('small',`${s.kind} · ${s.quality} · ${s.models?s.models+' models · ':''}${s.prompts?integer(s.prompts)+' prompts':''}`,'muted'));summary.append(name,el('strong',integer(s.rows)+' '+(s.unit||'rows'),'mono'));card.append(summary);
    card.append(el('p',s.notes||''),el('p',s.path,'mono muted'));if(s.overlap)card.append(notice(s.overlap));if(/^https?:\/\//.test(s.source_url||''))card.append(link('Original source ↗',s.source_url));
    if(s.quality_counts)card.append(table(['Screening / partition','Rows'],Object.entries(s.quality_counts).map(([k,v])=>[k.replaceAll('_',' '),integer(v)]),[1]));
    if(s.splits)card.append(table(['Training view split','Rows','Tokens'],s.splits.map(x=>[x.split,integer(x.rows),integer(x.tokens)]),[1,2]));
    if(s.model_counts)card.append(table(['Model','Rows'],Object.entries(s.model_counts).map(([k,v])=>[k,integer(v)]),[1]));
    if(s.children){const children=el('details',null,'section');children.append(el('summary',`${s.children.length} underlying sources · included in this pool`),table(['Source','Responses','Models'],s.children.map(x=>[x.name,integer(x.rows),x.models]),[1,2]));card.append(children);}
    list.append(card);
   }
   if(!list.children.length)list.append(el('p','No sources match these filters.','muted'));
  };search.oninput=draw;kind.input.onchange=draw;quality.input.onchange=draw;draw();root.append(list,notice('Quality is independent of source. Good/bad labels appear only after an explicit review; generation or public availability alone does not establish quality. Agents can register new sources and record quality decisions through the API.'));return root;
 }
 return {ideaBoard,ideaPage,dataPage};
}
