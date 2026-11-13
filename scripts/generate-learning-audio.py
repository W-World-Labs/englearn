#!/usr/bin/env python3
"""Offline authoring only. Use separate MeloTTS / Qwen environments; see data/learning/README.md."""
import argparse,hashlib,importlib,json,os,shutil,subprocess,sys,tempfile
from pathlib import Path
os.environ.setdefault('HF_HUB_ETAG_TIMEOUT','15');os.environ.setdefault('HF_HUB_DOWNLOAD_TIMEOUT','30')
import torch
from huggingface_hub import hf_hub_download,snapshot_download
parser=argparse.ArgumentParser();parser.add_argument('--engine',choices=['melo','qwen'],required=True);parser.add_argument('--id',action='append',default=[]);args=parser.parse_args()
root=Path(__file__).resolve().parents[1];manifest_path=root/'data/learning/audio-v1.json';manifest=json.loads(manifest_path.read_text());texts=json.loads((root/'data/learning/readings-v1.json').read_text())['items']
models=manifest['models'];names={'en':('English','EN'),'zh':('Chinese','ZH'),'ja':('Japanese','JP'),'es':('Spanish','ES'),'ko':('Korean','KR')}
torch.set_num_threads(4);torch.manual_seed(140)
with tempfile.TemporaryDirectory(prefix='lingolearn-audio-') as temporary:
 temp=Path(temporary)
 if args.engine=='melo':
  source=Path(os.environ['ENGLEARN_MELO_SOURCE'])
  assert subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True,timeout=10).strip()==manifest['generator']['revision']
  # Upstream eagerly imports unused languages. A private MIT-source copy loads only supported
  # authoring languages, avoiding the unused Korean model whose upstream has additional terms.
  shutil.copytree(source/'melo',temp/'melo');sys.path.insert(0,str(temp))
  cleaner=temp/'melo/text/cleaner.py';s=cleaner.read_text().replace(', korean','').replace("'KR': korean,",'');cleaner.write_text(s)
  # Pin auxiliary tokenizers/features to the exact authoring revisions as well.
  import transformers
  pins={a['repo']:a['revision'] for a in manifest['auxiliaries']}
  for cls in (transformers.AutoTokenizer,transformers.AutoModelForMaskedLM):
   original=cls.from_pretrained
   def pinned(repo,*values,_original=original,**options):
    if repo in pins:options['revision']=pins[repo]
    return _original(repo,*values,**options)
   cls.from_pretrained=pinned
  from melo.api import TTS
  import melo.utils
  modules={'EN':'english_bert','JP':'japanese_bert','ZH_MIX_EN':'chinese_mix','ES':'spanish_bert'}
  melo.utils.get_bert=lambda text,words,language,device:importlib.import_module('melo.text.'+modules[language]).get_bert_feature(text,words,device)
 else:
  import numpy as np,soundfile as sf
  from qwen_tts import Qwen3TTSModel
 for language,(name,code) in names.items():
  if models[name].get('engine','qwen' if language in ('zh','ko') else 'melo') != args.engine:continue
  selected=[t for t in texts if t['language']==language and (not args.id or t['id'] in args.id)]
  if not selected:continue
  src=models[name];repo=src['source'].removeprefix('https://huggingface.co/');revision=src['revision']
  if args.engine=='melo':
   model=TTS(language=code,device='cpu',config_path=hf_hub_download(repo,'config.json',revision=revision),ckpt_path=hf_hub_download(repo,'checkpoint.pth',revision=revision));speaker=next(iter(model.hps.data.spk2id.values()))
  else:
   folder=snapshot_download(repo,revision=revision,max_workers=2);model=Qwen3TTSModel.from_pretrained(folder,device_map='cpu',dtype=torch.float32,attn_implementation='sdpa');speaker='Sohee' if language=='ko' else 'Vivian'
  for text in selected:
   previous=next(c for c in manifest['clips'] if c['id']==text['id']);script=' '.join(s['text'] for s in text['sentences']);wav=temp/(text['id']+'.wav');target=root/'public/learning-audio'/(text['id']+'.mp3')
   if args.engine=='melo':model.tts_to_file(script,speaker,str(wav),speed=.9 if text['stage']=='foundation' else 1.,quiet=True)
   else:
    sentence_mode=previous.get('segmentation')=='sentence';scripts=[s['text'] for s in text['sentences']] if sentence_mode else [script];segments=[]
    for segment in scripts:
     waves,sr=model.generate_custom_voice(text=segment,language=name,speaker=speaker,max_new_tokens=500 if sentence_mode else 1800,do_sample=previous.get('sampling',False));segments.append(waves[0])
     if sentence_mode:segments.append(np.zeros(int(sr*.2),dtype=np.float32))
    sf.write(wav,np.concatenate(segments),sr)
   subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-ac','1','-ar','24000','-codec:a','libmp3lame','-b:a','64k',str(target)],check=True,timeout=60)
   duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(target)],text=True,timeout=20));assert 3<duration<180
   previous.update(file=target.name,duration=round(duration,3),sha256=hashlib.sha256(target.read_bytes()).hexdigest(),scriptSha256=hashlib.sha256(script.encode()).hexdigest(),model=repo,revision=revision,speaker=speaker)
   manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(text['id'],duration,flush=True)
  del model
