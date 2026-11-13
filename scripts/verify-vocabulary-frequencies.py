"""Authoring audit only: uv run --with wordfreq==3.1.1 python scripts/verify-vocabulary-frequencies.py.
The data bank retains attribution and its CC-BY-SA-4.0 licence. No learner data or network calls.
"""
import importlib.metadata
import json
from pathlib import Path
from wordfreq import top_n_list
assert importlib.metadata.version('wordfreq') == '3.1.1'
bank = json.loads((Path(__file__).resolve().parents[1] / 'data/vocabulary/bank-v1.json').read_text())
assert bank['license'] == 'CC-BY-SA-4.0' and bank['attribution']
for language in ['en', 'zh', 'ja', 'ko', 'es']:
    words = [w for w in top_n_list(language, 30000, wordlist='best')
             if any(c.isalpha() for c in w) and not any(c.isdigit() or c.isspace() for c in w)][:10000]
    items = [i for i in bank['items'] if i['language'] == language]
    assert len(items) == 300, (language, len(items))
    for item in items:
        assert words[item['rank'] - 1] == item['word'], item['id']
        assert item['band'] == next(i for i, upper in enumerate([1000, 3000, 6000, 10000]) if item['rank'] <= upper)
    assert [sum(i['band'] == b for i in items) for b in range(4)] == [75] * 4
print('All 1500 word forms match wordfreq 3.1.1 ranks and the four declared strata.')
