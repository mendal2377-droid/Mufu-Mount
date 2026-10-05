import * as THREE from 'three';

// Silhouettes follow the photographed features in research/nanjing/LANDMARKS.md.
// Dimensions and courtyard placements are deliberately compressed for the atlas.
export function archWall(width,height,depth,openings=[{x:0,r:3,spring:4}]){
  const shape=new THREE.Shape();shape.moveTo(-width/2,0);
  for(const {x,r,spring} of [...openings].sort((a,b)=>a.x-b.x)){
    shape.lineTo(x-r,0);shape.lineTo(x-r,spring);
    shape.absarc(x,spring,r,Math.PI,0,true);shape.lineTo(x+r,0);
  }
  shape.lineTo(width/2,0);shape.lineTo(width/2,height);shape.lineTo(-width/2,height);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:12});g.translate(0,0,-depth/2);return g;
}
export function octagonalEave(radius,rise=2,sides=8){
  const pos=[],rings=[[.58,rise],[.92,.08],[1.12,.32]];
  for(let ring=0;ring<2;ring++)for(let i=0;i<sides;i++){
    const pt=(j,k)=>{const a=j*Math.PI*2/sides+Math.PI/sides;return [Math.cos(a)*radius*rings[k][0],rings[k][1],Math.sin(a)*radius*rings[k][0]];};
    const a=pt(i,ring),b=pt(i+1,ring),c=pt(i,ring+1),d=pt(i+1,ring+1);pos.push(...a,...c,...b,...b,...c,...d);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;
}
export function bridgeRing(bp,t,width=13,height=19){
  return Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2;
    return bp(t+Math.cos(a)*.065,Math.sin(a)*width,height+Math.cos(a)*height-3);});
}
function prism(points,height){
  const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
  const g=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false});g.rotateX(-Math.PI/2);return g;
}

