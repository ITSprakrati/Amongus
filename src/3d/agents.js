import * as THREE from 'three';
import { gsap } from 'gsap';

export class AgentSystem3D {
  constructor(scene) {
    this.scene = scene;
    this.agents = {};
    this.activeAgentName = null;
    
    // Group for all agents
    this.group = new THREE.Group();
    this.scene.add(this.group);
    
    this.initAgents();
  }
  
  initAgents() {
    const agentConfigs = [
      { 
        name: 'Registrar', 
        title: 'REGISTRAR',
        role: 'Intake & Config',
        color: 0xf59e0b, 
        colorHex: '#F59E0B',
        geometry: new THREE.OctahedronGeometry(0.45) 
      },
      { 
        name: 'Assessor', 
        title: 'ASSESSOR',
        role: 'Document Intel',
        color: 0x0ea5e9, 
        colorHex: '#0EA5E9',
        geometry: new THREE.IcosahedronGeometry(0.45, 0) 
      },
      { 
        name: 'Proctor', 
        title: 'PROCTOR',
        role: 'Verification & QA',
        color: 0x10b981, 
        colorHex: '#10B981',
        geometry: new THREE.BoxGeometry(0.65, 0.65, 0.65) 
      },
      { 
        name: 'Auditor', 
        title: 'AUDITOR',
        role: 'Analytics & Audit',
        color: 0xe11d48, 
        colorHex: '#E11D48',
        geometry: new THREE.DodecahedronGeometry(0.45) 
      },
      { 
        name: 'Archivist', 
        title: 'ARCHIVIST',
        role: 'Moderation Memory',
        color: 0x6366f1, 
        colorHex: '#6366F1',
        geometry: new THREE.SphereGeometry(0.42, 32, 32) 
      }
    ];
    
    const spacing = 2.4;
    const startX = -((agentConfigs.length - 1) * spacing) / 2;
    
    agentConfigs.forEach((config, index) => {
      const agentGroup = new THREE.Group();
      
      // 1. Inner crystal core
      const coreMaterial = new THREE.MeshPhysicalMaterial({
        color: config.color,
        emissive: config.color,
        emissiveIntensity: 0.35,
        metalness: 0.2,
        roughness: 0.15,
        transparent: true,
        opacity: 0.95,
        transmission: 0.45,
        clearcoat: 1.0,
      });
      const coreMesh = new THREE.Mesh(config.geometry, coreMaterial);
      agentGroup.add(coreMesh);
      
      // 2. Holographic Ring 1 (Equatorial)
      const ring1Geo = new THREE.TorusGeometry(0.72, 0.015, 12, 48);
      const ringMat = new THREE.MeshBasicMaterial({ 
        color: config.color, 
        transparent: true, 
        opacity: 0.4,
        blending: THREE.AdditiveBlending 
      });
      const ring1 = new THREE.Mesh(ring1Geo, ringMat);
      ring1.rotation.x = Math.PI / 2;
      agentGroup.add(ring1);
      
      // 3. Holographic Ring 2 (Polar / Gimbal)
      const ring2Geo = new THREE.TorusGeometry(0.92, 0.012, 12, 48);
      const ring2 = new THREE.Mesh(ring2Geo, ringMat.clone());
      ring2.rotation.y = Math.PI / 4;
      agentGroup.add(ring2);

      // 4. Subtle Outer Wireframe Halo
      const wireframeMat = new THREE.MeshBasicMaterial({
        color: config.color,
        wireframe: true,
        transparent: true,
        opacity: 0.15
      });
      const outerMesh = new THREE.Mesh(config.geometry, wireframeMat);
      outerMesh.scale.set(1.25, 1.25, 1.25);
      agentGroup.add(outerMesh);
      
      // 5. Downward Beacon Cone
      const beamGeo = new THREE.CylinderGeometry(0.04, 0.5, 4.5, 16);
      beamGeo.translate(0, -2.25, 0);
      const beamMat = new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      agentGroup.add(beam);
      
      // 6. Dynamic Point Light
      const light = new THREE.PointLight(config.color, 0, 10);
      light.position.set(0, 0, 0);
      agentGroup.add(light);
      
      // 7. Floating 3D Text Badge Sprite
      const badgeSprite = this.createBadgeSprite(config.title, config.role, config.colorHex);
      agentGroup.add(badgeSprite);

      // Celestial Background Dock: high overhead, well clear of any UI cards
      const baseX = startX + index * spacing;
      const baseY = 11.5;
      const baseZ = -13.0;
      
      agentGroup.position.set(baseX, baseY, baseZ);
      agentGroup.scale.set(0.5, 0.5, 0.5);
      
      // Store references for animation
      agentGroup.userData = {
        name: config.name,
        colorHex: config.colorHex,
        baseX, baseY, baseZ,
        core: coreMesh,
        ring1: ring1,
        ring2: ring2,
        outer: outerMesh,
        beam: beam,
        light: light,
        badge: badgeSprite,
        timeOffset: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 0.5
      };
      
      this.agents[config.name] = agentGroup;
      this.group.add(agentGroup);
    });
  }

