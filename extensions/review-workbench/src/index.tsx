'use client';
import React,{useCallback,useEffect,useId,useRef,useState} from 'react';
import {createPortal,flushSync} from 'react-dom';
import {Agentation,getStorageKey,loadAnnotations,saveAnnotations,type AgentationProps,type Annotation} from 'agentation';
import {allowedPage,isEditing,isTyping,listed,modeChord,readComments,removeCached,requestJSON,type Scope} from './model';
import {styles} from './styles';

export type OwnerAction={id:string;label:string;run:()=>void|Promise<void>;disabled?:boolean};
export type ReviewWorkbenchProps={
  /** Explicit opt-in. Do not enable on your public reader build. */
  enabled:boolean;
  endpoint?:string;
  /** Defaults to the current path on this origin. This is not server authorization. */
  scope?:Scope;
  agentationProps?:Omit<AgentationProps,'endpoint'|'useHashLocation'|'enableKeyboardShortcuts'>;
  /** Supply only after host authorization. No file-writing APIs are included. */
  ownerActions?:OwnerAction[];
  /** True while a host text/drawing editor has an unsaved draft or pending save. */
  isOwnerBusy?:()=>boolean;
};
export function ReviewWorkbench(props:ReviewWorkbenchProps){
  return props.enabled?<Workbench {...props}/>:null;
}
function Workbench({endpoint,scope,agentationProps={},ownerActions=[],isOwnerBusy}:ReviewWorkbenchProps){
  const id=useId(),[notes,setNotes]=useState<Annotation[]>([]),[open,setOpen]=useState(false);
  const [notice,setNotice]=useState(''),[error,setError]=useState(''),[loadError,setLoadError]=useState(''),[confirmId,setConfirmId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false),busyRef=useRef(false),epoch=useRef(0),alive=useRef(true);
  const [mounted,setMounted]=useState(true),[toolbarKey,setToolbarKey]=useState(0);
  const [target,setTarget]=useState<HTMLElement|null>(null),[theme,setTheme]=useState('light');
  const wrapper=useRef<HTMLDivElement>(null),toggle=useRef<HTMLButtonElement>(null);
  const current=()=>new URL(location.href);
  const root=useCallback(()=>wrapper.current?.querySelector('agentation-toolbar')?.shadowRoot ??
    // The core renders its host in a body portal. This extension supports one toolbar per page.
    document.querySelector('agentation-toolbar.agw-native')?.shadowRoot ?? null,[]);
  const busyOwner=()=>!!isOwnerBusy?.();
  const guard=()=>{
    if(busyRef.current || busyOwner())throw Error('Save or cancel the current edit first.');
    if(isEditing(root()))throw Error('Finish or close the current comment first.');
  };
  const refresh=useCallback(async()=>{
    if(busyRef.current)return;
    const ticket=++epoch.current;
    try {
      const next=endpoint?await readComments(endpoint,current(),scope):loadAnnotations<Annotation>(location.pathname).map(n=>({...n,url:n.url??location.href})).filter(n=>listed(n,current(),scope));
      if(alive.current && ticket===epoch.current){setNotes(next);setLoadError('');}
    }catch(e){if(alive.current && ticket===epoch.current)setLoadError((e as Error).message);}
  },[endpoint,scope]);
  const updateRef=useRef({guard,root,busyOwner,ownerActions,refresh});
  updateRef.current={guard,root,busyOwner,ownerActions,refresh};
  useEffect(()=>{
    alive.current=true;void refresh();
    const interval=setInterval(()=>void refresh(),2500);
    return()=>{alive.current=false;epoch.current++;clearInterval(interval);};
  },[refresh]);
  useEffect(()=>{
    const bind=()=>{
      const shadow=root(),toolbar=shadow?.querySelector<HTMLElement>('[data-agentation-toolbar]');
      const expanded=shadow?.querySelector('button[aria-label="Exit"][aria-expanded="true"]');
      setTarget(expanded?toolbar??null:null);
      setTheme(shadow?.querySelector('[data-agentation-root]')?.getAttribute('data-agentation-theme')==='dark'?'dark':'light');
    };
    const interval=setInterval(bind,200);bind();return()=>clearInterval(interval);
  },[root]);
  useEffect(()=>{
    const keydown=(event:KeyboardEvent)=>{
      if(event.defaultPrevented)return;
      const latest=updateRef.current,shadow=latest.root();
      if(modeChord(event)){
        event.stopImmediatePropagation();
        if(isTyping(event)||event.repeat||event.isComposing)return;
        event.preventDefault();
        try{latest.guard();(shadow?.querySelector<HTMLButtonElement>('button[aria-label="Start feedback mode"], button[aria-label="Exit"]'))?.click();}
        catch(e){setNotice((e as Error).message);}return;
      }
      if((event.metaKey||event.ctrlKey)&&event.key==='Enter'&&!event.isComposing&&!event.repeat&&isEditing(shadow)){
        const textarea=event.composedPath()[0] as HTMLElement;
        const popup=textarea?.closest('[data-annotation-editor],[data-annotation-popup]');
        if(!popup)return;
        const save=[...popup.querySelectorAll<HTMLButtonElement>('button')].find(b=>['Add','Save','Save changes'].includes(b.textContent?.trim()??''));
        if(save){event.preventDefault();event.stopImmediatePropagation();if(!save.disabled)save.click();}
      }
    };
    // Protect drafts before the core's document-capture outside-click handler.
    const protect=(event:Event)=>{
      const path=event.composedPath() as HTMLElement[];
      const extensionHit=path.some(node=>node?.dataset?.agwUi!==undefined);
      const nativeHit=path.some(node=>node?.hasAttribute?.('data-agentation-toolbar') || node?.classList?.contains('agw-native'));
      if((extensionHit&&isEditing(updateRef.current.root()))||((extensionHit||nativeHit)&&updateRef.current.busyOwner())){
        event.preventDefault();event.stopImmediatePropagation();setNotice('Save or cancel the current edit first.');
      }
    };
    window.addEventListener('keydown',keydown,{capture:true});
    for(const type of ['pointerdown','mousedown','click'])window.addEventListener(type,protect,{capture:true});
    return()=>{window.removeEventListener('keydown',keydown,{capture:true});for(const type of ['pointerdown','mousedown','click'])window.removeEventListener(type,protect,{capture:true});};
  },[]);
  useEffect(()=>{if(confirmId)document.getElementById(id+'-cancel')?.focus();},[confirmId,id]);
  async function mutate(note:Annotation,remove:boolean){
    let active=false;
    try{
      guard();busyRef.current=true;setBusy(true);setError('');epoch.current++;
      const page=allowedPage(note.url,current(),scope);if(!page)throw Error('This comment is outside the configured page scope.');
      // Test storage before any irreversible remote deletion.
      const key=getStorageKey(page.pathname),raw=localStorage.getItem(key);
      if(raw!==null){removeCached(JSON.parse(raw),note.id);localStorage.setItem(key,raw);}
      if(endpoint){
        try{await requestJSON(endpoint,'/annotations/'+encodeURIComponent(note.id),remove?{method:'DELETE'}:{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'resolved',resolvedBy:'human'})});}
        catch(e){if(!remove || !(e as Error).message.includes('(404)'))throw e;}
      }
      const shadow=root();active=!!shadow?.querySelector('button[aria-label="Exit"][aria-expanded="true"]');
      if(alive.current)flushSync(()=>setMounted(false));
      const cache=loadAnnotations<Annotation>(page.pathname);
      saveAnnotations(page.pathname,remove?removeCached(cache,note.id):cache.map(n=>n.id===note.id?{...n,status:'resolved'}:n));
      if(!alive.current)return;
      setNotes(previous=>remove?previous.filter(n=>n.id!==note.id):previous.map(n=>n.id===note.id?{...n,status:'resolved'}:n));
      setConfirmId(null);setToolbarKey(k=>k+1);flushSync(()=>setMounted(true));
      setNotice(remove?'Comment deleted.':'Marked as applied.');
      if(remove)toggle.current?.focus();
      if(active){for(let i=0;i<30;i++){const start=root()?.querySelector<HTMLButtonElement>('button[aria-label="Start feedback mode"]');if(start){start.click();break;}await new Promise(r=>setTimeout(r,30));}}
    }catch(e){setError((e as Error).message);}
    finally{busyRef.current=false;setBusy(false);if(alive.current)void refresh();}
  }
  function show(note:Annotation){
    try{
      guard();const page=allowedPage(note.url,current(),scope);if(!page)return;
      if(page.pathname!==location.pathname || page.search!==location.search){location.assign(page.href);return;}
      const y=note.isFixed?scrollY+note.y:note.y;
      window.scrollTo({top:Math.max(0,y-160),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
      setNotice('Comment location shown. Use the numbered marker to edit it.');
    }catch(e){setNotice((e as Error).message);}
  }
  async function ownerAction(action:OwnerAction){
    try{guard();root()?.querySelector<HTMLButtonElement>('button[aria-label="Exit"]')?.click();await action.run();}
    catch(e){setNotice((e as Error).message);}
  }
  const panel=<div className="agw agw-list" data-theme={theme} data-feedback-toolbar data-agw-ui>
    <style>{styles}</style>
    <button className="agw-toggle" ref={toggle} aria-expanded={open} aria-controls={id} onClick={()=>{try{guard();setOpen(!open);setNotice('');void refresh();}catch(e){setNotice((e as Error).message);}}}>Comments · {notes.length}</button>
    {open&&<section id={id} className="agw-panel" aria-labelledby={id+'-title'} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);toggle.current?.focus();}}}>
      <header><h2 id={id+'-title'}>Comments</h2><button aria-label="Close comments" onClick={()=>{setOpen(false);toggle.current?.focus();}}>Close</button></header>
      {(error||loadError)&&<p className="agw-status agw-error" role="alert">{error||loadError} {loadError&&<button onClick={()=>void refresh()}>Retry</button>}</p>}
      {!notes.length&&<p className="agw-status">{loadError?'Comments are unavailable.':'No comments yet. Click or drag in feedback mode to add one.'}</p>}
      <ul>{notes.map(note=><li key={note.id} data-comment-id={note.id}>
        <div className="agw-meta"><span>{new URL(note.url??location.href).pathname} · {note.element}</span><span className={'agw-badge'+(note.status==='resolved'?' agw-applied':'')}>{note.status==='resolved'?<><svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden><path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>Applied</>:note.status==='acknowledged'?'Acknowledged':'Pending'}</span></div>
        <p className="agw-comment">{note.comment}</p><div className="agw-actions">
          <button disabled={busy} onClick={()=>show(note)}>Show location</button>
          {note.status!=='resolved'&&<button disabled={busy} onClick={()=>void mutate(note,false)}>Mark applied</button>}
          <button className="agw-delete" disabled={busy} aria-expanded={confirmId===note.id} onClick={()=>{setConfirmId(note.id);setError('');}}>Delete</button>
        </div>
        {confirmId===note.id&&<div className="agw-confirm" role="group" aria-label="Delete this comment?">
          <p>Delete this comment? This cannot be undone.</p><button id={id+'-cancel'} disabled={busy} onClick={()=>setConfirmId(null)}>Cancel</button>
          <button className="agw-delete" disabled={busy} onClick={()=>void mutate(note,true)}>{busy?'Deleting…':'Delete comment'}</button>
        </div>}
      </li>)}</ul>
      {notice&&<p role="status" className="agw-status">{notice}</p>}
      <p className="agw-help">⌘⇧F / Ctrl+Shift+F · Feedback<br/>⌘Enter / Ctrl+Enter · Save comment</p>
    </section>}
    {!open&&notice&&<p role="status" className="agw-notice">{notice}</p>}
  </div>;
  return <div ref={wrapper}>
    {mounted&&<Agentation {...agentationProps} key={toolbarKey} endpoint={endpoint} className={'agw-native '+(agentationProps.className??'')} enableKeyboardShortcuts={false} useHashLocation={false}
      onAnnotationAdd={n=>{agentationProps.onAnnotationAdd?.(n);void refresh();}}
      onAnnotationUpdate={n=>{agentationProps.onAnnotationUpdate?.(n);void refresh();}}
      onAnnotationDelete={n=>{agentationProps.onAnnotationDelete?.(n);void refresh();}}
      onAnnotationsClear={n=>{agentationProps.onAnnotationsClear?.(n);void refresh();}}/>}
    {typeof document!=='undefined'&&createPortal(panel,document.body)}
    {target&&ownerActions.length>0&&createPortal(<div className="agw agw-owner" data-theme={theme} role="group" aria-label="Owner tools" data-feedback-toolbar data-agw-ui>
      <style>{styles}</style>{ownerActions.map(action=><button key={action.id} disabled={busy||action.disabled} onClick={()=>void ownerAction(action)}>{action.label}</button>)}
    </div>,target)}
  </div>;
}
