import re

with open('/Users/kekkopettine/Desktop/abstergo/js/app.js', 'r') as f:
    content = f.read()

# 1. Config
content = content.replace(
    "  const DNA_TURNS = 6;\n  const DNA_RAD   = 1.1;\n  const r_dna     = 18;",
    "  const DNA_TURNS = 6;\n  const DNA_RAD   = 1.1;\n  const r_dna     = 18;\n  const DNA_WIDTH = 44;\n  const DNA_START_X = -DNA_WIDTH / 2;"
)

# 2. Plexus init
content = re.sub(
    r"  const PLEXUS_NODES = 120;.*?plexusVel\.push.*?\}\n",
    """  const PLEXUS_NODES = 200;
  const plexusPts = new Float32Array(PLEXUS_NODES * 3);
  const plexusVel = [];
  for (let i = 0; i < PLEXUS_NODES; i++) {
    plexusPts[i*3] = (Math.random() - 0.5) * 60;
    plexusPts[i*3+1] = (Math.random() - 0.5) * 16;
    plexusPts[i*3+2] = -18 + (Math.random() - 0.5) * 12;
    plexusVel.push(new THREE.Vector3((Math.random() - 0.5)*0.015, (Math.random() - 0.5)*0.015, (Math.random() - 0.5)*0.015));
  }\n""",
    content, flags=re.DOTALL
)

# 3. Particles setup
content = re.sub(
    r"  // ── HOLOGRAPHIC PARTICLE DNA ──.*?dnaGroup\.add\(particleBloom\);\n",
    """  // ── HOLOGRAPHIC PARTICLE DNA ──
  const PARTICLE_COUNT = 30000;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(PARTICLE_COUNT * 3);
  const pOffset = new Float32Array(PARTICLE_COUNT);
  const pType = new Float32Array(PARTICLE_COUNT);
  const pT = new Float32Array(PARTICLE_COUNT);
  
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    let type;
    const rand = Math.random();
    if (rand < 0.4) type = 0.0;
    else if (rand < 0.6) type = 1.0;
    else if (rand < 0.95) type = 2.0;
    else type = 3.0;
    pType[i] = type;
    pT[i] = Math.random();
    pOffset[i] = Math.random() * Math.PI * 2;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('aOffset', new THREE.BufferAttribute(pOffset, 1));
  pGeo.setAttribute('aType', new THREE.BufferAttribute(pType, 1));
  pGeo.setAttribute('aT', new THREE.BufferAttribute(pT, 1));

  const pShaderMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScanner: { value: 0 },
      uHoveredT: { value: -1.0 },
      uSelectedT: { value: -1.0 }
    },
    vertexShader: `
      uniform float uTime;
      attribute float aOffset;
      attribute float aType;
      attribute float aT;
      varying float vAlpha;
      varying vec3 vColor;
      varying float vDistToScanner;
      varying float vType;
      uniform float uScanner;
      uniform float uHoveredT;
      uniform float uSelectedT;
      void main() {
        vType = aType;
        vec3 pos = position;
        
        float breath = sin(uTime * 2.0 + aOffset) * 0.5 + 0.5;
        float size = 1.0;
        
        if (aType == 0.0 || aType == 1.0) {
           size = 1.5 + breath * 1.5 + (aType == 1.0 ? 1.0 : 0.0);
        } else if (aType == 2.0) {
           size = 0.6 + breath * 0.4;
        } else if (aType == 3.0) {
           size = 1.0 + breath * 2.0;
           pos.x += sin(uTime * 0.5 + aOffset) * 0.5;
           pos.y += cos(uTime * 0.6 + aOffset) * 0.5;
           pos.z += sin(uTime * 0.7 + aOffset) * 0.5;
        }

        float scanDist = abs(aT - uScanner);
        if (scanDist > 0.5) scanDist = 1.0 - scanDist; 
        vDistToScanner = scanDist;
        
        float isTarget = 0.0;
        if (uHoveredT >= 0.0 && abs(aT - uHoveredT) < 0.04) isTarget = 0.8;
        if (uSelectedT >= 0.0 && abs(aT - uSelectedT) < 0.04) isTarget = 1.0;
        
        size += isTarget * 3.0;
        if (scanDist < 0.02) size *= 2.0;
        
        vec3 baseColor = vec3(0.0, 0.8, 0.7);
        vec3 highlightColor = vec3(0.8, 1.0, 1.0);
        
        float intensity = isTarget + (scanDist < 0.02 ? 1.0 : 0.0);
        vColor = mix(baseColor, highlightColor, clamp(intensity + breath*0.2, 0.0, 1.0));
        vAlpha = clamp(0.4 + breath * 0.4 + intensity, 0.0, 1.0);
        if (aType == 3.0) vAlpha *= 0.5;
        
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = size * (40.0 / -mvPosition.z);
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying vec3 vColor;
      varying float vDistToScanner;
      varying float vType;
      void main() {
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);
        
        float alpha = vAlpha;
        if (vType > 0.5 && vType < 1.5) { // Ring
           if (dist < 0.25 || dist > 0.45) discard;
           alpha *= smoothstep(0.45, 0.35, dist) * smoothstep(0.25, 0.35, dist);
        } else { // Dot
           if (dist > 0.5) discard;
           alpha *= smoothstep(0.5, 0.1, dist);
        }
        
        vec3 finalColor = vColor;
        if (vDistToScanner < 0.02) finalColor += vec3(0.5);
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const particleDna = new THREE.Points(pGeo, pShaderMat);
  dnaGroup.add(particleDna);

  const pBloomMat = pShaderMat.clone();
  pBloomMat.vertexShader = pBloomMat.vertexShader.replace('gl_PointSize = size * (40.0', 'gl_PointSize = size * (120.0');
  pBloomMat.fragmentShader = pBloomMat.fragmentShader.replace('vec4(finalColor, alpha)', 'vec4(finalColor, alpha * 0.15)');
  const particleBloom = new THREE.Points(pGeo, pBloomMat);
  dnaGroup.add(particleBloom);\n""",
    content, flags=re.DOTALL
)

