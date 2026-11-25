import {catalog,makeLesson,prompt,formula,cards,transform,finishedOperation,progress,lessonReview} from './strategy.mjs'
import {value} from './engine.mjs'

// 配对以外的策略，让儿童直接填写或选择发生变化的数学对象。
function operationTask(skill,tree){
 const [a,b,c]=cards(tree)
 switch(skill){
 case 'shift':return {
  label:'从 '+b+' 拿出多少给 '+a+'，能让 '+a+' 变成 100？',
  answer:100-a,selection:[0,1],
  retry:'再算一算，100 比 '+a+' 多多少？',
  explain:'从 '+b+' 拿出 '+(100-a)+' 给 '+a+'。一边加 '+(100-a)+'，另一边减 '+(100-a)+'，总和相同。'
 }
 case 'split':return {
  label:'按数位拆开 '+a+'：'+a+' ＝ '+(a-a%10)+' ＋ □。方框里填几？',
  answer:a%10,selection:[0],retry:'看一看个位上的数字。',explain:'把十位和个位分开，再与原来的加数相加。'
 }
 case 'distribute':return {
  label:'把 '+b+' 拆成 10 ＋ '+(b-10)+'。哪一个算式把两部分都乘了 '+a+'？',
  choices:[a+' × 10 ＋ '+(b-10),a+' × 10 ＋ '+a+' × '+(b-10)],
  answer:1,selection:[1],retry:'十位和个位两部分，都需要乘同一个数。',explain:'两部分各乘一次，再把两个积加起来。'
 }
 case 'inverse':return {
  label:prompt(skill,tree)+'。用哪个算式求方框里的数？',
  choices:[a+' − '+b,a+' ＋ '+b],answer:0,selection:[0,1],
  retry:'总数已经知道，去掉已知的一部分，还剩多少？',explain:'从总数中减去已知加数，就得到缺少的加数。'
 }
 case 'order':return {
  label:'这个算式里，应该先算哪一步？',
  choices:[a+' ＋ '+b,b+' × '+c],answer:1,selection:[1,2],
  retry:'没有括号，加法和乘法在一起时先算乘法。',explain:'先求乘积，再把积加到第一个数上。'
 }
 }
}

