# Parkridge scorecard cost model: reference implementation and 20-persona simulation (Oct 27, 2026)
# Run: python3 scorecard-cost-model.py   (prints the old model, then the approved model)
import statistics as s
from collections import Counter
import csv, json
LEADS={"<10":5,"10-25":10,"25-50":25,"50-100":50,"100+":100}
LEADS_MID={"<10":6,"10-25":17,"25-50":37,"50-100":75,"100+":120}
CLOSE={"0-1":.10,"2-3":.20,"4-5":.40,"6+":.60,"NS":.20}
VAL={"<500":250,"500-2K":500,"2K-10K":2000,"10K-50K":10000,"50K+":50000}
VAL_MID={"<500":300,"500-2K":1000,"2K-10K":4500,"10K-50K":22000,"50K+":75000}
RESP={"5min":None,"15min":None,"hour":(.05,.10),"same_day":(.15,.30),"1-2days":(.25,.50),"varies":(.15,.30)}
FU={"once":(.20,.40),"2-3":(.10,.20),"NS":(.10,.20),"4-6":None,"7+":None}
REACT={"regular":None,"now_then":(.03,.06),"rarely":(.05,.10),"no_list":None}
ORDER=["slow_response","short_follow_up","untapped_database"]
# name, staff, industry, leads, resp, fu, close, value, react, tracking, ai_level, sources
P=[
("Mike's Mobile Plumbing",1,"Plumbing, solo","10-25","varies","once","4-5","500-2K","rarely","inbox",1,["Referrals","Organic search"]),
("Lens & Light Photography",1,"Wedding photographer","<10","same_day","2-3","2-3","2K-10K","rarely","spreadsheet",2,["Referrals","Social media"]),
("Clear Path Coaching",1,"Business coach","<10","hour","2-3","2-3","2K-10K","now_then","spreadsheet",3,["Social media","Referrals"]),
("Hartley Realty",1,"Solo real estate agent","25-50","hour","4-6","0-1","10K-50K","now_then","crm_fuzzy",2,["Paid ads","Referrals","Social media"]),
("Ledger Bookkeeping",2,"Bookkeeping","<10","same_day","once","4-5","2K-10K","rarely","spreadsheet",2,["Referrals"]),
("Summit Farmers Agency",5,"P&C insurance agency","50-100","hour","2-3","2-3","500-2K","rarely","crm_fuzzy",1,["Referrals","Paid ads","Partners"]),
("Wasatch Wealth Partners",4,"Financial advisor","10-25","same_day","2-3","4-5","2K-10K","now_then","crm_fuzzy",2,["Referrals","Partners"]),
("Bright Smile Dental",20,"Dental practice","50-100","hour","2-3","4-5","500-2K","now_then","crm_fuzzy",1,["Organic search","Paid ads","Referrals"]),
("Glow Med Spa",8,"Med spa","50-100","same_day","2-3","2-3","500-2K","rarely","crm_fuzzy",2,["Social media","Paid ads"]),
("Great Install LLC",10,"HVAC","25-50","same_day","2-3","2-3","2K-10K","rarely","spreadsheet",2,["Referrals","Paid ads"]),
("Peak Roofing",15,"Roofing","50-100","same_day","once","2-3","10K-50K","rarely","crm_fuzzy",1,["Paid ads","Referrals","Partners"]),
("Benson & Cole Law",12,"Personal injury law","25-50","15min","4-6","2-3","10K-50K","now_then","crm_connected",3,["Paid ads","Organic search","Referrals"]),
("Tally CPA Group",6,"CPA firm","10-25","1-2days","once","6+","2K-10K","rarely","spreadsheet",1,["Referrals"]),
("Spark Digital Agency",10,"Marketing agency","10-25","same_day","4-6","2-3","10K-50K","now_then","crm_connected",4,["Referrals","Outbound","Social media"]),
("Evergreen Landscaping",25,"Landscaping","25-50","1-2days","once","4-5","2K-10K","rarely","spreadsheet",0,["Referrals","Organic search"]),
("Shield Pest Control",30,"Pest control","100+","5min","7+","4-5","500-2K","regular","crm_connected",3,["Paid ads","Organic search","Partners","Referrals"]),
("Ridgeline Custom Homes",30,"Custom home builder","10-25","same_day","2-3","0-1","50K+","rarely","crm_fuzzy",1,["Referrals","Organic search"]),
("SunCore Solar",30,"Solar installer","100+","hour","2-3","0-1","10K-50K","now_then","crm_fuzzy",3,["Paid ads","Outbound","Partners"]),
("Sparkle Home Cleaning",20,"Residential cleaning","50-100","varies","once","4-5","2K-10K","rarely","spreadsheet",1,["Paid ads","Organic search","Referrals"]),
("NetGuard IT",18,"Managed IT services","<10","5min","7+","4-5","10K-50K","regular","crm_connected",4,["Referrals","Outbound","Partners"]),
]
def run(p, leads_map=LEADS, val_map=VAL, cap=None):
    name,staff,ind,leads,resp,fu,close,val,react,trk,ai,src=p
    rev=leads_map[leads]*CLOSE[close]*val_map[val]
    lk={}
    for k,tbl,a in [("slow_response",RESP,resp),("short_follow_up",FU,fu),("untapped_database",REACT,react)]:
        r=tbl[a]
        if r: lk[k]=(rev*r[0],rev*r[1])
    ranked=sorted(lk.items(),key=lambda x:(-x[1][1],ORDER.index(x[0])))
    top=ranked[:2]
    lo=sum(v[0] for k,v in top); hi=sum(v[1] for k,v in top)
    lift_hi=sum(RESP.get(resp) and 0 or 0 for _ in [0])
    pct_lo=lo/rev if rev else 0; pct_hi=hi/rev if rev else 0
    if not top: status="no_dollar_leak"
    elif hi*12<6000: status="too_small_hidden"
    else: status="shown"
    return dict(name=name,staff=staff,industry=ind,rev_month=rev,top_leak=top[0][0] if top else (trk if trk!="crm_connected" else "ad_hoc_ai" if ai<=2 else "none"),
                month_lo=round(lo),month_hi=round(hi),year_lo=round(lo*12),year_hi=round(hi*12),pct_lo=round(pct_lo*100),pct_hi=round(pct_hi*100),status=status)
