import re, sys
def parse(path):
    d=open(path,'rb').read()
    s=d.replace(b'\xfe',b'|').replace(b'\xfd',b'~').replace(b'\xfc',b'^')
    s=re.sub(rb'[\x00-\x08\x0e-\x1f\x7f-\xff]',b'\x01',s).decode('latin1')
    out={}
    for m in re.finditer(r'([A-Za-z@][A-Za-z0-9_.@%$-]{0,40})\x01+([DIAS])\|([^|\x01]*)\|([^|\x01]*)\|([^|\x01]*)\|([^|\x01]*)\|?([SM]?)', s):
        rid,typ,loc,conv,head,fmt,sm=m.groups()
        out.setdefault(rid,(typ,loc,conv,head.replace('~',' '),fmt,sm))
    return out
for p in sys.argv[1:]:
    d=parse(p)
    print('=====',p,len(d))
    rows=sorted(d.items(), key=lambda kv:(kv[1][0]!='D', int(kv[1][1]) if kv[1][0]=='D' and kv[1][1].isdigit() else 9999, kv[0]))
    for rid,(typ,loc,conv,head,fmt,sm) in rows:
        print(f"{typ}\t{loc[:70]}\t{rid}\t{head[:30]}\t{conv[:14]}\t{fmt}\t{sm}")
