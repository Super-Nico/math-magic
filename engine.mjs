export const defaults={mode:'classic',kind:'add',range:13,count:4,length:10,speed:2000,gap:200}
export const sign={'+':'+','-':'−','*':'×','/':'÷'}
export const skills={add:'add.multi',sub:'sub.single',mul:'mul.fact',div:'div.exact',mixed:'mix.priority'}
export function rng(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296}}
export function value(t){
 if(typeof t==='number'){if(!Number.isInteger(t)||t<1||t>999)throw Error('牌值越界');return t}
 const a=value(t[1]),b=value(t[2]);const n={'+':a+b,'-':a-b,'*':a*b,'/':a/b}[t[0]]
 if(!Number.isInteger(n)||n<0||n>1000000)throw Error('运算越界');return n
}
export function tokens(t,parent='',right=false){
 if(typeof t==='number')return [t]
 const [op,a,b]=t, precedence=x=>'+-'.includes(x)?1:2
 const body=[...tokens(a,op),sign[op],...tokens(b,op,true)]
 return parent&&(precedence(op)<precedence(parent)||right&&precedence(op)===precedence(parent))?['(',...body,')']:body
}
export function features(t){
 if(typeof t==='number')return []
 const [op,left,right]=t,a=value(left),b=value(right),tags=[...features(left),...features(right)]
 if(op==='/' )tags.push('div.exact')
 if(op==='+'||op==='-'){let x=a,y=b,carry=0;while(x||y){const digit=x%10,other=y%10;carry=op==='+'?Number(digit+other+carry>=10):Number(digit-other-carry<0);if(carry)tags.push(op==='+'?'add.carry':'sub.borrow');x=Math.floor(x/10);y=Math.floor(y/10)}}
 return [...new Set(tags)]
}
export function generate(c,seed,exclude=[],pattern=null){
 if(!['classic','flash'].includes(c.mode)||!Object.hasOwn(skills,c.kind)||![10,13,99,999].includes(c.range)||!Number.isInteger(c.count)||c.count<2||c.count>10||![5,6,10,15,20].includes(c.length)||![500,1000,1500,2000,3000].includes(c.speed)||![0,200,500].includes(c.gap)||c.mode==='flash'&&!['add','sub'].includes(c.kind))throw Error('设置组合不可用')
 const r=rng(seed),lo=c.range===999?100:c.range===99?10:1,pick=(a,b)=>a+Math.floor(r()*(b-a+1))
 const used=new Set(exclude),items=[]
 for(let i=0;i<c.length;i++){
 let found=false
 for(let attempt=0;attempt<100&&!found;attempt++){
 let tree=pick(lo,c.range),total=tree
 for(let j=1;j<c.count;j++){
 let op={add:'+',sub:r()<0.55?'-':'+',mul:'*',div:'/',mixed:['+','-','*','/'][pick(0,3)]}[c.kind],n=pick(lo,c.range)
 if(pattern)op=pattern[j-1]
 if(op==='-'&&total<lo){if(pattern){tree=null;break}op='+'}
 if(op==='-')n=pick(lo,Math.min(total,c.range))
 if(op==='/'){const factors=[];for(let k=lo;k<=c.range;k++)if(total%k===0)factors.push(k);if(!factors.length){tree=null;break}n=factors[pick(0,factors.length-1)]}
 if(op==='*'){const max=Math.min(c.range,Math.floor(1000000/Math.max(1,total)));if(max<lo){tree=null;break}n=pick(lo,max)}
 tree=[op,tree,n];total=value(tree)
 }
 if(!tree)continue
 const parts=tokens(tree),key=c.kind==='add'?parts.filter(Number.isInteger).sort((a,b)=>a-b).join(','):JSON.stringify(tree)
 if(used.has(key))continue
 used.add(key);items.push({tree,cards:parts.filter(Number.isInteger).map((n,j)=>({id:'c'+j,value:n,suit:c.range<=13?['spade','heart','club','diamond'][j%4]:null})),templateId:c.mode+'.'+c.kind,answer:total,key,features:features(tree),explanation:explain({tree,answer:total}),skill:c.mode==='flash'?'memory.accumulate':skills[c.kind],version:1});found=true
 }
 if(!found)throw Error('这个范围内无法生成足够多的不同题目，请减少牌数、题量或更换运算。')
 }return items
}
export function median(xs){if(!xs.length)return null;const a=xs.slice().sort((a,b)=>a-b),m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2}
export function summary(s){const rows=s.rows.filter(x=>x.first),correct=rows.filter(x=>x.first.n===x.q.answer)
 return {answered:rows.length,correct:correct.length,skips:s.rows.filter(x=>x.skip).length,shown:s.rows.filter(x=>x.shown).length,ms:median(correct.filter(x=>x.first.timingValid??!x.interrupted).map(x=>x.first.ms))}
}
export function explain(q){const p=tokens(q.tree);if(p.every(x=>Number.isInteger(x)||x==='+')){const a=p.filter(Number.isInteger);for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if((a[i]+a[j])%10===0)return '先把 '+a[i]+' 和 '+a[j]+' 合成 '+(a[i]+a[j])+'，再加上其余数字，得到 '+q.answer+'。'}
 const steps=[];function walk(t){if(typeof t==='number')return t;const a=walk(t[1]),b=walk(t[2]),v=value(t);steps.push(a+' '+sign[t[0]]+' '+b+' = '+v);return v}walk(q.tree);return steps.join('，')}
