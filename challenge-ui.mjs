import {sign} from './engine.mjs'
import {operations,targets,targetQuestion,targetBoard,sprintQuestion,sprintStats,beforeDeadline} from './challenges.mjs'

export function challengePage(app,db,save,mode){
 const rows=db.challenges??=[],learn=db.prefs.learn
 let round=rows.findLast(r=>r.mode===mode)
 let left=null,op=null,start=null,interval,feedback=''
 const heading=document.createElement('h1'),panel=document.createElement('section')
 heading.textContent=mode==='target'?'目标数字挑战':'极限挑战';panel.className='panel';app.replaceChildren(heading,panel)
 const events=new AbortController()
 function el(tag,text,parent=panel){
  const n=document.createElement(tag);n.textContent=text;parent.append(n);return n
 }
 function btn(label,action,parent=panel){
  const b=el('button',label,parent);b.type='button';b.onclick=action;return b
 }
 function select(label,choices){
  const field=el('label',label);field.className='field'
  const s=el('select','',field)
  for(const [value,title] of choices)el('option',title,s).value=value
  return s
 }
 function begin(fields){
  round={id:crypto.randomUUID(),version:1,seed:crypto.getRandomValues(new Uint32Array(1))[0],mode,status:'live',...fields}
  if(mode==='target'&&!round.q)round.q=targetQuestion(fields.range,fields.goal,round.seed)
  if(mode==='sprint')nextRow()
  rows.push(round);db.challenges=rows;save();feedback='';left=null;op=null
 }
 function targetSetup(){
  const range=select('本题已学运算',Object.entries(operations).map(([k,ops])=>[k,ops.map(op=>sign[op]).join('、')]))
  range.value=round?.q.learn??learn
  const t=select('想凑出多少？',[]),rules=el('p','')
  function choices(){
   const last=Number(t.value);t.replaceChildren()
   for(const n of targets(range.value))el('option',n,t).value=n
   if(targets(range.value).includes(last))t.value=last
   rules.textContent=(range.value==='add'?'加法入门：把四张牌逐步加起来。':'每张牌用一次，想想先算哪两张。')+'每一步都要得到非负整数。'
  }
  range.onchange=choices;choices()
  btn('开始新题',()=>{begin({range:range.value,goal:Number(t.value),steps:[],attempts:[],hints:0});targetDraw()})
 }
 function targetDraw(){
  panel.replaceChildren()
  if(!round){targetSetup();return}
  const q=round.q,board=targetBoard(q,round.steps)
  el('h2','用四张牌凑出 '+q.target)
  if(round.status!=='live'){
   el('p',round.status==='done'?board[0].text+' ＝ '+q.target:'已跳过这题')
   el('p','提交 '+round.attempts.length+' 次 · '+(round.hints?'用过提示':'独立探索'))
   if(round.status==='done')btn('用这四张牌试另一种算法',()=>{
    begin({q:structuredClone(q),steps:[],attempts:[],hints:round.hints});targetDraw()
   })
   targetSetup();return
  }
  const selected=board.find(t=>t.id===left)
  const lastResult=board.at(-1).value
  const checked=JSON.stringify(round.steps)===JSON.stringify(round.attempts.at(-1)?.steps)
  let instruction='先选一个数，再选运算符和第二个数。'
  if(board.length===1)instruction=checked?'想换一种算法？可以撤销上一步。':'四张牌都用到了。点“验证算式”看看结果。'
  else if(selected)instruction=op?selected.value+' '+sign[op]+' □　选择第二个数':'已选 '+selected.value+'，选择运算符'
  else if(round.steps.length)instruction='刚算出的 '+lastResult+' 也能当一张牌，继续选数吧。'
  el('p',instruction)
  const rack=el('div','');rack.className='puzzle-cards'
  for(const t of board){
   const b=btn(String(t.value),()=>{
    if(!op||left===t.id){left=left===t.id?null:t.id;op=null}
    else{
     const steps=[...round.steps,[left,op,t.id]]
     try{targetBoard(q,steps)}catch(e){feedback=e.message;targetDraw();return}
     round.steps=steps;left=op=null;save()
    }
    feedback='';targetDraw()
   },rack)
   b.setAttribute('aria-pressed',String(t.id===left));b.disabled=board.length===1
  }
  const bar=el('div','');bar.className='challenge-actions'
  for(const k of board.length>1?operations[q.learn]:[]){
   const b=btn(sign[k],()=>{op=k;feedback='';targetDraw()},bar)
   b.disabled=!selected;b.setAttribute('aria-pressed',String(op===k))
  }
  if(round.steps.length){
   const list=el('ol','')
   round.steps.forEach(([l,k,r],i)=>{
    const prev=targetBoard(q,round.steps.slice(0,i)),a=prev.find(t=>t.id===l),b=prev.find(t=>t.id===r)
    el('li',a.value+' '+sign[k]+' '+b.value+' ＝ '+targetBoard(q,round.steps.slice(0,i+1)).at(-1).value,list)
   })
   btn('撤销上一步',()=>{round.steps.pop();left=op=null;feedback='';save();targetDraw()})
  }
  if(board.length===1)btn('验证算式',()=>{
   round.attempts.push({steps:structuredClone(round.steps),hints:round.hints})
   if(board[0].value===q.target)round.status='done'
   else feedback='算出了 '+board[0].value+'，目标是 '+q.target+'。可以撤销再试。'
   save();targetDraw()
  }).disabled=checked
  if(feedback)el('p',feedback).setAttribute('role','status')
  if(round.hints){
   const first=targetBoard(q,q.solution.slice(0,1)).at(-1)
   el('p',round.hints===1?'从原来的四张牌出发，可以先试试'+({'+':'加法','-':'减法','*':'乘法','/':'除法'})[q.solution[0][1]]+'。':round.hints===2?'一种走法先凑出 '+first.value+'。':'一种完整算式：'+targetBoard(q,q.solution)[0].text+' ＝ '+q.target)
  }
  if(round.hints<3)btn(['看提示','看中间目标','看完整算式'][round.hints],()=>{round.hints++;save();targetDraw()})
  btn('跳过这题',()=>{round.status='skip';save();targetDraw()})
 }
 function nextRow(){round.rows.push({cards:sprintQuestion(round.seed,round.rows.length,round.level),answer:null})}
 function sprintSetup(){
  const level=select('加法范围',[[0,'和在 10 以内'],[1,'跨过 10']]),seconds=select('挑战时长',[[60,'60 秒'],[120,'120 秒']]),input=select('作答方式',[['screen','屏幕数字键'],['keyboard','直接输入数字']])
  el('p','每题只答一次。整轮连续完成、至少作答 10 题且正确率达到 90%，即可比较同配置个人纪录。')
  btn('开始挑战',()=>{
   begin({level:Number(level.value),seconds:Number(seconds.value),input:input.value,elapsed:0,valid:true,rows:[]})
   resume()
  })
 }
 function resume(){start=performance.now()-round.elapsed;sprintDraw();interval=setInterval(tick,100)}
 function stop(){clearInterval(interval);start=null}
 function tick(){
  if(start===null)return false
  const elapsed=performance.now()-start
  if(!beforeDeadline(elapsed,round.seconds)){
   round.elapsed=round.seconds*1000;round.status='done';stop();save();sprintDraw();return false
  }
  round.elapsed=elapsed
  const timer=panel.querySelector('[data-time]')
  if(timer)timer.textContent='剩余 '+Math.ceil(round.seconds-elapsed/1000)+' 秒'
  return true
 }
 function pause(redraw=true){
  if(!tick())return
  stop();round.valid=false;save();if(redraw)sprintDraw()
 }
 function sprintDraw(){
  panel.replaceChildren()
  if(!round){sprintSetup();return}
  if(round.status!=='live'){
   const s=sprintStats(round)
   el('h2',round.status==='done'?'时间到':'已结束练习')
   el('p','答对 '+s.correct+' 题 · 答错 '+s.wrong+' 题 · 跳过 '+s.skipped+' 题 · 到时未答 '+s.timeout+' 题')
   el('p','首答准确率 '+(s.answered?Math.round(100*s.correct/s.answered)+'%':'暂无作答'))
   const peers=rows.filter(r=>r.mode===mode&&r.input===round.input&&r.seconds===round.seconds&&r.level===round.level&&sprintStats(r).eligible)
   if(peers.length)el('p','同配置个人最佳：答对 '+Math.max(...peers.map(r=>sprintStats(r).correct))+' 题')
   if(!s.eligible)el('p','本轮作为普通练习保存。')
   const detail=el('details','');el('summary','回看本轮题目',detail)
   for(const row of round.rows){const [a,b]=row.cards;el('p',a+' ＋ '+b+' ＝ '+(a+b)+'　'+(row.answer===null?'未答':row.answer==='skip'?'跳过':'你的答案 '+row.answer),detail)}
   sprintSetup();return
  }
  if(start===null){
   el('h2','挑战已暂停');el('p','继续后按普通练习保存。')
   btn('继续练习',resume);btn('结束本轮',()=>{round.status='ended';save();sprintDraw()});return
  }
  const current=round.rows.at(-1)
  el('p','').dataset.time=''
  el('h2',current.cards.join(' ＋ ')+' ＝ ?')
  const label=el('label','你的答案 '),answer=el('input','',label)
  answer.inputMode='numeric';answer.maxLength=2;answer.readOnly=round.input==='screen'
  function submit(skipped){
   if(current!==round.rows.at(-1)||!tick())return
   if(!skipped&&!/^\d{1,2}$/.test(answer.value)){answer.focus();return}
   current.answer=skipped?'skip':Number(answer.value);current.at=round.elapsed
   feedback=skipped?'上一题已跳过':current.answer===current.cards[0]+current.cards[1]?'上一题答对了':'上一题答错了，结束后可以回看。'
   nextRow();save();sprintDraw()
  }
  if(answer.readOnly){
   const pad=el('div','');pad.className='pad'
   for(const n of '1234567890')btn(n,()=>{if(answer.value.length<2)answer.value+=n},pad)
   btn('退格',()=>{answer.value=answer.value.slice(0,-1)},pad)
  }else{answer.onkeydown=e=>{if(e.key==='Enter'&&!e.repeat){e.preventDefault();submit(false)}};answer.focus()}
  btn('提交答案',()=>submit(false));btn('跳过',()=>submit(true));btn('暂停',()=>pause())
  el('p',feedback).setAttribute('role','status');tick()
 }
 if(mode==='target'){targetDraw();return}
 if(round?.status==='live'){round.valid=false;save()}
 window.addEventListener('blur',()=>pause(),{signal:events.signal})
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()},{signal:events.signal})
 window.addEventListener('pagehide',()=>pause(),{signal:events.signal})
 sprintDraw()
 return ()=>{pause(false);stop();events.abort()}
}