function renderOperation(container,task,submit,status,reverseChoices){
 const label=document.createElement('label')
 label.textContent=task.label
 container.append(label)
 function check(n){
  if(n===task.answer)submit(task.selection)
  else status.textContent=task.retry
 }
 if(task.choices){
  const order=task.choices.map((_,i)=>i)
  if(reverseChoices)order.reverse()
  order.forEach(index=>{
   const button=document.createElement('button')
   button.textContent=task.choices[index];button.onclick=()=>check(index);container.append(button)
  })
 }else{
  const form=document.createElement('form'),input=document.createElement('input'),button=document.createElement('button')
  input.id='operationAmount';input.inputMode='numeric';input.pattern='[0-9]{1,3}';input.maxLength=3;input.required=true
  label.htmlFor=input.id;button.textContent='验证';form.append(input,button);container.append(form)
  form.onsubmit=e=>{e.preventDefault();if(form.checkValidity())check(Number(input.value))}
 }
}
export function skillPage(app,db,save,skill,hub=false){
 const lessons=db.lessons??[]
 if(!Object.hasOwn(catalog,skill)){
  const draw=(category='全部')=>{
   app.innerHTML='<h1>'+(hub?'巧算大师':'技能图鉴')+'</h1><label>技能分类 <select id="category">'+['全部','数感','加减','乘除','策略'].map(x=>'<option>'+x+'</option>').join('')+'</select></label><section class="grid">'+Object.entries(catalog).filter(([,v])=>category==='全部'||v[1]===category).map(([id,[title,group]])=>{
    const p=progress(lessons,id)
    return '<a class="tile" href="#/skills/'+id+'"><h2>'+title+'</h2><p>'+group+' · '+p.state+' · '+p.count+' 题</p></a>'
   }).join('')+'</section>'
   const filter=app.querySelector('select');filter.value=category;filter.onchange=()=>draw(filter.value)
  }
  draw();return
 }
 const [title,group,tip]=catalog[skill]
 let lesson=lessons.findLast(l=>l.skill===skill)
 const render=()=>{
  const p=progress(db.lessons??[],skill)
  app.innerHTML='<p><a href="#/skills">技能图鉴</a> / '+group+'</p><h1>'+title+'</h1><section class="panel" id="lesson"></section>'
  const panel=app.querySelector('#lesson')
  if(!lesson||lesson.advanced===3){
   panel.innerHTML=(lesson?'<h2>本轮完成</h2><p>独立变式答对 '+lesson.answers.slice(1).filter((n,i)=>n===value(lesson.questions[i+1])).length+' / 2 题</p>':'')+'<p>先自己算，再动手试，最后练两道变式。</p><p>需要会'+({乘除:'乘法口诀',数感:'识别十位和个位',加减:'整数加减',策略:skill==='order'?'加法和乘法':'整数加减'}[group])+' · '+p.state+' · 已答 '+p.count+' 题</p><button id="startLesson">开始练习</button>'
   const schedule=lessonReview(db.lessons??[],skill)
   if(schedule?.ready)panel.querySelector('#startLesson').textContent='开始复习'
   const create=()=>{
    const seed=crypto.getRandomValues(new Uint32Array(1))[0],previous=new Set(lesson?.questions.map(formula))
    for(let offset=0;offset<32;offset++){
     const next=makeLesson(skill,(seed+offset)>>>0)
     if(next.questions.every(q=>!previous.has(formula(q)))){lesson=next;break}
    }
    lesson.startedAt=Date.now()
    ;(db.lessons??=[]).push(lesson)
   }
   panel.querySelector('#startLesson').onclick=()=>{create();save();render()}
   const example=makeLesson(skill,0)
   const choice={ten:[0,2],hundred:[0,2],split:[0],shift:[0,1],group:[0,2],distribute:[1],product:[0,2],inverse:[0,1],order:[1,2]}[skill]
   const step=transform(example,choice),task=operationTask(skill,example.questions[0])
   const details=document.createElement('details')
   details.innerHTML='<summary>看一个例子</summary><p>'+(task?.explain??tip)+'</p><p>'+prompt(skill,example.questions[0])+'</p><p>'+formula(step.beforeAST)+' ＝ '+formula(step.afterAST)+'</p><button>学完例题，自己试试</button>'
   details.querySelector('button').onclick=()=>{create();lesson.studied=true;save();render()}
   panel.append(details);return
  }
  const ix=lesson.answers.length
  if(ix===lesson.advanced){
   panel.innerHTML='<p>'+(ix?'独立变式 '+ix+' / 2':'先自己算')+'</p>'+(ix===2?'<p>上一题正确结果为 '+value(lesson.questions[1])+'。</p>':'')+'<form><label><strong>'+prompt(skill,lesson.questions[ix])+'</strong> <input id="skillAnswer" inputmode="numeric" pattern="[0-9]{1,7}" required maxlength="7" autocomplete="off"></label> <button>提交答案</button></form>'
   panel.querySelector('form').onsubmit=e=>{e.preventDefault();const input=panel.querySelector('input');if(lesson.answers.length!==ix||!/^\d{1,7}$/.test(input.value))return;lesson.answers.push(Number(input.value));save();render()};panel.querySelector('input').focus();return
  }
  const stage=lesson.advanced
  const board={...lesson,questions:[lesson.questions[stage]],steps:stage?lesson.variantSteps[stage-1]:lesson.steps}
  const tree=board.steps.at(-1)?.afterAST??board.questions[0],done=finishedOperation(board)
  const task=operationTask(skill,board.questions[0])
  panel.innerHTML='<p>你的首答 '+lesson.answers[stage]+'，正确结果 '+value(tree)+'</p><h2>动手试一试</h2><p>'+(task&&done?formula(board.questions[0])+' ＝ '+formula(tree):skill==='inverse'&&!done?prompt(skill,tree):formula(tree))+'</p><p>'+(done?(task?.explain??'变换前后结果相同。'):task?'':board.steps.length&&cards(tree).length===2?'选最后两张卡相加。':stage?'试着自己选卡，把算式变简单。':tip)+'</p><div class="actions" id="operands"></div><p role="status"></p><div class="actions"><button id="undo">撤销</button><button id="reset">重置</button><button id="advance">'+(stage===2?'查看本轮结果':done?'练习变式':'跳过操作，练习变式')+'</button></div>'
  let selected=[]
  const choose=i=>{
   const btn=panel.querySelector('[data-index="'+i+'"]')
   if(selected.includes(i)){selected=[];panel.querySelectorAll('[data-index]').forEach(b=>b.setAttribute('aria-pressed','false'));return}
   selected.push(i);btn.setAttribute('aria-pressed','true')
   if(selected.length<(['split','distribute'].includes(skill)?1:2))return
   let step
   try{step=transform(board,selected)}catch(err){panel.querySelector('[role=status]').textContent=err.message;selected=[];panel.querySelectorAll('[data-index]').forEach(b=>b.setAttribute('aria-pressed','false'));return}
   board.steps.push(step);save();render()
  }
  if(!done&&task){
   renderOperation(panel.querySelector('#operands'),task,selection=>{
    board.steps.push(transform(board,selection));save();render()
   },panel.querySelector('[role=status]'),(lesson.seed+stage)%2===1)
  }
  if(!done&&!task)cards(tree).forEach((n,i)=>{
   const b=document.createElement('button');b.textContent=n;b.dataset.index=i;b.setAttribute('aria-pressed','false');b.onclick=()=>choose(i);b.draggable=true
   b.ondragstart=e=>e.dataTransfer.setData('text/plain',String(i));b.ondragover=e=>e.preventDefault();b.ondrop=e=>{e.preventDefault();const j=Number(e.dataTransfer.getData('text/plain'));if(Number.isInteger(j)&&j>=0&&j<cards(tree).length&&j!==i&&!['split','distribute'].includes(skill)){selected=[];choose(j);choose(i)}}
   panel.querySelector('#operands').append(b)
  })
  for(const id of ['undo','reset']){const b=panel.querySelector('#'+id);b.disabled=!board.steps.length;b.onclick=()=>{board.steps.splice(id==='reset'?0:-1);save();render()}}
  panel.querySelector('#advance').onclick=()=>{lesson.advanced++;if(lesson.advanced===3)lesson.completedAt=Date.now();save();render()}
 }
 render()
}
