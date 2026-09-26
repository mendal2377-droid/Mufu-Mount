export class NatureAudio{
  constructor(){this.enabled=false;this.nodes={};this.lastStep=0;this.started=false;}
  async start(){
    if(this.ctx){await this.ctx.resume();return;}
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
    this.ctx=new C();this.master=this.ctx.createGain();this.master.gain.value=0;this.master.connect(this.ctx.destination);
    await this.ctx.resume();
    await Promise.all(['forest','wind','water','rain','snow','bird'].map(async name=>{
      const res=await fetch(`/audio/${name}.mp3`);if(!res.ok)throw Error('Sound download failed');
      const buffer=await this.ctx.decodeAudioData(await res.arrayBuffer());
      const source=this.ctx.createBufferSource();source.buffer=buffer;source.loop=true;
      const gain=this.ctx.createGain();gain.gain.value=0;source.connect(gain);gain.connect(this.master);source.start();this.nodes[name]={gain,source};
    }));this.started=true;
  }
  toggle(on){this.enabled=on;if(this.ctx){this.ctx.resume();this.master.gain.setTargetAtTime(on?.7:0,this.ctx.currentTime,.3);}}
  update(weather,river,moving){
    if(!this.ctx)return;const storm=weather.storm,snow=weather.snow;
    const levels={forest:.55*(1-storm)*(1-snow*.85),wind:.17+storm*.65+snow*.12,water:river*.45,rain:storm*.62,snow:snow*(moving?.32:0),bird:.18*(1-storm)*(1-snow)};
    Object.entries(this.nodes).forEach(([n,v])=>v.gain.gain.setTargetAtTime(levels[n],this.ctx.currentTime,.7));
    if(moving&&this.ctx.currentTime-this.lastStep>.58&&snow<.6){this.lastStep=this.ctx.currentTime;this.noise(.11,.025,260);}
  }
  noise(duration,volume,frequency){if(!this.ctx||!this.enabled)return;const c=this.ctx,b=c.createBuffer(1,c.sampleRate*duration,c.sampleRate),a=b.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/a.length,2);const s=c.createBufferSource();s.buffer=b;const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=frequency;const g=c.createGain();g.gain.value=volume;s.connect(f);f.connect(g);g.connect(this.master);s.start();s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};}
  thunder(){this.noise(3.8,.38,170);}
}
