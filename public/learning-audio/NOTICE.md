# LingoLearn original reading narration

Original scripts, explanations, questions and synthesized MP3 recordings:
Copyright 2026 LingoLearn contributors, **CC BY-SA 4.0**.
Attribution: LingoLearn, https://llearn.myfastools.com/learn .
License: https://creativecommons.org/licenses/by-sa/4.0/ .
Reusers must retain attribution, identify changes, and apply the same license to adaptations.
These are original teaching texts, not official examination recordings.

The narration was synthesized locally from our original text. No learner data,
online speech provider, third-party article or uploaded person's voice was used.
Code and model licenses are separate from the original reading-content license.
Python tools and model weights are not included in the deployed application.

English, Spanish and Japanese synthesis uses
[MeloTTS](https://github.com/myshell-ai/MeloTTS), copyright 2024 MyShell,
MIT; commit `209145371cff8fc3bd60d7be902ea69cbdb7965a`.
The corresponding `myshell-ai/MeloTTS-English`, `-Spanish` and `-Japanese` checkpoints are published under MIT. Each clip's pinned model revision,
script hash, MP3 hash, duration and speaker are recorded in `audio-v1.json` in the
source repository. Melo's Korean and Chinese checkpoints are not used for the released recordings.

Auxiliary text processing used English BERT from Google
(Apache-2.0), and the Tohoku NLP Japanese BERT tokenizer
(Apache-2.0). Spanish segmentation used the BETO tokenizer by José Cañete,
Gabriel Chaperon, Rodrigo Fuentes, Jou-Hui Ho, Hojin Kang and Jorge Pérez,
from https://huggingface.co/dccuchile/bert-base-spanish-wwm-uncased . Its publisher
states CC BY 4.0 intentions and notes uncertainty about the original pretraining
corpus licenses. Only the tokenizer processes our own original scripts; the
Spanish checkpoint disables BERT model features. No training corpus or tokenizer
files are redistributed here.

Chinese and Korean synthesis use [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS), copyright
2026 Qwen contributors, Apache-2.0, package qwen-tts 0.1.1, with the
[Qwen3-TTS-12Hz-0.6B-CustomVoice](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice)
checkpoint and its tokenizer (Apache-2.0), presets **Vivian** (Chinese) and **Sohee** (Korean). This is preset
synthetic narration, not a cloned user recording.

Audio was encoded with ffmpeg to mono, 24 kHz, 64 kbps MP3. Regenerated or
modified audio must be reviewed before replacing a released file. Synthetic
pronunciation and teaching stages are not an official exam standard or certified
proficiency level. Transcript and sentence explanations remain available.