# 4. Labels
content = re.sub(
    r"  const dnaLabelEls = \[\];\n  for \(let s = 0; s < NUM_SECTIONS; s\+\+\) \{.*?gridGroup\.add\(cssLbl\);\n  \}",
    """  const dnaLabelEls = [];
  for (let s = 0; s < NUM_SECTIONS; s++) {
    const t = specialGeneIndices[s] / NUM_RUNGS;
    const cx = DNA_START_X + t * DNA_WIDTH;
    const el  = document.createElement('div');
    el.className = 'dna-label';
    el.innerHTML = `
      <div class="dna-label-card">
        <div class="dna-label-header">
          <span class="dna-label-dot"></span>
          <span class="dna-label-tag">GENE_0${s+1}</span>
        </div>
        <div class="dna-label-year">${sectionData[s].year}</div>
        <div class="dna-label-status">[ DECODED LINK ]</div>
      </div>
    `;
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    document.getElementById('hud-container').appendChild(el);
    dnaLabelEls.push(el);
    const cssLbl = new THREE.CSS3DObject(el);
    const yOffset = (s % 2 === 0) ? (DNA_RAD + 2.5) : -(DNA_RAD + 2.5);
    const cz = -18;
    cssLbl.position.set(cx, yOffset, cz);
    cssLbl.scale.set(0.022, 0.022, 0.022);
    cssLbl.lookAt(cx, yOffset, cz + 10);
    gridGroup.add(cssLbl);
  }""",
    content, flags=re.DOTALL
)

