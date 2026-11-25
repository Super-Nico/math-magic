import {uniqueUnknown,puzzleModes,makePuzzle,puzzleProgress,assess,equation} from './puzzles.mjs'

export function puzzlePage(app,db,save,mode){
 const {title,levels}=puzzleModes[mode]
 const history=(db.puzzles??[]).filter(r=>r.question.mode===mode)
 let round=history.at(-1)
 const heading=document.createElement('h1'),panel=document.createElement('section')
 heading.textContent=title;panel.className='panel';app.replaceChildren(heading,panel)
 const el=(tag,text,parent=panel)=>{
  const node=document.createElement(tag);node.textContent=text;parent.append(node);return node
 }
 const button=(label,fn,parent)=>{const b=el('button',label,parent);b.type='button';b.onclick=fn;return b}
 const describe=p=>p.skipped?'已跳过':'已完成'
 function setup(){
  const label=el('label','选择挑战 '),select=el('select','',label)
  levels.forEach((level,i)=>{el('option',level,select).value=i})
  select.value=round?.level??0
  button('开始新题',()=>{
   round=makePuzzle(mode,Number(select.value),crypto.getRandomValues(new Uint32Array(1))[0])
   ;(db.puzzles??=[]).push(round);history.push(round);save();draw()
  })
  if(history.length>1){
   const details=el('details','');el('summary','最近练习',details)
   for(const r of history.slice(-5).reverse()){
    const p=puzzleProgress(r)
    el('p',levels[r.level]+' · '+describe(p)+' · 提交 '+p.attempts+' 次',details)
   }
  }
 }
 // 只有找全任务中的同值牌才需要区分。字母不参与求和。
 function cardMark(q,i){
  return !q.byValue&&q.all&&q.cards.some((n,j)=>j!==i&&n===q.cards[i])?String.fromCharCode(65+i):''
 }
 function cardFace(parent,q,i){
  const mark=cardMark(q,i)
  if(mark)el('small',mark,parent).className='treasure-mark'
  el('strong',String(q.cards[i]),parent).className='treasure-value'
 }
 function draw(message=''){
  panel.replaceChildren()
  if(!round){setup();return}
  const q=round.question,p=puzzleProgress(round)
  el('h2',mode==='treasure'?'用 '+q.count+' 张牌凑出 '+q.target:equation(q))
  if(mode==='treasure'){
   const rules=q.byValue?'找全不同的数字搭配。换一张相同的数，或交换顺序，都算同一组。':'这道旧题按牌找全。字母区分相同数字的牌。'
   el('p',q.all?rules:'找到一组就完成。点一下选牌，再点一下取消。')
   el('p','已找到 '+p.found.length+' / '+p.total+' 组')
   for(const key of p.found){
    const line=el('div','');line.className='treasure-solution'
    key.split(',').forEach((id,j)=>{
     if(j)el('span','＋',line)
     const tile=el('span','',line);tile.className='treasure-mini'
     cardFace(tile,q,Number(id))
    })
    el('strong','＝ '+q.target,line)
   }
  }
  if(p.done){
   el('h3',describe(p))
   if(mode==='mystery'){
    const answer=uniqueUnknown(q.tree,q.target)
    el('p','把 '+answer+' 代回去：'+equation(q).replace('□',String(answer)))
   }
   el('p','提交 '+p.attempts+' 次 · '+(mode==='treasure'?'未凑成的组合 ':'错误作答 ')+p.wrong+' 次'+(p.hinted?' · 用过提示':''))
   if(mode==='mystery'&&p.first)el('p','首答'+(p.first.correct?'正确':'有误')+(p.first.hinted?'（提示后）':'（独立）'))
   setup();return
  }
  const status=el('p',message);status.setAttribute('role','status')
  function record(event,msg){round.events.push(event);save();draw(msg)}
  function submit(answer){
   const result=assess(q,p,answer)
   if(!result.valid){if(mode==='treasure')draw(result.message);else status.textContent=result.message;return}
   record({type:'answer',answer},result.message)
  }
  if(mode==='treasure'){
   const chosen=new Set(),rack=el('div','');rack.className='puzzle-cards'
   const selection=el('p','选好 '+q.count+' 张牌后提交。');selection.className='treasure-selection';selection.setAttribute('aria-live','polite')
   q.cards.forEach((n,i)=>{
    const b=button('',()=>{
     if(chosen.has(i))chosen.delete(i)
     else if(chosen.size<q.count)chosen.add(i)
     else{status.textContent='先取消一张，再选另一张。';return}
     b.setAttribute('aria-pressed',String(chosen.has(i)))
     selection.textContent=chosen.size?'已选　'+[...chosen].map(j=>q.cards[j]).join(' ＋ ')+'　（'+chosen.size+'/'+q.count+' 张）':'选好 '+q.count+' 张牌后提交。'
     submitButton.disabled=chosen.size!==q.count
    },rack)
    cardFace(b,q,i)
    b.setAttribute('aria-label','数字 '+n+(cardMark(q,i)?'，'+cardMark(q,i)+' 牌':''))
    b.setAttribute('aria-pressed','false')
   })
   const submitButton=button('提交这一组',()=>submit([...chosen]));submitButton.disabled=true
  }else{
   const form=el('form',''),label=el('label','缺少的数（1 到 99） ',form),input=el('input','',label)
   input.inputMode='numeric';input.pattern='[0-9]{1,2}';input.maxLength=2;input.required=true
   el('button','代入验证',form)
   form.onsubmit=e=>{e.preventDefault();if(form.checkValidity())submit(Number(input.value))}
   input.focus()
  }
  if(!p.hinted)button('看提示',()=>record({type:'hint'}))
  else el('p',mode==='treasure'?'先选一张，再想想剩下的牌需要凑出多少。':q.tree[0]==='*'?'先把等式两边都除以括号外的因数。':q.tree[0]==='-'?'从总数减去等号右边的数，看看少了多少。':'从等号右边的总数减去已知加数。')
  button('跳过这题',()=>record({type:'skip'}))
 }
 draw()
}
