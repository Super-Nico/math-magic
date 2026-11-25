import {rng,sign} from './engine.mjs'

export const operations={add:['+'],sub:['+','-'],mul:['+','-','*'],div:['+','-','/'],mixed:['+','-','*','/']}
export const targets=learn=>operations[learn].includes('*')?[24,36,100]:[24,36]
const initial=cards=>cards.map((value,i)=>({id:1<<i,value,text:String(value)}))
function combine(a,op,b){
 const value={'+':a.value+b.value,'-':a.value-b.value,'*':a.value*b.value,'/':a.value/b.value}[op]
 if(!Number.isInteger(value)||value<0)return null
 return {id:a.id|b.id,value,text:'('+a.text+' '+sign[op]+' '+b.text+')'}
}
export function targetBoard(q,steps){
 let board=initial(q.cards)
 if(!Array.isArray(steps)||steps.length>3)throw Error('最多合并三次。')
 for(const move of steps){
  if(!Array.isArray(move)||move.length!==3)throw Error('请选择两张牌。')
  const [left,op,right]=move,a=board.find(t=>t.id===left),b=board.find(t=>t.id===right)
  if(!a||!b||a===b||!operations[q.learn].includes(op))throw Error('请选择两张可用的牌和已学运算。')
  const next=combine(a,op,b)
  if(!next)throw Error('这一步需要得到非负整数，除数也要大于零。')
  board=board.filter(t=>t!==a&&t!==b).concat(next)
 }
 return board
}
export function solveTarget(q,budget=8000){
 let visited=0
 function search(board,path){
  if(++visited>budget)throw Error('搜索达到上限')
  if(board.length===1)return board[0].value===q.target?path:null
  for(const a of board)for(const b of board){
   if(a===b)continue
   for(const op of operations[q.learn]){
    if((op==='+'||op==='*')&&a.id>b.id)continue
    const result=combine(a,op,b)
    if(!result)continue
    const solution=search(board.filter(t=>t!==a&&t!==b).concat(result),[...path,[a.id,op,b.id]])
    if(solution)return solution
   }
  }
  return null
 }
 return search(initial(q.cards),[])
}
export function targetQuestion(learn,target,seed){
 if(!Object.hasOwn(operations,learn)||!targets(learn).includes(target))throw Error('目标超出已学范围')
 const random=rng(seed)
 for(let i=0;i<=48;i++){
  const cards=i<48?Array.from({length:4},()=>1+Math.floor(random()*13)):({24:[3,5,7,9],36:[6,8,10,12],100:[2,3,7,13]})[target]
  const q={cards,learn,target},solution=solveTarget(q)
  if(solution)return {...q,solution}
 }
 throw Error('未找到可解题目')
}
export function sprintQuestion(seed,index,level){
 const random=rng((seed+Math.imul(index,2654435761))>>>0)
 const a=level===0?1+Math.floor(random()*9):2+Math.floor(random()*8),b=level===0?1+Math.floor(random()*(10-a)):11-a+Math.floor(random()*(a-1||1))
 return [a,b]
}
export function sprintStats(r){
 const correct=r.rows.filter(row=>row.answer===row.cards[0]+row.cards[1]).length
 const answered=r.rows.filter(row=>Number.isInteger(row.answer)).length
 const skipped=r.rows.filter(row=>row.answer==='skip').length
 return {answered,correct,skipped,wrong:answered-correct,timeout:Number(r.status==='done'),
 eligible:r.status==='done'&&r.valid&&answered>=10&&correct/answered>=.9}
}
export const beforeDeadline=(elapsed,seconds)=>Number.isFinite(elapsed)&&elapsed>=0&&elapsed<seconds*1000
export function validChallenge(r){
 try{
 if(!r||r.version!==1||!Number.isInteger(r.seed)||r.seed<0||r.seed>4294967295)return false
 if(r.mode==='target'){
  const q=r.q
  if(!Object.hasOwn(operations,q.learn)||!targets(q.learn).includes(q.target)||q.cards.length!==4||!q.cards.every(x=>Number.isInteger(x)&&x>=1&&x<=13))return false
  if(targetBoard(q,q.solution)[0].value!==q.target||q.solution.length!==3)return false
  const board=targetBoard(q,r.steps)
  if(!Number.isInteger(r.hints)||r.hints<0||r.hints>3||!Array.isArray(r.attempts))return false
  for(const [i,a] of r.attempts.entries()){
   const result=targetBoard(q,a.steps)
   if(result.length!==1||!Number.isInteger(a.hints)||a.hints<0||a.hints>r.hints)return false
   if(result[0].value===q.target&&(i!==r.attempts.length-1||r.status!=='done'))return false
  }
  return ['live','skip','done'].includes(r.status)&&(r.status!=='done'||(board.length===1&&board[0].value===q.target&&JSON.stringify(r.steps)===JSON.stringify(r.attempts.at(-1)?.steps)))
 }
 if(r.mode!=='sprint'||![60,120].includes(r.seconds)||![0,1].includes(r.level)||!['screen','keyboard'].includes(r.input)||typeof r.valid!=='boolean'||!['live','done','ended'].includes(r.status))return false
 if(!Number.isFinite(r.elapsed)||r.elapsed<0||r.elapsed>r.seconds*1000||(r.status==='done')!==(r.elapsed===r.seconds*1000))return false
 if(!Array.isArray(r.rows)||!r.rows.length)return false
 let previous=0
 return r.rows.every((row,i)=>{
  if(JSON.stringify(row.cards)!==JSON.stringify(sprintQuestion(r.seed,i,r.level)))return false
  if(i===r.rows.length-1)return row.answer===null
  if(!beforeDeadline(row.at,r.seconds)||row.at<previous||row.at>r.elapsed)return false
  previous=row.at
  return row.answer==='skip'||Number.isInteger(row.answer)&&row.answer>=0&&row.answer<=99
 })
 }catch{return false}
}
