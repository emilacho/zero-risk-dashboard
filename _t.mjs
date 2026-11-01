import { chromium } from "playwright"
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:1800,height:1013} })
const u = process.argv[2]
const t0=Date.now(); const reqs=[]
p.on("response", async r=>{ const h=r.headers(); reqs.push([Date.now()-t0, r.status(), r.url().split("?")[0].slice(-60), h["content-length"]||h["content-encoding"]||""]) })
await p.goto(u,{waitUntil:"load"}); console.log("final", p.url(), "load", Date.now()-t0)
reqs.slice(0,40).forEach(x=>console.log(x.join(" ")))
await b.close()
