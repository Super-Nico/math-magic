import {rng,value,tokens} from './engine.mjs'

export const puzzleModes={
 treasure:{title:'数字寻宝',levels:['6 张牌 · 凑 10，找一组','8 张牌 · 凑 20，找全两张组合','9 张牌 · 凑 100，找全三张组合']},
 mystery:{title:'神秘数字',levels:['一步加减','两步运算 · 含乘法和括号']}
}

export function combinations(cards,count,target){
 const result=[]
 function visit(start,ids,sum){
  if(ids.length===count){if(sum===target)result.push(ids);return}
  for(let i=start;i<=cards.length-(count-ids.length);i++){
   visit(i+1,[...ids,i],sum+cards[i])
  }
 }
 visit(0,[],0)
 return result
}
function substitute(tree,n){
 if(tree==='□')return n
 return Array.isArray(tree)?[tree[0],substitute(tree[1],n),substitute(tree[2],n)]:tree
}
function satisfies(tree,target,n){
 try{return value(substitute(tree,n))===target}catch{return false}
}
export function uniqueUnknown(tree,target){
 const solutions=[]
 for(let n=1;n<=99;n++)if(satisfies(tree,target,n))solutions.push(n)
 if(solutions.length!==1)throw Error('等式在 1 到 99 中必须恰有一个解。')
 return solutions[0]
}
export const equation=q=>tokens(substitute(q.tree,998)).map(t=>t===998?'□':t).join(' ')+' ＝ '+q.target

function valueKey(cards,ids){
 return ids.map(i=>cards[i]).sort((a,b)=>a-b).join(',')
}
export function generatePuzzle(mode,level,seed,version=2){
 if(!Object.hasOwn(puzzleModes,mode)||!Number.isInteger(level)||!puzzleModes[mode].levels[level]||!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error('题目设置无效')
 const random=rng(seed),pick=(lo,hi)=>lo+Math.floor(random()*(hi-lo+1))
 if(mode==='mystery'){
  const n=pick(3,65),a=pick(2,16),b=pick(2,6)
  const tree=level?['*',['+','□',a],b]:pick(0,1)?['+','□',a]:['-',a+n,'□']
  const target=value(substitute(tree,n))
  uniqueUnknown(tree,target)
  return {mode,tree,target}
 }
 const target=[10,20,100][level],count=level===2?3:2
 // 先构造解，再洗牌。进阶限制解的数量，使“找全”可在短时练习中完成。
 for(let trial=0;trial<40;trial++){
  const size=[6,8,9][level],cards=[]
  for(let group=0;group<(level?2:1);group++){
   const a=pick(1,Math.floor(target/3)),b=count===3?pick(12,36):0
   cards.push(a,target-a-b);if(b)cards.push(b)
  }
  while(cards.length<size)cards.push(pick(1,target-1))
  for(let i=size-1;i>0;i--){const j=pick(0,i);[cards[i],cards[j]]=[cards[j],cards[i]]}
  const solutions=combinations(cards,count,target)
  const distinct=new Set(solutions.map(ids=>valueKey(cards,ids))).size
  if(!level||solutions.length<=6&&(version===1||distinct>=2))return {mode,cards,count,target,all:level>0,...(version===2?{byValue:true}:{})}
 }
 return {mode,cards:level===1?[2,18,3,17,4,5,6,7]:[1,20,79,2,22,76,3,4,5],count,target,all:true,...(version===2?{byValue:true}:{})}
}
export function makePuzzle(mode,level,seed){
 return {id:crypto.randomUUID(),version:2,level,seed,question:generatePuzzle(mode,level,seed),events:[]}
}
export function assess(q,progress,answer){
 if(progress.done)return {valid:false,message:'这道题已经结束。'}
 if(q.mode==='treasure'){
  if(!Array.isArray(answer)||answer.length!==q.count||new Set(answer).size!==q.count||!answer.every(i=>Number.isInteger(i)&&i>=0&&i<q.cards.length))return {valid:false,message:'请选择 '+q.count+' 张不同的牌。'}
  const key=[...answer].sort((a,b)=>a-b).join(',')
  if(progress.found.includes(key)||q.byValue&&progress.found.some(ids=>valueKey(q.cards,ids.split(','))===valueKey(q.cards,answer)))return {valid:false,message:'这一组已经找到了，换一组试试。'}
  const sum=answer.reduce((n,i)=>n+q.cards[i],0)
  return {valid:true,correct:sum===q.target,key,message:sum===q.target?'找到一组！':'这组的和是 '+sum+'，再试一组。'}
 }
 if(!Number.isInteger(answer)||answer<1||answer>99)return {valid:false,message:'请填 1 到 99 之间的整数。'}
 const correct=satisfies(q.tree,q.target,answer)
 return {valid:true,correct,message:correct?'代入后等式成立！':'代入 '+answer+' 后，等式两边不相等。'}
}
export function puzzleProgress(round){
 const q=round.question
 const groups=q.all?combinations(q.cards,q.count,q.target):[]
 const total=q.all?(q.byValue?new Set(groups.map(ids=>valueKey(q.cards,ids))).size:groups.length):1
 const p={found:[],total,attempts:0,wrong:0,hinted:false,first:null,done:false,skipped:false}
 for(const e of round.events){
  if(p.done)throw Error('结束之后存在多余记录')
  if(e.type==='hint'&&!p.hinted){p.hinted=true;continue}
  if(e.type==='skip'){p.skipped=p.done=true;continue}
  if(e.type!=='answer')throw Error('记录类型无效')
  const r=assess(q,p,e.answer)
  if(!r.valid)throw Error(r.message)
  if(!p.attempts)p.first={correct:r.correct,hinted:p.hinted}
  p.attempts++
  if(!r.correct){p.wrong++;continue}
  if(q.mode==='treasure')p.found.push(r.key)
  p.done=q.mode==='mystery'||p.found.length===p.total
 }
 return p
}
export function validatePuzzle(r){
 if(![1,2].includes(r.version)||typeof r.id!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(r.id)||!Array.isArray(r.events))return false
 if(JSON.stringify(r.question)!==JSON.stringify(generatePuzzle(r.question.mode,r.level,r.seed,r.version)))return false
 puzzleProgress(r)
 return true
}
