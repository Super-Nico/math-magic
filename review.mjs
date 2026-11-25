const gaps=[1,3,7]
// 把本地年月日映射为连续日序，跨夏令时也按日历天推进。
export function reviewDay(time){
 const d=new Date(time)
 return Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000
}
export function reviewQueue(sessions,now=Date.now()){
 const today=reviewDay(now),entries=new Map()
 for(const s of sessions){
  if(s.type==='spaced')continue
  s.rows.forEach((r,i)=>{
   if(!r.first||r.first.n===r.q.answer)return
   const id=s.id+'-'+i
   entries.set(id,{id,s,r,stage:0,due:reviewDay(r.first.at??s.at)+1,history:[],live:null})
  })
 }
 const reviews=sessions.filter(s=>s.type==='spaced').sort((a,b)=>(a.rows[0].first?.at??a.at)-(b.rows[0].first?.at??b.at))
 for(const s of reviews){
  const e=entries.get(s.source)
  if(!e)continue
  const row=s.rows[0],first=row.first
  e.history.push(s)
  if(!first){if(!row.skip&&s.status==='live')e.live=s;continue}
  const day=reviewDay(first.at??s.at)
  if(e.stage===gaps.length||day<e.due)continue
  e.stage=first.n===row.q.answer&&!first.hintUsed?e.stage+1:0
  e.due=e.stage===gaps.length?null:day+gaps[e.stage]
 }
 return [...entries.values()].map(e=>({...e,ready:e.due!==null&&e.due<=today}))
}
export function dueLabel(e,now=Date.now()){
 if(e.due===null)return '三次间隔复习已完成'
 const remaining=e.due-reviewDay(now)
 if(remaining<=0)return '可以复习'
 if(remaining===1)return '明天复习'
 const d=new Date(e.due*86400000)
 return (d.getUTCMonth()+1)+' 月 '+d.getUTCDate()+' 日复习'
}
