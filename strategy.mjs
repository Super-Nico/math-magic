import {value,tokens} from './engine.mjs'

export const catalog={
 ten:['凑十','加减','找两张合起来是 10 的卡。'],
 hundred:['凑整百','加减','先合成两个 100，再相加。'],
 split:['数字拆分','数感','选出两位数，把它拆成几十和几。'],
 shift:['补偿法','策略','先选接近整百的数，再从另一张卡移一些给它。'],
 group:['交换与结合','加减','选两张可以凑成整十的卡，再加上剩下的数。'],
 distribute:['乘法分配律','乘除','选两位数因数，把它拆成十位和个位，再分别乘。'],
 product:['特殊乘法关系','乘除','先选能相乘得到 100 的两个因数。'],
 inverse:['逆运算','加减','先选总数，再选已知加数，用减法求缺数。'],
 order:['运算优先级','策略','选出应该先相乘的两个数。']
}
const add=(a,b)=>['+',a,b],mul=(a,b)=>['*',a,b]
const sum=xs=>xs.reduce(add)
export const formula=tree=>tokens(tree).join(' ')
function problem(skill,k){
 const a=2+k%6,b=11+k%75,c=11+(k+13)%75
 switch(skill){
 case 'ten':return sum([a,k%8+1,10-a])
 case 'hundred':return sum([b,c,100-b,100-c])
 case 'split':return add(10*(1+k%8)+a,3+k%5)
 case 'shift':return add(100-a,24+k%50)
 case 'group':return sum([10+a,7+k%8,10-a])
 case 'distribute':return mul(2+k%7,11+k%8)
 case 'product':return mul(mul(25,2+k%7),4)
 case 'inverse':return ['-',35+k%60,a]
 case 'order':return add(a,mul(3+k%6,2+k%7))
 }
}
export function makeLesson(skill,seed){
 if(!Object.hasOwn(catalog,skill)||!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error('课程配置无效')
 return {version:1,id:crypto.randomUUID(),skill,seed,questions:[0,1,2].map(i=>problem(skill,seed+i)),answers:[],steps:[],variantSteps:[[],[]],advanced:0}
}
export const cards=tree=>tokens(tree).filter(Number.isInteger)
export function prompt(skill,tree){
 if(skill==='inverse')return '□ ＋ '+tree[2]+' ＝ '+tree[1]
 return formula(tree)+' ＝ ?'
}
export function transform(lesson,selection){
 const before=lesson.steps.at(-1)?.afterAST??lesson.questions[0],xs=cards(before)
 const [i,j]=selection,a=xs[i],b=xs[j],skill=lesson.skill
 const single=['split','distribute'].includes(skill)
 if(selection.length!==(single?1:2)||!selection.every(n=>Number.isInteger(n)&&n>=0&&n<xs.length)||i===j)throw Error(catalog[skill][2])
 let after,action,reason=catalog[skill][2]
 if(['ten','hundred','group'].includes(skill)){
  const target={ten:10,hundred:100,group:20}[skill]
  if(xs.length===2||a+b===target){after=sum([...xs.filter((_,n)=>n!==i&&n!==j),a+b]);action='combine'}
 }else if(!lesson.steps.length){
  if(skill==='split'&&i===0){after=add(add(a-a%10,a%10),xs[1]);action='split'}
  if(skill==='distribute'&&i===1){after=add(mul(xs[0],10),mul(xs[0],a-10));action='distribute'}
  if(skill==='shift'&&i===0){after=add(100,b-(100-a));action='transfer'}
  if(skill==='product'&&a*b===100){after=mul(100,xs.find((_,n)=>n!==i&&n!==j));action='group'}
  if(skill==='inverse'&&i===0){after=before[1]-before[2];action='inverse'}
  if(skill==='order'&&i!==0&&j!==0){after=add(xs[0],a*b);action='multiply'}
 }
 if(after===undefined||value(after)!==value(before))throw Error(reason)
 return {stepId:lesson.steps.length+1,beforeAST:before,actionType:action,allowedCardIds:selection,afterAST:after,rationale:reason}
}
export function finishedOperation(l){
 return l.steps.length>0&&(!['ten','hundred','group'].includes(l.skill)||typeof l.steps.at(-1).afterAST==='number')
}
export function validateLesson(l){
 const ok=Object.hasOwn(catalog,l.skill)&&l.version===1&&typeof l.id==='string'&&/^[a-zA-Z0-9-]{1,64}$/.test(l.id)&&Number.isInteger(l.seed)&&l.seed>=0&&l.seed<=4294967295
 if(!ok||(l.studied!==undefined&&typeof l.studied!=='boolean')||!Array.isArray(l.questions)||l.questions.length!==3||!l.questions.every((q,i)=>JSON.stringify(q)===JSON.stringify(problem(l.skill,l.seed+i))))return false
 if(!Array.isArray(l.answers)||l.answers.length>3||!l.answers.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=9999999)||!Number.isInteger(l.advanced)||l.advanced<0||l.advanced>l.answers.length||l.answers.length>l.advanced+1)return false
 if(!Array.isArray(l.variantSteps)||l.variantSteps.length!==2)return false
 return [l.steps,...l.variantSteps].every((steps,i)=>validSteps({...l,questions:[l.questions[i]],steps,answers:l.answers.slice(i)}))
}
function validSteps(l){
 if(!Array.isArray(l.steps)||l.steps.length>3||(l.steps.length&&!l.answers.length))return false
 const replay={...l,steps:[]}
 for(const step of l.steps){
  if(finishedOperation(replay)||JSON.stringify(transform(replay,step.allowedCardIds))!==JSON.stringify(step))return false
  replay.steps.push(step)
 }
 return true
}
export function progress(lessons,skill){
 const rounds=lessons.filter(l=>l.skill===skill)
 const answers=rounds.flatMap(l=>l.answers.map((a,i)=>a===value(l.questions[i])))
 const correct=answers.filter(Boolean).length
 const mastered=answers.length>=20&&correct/answers.length>=.9&&rounds.filter(l=>l.answers.length).length>=2&&rounds.some(l=>l.variantSteps.some((steps,i)=>finishedOperation({...l,steps})&&l.answers[i+1]===value(l.questions[i+1])))&&rounds.some(l=>l.answers.length>1)
 return {count:answers.length,correct,state:mastered?'已掌握':answers.length?'练习中':rounds.some(l=>l.studied)?'已学习':'未探索'}
}
