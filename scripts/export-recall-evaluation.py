# Run on the product host. Emits only aggregate counts and relative-day/rating sequences.
# Redirect to a mode-0600 temporary file; never commit individual sequences.
import json,pathlib,collections,os
root=pathlib.Path(os.environ['ENGLEARN_DATA_DIR'])/'learning-journals';seqs=[];stats={'journals':0,'recallRounds':0,'cardsWithRecall':0,'delayedObservations':0,'invalidFiles':0}
for file in sorted(root.glob('*/*.json')):
 try:
  s=json.loads(file.read_text())['session'];stats['journals']+=1
  cards=collections.defaultdict(list)
  for r in s.get('reviews',[]):
   stats['recallRounds']+=1
   for card,rating in zip(r['cards'],r['ratings']): cards[card].append((r['at'],rating))
  for seq in cards.values():
   seq.sort();base=seq[0][0];seqs.append([[(at-base)/86400000,r] for at,r in seq]);stats['cardsWithRecall']+=1
   stats['delayedObservations']+=sum(seq[i][0]-seq[i-1][0]>=86400000 for i in range(1,len(seq)))
 except Exception: stats['invalidFiles']+=1
print(json.dumps({'stats':stats,'sequences':seqs}))
