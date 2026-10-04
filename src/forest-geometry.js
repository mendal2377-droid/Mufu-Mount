import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// An image supplies leaf detail, but curved patches and branch volumes supply
// the parallax. Surface normals follow each crown lobe, rather than the flat
// face of a card, so the sun lights the tree as a volume from any direction.
export function randomSeed(seed) {
  return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
}

export function foliagePatch(width,height,tile=0,segments=3,bend=.3) {
  const g=new THREE.PlaneGeometry(width,height,segments,segments);
  const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
  const col=tile%2,row=Math.floor(tile/2);
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i)/(width*.5),y=p.getY(i)/(height*.5);
    p.setZ(i,bend*(1-x*x)*(1-y*y));
    const normal=new THREE.Vector3(x*.6,y*.6,1).normalize();n.setXYZ(i,...normal.toArray());
    // The PNG atlas has transparent gutters; inset samples stay in their cell
    // when the texture is mipmapped or viewed obliquely.
    uv.setXY(i,(col+.07+uv.getX(i)*.86)*.5,(1-row+.07+uv.getY(i)*.86)*.5);
  }
  g.computeBoundingBox();return g;
}

function branch(a,b,r0,r1,sides=5) {
  const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(r1,r0,delta.length(),sides);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
  g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());return g;
}

export function treeGeometry(kind="broadleaf",detailed=true,variant=0) {
  const rand=randomSeed(625+variant*213),wood=[],leaves=[];
  const pine=kind==="pine";
  wood.push(branch(new THREE.Vector3(),new THREE.Vector3(.12, pine?11.4:6.8,-.1),.24,.035,7));
  if(pine) {
    const levels=detailed?10:7;
    for(let i=0;i<levels;i++) {
      const h=2.2+i*(8.6/(levels-1)),radius=(11.8-h)*.29;
      for(let j=0;j<(detailed?5:3);j++) {
        const angle=j*2.39996+i*.7,tip=new THREE.Vector3(Math.cos(angle)*radius,h-.25,Math.sin(angle)*radius);
        if(detailed)wood.push(branch(new THREE.Vector3(0,h,0),tip,.035,.008,4));
        const g=foliagePatch(radius*1.85,1.2+i*.025,2,detailed?3:1,.22);
        g.rotateX(-.3-rand()*.4);g.rotateY(angle+Math.PI/2);
        g.translate(tip.x*.55,h,tip.z*.55);leaves.push(g);
      }
    }
  } else {
    const count=detailed?24:15;
    for(let i=0;i<count;i++) {
      const angle=i*2.39996+variant*.9,radius=1.1+rand()*1.6;
      const center=new THREE.Vector3(Math.cos(angle)*radius,4.8+rand()*3.8,Math.sin(angle)*radius);
      if(i<8)wood.push(branch(new THREE.Vector3(.1,3.7+i*.16,0),center,.065,.012,4));
      for(let j=0;j<(detailed?3:2);j++) {
        const g=foliagePatch(2.7+rand()*.9,2.25+rand()*.8,i%4===0?1:0,detailed?3:1,.5);
        g.rotateX((rand()-.5)*.9);g.rotateY(angle+j*Math.PI/3);
        g.translate(center.x,center.y,center.z);leaves.push(g);
      }
    }
  }
  const trunk=mergeGeometries(wood),crown=mergeGeometries(leaves);
  wood.forEach(g=>g.dispose());leaves.forEach(g=>g.dispose());
  trunk.computeBoundingBox();crown.computeBoundingBox();
  return {trunk,crown};
}

// These are visual species variations, not surveyed species assignments.
// Forest placements can carry pines; the planted promenade stays broadleaf.
export function treeKind(tree,index) {return tree[5] && index%6===0 ? "pine" : "broadleaf";}

export function treeShadowGeometry() {
  // Icosahedra are non-indexed; normalise the cylinder too before merging.
  // This remains the forty-triangle proxy, never the detailed foliage mesh.
  const trunk=new THREE.CylinderGeometry(.11,.2,5.7,5).translate(0,2.85,0).toNonIndexed();
  const crown=new THREE.IcosahedronGeometry(1,0).scale(2.7,3.8,2.7).translate(0,6.7,0);
  const g=mergeGeometries([trunk,crown]);trunk.dispose();crown.dispose();return g;
}

export function fernGeometry() {
  const fronds=[];
  for(let i=0;i<7;i++) {
    const g=foliagePatch(.62,1.45,3,3,.22);
    g.translate(0,.72,0);g.rotateX(-.48);g.rotateY(i*2.39996);
    fronds.push(g);
  }
  const g=mergeGeometries(fronds);fronds.forEach(f=>f.dispose());return g;
}