# 5. updateDNA
content = re.sub(
    r"  function updateDNA\(phase\) \{.*?plexusLineGeo\.attributes\.position\.needsUpdate = true;\n  \}",
    """  function updateDNA(phase) {
    // 1. Aggiorna hitboxes invisibili
    for (let i = 0; i <= NUM_RUNGS; i++) {
      const t  = i / NUM_RUNGS;
      const ha  = t * Math.PI * 2 * DNA_TURNS + phase;
      const cx = DNA_START_X + t * DNA_WIDTH;
      const cy = Math.sin(ha) * DNA_RAD;
      const cz = -18 + Math.cos(ha) * DNA_RAD;
      
      sphArr1[i].position.set(cx, cy,  cz);
      sphArr2[i].position.set(cx, -cy, -18 - Math.cos(ha) * DNA_RAD);
    }
    
    // Riposiziona reticoli HUD
    for (let s = 0; s < NUM_SECTIONS; s++) {
      const idx = specialGeneIndices[s];
      reticleArr1[s].position.copy(sphArr1[idx].position);
      reticleArr2[s].position.copy(sphArr2[idx].position);
      reticleArr1[s].lookAt(reticleArr1[s].position.x, reticleArr1[s].position.y, reticleArr1[s].position.z + 1);
      reticleArr2[s].lookAt(reticleArr2[s].position.x, reticleArr2[s].position.y, reticleArr2[s].position.z + 1);
    }

    // 2. Aggiorna Shader Uniforms
    const now = performance.now();
    const dt = now - prevTime;
    prevTime = now;
    
    pShaderMat.uniforms.uTime.value = now * 0.001;
    pBloomMat.uniforms.uTime.value = now * 0.001;
    
    scannerPhase = (scannerPhase + dt * 0.00015) % 1.0;
    pShaderMat.uniforms.uScanner.value = scannerPhase;
    pBloomMat.uniforms.uScanner.value = scannerPhase;

    let hoverT = -1.0, selT = -1.0;
    if (lastHoveredGene !== -1) hoverT = specialGeneIndices[lastHoveredGene] / NUM_RUNGS;
    if (selectedDnaGene !== -1) selT = specialGeneIndices[selectedDnaGene] / NUM_RUNGS;
    
    pShaderMat.uniforms.uHoveredT.value = hoverT;
    pBloomMat.uniforms.uHoveredT.value = hoverT;
    pShaderMat.uniforms.uSelectedT.value = selT;
    pBloomMat.uniforms.uSelectedT.value = selT;

    // 3. Aggiorna posizioni Particelle
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const t = pT[i];
      const type = pType[i];
      const ha  = t * Math.PI * 2 * DNA_TURNS + phase;
      const cx = DNA_START_X + t * DNA_WIDTH;
      const cy = Math.sin(ha) * DNA_RAD;
      const cz = -18 + Math.cos(ha) * DNA_RAD;
      
      if (type === 0.0 || type === 1.0) {
        const isStrand2 = (i % 2 === 0);
        const strandSign = isStrand2 ? -1 : 1;
        
        const dOffsetX = Math.sin(i * 11.0) * 0.1;
        const dOffsetY = Math.cos(i * 13.0) * 0.1;
        const dOffsetZ = Math.sin(i * 17.0) * 0.1;
        
        pPos[i*3] = cx + dOffsetX; 
        pPos[i*3+1] = strandSign * cy + dOffsetY; 
        pPos[i*3+2] = -18 + strandSign * Math.cos(ha) * DNA_RAD + dOffsetZ;
      } else if (type === 2.0) {
        const lerp = Math.sin(i * 77.7) * 0.5 + 0.5;
        const cy2 = -cy;
        const cz2 = -18 - Math.cos(ha) * DNA_RAD;
        
        pPos[i*3] = cx + Math.sin(i * 31.1) * 0.05; 
        pPos[i*3+1] = cy * lerp + cy2 * (1 - lerp) + Math.cos(i * 41.1) * 0.05; 
        pPos[i*3+2] = cz * lerp + cz2 * (1 - lerp) + Math.sin(i * 51.1) * 0.05;
      } else {
        pPos[i*3] = cx + Math.sin(i * 12.3) * 3.0;
        pPos[i*3+1] = Math.cos(i * 14.5) * 3.0;
        pPos[i*3+2] = -18 + Math.sin(i * 16.7) * 3.0;
      }
    }
    pGeo.attributes.position.needsUpdate = true;

    // 4. Aggiorna Plexus Background
    const plexusPositions = plexusGeo.attributes.position.array;
    for (let i = 0; i < PLEXUS_NODES; i++) {
      plexusPositions[i*3] += plexusVel[i].x;
      plexusPositions[i*3+1] += plexusVel[i].y;
      plexusPositions[i*3+2] += plexusVel[i].z;
      
      const px = plexusPositions[i*3];
      const pz = plexusPositions[i*3+2];
      
      if (px > 30 || px < -30) plexusVel[i].x *= -1;
      if (pz > -6 || pz < -30) plexusVel[i].z *= -1;
      if (plexusPositions[i*3+1] > 12 || plexusPositions[i*3+1] < -12) {
        plexusVel[i].y *= -1;
      }
    }
    plexusGeo.attributes.position.needsUpdate = true;
    
    // Connetti plexus
    const linePts = plexusLineGeo.attributes.position.array;
    let lineIdx = 0;
    for (let i = 0; i < PLEXUS_NODES; i++) {
      for (let j = i + 1; j < PLEXUS_NODES; j++) {
        const dx = plexusPositions[i*3] - plexusPositions[j*3];
        const dy = plexusPositions[i*3+1] - plexusPositions[j*3+1];
        const dz = plexusPositions[i*3+2] - plexusPositions[j*3+2];
        if (dx*dx + dy*dy + dz*dz < 25.0) {
          linePts[lineIdx++] = plexusPositions[i*3];
          linePts[lineIdx++] = plexusPositions[i*3+1];
          linePts[lineIdx++] = plexusPositions[i*3+2];
          linePts[lineIdx++] = plexusPositions[j*3];
          linePts[lineIdx++] = plexusPositions[j*3+1];
          linePts[lineIdx++] = plexusPositions[j*3+2];
        }
      }
    }
    plexusLineGeo.setDrawRange(0, lineIdx / 3);
    plexusLineGeo.attributes.position.needsUpdate = true;
  }""",
    content, flags=re.DOTALL
)

with open('/Users/kekkopettine/Desktop/abstergo/js/app.js', 'w') as f:
    f.write(content)
print("Done.")
