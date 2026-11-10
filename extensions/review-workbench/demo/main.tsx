import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {EditorContent,useEditor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type {JSONContent} from '@tiptap/core';
import {Draw,toSvg,type Stroke} from 'drawesome';
import 'drawesome/styles.css';
import {ReviewWorkbench} from '../src/index';
import './style.css';

// This is an opt-in browser-only sandbox, NOT a CMS or an authorized write API.
const storageKey='agentation-workbench-demo-v1';
type Page={title:string;doc:JSONContent;strokes:Stroke[];revision:string};
const example:Page={title:'A page to review',doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'This is illustrative sample content. Click a sentence to leave feedback, or drag across several elements to select them together.'}]},{type:'paragraph',content:[{type:'text',text:'Open the feedback toolbar to try Edit text or Drawesome. These examples save only in this browser; they never write to your project files.'}]}]},strokes:[],revision:'initial'};
function load():Page{
  try{const p=JSON.parse(localStorage.getItem(storageKey)??'null');if(p&&typeof p.title==='string'&&p.doc?.type==='doc'&&Array.isArray(p.strokes)&&typeof p.revision==='string')return p;}catch{}
  return example;
}
const requestedEndpoint=new URLSearchParams(location.search).get('endpoint');
let endpoint:string|undefined;
if(requestedEndpoint){const url=new URL(requestedEndpoint);if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.protocol!=='http:'||url.username||url.password)throw Error('The demo accepts a loopback HTTP Agentation endpoint only.');endpoint=url.origin;}

function App(){
  const [page,setPage]=useState(load),[mode,setMode]=useState<'text'|'draw'|null>(null),[title,setTitle]=useState(''),[error,setError]=useState('');
  const state=useRef({mode:null as 'text'|'draw'|null}),draft=useRef<Stroke[]>([]),base=useRef('');
  state.current.mode=mode;
  const reader=useEditor({extensions:[StarterKit],content:page.doc,editable:false});
  const editor=useEditor({extensions:[StarterKit],content:example.doc});
  const dialog=useRef<HTMLDialogElement>(null),returnFocus=useRef<HTMLElement|null>(null);
  useEffect(()=>{reader?.commands.setContent(page.doc);},[page,reader]);
  useEffect(()=>{
    if(mode){dialog.current?.showModal();dialog.current?.querySelector<HTMLInputElement>('input')?.focus();}
    const beforeUnload=(event:BeforeUnloadEvent)=>{if(mode){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',beforeUnload);return()=>window.removeEventListener('beforeunload',beforeUnload);
  },[mode]);
  const close=()=>{setMode(null);setError('');dialog.current?.close();returnFocus.current?.focus();};
  const open=(next:'text'|'draw')=>{
    returnFocus.current=document.activeElement as HTMLElement;base.current=page.revision;
    draft.current=structuredClone(page.strokes);setTitle(page.title);editor?.commands.setContent(page.doc);setError('');setMode(next);
  };
  function save(){
    try{
      const raw=localStorage.getItem(storageKey),saved=raw?JSON.parse(raw):example;
      if(saved.revision!==base.current)throw Error('This sample changed in another tab. Cancel and reopen before saving.');
      if(mode==='text'&&(!title.trim()||!editor?.getText().trim()))throw Error('Add a title and some body text before saving.');
      const next={...page,revision:crypto.randomUUID(),...(mode==='text'?{title:title.trim(),doc:editor!.getJSON()}:{strokes:draft.current})};
      // Persist before changing the reader; failures leave the draft open.
      localStorage.setItem(storageKey,JSON.stringify(next));setPage(next);close();
    }catch(e){setError((e as Error).message);}
  }
  return <>
    <main><h1>Review Workbench</h1><p className="intro">An optional extension for the Agentation fork. Comment, review progress, edit a sample document and draw with the original Drawesome pen tray.</p>
      <p className="connection">{endpoint?'Connected to your explicitly selected local Agentation server.':'Browser-only feedback. No Agentation server selected.'}</p>
      <article aria-label="Sample page"><h2>{page.title}</h2><EditorContent editor={reader}/></article>
      <section aria-labelledby="drawing-title"><h2 id="drawing-title">Drawing sample</h2><p>Saved strokes stay in this browser.</p><div className="saved-drawing"><img alt="Saved sample drawing" width="720" height="320" src={'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(toSvg(page.strokes,720,320,null))}/></div></section>
    </main>
    <ReviewWorkbench enabled={import.meta.env.DEV} endpoint={endpoint} isOwnerBusy={()=>!!state.current.mode}
      ownerActions={[{id:'edit',label:'Edit text',run:()=>open('text')},{id:'draw',label:'Drawesome',run:()=>open('draw')}]}/>
    <dialog ref={dialog} aria-label={mode==='text'?'Edit sample text':'Draw on sample'} onCancel={event=>{event.preventDefault();if(confirm('Discard this unsaved sample edit?'))close();}}>
      <header><h2>{mode==='text'?'Edit text':'Drawesome'}</h2><div><button onClick={()=>{if(confirm('Discard this unsaved sample edit?'))close();}}>Cancel</button><button onClick={save}>Save sample</button></div></header>
      <p className="storage-hint">This demonstration saves in this browser only. Your project files are unchanged.</p>
      {mode==='text'?<><label>Title<input value={title} maxLength={200} onChange={e=>setTitle(e.target.value)}/></label>
        <div className="formatting" role="toolbar" aria-label="Text formatting"><button aria-pressed={editor?.isActive('bold')??false} onClick={()=>editor?.chain().focus().toggleBold().run()}>Bold</button><button onClick={()=>editor?.chain().focus().undo().run()}>Undo</button><button onClick={()=>editor?.chain().focus().redo().run()}>Redo</button></div><EditorContent editor={editor}/></>
      :mode==='draw'?<div className="draw-editor"><Draw board={{w:720,h:320}} initialStrokes={draft.current} theme="light" look="studio" motion="none" onChange={strokes=>{draft.current=strokes;}}/></div>:null}
      {error&&<p role="alert" className="error">{error}</p>}
    </dialog>
  </>;
}
createRoot(document.getElementById('app')!).render(<App/>);
