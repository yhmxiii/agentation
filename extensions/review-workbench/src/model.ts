import type {Annotation} from 'agentation';

export type Scope = (url:URL) => boolean;
export function allowedPage(value:string|undefined, current:URL, scope?:Scope):URL|null {
  try {
    if(!value)return null;
    const url=new URL(value);
    return url.origin===current.origin && (scope?scope(url):url.pathname===current.pathname) ? url : null;
  } catch {return null;}
}
export function listed(note:Annotation,current:URL,scope?:Scope) {
  return typeof note?.id==='string' && typeof note.comment==='string' &&
    (!note.kind || note.kind==='feedback') && allowedPage(note.url,current,scope) &&
    (!note.status || ['pending','acknowledged','resolved'].includes(note.status));
}
export function removeCached<T extends {id:string}>(items:T[],id:string):T[] {
  if(!Array.isArray(items))throw Error('Comment cache is unavailable. Reload before deleting.');
  return items.filter(item=>item?.id!==id);
}
export function isEditing(root:ParentNode|null) {
  return [...(root?.querySelectorAll<HTMLTextAreaElement>('[data-annotation-editor] textarea, [data-annotation-popup] textarea') ?? [])].some(editor=>{
    if(editor.readOnly || editor.disabled || editor.closest('[data-preview],[data-annotation-card],[hidden],[inert],[aria-hidden="true"]'))return false;
    const r=editor.getBoundingClientRect();if(r.width<=0 || r.height<=0)return false;
    for(let node:HTMLElement|null=editor;node;node=node.parentElement){
      const style=getComputedStyle(node);
      if(style.display==='none' || ['hidden','collapse'].includes(style.visibility) || style.opacity==='0')return false;
    }
    return true;
  });
}
export function isTyping(event:KeyboardEvent) {
  const target=event.composedPath()[0] as HTMLElement|undefined;
  return !!target?.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(target?.tagName ?? '');
}
export function modeChord(event:KeyboardEvent) {
  return (event.metaKey||event.ctrlKey) && event.shiftKey && !event.altKey && event.code==='KeyF';
}
export async function requestJSON(endpoint:string,path:string,options:RequestInit={}) {
  const response=await fetch(endpoint.replace(/\/$/,'')+path,{...options,credentials:'omit',signal:options.signal??AbortSignal.timeout(8000)});
  if(!response.ok)throw Error(`Connection failed (${response.status}). Your comment has not been changed. Try again.`);
  return response.status===204?null:response.json();
}
export async function readComments(endpoint:string,current:URL,scope?:Scope):Promise<Annotation[]> {
  const sessions=await requestJSON(endpoint,'/sessions');
  if(!Array.isArray(sessions))throw Error('Unexpected session response. Check your Agentation server.');
  const selected=sessions.filter(s=>typeof s?.id==='string' && allowedPage(s.url,current,scope));
  const pages=await Promise.all(selected.map(s=>requestJSON(endpoint,'/sessions/'+encodeURIComponent(s.id))));
  if(pages.some(p=>!Array.isArray(p?.annotations)))throw Error('Unexpected comment response. Try again.');
  const unique=new Map<string,Annotation>();
  for(const note of pages.flatMap(p=>p.annotations))if(listed(note,current,scope))unique.set(note.id,note);
  return [...unique.values()].sort((a,b)=>b.timestamp-a.timestamp);
}
