import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inflateSync} from 'node:zlib';
import {paintedCrown,canopyInterior,paintCityWater} from '../src/city-art.js';

test('painted city crowns retain volume and small geometry budgets at both distances',()=>{
  for(let species=0;species<3;species++)for(const near of [true,false]){
    const g=paintedCrown(species,near),b=g.boundingBox;
    assert.ok(b.max.x-b.min.x>4&&b.max.z-b.min.z>3);
    assert.ok(b.max.y-b.min.y>5);
    assert.ok(g.index.count/3<=(near?650:30));
    for(const key of ['position','normal','uv'])assert.ok(g.attributes[key].array.every(Number.isFinite));
    const uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++)assert.ok(uv.getX(i)>0&&uv.getX(i)<1&&uv.getY(i)>0&&uv.getY(i)<1);
    g.dispose();
  }
  for(let species=0;species<3;species++){
    const g=canopyInterior(species);g.computeBoundingBox();
    assert.ok(g.attributes.position.count/3<=100);
    assert.ok(g.boundingBox.max.z-g.boundingBox.min.z>2);
    assert.ok(g.attributes.normal.array.every(Number.isFinite));g.dispose();
  }
});

test('runtime foliage keeps real alpha and transparent cell gutters',()=>{
  const png=fs.readFileSync(new URL('../public/city/art/foliage-gouache-v1.png',import.meta.url));
  assert.equal(png[25],6);assert.equal(png.readUInt32BE(16),1024);assert.equal(png.readUInt32BE(20),1024);
  assert.ok(png.length<2*1024*1024);
  const chunks=[];for(let p=8;p<png.length;){const length=png.readUInt32BE(p);
    if(png.toString('ascii',p+4,p+8)==='IDAT')chunks.push(png.subarray(p+8,p+8+length));p+=length+12;}
  const raw=inflateSync(Buffer.concat(chunks)),stride=4096,pixels=Buffer.alloc(stride*1024);
  const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
  for(let y=0;y<1024;y++){
    const filter=raw[y*(stride+1)];
    for(let x=0;x<stride;x++){
      const i=y*stride+x,a=x>=4?pixels[i-4]:0,b=y?pixels[i-stride]:0,c=y&&x>=4?pixels[i-stride-4]:0;
      const predicted=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];
      pixels[i]=(raw[y*(stride+1)+1+x]+predicted)&255;
    }
  }
  let opaque=0;
  for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){
    const alpha=pixels[(y*1024+x)*4+3],cx=x%512,cy=y%512;
    if(cx<40||cy<40||cx>471||cy>471)assert.equal(alpha,0);
    if(alpha>128)opaque++;
  }
  assert.ok(opaque>200000&&opaque<750000);
});

test('city water binds shared weather and uses view-space filtered normals',()=>{
  const shared=Object.fromEntries(['time','storm','sunset','snow'].map(k=>[k,{value:0}]));
  const material={},shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <normal_fragment_maps>\n#include <color_fragment>'};
  paintCityWater(material,shared);material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.citySunset,shared.sunset);assert.equal(shader.uniforms.cityStorm,shared.storm);
  assert.match(shader.fragmentShader,/mat3\(viewMatrix\)/);assert.match(shader.fragmentShader,/fwidth/);
  assert.doesNotMatch(shader.fragmentShader,/tonemapping_fragment/);
});
