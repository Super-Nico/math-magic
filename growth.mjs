import {catalog,progress,prompt,lessonReview} from './strategy.mjs'
import {value} from './engine.mjs'
import {puzzleProgress,puzzleModes,equation} from './puzzles.mjs'
import {sprintStats,targetBoard} from './challenges.mjs'
import {reviewQueue} from './review.mjs'

export const themes=[
 ['classic','经典',0],['stars','星空',1],['forest','森林',3],['ocean','海洋',7],['dino','恐龙',12]
]
export function milestones(db){
 const modes=new Map()
 function credit(mode){modes.set(mode,(modes.get(mode)??0)+1)}
 for(const s of db.sessions)if(s.status==='done'&&s.rows.some(r=>r.first))credit(s.c.mode)
 for(const l of db.lessons??[])if(l.advanced===3)credit('strategy')
 for(const r of db.puzzles??[]){
  const p=puzzleProgress(r)
  if(p.done&&!p.skipped)credit(r.question.mode)
 }
 for(const r of db.challenges??[])if(r.status==='done'&&(r.mode==='target'||sprintStats(r).answered))credit(r.mode)
 return {modes,count:[...modes.values()].reduce((a,b)=>a+b,0)}
}
export function activeTheme(db){
 const id=db.prefs.theme??'classic'
 if(id==='classic')return id
 const theme=themes.find(t=>t[0]===id)
 return theme&&milestones(db).count>=theme[2]?id:'classic'
}
function el(parent,tag,text=''){
 const node=document.createElement(tag);node.textContent=text;parent.append(node);return node
}
function link(parent,path,title){
 const a=el(parent,'a',title);a.href='#'+path;a.className='btn';return a
}
export function collectionPage(app,db,save,card){
 app.replaceChildren();el(app,'h1','卡牌收藏馆')
 const {count}=milestones(db),active=activeTheme(db)
 el(app,'p','已完成 '+count+' 次练习。完成一轮有作答的训练、一节巧算课程或一道探索挑战，都算一次。')
 const grid=el(app,'div');grid.className='grid'
 for(const [id,title,needed] of themes){
  const section=el(grid,'section');section.className='panel theme-preview';section.dataset.theme=id
  el(section,'h2',title)
  const rack=el(section,'div');rack.className='rack';rack.innerHTML=card(7,0)+card(12,1)
  if(count<needed){el(section,'p','再完成 '+(needed-count)+' 次练习可使用');continue}
  const button=el(section,'button',id===active?'正在使用':'使用'+title+'牌面')
  button.disabled=id===active
  button.onclick=()=>{db.prefs.theme=id;save();document.body.dataset.theme=id;collectionPage(app,db,save,card);app.querySelector('[data-theme="'+id+'"] h2').focus()}
  section.querySelector('h2').tabIndex=-1
 }
}
const stages=[
 ['看数与拆数',['split','ten','classic']],
 ['加减与凑整',['group','hundred','shift','treasure']],
 ['乘法与运算顺序',['product','distribute','order']],
 ['记忆与逆推',['flash','inverse','mystery']],
 ['综合运用',['target','sprint']]
]
const titles={classic:'经典翻牌',flash:'闪电心算',treasure:'数字寻宝',mystery:'神秘数字',target:'目标数字挑战',sprint:'极限挑战'}
export function journeyPage(app,db){
 app.replaceChildren();el(app,'h1','成长地图')
 const nav=el(app,'div');nav.className='actions'
 link(nav,'/skills','技能图鉴');link(nav,'/review','错题复习');link(nav,'/achievements','我的成就')
 const {modes}=milestones(db),due=new Set(reviewQueue(db.sessions).filter(e=>e.ready).map(e=>e.s.c.mode))
 for(const [stage,ids] of stages){
  const section=el(app,'section');section.className='panel journey-stage';el(section,'h2',stage)
  const branches=el(section,'div');branches.className='actions'
  for(const id of ids){
   const skill=Object.hasOwn(catalog,id),p=skill&&progress(db.lessons??[],id)
   const review=skill?lessonReview(db.lessons??[],id)?.ready:due.has(id)
   const state=review?'待复习':skill?p.state:modes.has(id)?'已完成练习':'可探索'
   const a=link(branches,review&&!skill?'/review':skill?'/skills/'+id:'/games/'+id+'/setup',skill?catalog[id][0]:titles[id])
   el(a,'small',state)
  }
 }
}
export function lessonDueLinks(panel,db){
 for(const id of Object.keys(catalog)){
  if(lessonReview(db.lessons??[],id)?.ready)link(panel,'/skills/'+id,'复习'+catalog[id][0])
 }
}
export function explorationReport(app,db){
 const section=el(app,'section');section.className='panel';el(section,'h2','专项与挑战记录')
 el(section,'p','显示本机全部练习。展开记录可核对题面和作答。')
 const label=el(section,'label','练习项目 '),mode=el(label,'select')
 for(const [id,title] of Object.entries({strategy:'巧算大师',...Object.fromEntries(Object.entries(titles).filter(([k])=>!['classic','flash'].includes(k)))}))el(mode,'option',title).value=id
 const filter=el(section,'label','　练习范围 '),select=el(filter,'select'),body=el(section,'div')
 function entry(title,lines){
  const detail=el(body,'details');el(detail,'summary',title);for(const line of lines)el(detail,'p',line)
 }
 function draw(){
  body.replaceChildren();const id=mode.value,k=select.value
  if(id==='strategy'){
   const lessons=(db.lessons??[]).filter(l=>l.skill===k)
   const p=progress(lessons,k),schedule=lessonReview(lessons,k)
   el(body,'p',p.state+' · 首答正确 '+p.correct+' / '+p.count+' 题'+(schedule?.ready?' · 已到复习日':''))
   for(const l of lessons.toReversed()){
    const lines=l.answers.map((a,i)=>(i?'变式':'例题')+'　'+prompt(k,l.questions[i])+'　首答 '+a+'，正确答案 '+value(l.questions[i]))
    if(lines.length)entry(catalog[k][0]+' · 已答 '+lines.length+' 题',lines)
   }
  }else if(id==='treasure'||id==='mystery'){
   for(const r of (db.puzzles??[]).toReversed().filter(r=>r.question.mode===id&&r.level===Number(k))){
    const q=r.question,p=puzzleProgress(r)
    const lines=r.events.map(e=>e.type==='answer'?'提交 '+(id==='treasure'?e.answer.map(i=>q.cards[i]).join(' ＋ '):e.answer):e.type==='hint'?'查看提示':'跳过')
    entry((id==='treasure'?'从 '+q.cards.join('、')+' 中凑 '+q.target:equation(q))+' · 提交 '+p.attempts+' 次',lines)
   }
  }else{
   for(const r of (db.challenges??[]).toReversed().filter(r=>r.mode===id&&String(id==='sprint'?r.seconds:r.q.target)===k)){
    if(id==='target')entry(r.q.cards.join('、')+' → '+r.q.target+' · 提交 '+r.attempts.length+' 次',r.attempts.map(a=>{const b=targetBoard(r.q,a.steps)[0];return b.text+' ＝ '+b.value+' · '+(a.hints?'提示后':'独立')}))
    else{
     const s=sprintStats(r)
     entry(r.seconds+' 秒 · '+(r.level?'跨过 10':'和在 10 以内')+' · 首答正确 '+s.correct+' / '+s.answered,r.rows.map(row=>row.cards.join(' ＋ ')+'　'+(row.answer===null?'未答':row.answer==='skip'?'跳过':'首答 '+row.answer)))
    }
   }
  }
  if(!body.children.length)el(body,'p','这个范围还没有练习记录。')
 }
 function choices(){
  select.replaceChildren()
  const id=mode.value,options=id==='strategy'?Object.entries(catalog).map(([k,v])=>[k,v[0]]):puzzleModes[id]?puzzleModes[id].levels.map((v,i)=>[i,v]):id==='target'?[24,36,100].map(n=>[n,'目标 '+n]):[[60,'60 秒'],[120,'120 秒']]
  for(const [k,t] of options)el(select,'option',t).value=k
  draw()
 }
 mode.onchange=choices;select.onchange=draw;choices()
}
