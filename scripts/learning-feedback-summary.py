#!/usr/bin/env python3
"""Read-only content QA summary on the product host; never emits owners or free-text notes."""
import collections,json,os,pathlib
root=pathlib.Path(os.environ['ENGLEARN_DATA_DIR'])/'learning-feedback'
counts=collections.Counter();invalid=0
for file in root.glob('*/*.json'):
 try:
  report=json.loads(file.read_text())['session']
  counts[(report['question'],report['reason'])]+=1
 except (KeyError,ValueError,OSError):invalid+=1
print(json.dumps({'invalidRecords':invalid,'reports':[{'question':q,'reason':r,'count':n} for (q,r),n in counts.most_common()]},ensure_ascii=False,indent=2))