export function landmarkDetails(p,{add,block,beam,hall,roof,sphere,ground,tree}){
  const [x,y,z]=p.position;
  const emit=(g,mat,pos)=>{add(g,mat,pos);g.dispose();};
  const arch=(xx,yy,zz,w,h,d,openings,mat='stone',yaw=0)=>{
    const g=archWall(w,h,d,openings);add(g,mat,[xx,yy,zz],[1,1,1],yaw);g.dispose();};
  function octagon(xx,yy,zz,levels,body='red',tiles='roof',radius=6,spacing=4.3,sides=8){
    for(let i=0;i<levels;i++){
      const r=radius*(1-i*.065),base=yy+i*spacing;
      emit(new THREE.CylinderGeometry(r*.72,r*.72,spacing-.5,sides).rotateY(Math.PI/sides),'stone',[xx,base+(spacing-.5)/2,zz]);
      emit(new THREE.CylinderGeometry(r*.725,r*.725,spacing-1,sides).rotateY(Math.PI/sides),body,[xx,base+(spacing-1)/2+.15,zz]);
      for(let j=0;j<sides;j++){
        const a=j*Math.PI*2/sides,ux=Math.cos(a),uz=Math.sin(a),yaw=Math.PI/2-a,face=r*.725*Math.cos(Math.PI/sides)+.04,rail=r*.98*Math.cos(Math.PI/sides);
        const corner=a+Math.PI/sides,cx=Math.cos(corner)*r*.72,cz=Math.sin(corner)*r*.72;
        block(xx+ux*face,base+1,zz+uz*face,r*.35,1.35,.13,body==='stone'?'roof':'glass',yaw);
        block(xx+ux*rail,base+.7,zz+uz*rail,r*.66,.15,.15,'bronze',yaw);
        beam([xx+cx,base,zz+cz],[xx+cx,base+spacing-.4,zz+cz],.18,body);
      }
      emit(octagonalEave(r,1.8,sides),tiles,[xx,base+spacing-.8,zz]);
    }
    beam([xx,yy+levels*spacing,zz],[xx,yy+levels*spacing+5,zz],.18,'bronze');
    for(let i=0;i<5;i++)emit(new THREE.TorusGeometry(.7-i*.1,.08,4,12).rotateX(Math.PI/2),'bronze',[xx,yy+levels*spacing+i*.65,zz]);
  }
  function paifang(xx,yy,zz,stone=false,yaw=0){
    const mat=stone?'stone':'white';
    for(const dx of [-10,-4,4,10]){
      block(xx+Math.cos(yaw)*dx,yy,zz-Math.sin(yaw)*dx,.75,10,.75,mat);
      add(sphere,mat,[xx+Math.cos(yaw)*dx,yy+10.4,zz-Math.sin(yaw)*dx],[.55,.55,.55]);
    }
    for(const [dx,w,h] of [[0,9,8.3],[-7,6,6.8],[7,6,6.8]]){
      const xx2=xx+Math.cos(yaw)*dx,zz2=zz-Math.sin(yaw)*dx;
      block(xx2,yy+h-1,zz2,w,1,.7,mat,yaw);add(roof,stone?'roof':'blue',[xx2,yy+h,zz2],[w+1,3,3],yaw);
    }
  }
  function horsehead(xx,yy,zz,d=12){
    for(const side of [-1,1])for(let k=0;k<3;k++){
      const zz2=zz+(k-1)*d*.32;
      block(xx+side*7,yy+5,zz2,.55,2.2+(1-Math.abs(k-1))*1.4,d*.34,'white');
      block(xx+side*7,yy+7.2+(1-Math.abs(k-1))*1.4,zz2,.8,.25,d*.37,'roof');
    }
  }
  if(p.id==='zhonghua'){
    for(let gate=0;gate<4;gate++){
      const zz=z+55-gate*15;arch(x,y,zz,76,12,6,[{x:0,r:4,spring:4.5}]);
      for(let i=-9;i<=9;i++)for(const side of [-1,1])block(x+i*4,y+12,zz+side*3,1.8,1.6,1.2,'stone');
      if(gate<3)block(x,y-.05,zz-7.5,64,.2,9,'stone');
    }
    for(const side of [-1,1]){
      block(x+side*34,y,z+32.5,8,12,51,'stone');
      for(let i=0;i<13;i++)block(x+side*37,y+12,z+57-i*4,1.2,1.6,1.8,'stone');
      for(let i=0;i<20;i++)block(x+side*26,y+i*.6,z+57-i*2.25,5,.65,2.3,'stone');
      arch(x+side*30,y,z+32.5,42,6,2,Array.from({length:5},(_,i)=>({x:-18+i*9,r:2,spring:2.2})),'stone',Math.PI/2);
    }
    return true;
  }
  if(p.id==='palace'){
    arch(x,y,z+20,36,11,4,[-10,0,10].map(xx=>({x:xx,r:xx?2.6:3.3,spring:4.7})),'white');
    for(const dx of [-17,-14,-6,6,14,17]){
      block(x+dx,y,z+22.2,.65,10,.55,'white');block(x+dx,y+.2,z+22.5,1,.4,.85,'stone');
      block(x+dx,y+9.4,z+22.5,1,.4,.85,'stone');
    }
    block(x,y+10,z+20,39,.8,5,'stone');block(x,y+11,z+20,17,2.3,4,'white');block(x,y+13.3,z+20,18,.4,4.6,'stone');
    beam([x,y+13.6,z+20],[x,y+23,z+20],.12,'bronze');
    for(let i=-4;i<=4;i++)block(x+i*3,y+8.8,z+22.15,1.2,.8,.15,'stone');
    hall(x,y,z-6,26,16,8);hall(x-24,y,z-35,18,14,7);hall(x+24,y,z-35,18,14,7);
    return true;
  }
  if(p.id==='jiming'){
    octagon(x,y,z,7,'red','roof',6.5,4.7);
    for(const [dx,dz,w,d,h] of [[-23,14,22,13,7],[12,29,24,13,6],[-23,-11,19,12,7]]){
      const yy=ground(x+dx,z+dz);hall(x+dx,yy,z+dz,w,d,h);
      block(x+dx,yy,z+dz+d*.51,w,h,.12,'ochre');
      for(const side of [-1,1])block(x+dx+side*w*.505,yy,z+dz,.13,h,d,'ochre');
    }
    return true;
  }
  if(p.id==='niushou'){
    for(const [dx,dz,r,h,mat] of [[-16,0,28,18,'bronze'],[27,-9,18,13,'white']]){
      block(x+dx,y-.3,z+dz,r*2,1.5,r*2,'stone');
      // The visible inner shell and triangulated rib cage are independent volumes.
      const shell=new THREE.SphereGeometry(1,32,14,0,Math.PI*2,0,Math.PI/2);
      add(shell,dx<0?'stone':mat,[x+dx,y+2,z+dz],[r*.96,h*.96,r*.96]);shell.dispose();
      const point=(i,j)=>{const a=i/24*Math.PI*2,t=j/8*Math.PI/2;return [x+dx+Math.cos(a)*Math.sin(t)*r,y+2+Math.cos(t)*h,z+dz+Math.sin(a)*Math.sin(t)*r];};
      for(let j=1;j<=8;j++)for(let i=0;i<24;i++){
        beam(point(i,j),point(i+1,j),.15,'bronze');beam(point(i,j),point(i,j-1),.17,'bronze');beam(point(i,j),point(i+1,j-1),.18,'bronze');
      }
      for(let i=0;i<16;i++){
        const a=i/16*Math.PI*2;beam([x+dx+Math.cos(a)*r,y,z+dz+Math.sin(a)*r],[x+dx+Math.cos(a)*r,y+2,z+dz+Math.sin(a)*r],.24,'white');
      }
    }
    octagon(x+63,ground(x+63,z-18),z-18,9,'red','bronze',4.8,4.2,4);
    block(x+6,y+.02,z+37,65,.18,17,'stone');block(x+6,y+.25,z+37,61,.05,13,'water');
    return true;
  }
  if(p.id==='zifeng'){
    const outline=[[-12,-9],[9,-10],[14,2],[-3,13],[-12,6]];
    for(const [base,h,s,shift] of [[0,43,1,0],[43,24,.84,2],[67,13,.61,3],[80,9,.36,5]]){
      emit(prism(outline.map(([a,b])=>[a*s+shift,b*s]),h),'glass',[x,y+base,z]);
      for(let j=2;j<h;j+=2)for(let i=0;i<outline.length;i++){
        const a=outline[i],b=outline[(i+1)%outline.length];beam([x+a[0]*s+shift,y+base+j,z+a[1]*s],[x+b[0]*s+shift,y+base+j,z+b[1]*s],.075,'white');
      }
    }
    beam([x+5,y+89,z],[x+5,y+112,z],.23,'bronze');
    block(x,y,z-22,45,7,22,'white');block(x,y+7,z-22,43,.7,20,'glass');
    for(const side of [-1,1]){block(x+side*22,y,z+30,12,15,14,'glass');tree(x+side*28,z+10,.85);}
    return true;
  }
  if(p.id==='qixia'){
    // The relic pagoda is carved stone with close eaves, not a tall timber tower.
    octagon(x+22,y,z-8,5,'stone','stone',4.5,2.3);
    hall(x,y,z+13,31,18,8);hall(x,y,z-23,28,18,8);
    for(const side of [-1,1])hall(x+side*28,ground(x+side*28,z),z,13,28,6);
    block(x,y+.05,z+38,28,.2,12,'stone');return true;
  }
  if(p.id==='yuejiang'){
    for(let level=0;level<4;level++){
      const w=32-level*5,d=25-level*4,yy=y+level*6;
      hall(x,yy,z,w,d,5,'blue');
      block(x,yy,z,w+.02,5,d+.02,'red');
      for(const side of [-1,1]){
        block(x,yy+.8,z+side*(d/2+1.1),w+2,.18,.18,'red');
        block(x+side*(w/2+1.1),yy+.8,z,.18,.18,d+2,'red');
        for(let i=-4;i<=4;i++)block(x+i*w/9,yy,z+side*(d/2+1.1),.15,.9,.15,'red');
      }
    }
    return true;
  }
  if(p.id==='xiaoling'){
    arch(x,y,z,34,12,22,[{x:0,r:3.3,spring:4.5}],'ochre');hall(x,y+12,z,28,17,8,'red');
    for(const side of [-1,1])for(let i=0;i<11;i++)block(x+side*18,y+i*1.1,z+12-i*2,6,1.15,2.05,'stone');
    return true;
  }
  if(p.id==='zhongshan'){
    const base=ground(x,z+58);paifang(x,base,z+69);return false;
  }
  if(p.kind==='oldtown'){
    paifang(x-55,ground(x-55,z),z,p.id!=='qinhuai',Math.PI/2);
    for(const side of [-1,1])for(let i=-3;i<=3;i++)horsehead(x+i*17,ground(x+i*17,z+side*19),z+side*19,11);
    if(p.id==='qinhuai'){
      // A stone footbridge crosses the artistic canal; its arched opening is real geometry.
      arch(x+37,y,z+43,19,7,6,[{x:0,r:6,spring:0}],'stone',Math.PI/2);
      for(const side of [-1,1])for(let i=-5;i<=5;i++){
        const yy=y+7-Math.abs(i)*.75;block(x+37+side*3.2,yy,z+43+i*1.8,.35,1.1,.35,'white');
      }
      block(x+82,y,z-65,42,8,1.5,'ochre');add(roof,'roof',[x+82,y+8,z-65],[43,3,3]);
    }
    if(p.id==='gaochun')for(let i=-3;i<=3;i++){
      const bx=x+i*17;block(bx,y+3.5,z+12,9,.3,4,'bark');
      for(const side of [-1,1])block(bx+side*4,y,z+13,.18,3.5,.18,'bark');
    }
    return false;
  }
  return false;
}

