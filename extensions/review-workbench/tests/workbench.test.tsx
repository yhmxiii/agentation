import React from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
vi.mock('agentation',()=>({
  Agentation:(props:any)=><button onClick={()=>props.onAnnotationAdd?.({id:'added',comment:'New comment'})}>Mock native add</button>,
  getStorageKey:(path:string)=>'test-comments-'+path,
  loadAnnotations:(path:string)=>JSON.parse(localStorage.getItem('test-comments-'+path)??'[]'),
  saveAnnotations:(path:string,notes:unknown[])=>localStorage.setItem('test-comments-'+path,JSON.stringify(notes)),
}));
import {ReviewWorkbench} from '../src/index';
const note={id:'test',comment:'<img src=x onerror=alert(1)>',element:'p',elementPath:'p',timestamp:1,x:10,y:20,url:location.href};
beforeEach(()=>{localStorage.clear();});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('requires explicit enablement and mounts no UI when disabled',()=>{
  render(<ReviewWorkbench enabled={false}/>);expect(screen.queryByText('Mock native add')).toBeNull();expect(screen.queryByText(/Comments/)).toBeNull();
});
it('renders comment text, never comment-supplied HTML',async()=>{
  localStorage.setItem('test-comments-/',JSON.stringify([note]));render(<ReviewWorkbench enabled/>);
  await act(async()=>{});fireEvent.click(screen.getByRole('button',{name:/^Comments ·/}));
  expect(await screen.findByText(note.comment)).toBeTruthy();expect(document.querySelector('.agw-panel img')).toBeNull();
});
it('cancels deletion without mutating storage, then deletes only the chosen note',async()=>{
  localStorage.setItem('test-comments-/',JSON.stringify([note,{...note,id:'keep',comment:'Keep this'}]));
  render(<ReviewWorkbench enabled/>);await act(async()=>{});fireEvent.click(screen.getByRole('button',{name:/^Comments ·/}));
  const row=(await screen.findByText(note.comment)).closest('li')!;
  fireEvent.click(within(row).getByRole('button',{name:'Delete'}));
  expect(document.activeElement).toBe(within(row).getByRole('button',{name:'Cancel'}));
  fireEvent.click(within(row).getByRole('button',{name:'Cancel'}));
  expect(JSON.parse(localStorage.getItem('test-comments-/')!)).toHaveLength(2);
  fireEvent.click(within(row).getByRole('button',{name:'Delete'}));
  await act(async()=>{fireEvent.click(within(row).getByRole('button',{name:'Delete comment'}));});
  expect(JSON.parse(localStorage.getItem('test-comments-/')!).map((n:any)=>n.id)).toEqual(['keep']);
  expect(screen.queryByText(note.comment)).toBeNull();expect(screen.getByText('Keep this')).toBeTruthy();
});
it('shows an applied checkmark and persists the manual status',async()=>{
  localStorage.setItem('test-comments-/',JSON.stringify([note]));render(<ReviewWorkbench enabled/>);await act(async()=>{});
  fireEvent.click(screen.getByRole('button',{name:/^Comments ·/}));
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Mark applied'}));});
  expect(screen.getByText('Applied')).toBeTruthy();expect(JSON.parse(localStorage.getItem('test-comments-/')!)[0].status).toBe('resolved');
});
it('preserves the host annotation callback',async()=>{
  const callback=vi.fn();render(<ReviewWorkbench enabled agentationProps={{onAnnotationAdd:callback}}/>);
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Mock native add'}));});
  expect(callback).toHaveBeenCalledWith({id:'added',comment:'New comment'});
});
