import {describe,it,expect,vi,afterEach} from 'vitest';
import {allowedPage,isEditing,isTyping,listed,modeChord,readComments,removeCached} from '../src/model';
import type {Annotation} from 'agentation';
const current=new URL('http://localhost:4192/work');
const note={id:'a',comment:'Hello',element:'p',elementPath:'p',timestamp:1,x:10,y:10,url:current.href} as Annotation;
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();document.body.replaceChildren();});
describe('scoped feedback',()=>{
  it('rejects external, script, relative and malformed URLs',()=>{
    for(const value of ['https://elsewhere.test/work','javascript:alert(1)','/work','',undefined])expect(allowedPage(value,current)).toBeNull();
  });
  it('defaults to this path, and permits explicit same-origin scope only',()=>{
    expect(allowedPage('http://localhost:4192/other',current)).toBeNull();
    expect(allowedPage('http://localhost:4192/other',current,()=>true)).toBeInstanceOf(URL);
    expect(allowedPage('http://elsewhere.test/other',current,()=>true)).toBeNull();
  });
  it('preserves pending, acknowledged and applied, excluding dismissed/other kinds',()=>{
    for(const status of [undefined,'pending','acknowledged','resolved'] as const)expect(listed({...note,status},current)).toBeTruthy();
    expect(listed({...note,status:'dismissed'},current)).toBeFalsy();expect(listed({...note,kind:'placement'},current)).toBeFalsy();
  });
  it('only removes one cached comment and rejects corrupted caches',()=>{
    expect(removeCached([note,{...note,id:'b'}],'a')).toEqual([{...note,id:'b'}]);
    expect(()=>removeCached(null as any,'a')).toThrow();
  });
  it('never fetches unrelated sessions and deduplicates matching notes',async()=>{
    const fetcher=vi.fn(async(url:string)=>new Response(JSON.stringify(url.endsWith('/sessions')?[{id:'one',url:current.href},{id:'two',url:'http://elsewhere.test/work'},{id:'three',url:'http://localhost:4192/private'}]:{annotations:[note,note]}),{status:200}));
    vi.stubGlobal('fetch',fetcher);expect(await readComments('http://localhost:4760',current)).toEqual([note]);expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toContain('/sessions/one');
  });
  it('fails visibly rather than presenting corrupt responses as an empty list',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}')));await expect(readComments('http://localhost:4760',current)).rejects.toThrow('Unexpected session');
  });
});
describe('draft protection',()=>{
  function editor(){const e=document.createElement('textarea');e.setAttribute('data-testid','editor');const wrap=document.createElement('div');wrap.setAttribute('data-annotation-popup','');wrap.append(e);document.body.append(wrap);vi.spyOn(e,'getBoundingClientRect').mockReturnValue(new DOMRect(0,0,120,80));return e;}
  it('detects editable drafts but not stored comment previews',()=>{
    const e=editor();expect(isEditing(document)).toBe(true);e.readOnly=true;expect(isEditing(document)).toBe(false);e.readOnly=false;e.parentElement!.setAttribute('data-annotation-card','');expect(isEditing(document)).toBe(false);
  });
  it('ignores hidden, disabled and inert editors',()=>{
    const e=editor();e.disabled=true;expect(isEditing(document)).toBe(false);e.disabled=false;e.parentElement!.inert=true;e.parentElement!.setAttribute('inert','');expect(isEditing(document)).toBe(false);
  });
  it('keeps offscreen editable drafts protected',()=>{
    const e=editor();vi.spyOn(e,'getBoundingClientRect').mockReturnValue(new DOMRect(-2000,0,120,80));expect(isEditing(document)).toBe(true);
  });
  it('uses physical F on Korean layouts and recognizes input context',()=>{
    expect(modeChord(new KeyboardEvent('keydown',{key:'ㄹ',code:'KeyF',metaKey:true,shiftKey:true}))).toBe(true);
    expect(modeChord(new KeyboardEvent('keydown',{code:'KeyF',metaKey:true,shiftKey:true,altKey:true}))).toBe(false);
    const e=new KeyboardEvent('keydown');vi.spyOn(e,'composedPath').mockReturnValue([document.createElement('textarea')]);expect(isTyping(e)).toBe(true);
  });
});
