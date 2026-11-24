import {defaults,value,tokens,features,skills,summary,median} from './engine.mjs'
export const prefs={learn:'add',sound:false,motion:true,timer:true,auto:true,minutes:10,faces:false,start:2}
export const fresh=()=>({schemaVersion:1,profile:crypto.randomUUID(),prefs:{...prefs},introduced:false,sessions:[]})
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9-]{1,64}$/.test(x)
const finite=x=>Number.isFinite(x)&&x>=0
function check(ok){if(!ok)throw Error('备份格式、版本或记录内容无效。')}
export function validate(d){
 check(d.schemaVersion===1&&id(d.profile)&&typeof d.introduced==='boolean'&&Array.isArray(d.sessions))
 const p=d.prefs;check(['add','sub','mul','div','mixed'].includes(p.learn)&&[2,4,6].includes(p.start)&&[5,10,15,20].includes(p.minutes))
 for(const k of ['sound','motion','timer','auto','faces'])check(typeof p[k]==='boolean')
 const ids=new Set()
 for(const s of d.sessions){
 check(id(s.id)&&!ids.has(s.id)&&finite(s.at)&&s.at<8640000000000000&&Number.isInteger(s.seed)&&['live','done','ended'].includes(s.status)&&['normal','test','review'].includes(s.type))
 ids.add(s.id);const c=s.c;check([10,13,99,999].includes(c.range)&&['flash','classic'].includes(c.mode)&&Object.hasOwn(skills,c.kind)&&Number.isInteger(c.count)&&c.count>=2&&c.count<=10&&[5,6,10,15,20].includes(c.length)&&[500,1000,1500,2000,3000].includes(c.speed)&&[0,200,500].includes(c.gap))
 check(c.mode!=='flash'||['add','sub'].includes(c.kind));check(Array.isArray(s.rows)&&s.rows.length===c.length&&Number.isInteger(s.i)&&s.i>=0&&s.i<s.rows.length)
 for(const [index,r] of s.rows.entries()){const q=r.q;function safe(t,depth){check(depth<=12);if(typeof t!=='number'){check(Array.isArray(t)&&t.length===3&&['+','-','*','/'].includes(t[0]));safe(t[1],depth+1);safe(t[2],depth+1)}}safe(q.tree,0)
 check(value(q.tree)===q.answer&&tokens(q.tree).filter(Number.isInteger).length===c.count&&q.version===1&&[...Object.values(skills),'sense.place','memory.accumulate'].includes(q.skill)&&typeof q.key==='string')
 const parts=tokens(q.tree),numbers=parts.filter(Number.isInteger),lo=c.range===999?100:c.range===99?10:1
 check(numbers.every(n=>n>=lo&&n<=c.range));const permitted={add:['+'],sub:['+','−'],mul:['×'],div:['÷'],mixed:['+','−','×','÷','(',')']}[c.kind]
 check(parts.every(v=>typeof v==='number'||permitted.includes(v)))
 check(q.key===(c.kind==='add'?numbers.slice().sort((a,b)=>a-b).join(','):JSON.stringify(q.tree)))
 check(Array.isArray(q.features)&&JSON.stringify(q.features)===JSON.stringify(features(q.tree)))
 check(r.first===null||typeof r.first==='object'&&!Array.isArray(r.first))
 check((!r.first&&!r.skip)||r.shown);check(!r.retries?.length||r.first);check(index>=s.i||r.first||r.skip);check(index<=s.i||(!r.shown&&!r.first&&!r.skip))
 if(s.status==='done')check(s.i===c.length-1&&(r.first||r.skip))
 check(typeof q.explanation==='string'&&q.explanation.length<=4096)
 check(q.templateId===c.mode+'.'+c.kind&&Array.isArray(q.cards)&&q.cards.length===c.count)
 check(q.cards.every((card,j)=>card.id==='c'+j&&card.value===numbers[j]))
 check(typeof r.skip==='boolean'&&typeof r.shown==='boolean'&&typeof r.interrupted==='boolean'&&Array.isArray(r.retries)&&!(r.first&&r.skip))
 for(const a of [r.first,...r.retries].filter(Boolean))check(Number.isSafeInteger(a.n)&&a.n>=0&&finite(a.ms)&&finite(a.display)&&['touch','keyboard'].includes(a.input))
 }}
 return d
}
export function merge(current,incoming){
 validate(incoming)
 if(current.profile!==incoming.profile&&current.sessions.length)throw Error('这份备份属于另一个档案，请先导出现有档案。')
 const sessions=new Map(current.sessions.map(s=>[s.id,s]))
 for(const s of incoming.sessions){if(sessions.has(s.id)&&JSON.stringify(sessions.get(s.id))!==JSON.stringify(s))throw Error('同一轮训练有不同内容，已保留当前记录。');sessions.set(s.id,s)}
 return validate({...incoming,sessions:[...sessions.values()]})
}
export const comparison=(s,r)=>JSON.stringify([s.c.mode,r.q.skill,s.c.kind,s.c.range,s.c.count,s.c.mode==='flash'?[s.c.speed,s.c.gap]:null,r.first.input,1])
export function records(sessions){const out=new Map();for(const s of sessions.filter(x=>x.status==='done')){const st=summary(s);if(st.answered<10||st.correct/st.answered<.9)continue
 const groups=new Map();for(const r of s.rows.filter(r=>r.first&&r.first.n===r.q.answer&&(r.first.timingValid??!r.interrupted))){const k=comparison(s,r);groups.set(k,[...(groups.get(k)||[]),r.first.ms])}for(const [k,t] of groups)if(t.length>=10)out.set(k,Math.min(out.get(k)??Infinity,median(t)))}return out}
export function recommendation(db,mode){
 let c={...defaults,mode,count:db.prefs.start,range:db.prefs.start===2?10:13}
 const history=db.sessions.filter(s=>s.status==='done'&&s.c.mode===mode&&s.type!=='review'&&['add',db.prefs.learn].includes(s.c.kind))
 let why='从已学范围开始，先练准确，再练速度。'
 if(db.prefs.auto&&history.length){const last=history.at(-1);c={...last.c,length:10};const recent=history.filter(s=>['range','kind','count','speed','gap'].every(k=>s.c[k]===c[k])).slice(-3)
 const attempts=recent.flatMap(s=>s.rows.filter(r=>r.first&&!r.retries.length)).slice(-20);const rate=attempts.filter(r=>r.first.n===r.q.answer).length/attempts.length
 const timed=s=>s.rows.filter(r=>r.first&&r.first.n===r.q.answer&&(r.first.timingValid??!r.interrupted)&&!r.retries.length);const latest=timed(last),prior=recent.slice(0,-1).flatMap(timed);const slower=latest.some(r=>{const k=comparison(last,r),before=prior.filter(x=>comparison(last,x)===k),now=latest.filter(x=>comparison(last,x)===k);return before.length>=10&&now.length>=10&&median(now.map(x=>x.first.ms))>1.1*median(before.map(x=>x.first.ms))});
 if(!slower&&attempts.length>=20&&recent.length>=2&&rate>=.95&&c.count<10){c.count++;why='同配置最近 '+attempts.length+' 次首答正确率达到 95%，试加一张牌。'}
 else if(attempts.length>=20&&recent.length>=2&&rate<.7&&c.count>2){c.count--;why='最近同配置首答正确率低于 70%，少一张牌练习。'}else why='沿用上一轮设置，继续积累同配置练习。'
 }return {c,why}
}
