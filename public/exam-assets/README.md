# TOPIK, HSK and JLPT practice audio

These are synthetic recordings of original LingoLearn listening scripts, generated
2026-09-07 through Microsoft Edge's online text-to-speech service with the
[edge-tts authoring tool](https://github.com/rany2/edge-tts) version 7.2.8.
They are not official exam recordings. No speaker was cloned.

Voices: zh-CN-XiaoxiaoNeural, zh-CN-YunxiNeural, ko-KR-SunHiNeural and
ko-KR-InJoonNeural, plus ja-JP-NanamiNeural and ja-JP-KeitaNeural. The app ships these MP3s locally; a learner's answers are
never sent to the speech service. No provider key or device voice is required
for playback. Practice playback allows pausing, seeking, speed changes and replay.

`data/exams/audio.json` records voice, rate, duration, original-script SHA256 and
MP3 SHA256 for each clip. `scripts/generate-exam-audio.py` reproduces the authoring
process with bounded requests. Use `--family jlpt` to regenerate only Japanese clips while preserving other
families. The catalogue contains 70 MP3s, including 25 JLPT questions and one
Japanese headphone check. The default production build does not run it.
