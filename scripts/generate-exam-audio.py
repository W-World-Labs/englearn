"""Authoring tool only: uv run --with edge-tts==7.2.8 --with mutagen==1.47.0 python scripts/generate-exam-audio.py

Reads original question scripts; never sends learner answers. Generated MP3s ship
with the release, so production does not contact a speech provider.
"""
import argparse
import asyncio
import hashlib
import json
from pathlib import Path

import edge_tts
from mutagen.mp3 import MP3

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'exam-assets' / 'audio'
SAMPLES = {
    'hsk': '你好。开始练习前，请确认能清楚听到这段语音。',
    'topik': '안녕하세요. 연습을 시작하기 전에 소리가 잘 들리는지 확인해 주세요.',
    'jlpt': 'こんにちは。練習を始める前に、この音声がはっきり聞こえることを確認してください。',
}

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--family', choices=list(SAMPLES), help='Regenerate only one family and preserve other recordings.')
    args = parser.parse_args()
    families = [args.family] if args.family else list(SAMPLES)
    clips = []
    for family in families:
        voices = {'hsk': ['zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural'], 'topik': ['ko-KR-SunHiNeural', 'ko-KR-InJoonNeural'], 'jlpt': ['ja-JP-NanamiNeural', 'ja-JP-KeitaNeural']}[family]
        clips.append((f'{family}-check-v1', 'sample', SAMPLES[family], voices[0], '-5%'))
        for paper in json.loads((ROOT / 'data' / 'exams' / f'{family}.json').read_text()):
            for i, q in enumerate(paper['questions']):
                if q.get('script'):
                    rate = '-15%' if paper['id'] in ['hsk-1-01-v1', 'hsk-2-01-v1'] else '-10%' if paper['id'] == 'topik-i-01-v1' else '-5%'
                    if family == 'jlpt':
                        rate = {'N5': '-10%', 'N4': '-8%', 'N3': '-5%', 'N2': '+0%', 'N1': '+0%'}[paper['level']]
                    clips.append((paper['id'], q['id'], q['script'], voices[i % 2], rate))
    semaphore = asyncio.Semaphore(2)
    async def generate(clip):
        paper_id, question_id, text, voice, rate = clip
        filename = f'{paper_id}-{question_id}.mp3'
        target = OUT / filename
        temporary = target.with_suffix('.tmp')
        async with semaphore:
            for attempt in range(2):
                try:
                    await asyncio.wait_for(edge_tts.Communicate(text, voice, rate=rate, connect_timeout=10, receive_timeout=20).save(str(temporary)), 45)
                    duration = MP3(temporary).info.length
                    if duration < 0.5 or temporary.stat().st_size < 1000:
                        raise ValueError('Incomplete speech asset')
                    temporary.replace(target)
                    print(f'Generated {filename}: {duration:.2f}s', flush=True)
                    return {'paperId': paper_id, 'questionId': question_id, 'file': filename, 'duration': round(duration, 3), 'voice': voice, 'rate': rate, 'scriptSha256': hashlib.sha256(text.encode()).hexdigest(), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
                except Exception:
                    temporary.unlink(missing_ok=True)
                    if attempt: raise
                    await asyncio.sleep(1)
    assets = await asyncio.gather(*(generate(c) for c in clips))
    manifest_path = ROOT / 'data' / 'exams' / 'audio.json'
    if args.family and manifest_path.exists():
        previous = json.loads(manifest_path.read_text())['clips']
        assets = [clip for clip in previous if not clip['paperId'].startswith(args.family + '-')] + assets
    manifest = {'format': 'audio/mpeg', 'generator': 'edge-tts 7.2.8', 'source': 'Original LingoLearn scripts, synthesized through Microsoft Edge online speech. No learner data.', 'clips': assets}
    (ROOT / 'data' / 'exams' / 'audio.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')

asyncio.run(main())