CAP_HI, CAP_LO = .35, .175
RETENTION = 1 + .85 + .85**2   # 3 years at 85% retention = 2.5725
HOURS = {"leads":(2,4),"quotes":(3,5),"followup":(2,4),"crm":(2,4),"scheduling":(1,3),"reporting":(1,2),"onboarding":(2,3),"admin":(2,4)}
SINKS = {"Mike's Mobile Plumbing":["quotes","scheduling","admin"],"Lens & Light Photography":["followup","admin"],"Clear Path Coaching":["followup","onboarding"],
"Hartley Realty":["leads","followup","crm"],"Ledger Bookkeeping":["admin","onboarding"],"Summit Farmers Agency":["quotes","crm","followup"],
"Wasatch Wealth Partners":["crm","reporting","onboarding"],"Bright Smile Dental":["scheduling","admin","followup"],"Glow Med Spa":["leads","scheduling","followup"],
"Great Install LLC":["followup","quotes","crm"],"Peak Roofing":["quotes","followup","scheduling"],"Benson & Cole Law":["onboarding","admin","reporting"],
"Tally CPA Group":["admin","onboarding","followup"],"Spark Digital Agency":["reporting","quotes","onboarding"],"Evergreen Landscaping":["quotes","scheduling","admin"],
"Shield Pest Control":["scheduling","reporting","admin"],"Ridgeline Custom Homes":["quotes","followup","crm"],"SunCore Solar":["leads","quotes","crm"],
"Sparkle Home Cleaning":["scheduling","leads","admin"],"NetGuard IT":["quotes","reporting","onboarding"]}
INSURANCE = {"Summit Farmers Agency"}
def run2(p):
    name,staff,ind,leads,resp,fu,close,val,react,trk,ai,src=p
    v = VAL[val]*(RETENTION if name in INSURANCE else 1)
    rev = LEADS_MID[leads]*CLOSE[close]*v
    lk={}
    for k,tbl,a in [("slow_response",RESP,resp),("short_follow_up",FU,fu),("untapped_database",REACT,react)]:
        if tbl[a]: lk[k]=tbl[a]
    ranked=sorted(lk.items(),key=lambda x:(-x[1][1],ORDER.index(x[0])))[:2]
    if not ranked:
        h=[HOURS[t] for t in SINKS[name]]
        return dict(name=name,staff=staff,top="hours",lo=sum(a for a,b in h),hi=sum(b for a,b in h),plo=0,phi=0,status="hours")
    plo=1; phi=1
    for k,(a,b) in ranked: plo*=1-a; phi*=1-b
    plo,phi=1-plo,1-phi
    phi=min(phi,CAP_HI); plo=min(plo,CAP_LO)
    lo,hi=rev*plo,rev*phi
    status="shown" if hi*12>=6000 else "too_small_hidden"
    return dict(name=name,staff=staff,top=ranked[0][0],lo=round(lo,-2),hi=round(hi,-2),plo=round(plo*100),phi=round(phi*100),status=status)
old={r["name"]:r for r in [run(p) for p in P]}
new=[run2(p) for p in P]
for r in new:
    o=old[r["name"]]
    if r["status"]=="hours": nv=f"{r['lo']}-{r['hi']} hrs/wk"
    else: nv=f"${r['lo']:,.0f}-${r['hi']:,.0f}"
    ov=f"${o['month_lo']:,}-${o['month_hi']:,}" if o['status']=='shown' else "none"
    print(f"{r['name'][:25]:25}|{r['staff']:>3}|{r['top']:17}|{ov:>17}|{nv:>17}|{o['pct_lo']}-{o['pct_hi']}% -> {r['plo']}-{r['phi']}%|{r['status']}")
sh=[r for r in new if r['status']=='shown']
print("shown",len(sh),"median",s.median([r['lo'] for r in sh]),s.median([r['hi'] for r in sh]),"mean",round(s.mean([r['lo'] for r in sh])),round(s.mean([r['hi'] for r in sh])))
print("below $750/mo low:",[r['name'] for r in sh if r['lo']<750])
print(Counter(r['status'] for r in new))
