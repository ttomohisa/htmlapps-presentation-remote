import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=readFileSync('src/index.template.html','utf8');
const begin=source.indexOf('function renderCompatibility(){');
const end=source.indexOf('\nasync function goTo(',begin);
assert.ok(begin>=0&&end>begin,'maintained renderCompatibility function is present');
const renderSource=source.slice(begin,end);

function fakeElement(tag='div'){
 const element={tagName:tag.toUpperCase(),children:[],dataset:{},attributes:{},listeners:{},open:false,textContent:'',className:'',
  append(...items){this.children.push(...items)},
  replaceChildren(...items){this.children=[...items]},
  setAttribute(name,value){this.attributes[name]=String(value)},
  addEventListener(name,callback){this.listeners[name]=callback},
  contains(child){return this.children.includes(child)}
 };
 Object.defineProperty(element,'childElementCount',{get(){return this.children.length}});
 return element;
}
function allChildren(root,predicate,found=[]){
 if(predicate(root))found.push(root);
 for(const child of root.children||[])allChildren(child,predicate,found);
 return found;
}
function harness(lang='ja',warnings=Array.from({length:17},(_,i)=>({type:'unsupported',label:'Unsupported picture',slide:i}))){
 const host=fakeElement(),badge=fakeElement();
 const elements={'#compatSummary':host,'#compatWarning':badge};
 const state={kind:'pptx',total:20,compat:warnings,deck:{engine:'hifi',errorSlides:()=>[3]}};
 const copies={ja:{compatBasic:'正常',compatFallback:'互換',compatNodeErrors:'描画エラー',compatNoWarnings:'警告なし',compatJumpTo:'スライド {number} に移動',compatMoreSlides:'ほか {count} 枚',unsupportedLabel:'確認が必要',displayNotes:'表示について',compatRecommendPdf:'PDFに変換'},en:{compatBasic:'Ready',compatFallback:'Fallback',compatNodeErrors:'Render errors',compatNoWarnings:'No issues',compatJumpTo:'Go to slide {number}',compatMoreSlides:'Show {count} more slides',unsupportedLabel:'Review required',displayNotes:'About rendering',compatRecommendPdf:'Try PDF'}};
 const context=vm.createContext({state,document:{createElement:fakeElement},$:selector=>elements[selector],tr:key=>copies[lang][key]||key});
 vm.runInContext(renderSource,context);
 context.renderCompatibility();
 return {host,badge,state,context};
}

test('every warning group offers direct slide-number buttons and accessible labels',()=>{
 const {host,badge}=harness();
 assert.equal(badge.hidden,false);
 const groups=allChildren(host,e=>e.className==='compat-item');
 const main=groups.find(e=>allChildren(e,x=>x.className==='compat-slide-jump').length===12);
 assert.ok(main,'main warning group exists');
 const visible=allChildren(main,e=>e.className==='compat-slide-jump');
 assert.equal(visible.length,12);
 assert.deepEqual(visible.map(e=>e.dataset.compatSlideIndex),Array.from({length:12},(_,i)=>String(i)));
 assert.equal(visible[0].attributes['aria-label'],'スライド 1 に移動');
 const more=allChildren(main,e=>e.className==='compat-more')[0];
 assert.ok(more,'remaining pages can be expanded');
 assert.equal(allChildren(more,e=>e.className==='compat-slide-jump').length,0,'remaining links created only when needed');
 const summary=more.children.find(e=>e.tagName==='SUMMARY');
 assert.equal(summary.textContent,'ほか 5 枚');
 more.open=true;more.listeners.toggle();
 const extra=allChildren(more,e=>e.className==='compat-slide-jump');
 assert.deepEqual(extra.map(e=>e.dataset.compatSlideIndex),['12','13','14','15','16']);
 more.listeners.toggle();
 assert.equal(allChildren(more,e=>e.className==='compat-slide-jump').length,5,'repeat toggles never duplicate links');
 const errors=groups.find(e=>allChildren(e,x=>x.className==='compat-issue').some(label=>label.textContent==='描画エラー'));
 assert.equal(allChildren(errors,e=>e.className==='compat-slide-jump')[0].dataset.compatSlideIndex,'3');
});

test('warning jump labels follow the current language and exclude invalid slides',()=>{
 const {host}=harness('en',[{type:'x',label:'Issue',slide:1},{type:'x',label:'Issue',slide:-2},{type:'x',label:'Issue',slide:99},{type:'x',label:'Issue',slide:1}]);
 const links=allChildren(host,e=>e.className==='compat-slide-jump');
 assert.equal(links.length,2,'valid PPTX warning and separate render error are both linked');
 const issue=links.find(el=>el.dataset.compatSlideIndex==='1');
 assert.ok(issue,'the valid PPTX warning points to the second slide');
 assert.equal(issue.attributes['aria-label'],'Go to slide 2');
 assert.equal(links.find(el=>el.dataset.compatSlideIndex==='3')?.attributes['aria-label'],'Go to slide 4');
});

test('PDF compatibility summary contains no warning jump controls',()=>{
 const {host,badge,context,state}=harness('ja');
 state.kind='pdf';context.renderCompatibility();
 assert.equal(badge.hidden,true);
 assert.equal(allChildren(host,e=>e.className==='compat-slide-jump').length,0);
});

test('delegated warning click navigates and reveals the slide, but ignores invalid indices',async()=>{
 const begin=source.indexOf("$('#compatSummary').addEventListener('click',event=>{");
 const end=source.indexOf("$('#pointerButton').addEventListener",begin);
 assert.ok(begin>=0&&end>begin,'warning click is connected to the presenter');
 const behavior=source.slice(begin,end);
 const listeners={};
 const host={addEventListener(name,handler){listeners[name]=handler},contains(target){return target.valid!==false}};
 let scrollCount=0;
 const stage={scrollIntoView(){scrollCount++}};
 const state={phase:'ready',current:0,total:20};
 const navigations=[];
 const context=vm.createContext({state,$:name=>name==='#compatSummary'?host:stage,goTo:async index=>{navigations.push(index);return true}});
 vm.runInContext(behavior,context);
 const click=async number=>{const target={dataset:{compatSlideIndex:String(number)},valid:true};listeners.click({target:{closest:()=>target}});await new Promise(resolve=>setImmediate(resolve))};
 await click(3);
 assert.deepEqual(navigations,[3]);assert.equal(scrollCount,1);
 await click(30);await click(-1);
 assert.deepEqual(navigations,[3],'out-of-range warning numbers never navigate');
 state.current=5;await click(5);
 assert.equal(scrollCount,2,'already open slide can be brought into view');
});