export function bridgeDetails(kind,bp,deck,{beam,block,add}){
  if(kind==='eye'){
    // bp accepts absolute height; shift the closed oval into the deck's frame.
    // Ellipse foundations descend beneath the water; no row of main-span piers.
    const local=(t,side,h)=>bp(t,side,h+2);
    for(const t of [.45,.75]){
      const tilt=t<.6?1:-1;
      const ring=bridgeRing((u,side,h)=>local(t+(u-t)*tilt,side,h),t,8,12);for(let i=1;i<ring.length;i++)beam(ring[i-1],ring[i],.7,'white');
      for(let j=1;j<=9;j++)for(const side of [-1,1])beam(local(t+tilt*.062,side*2.5,20.4),bp(Math.max(0,Math.min(1,t+(j-5)*.05)),side*4.8),.07,'glass');
    }
  }else if(kind==='cable'){
    for(const t of [.23,.77]){
      for(const side of [-1,1]){
        const pts=Array.from({length:10},(_,i)=>bp(t,side*(2+8*(1-i/9)**1.4),deck+i*4));
        for(let i=1;i<pts.length;i++)beam(pts[i-1],pts[i],.8,'white');
        for(let i=1;i<=10;i++)for(const direction of [-1,1])beam(bp(t,side*2,deck+36-i*.5),bp(Math.max(0,Math.min(1,t+direction*i*.04)),side*4.5,deck),.08,'glass');
      }
      beam(bp(t,-2,deck+36),bp(t,2,deck+36),.7,'white');beam(bp(t,-7,deck+13),bp(t,7,deck+13),.6,'white');
    }
  }else if(kind==='truss'){
    for(const side of [-1,1]){
      beam(bp(0,side*4,deck-6),bp(1,side*4,deck-6),.45,'glass');
      beam(bp(0,side*4,deck-1),bp(1,side*4,deck-1),.45,'glass');
    }
    for(const t of [.13,.87])for(const side of [-1,1]){
      const pos=bp(t,side*7,deck+16);block(pos[0],deck+15,pos[2],5,1,6,'red');
      for(let i=0;i<3;i++){
        const a=bp(t+(i-1)*.006,side*7,deck+15);beam(a,[a[0],a[1]+4,a[2]],.07,'bronze');
        const flag=new THREE.PlaneGeometry(1.6,1);add(flag,'red',[a[0]+.8,a[1]+3.2,a[2]]);flag.dispose();
      }
    }
  }
}
