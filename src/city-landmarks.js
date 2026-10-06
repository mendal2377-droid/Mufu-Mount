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

export function landmarkDetails(p,{add,block,beam,hall,roof,sphere,ground,tree,plaque,cylinder}){
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
    // One great round arch in a pale, crenellated brick wall is the whole
    // identity of the real gate (see the reference photographs), so make the arch
    // tall and wide, give it its name board, and fly the small red flags.
    const H=15;
    for(let gate=0;gate<4;gate++){
      const zz=z+55-gate*15;arch(x,y,zz,76,H,6,[{x:0,r:5.2,spring:5.8}]);
      for(let i=-9;i<=9;i++)for(const side of [-1,1])block(x+i*4,y+H,zz+side*3,1.8,1.6,1.2,'stone');
      if(gate<3)block(x,y-.05,zz-7.5,64,.2,9,'stone');
    }
    plaque('中华门',{x,y:y+13.2,z:z+55+3.1,w:7.5,h:1.7,bg:'#cfc7b0',fg:'#3a3d36'});
    for(const side of [-1,1]){
      block(x+side*34,y,z+32.5,8,H,51,'stone');
      for(let i=0;i<13;i++)block(x+side*37,y+H,z+57-i*4,1.2,1.6,1.8,'stone');
      for(let i=0;i<20;i++)block(x+side*26,y+i*.7,z+57-i*2.25,5,.65,2.3,'stone');
      arch(x+side*30,y,z+32.5,42,6,2,Array.from({length:5},(_,i)=>({x:-18+i*9,r:2,spring:2.2})),'stone',Math.PI/2);
      // A small red flag on each front corner.
      beam([x+side*37,y+H+1.4,z+57],[x+side*37,y+H+9,z+57],.12,'bronze');
      const flag=new THREE.PlaneGeometry(3.4,1.9);add(flag,'red',[x+side*37+1.7,y+H+7.8,z+57]);flag.dispose();
    }
    return true;
  }
  if(p.id==='palace'){
    // Grey-beige stone, paired Ionic columns, three arched iron gates and a gold
    // name board under a tall white flagpole: the photographed gatehouse.
    arch(x,y,z+20,36,11,4,[-10,0,10].map(xx=>({x:xx,r:xx?2.6:3.3,spring:4.7})),'stone');
    for(const dx of [-16.5,-13.6,-6.8,-3.6,3.6,6.8,13.6,16.5]){
      const col=new THREE.CylinderGeometry(.5,.58,9.4,10);add(col,'white',[x+dx,y+4.7,z+22.4]);col.dispose();
      block(x+dx,y+9.4,z+22.4,1.5,.5,1.5,'stone');block(x+dx,y,z+22.4,1.5,.45,1.5,'stone');
    }
    block(x,y+10,z+20,39,.8,5,'stone');block(x,y+10.8,z+20,17,2.6,4,'stone');block(x,y+13.4,z+20,18,.45,4.6,'stone');
    plaque('总统府',{x,y:y+12.1,z:z+22.05,w:10.5,h:2.1,bg:'#4a4a42',fg:'#e0b85c',yaw:0});
    beam([x,y+13.6,z+20],[x,y+26,z+20],.14,'white');
    for(let i=-4;i<=4;i++)block(x+i*3,y+8.8,z+22.15,1.2,.8,.15,'stone');
    hall(x,y,z-6,26,16,8);hall(x-24,y,z-35,18,14,7);hall(x+24,y,z-35,18,14,7);
    return true;
  }
  if(p.id==='jiming'){
    octagon(x,y,z,7,'red','roof',6.5,4.7);
    for(const [dx,dz,w,d,h] of [[-23,14,22,13,7],[12,29,24,13,6],[-23,-11,19,12,7]]){
      const yy=ground(x+dx,z+dz);hall(x+dx,yy,z+dz,w,d,h);
      block(x+dx,yy,z+dz+d*.51,w,h,.12,'ochre');
      if(dx===-23&&dz===14)plaque('鸡鸣寺',{x:x+dx,y:yy+h*.72,z:z+dz+d*.51+.12,w:7.5,h:1.5,bg:'#c98a2a',fg:'#4a1e12'});
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
    // The photographed tower is not a wide, flat castle: it is four red tiers that
    // step back sharply, each with a balcony and a dark, upswept roof edged in gold
    // over a band of cyan brackets, standing on a stone podium with a broad stair.
    block(x,y-.2,z,50,3.2,42,'stone');
    for(let i=0;i<9;i++)block(x,y+i*.34,z+22.5+(9-i)*.7,15,.34,.7,'stone');
    const tiers=[[26,21],[21,17],[16,13],[11,9]];
    let yy=y+3;
    tiers.forEach(([w,d],i)=>{
      const h=5.2;
      block(x,yy,z,w-1.6,h,d-1.6,'roof');                       // dark inner wall
      for(let k=0;k<=Math.round(w/3.4);k++){const px=x-w/2+.2+k*(w-.4)/Math.round(w/3.4);
        block(px,yy,z+d/2-.4,.55,h,.55,'red');block(px,yy,z-d/2+.4,.55,h,.55,'red');}
      for(let k=0;k<=Math.round(d/3.4);k++){const pz=z-d/2+.2+k*(d-.4)/Math.round(d/3.4);
        block(x-w/2+.4,yy,pz,.55,h,.55,'red');block(x+w/2-.4,yy,pz,.55,h,.55,'red');}
      // Balcony rail and the lintel band under the eave.
      for(const side of [-1,1]){block(x,yy+1.1,z+side*(d/2+.5),w+1,.2,.2,'red');block(x+side*(w/2+.5),yy+1.1,z,.2,.2,d+1,'red');}
      block(x,yy+h-.5,z,w+.6,.55,d+.6,'red');block(x,yy+h-.15,z,w+.9,.4,d+.9,'blue');
      add(roof,'roof',[x,yy+h,z],[w+8.5,7.4,d+8.5]);
      block(x,yy+h+3.3,z,w*.7,.3,.5,'bronze');                    // gilded ridge
      for(const side of [-1,1])for(const sx of [-1,1])block(x+sx*(w/2+3.6),yy+h+.15,z+side*(d/2+3.6),.7,.7,.7,'bronze'); // gilt eave tips
      yy+=h+2.2;
    });
    beam([x,yy-1,z],[x,yy+5.5,z],.2,'bronze');
    add(sphere,'bronze',[x,yy+5.8,z],[.55,.7,.55]);
    // Lower flanking pavilions with gold-edged roofs, as in the photographs.
    for(const side of [-1,1]){hall(x+side*30,y,z+4,12,10,4.5,'roof');block(x+side*30,y+4.5+3.2,z+4,6,.3,.4,'bronze');}
    plaque('阅江楼',{x,y:y+3+5.2*.55,z:z+tiers[0][1]/2+.4,w:8,h:1.7,bg:'#6e2a1f',fg:'#e3bd62'});
    return true;
  }
  if(p.id==='xiaoling'){
    // Bright vermilion walls with golden-yellow coping and red studded doors,
    // under blue-green painted brackets: the colours of the imperial tomb.
    arch(x,y,z,34,12,22,[{x:0,r:3.3,spring:4.5}],'red');
    block(x,y+12,z,35,.7,23,'bronze');
    block(x,y,z+11.05,6.6,6.6,.3,'roof');
    for(let r=0;r<5;r++)for(let c=-2;c<=2;c++)add(sphere,'bronze',[x+c*1.15,y+1.1+r*1.05,z+11.4],[.2,.2,.2]);
    hall(x,y+12.7,z,28,17,8,'bronze');block(x,y+12.7,z,28.2,8,17.2,'red');
    for(const side of [-1,1])for(let i=0;i<11;i++)block(x+side*18,y+i*1.1,z+12-i*2,6,1.15,2.05,'stone');
    plaque('明孝陵',{x,y:y+8.2,z:z+11.4,w:7.5,h:1.5,bg:'#2f3a33',fg:'#e0b85c'});
    return true;
  }
  if(p.id==='zhongshan'){
    const base=ground(x,z+58);paifang(x,base,z+69);
    plaque('博爱',{x,y:base+7.2,z:z+69.45,w:6.2,h:1.7,bg:'#2f4a73',fg:'#f0d98a'});return false;
  }
  if(p.kind==='oldtown'){
    paifang(x-55,ground(x-55,z),z,p.id!=='qinhuai',Math.PI/2);
    if(p.id==='qinhuai')plaque('夫子庙',{x:x-55.5,y:ground(x-55,z)+7.4,z,w:7,h:1.6,yaw:-Math.PI/2,bg:'#6e2a1f',fg:'#e3bd62'});
    if(p.id==='qinhuai'){
      // Lantern boats: the Qinhuai River's postcard image, drifting along the canal.
      for(let i=0;i<5;i++){
        const bx=x-48+i*24,bz=z+42.5+(i%2?1.6:-1.2),by=y+.5;
        block(bx,by,bz,10,.9,2.6,'red');block(bx,by+.9,bz,6.4,1.7,2.1,'roof');block(bx,by+2.6,bz,7.2,.25,2.6,'bronze');
        for(let k=-1;k<=1;k++)add(sphere,'glow',[bx+k*2.4,by+1.4,bz+1.5],[.34,.46,.34]);
      }
    }
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

export function bridgeDetails(kind,bp,deck,{beam,block,add,roof,sphere}){
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
    // Cream bridgehead towers, the bridge's identity in every photograph, with
    // the three red flags on top. Four stand at the two ends, either side of the road.
    for(const t of [.035,.965])for(const side of [-1,1]){
      const base=bp(t,side*16,deck);   // well clear of the roadway, so the camera is not walled in
      block(base[0],deck-8,base[2],9,10,9,'stone');
      block(base[0],deck+2,base[2],8,36,8,'ochre');
      for(let k=0;k<6;k++)block(base[0],deck+6+k*5.5,base[2],8.2,.5,8.2,'stone');
      block(base[0],deck+38,base[2],10,1.2,10,'stone');
      add(roof,'roof',[base[0],deck+39.2,base[2]],[11,5.5,11]);
      for(let i=0;i<3;i++){
        const a=[base[0]+(i-1)*1.6,deck+43,base[2]];beam(a,[a[0],a[1]+4.6,a[2]],.08,'bronze');
        const flag=new THREE.PlaneGeometry(1.5,1);add(flag,'red',[a[0]+.75,a[1]+3.8,a[2]]);flag.dispose();
      }
    }
    // Rows of cream multi-globe lamp posts along both edges of the deck.
    for(let i=1;i<20;i++){
      const t=i/20;
      for(const side of [-1,1]){
        const post=bp(t,side*5.2,deck);
        beam([post[0],deck,post[2]],[post[0],deck+5.6,post[2]],.13,'white');
        for(const k of [-1,0,1]){const g=bp(t+k*.004,side*5.2,deck+5.9+(k?0:.7));add(sphere,'glow',g,[.2,.25,.2]);}
      }
    }
    // Inverted-V approach piers under the deck.
    for(const t of [.2,.4,.6,.8])for(const side of [-1,1]){
      beam(bp(t,side*5,deck-1),bp(t,side*1.5,deck-9),.7,'stone');
    }
  }
}