  createBadgeSprite(title, roleSubtitle, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Background pill with dark glass effect
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(16, 16, 352, 96, 24);
    ctx.fill();
    
    // Colored border
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(16, 16, 352, 96, 24);
    ctx.stroke();
    
    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 192, 58);
    
    // Subtitle
    ctx.fillStyle = colorHex;
    ctx.font = '600 18px "JetBrains Mono", monospace';
    ctx.fillText(roleSubtitle.toUpperCase(), 192, 88);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0 });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.2, 0.75, 1);
    sprite.position.y = -0.85;
    return sprite;
  }
  
  activateAgent(name, customTargetPos = null) {
    if (this.activeAgentName === name && !customTargetPos) return;
    
    this.deactivateAll();
    
    const agent = this.agents[name];
    if (agent) {
      this.activeAgentName = name;
      
      const target = customTargetPos || { x: -1.8, y: 3.5, z: 0.5 };
      
      // Move active agent forward into view
      gsap.to(agent.position, {
        x: target.x,
        y: target.y,
        z: target.z,
        duration: 1.2,
        ease: "power3.out"
      });
      
      // Scale up to hero size
      gsap.to(agent.scale, {
        x: 1.25,
        y: 1.25,
        z: 1.25,
        duration: 1.2,
        ease: "back.out(1.4)"
      });

      // Brighten active agent materials
      if (agent.userData.core?.material) {
        agent.userData.core.material.opacity = 1.0;
        agent.userData.core.material.emissiveIntensity = 0.6;
      }
      if (agent.userData.ring1?.material) agent.userData.ring1.material.opacity = 0.8;
      if (agent.userData.ring2?.material) agent.userData.ring2.material.opacity = 0.7;
      
      // Fade in badge sprite
      if (agent.userData.badge?.material) {
        gsap.to(agent.userData.badge.material, { opacity: 0.95, duration: 0.6, delay: 0.3 });
      }
      
      // Activate light beam down to work area
      gsap.to(agent.userData.beam.material, {
        opacity: 0.6,
        duration: 0.8,
        delay: 0.2
      });
      
      // Light up the desk
      gsap.to(agent.userData.light, {
        intensity: 3.5,
        duration: 0.8,
        delay: 0.2
      });
    }
  }
  
  deactivateAll() {
    this.activeAgentName = null;
    
    Object.values(this.agents).forEach(agent => {
      // Return to high celestial dock
      gsap.to(agent.position, {
        x: agent.userData.baseX,
        y: agent.userData.baseY,
        z: agent.userData.baseZ,
        duration: 1.0,
        ease: "power2.inOut"
      });
      
      // Diminish scale
      gsap.to(agent.scale, {
        x: 0.5,
        y: 0.5,
        z: 0.5,
        duration: 1.0,
        ease: "power2.inOut"
      });

      // Subtly dim inactive materials
      if (agent.userData.core?.material) {
        agent.userData.core.material.opacity = 0.15;
        agent.userData.core.material.emissiveIntensity = 0.1;
      }
      if (agent.userData.ring1?.material) agent.userData.ring1.material.opacity = 0.1;
      if (agent.userData.ring2?.material) agent.userData.ring2.material.opacity = 0.1;
      
      // Hide badge sprite
      if (agent.userData.badge?.material) {
        gsap.to(agent.userData.badge.material, { opacity: 0, duration: 0.3 });
      }
      
      // Deactivate beam and light
      gsap.to(agent.userData.beam.material, {
        opacity: 0,
        duration: 0.3
      });
      
      gsap.to(agent.userData.light, {
        intensity: 0,
        duration: 0.3
      });
    });
  }
  
  update(delta) {
    if (!this.clockTime) this.clockTime = 0;
    this.clockTime += delta;
    
    Object.values(this.agents).forEach(agent => {
      const data = agent.userData;
      const t = this.clockTime * data.speed + data.timeOffset;
      const isActive = (this.activeAgentName === data.name);
      
      // Organic levitation hover
      const hoverOffset = Math.sin(t * 2) * (isActive ? 0.08 : 0.03);
      data.core.position.y = hoverOffset;
      data.outer.position.y = hoverOffset;
      
      // Continuous core rotation
      data.core.rotation.x += delta * 0.4;
      data.core.rotation.y += delta * 0.6;
      
      data.outer.rotation.x -= delta * 0.2;
      data.outer.rotation.y -= delta * 0.3;
      
      // Counter-rotating gyroscopic rings
      data.ring1.position.y = hoverOffset;
      data.ring1.rotation.z += delta * (isActive ? 1.2 : 0.4);
      
      data.ring2.position.y = hoverOffset;
      data.ring2.rotation.x += delta * (isActive ? 0.9 : 0.3);
      data.ring2.rotation.y += delta * (isActive ? 0.7 : 0.2);

      // Living heartbeat pulse on emissive intensity
      if (isActive && data.core?.material) {
        data.core.material.emissiveIntensity = 0.5 + 0.25 * Math.sin(t * 3);
      }
    });
  }
}
