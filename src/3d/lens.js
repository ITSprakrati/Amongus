import * as THREE from 'three';
import gsap from 'gsap';

/**
 * EvaluationLens3D
 * 
 * A precision academic instrument visualization connecting four nodes:
 * QUESTION, ANSWER, EVIDENCE, CRITERION.
 * Designed with a subtle, non-intrusive aesthetic.
 */
export class EvaluationLens3D {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.visible = false;

        // Brand Colors
        this.colors = {
            ivory: 0xFAF8F5,
            slate: 0x1E242B,
            tealAccent: 0x147C87, // Subtle teal
            goldAccent: 0xB59D5B  // Subtle gold
        };

        this.nodes = {};
        this.tethers = [];
        this.frame = null;
        this.pane = null;
        this.frameGroup = new THREE.Group();

        this.init();
        this.scene.add(this.group);
    }

    init() {
        this.createFrame();
        this.createNodes();
        this.createTethers();
    }

    createFrame() {
        // Main rectangular focus frame
        const width = 4;
        const height = 2.5;
        
        // Outer subtle border
        const borderGeometry = new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, height));
        const borderMaterial = new THREE.LineBasicMaterial({
            color: this.colors.slate,
            transparent: true,
            opacity: 0.0,
            linewidth: 1
        });
        this.frame = new THREE.LineSegments(borderGeometry, borderMaterial);
        
        // Inner glass pane
        const paneGeometry = new THREE.PlaneGeometry(width, height);
        const paneMaterial = new THREE.MeshPhysicalMaterial({
            color: this.colors.ivory,
            metalness: 0.1,
            roughness: 0.1,
            transmission: 0.9,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide
        });
        this.pane = new THREE.Mesh(paneGeometry, paneMaterial);
        
        this.frameGroup.add(this.frame);
        this.frameGroup.add(this.pane);
        this.group.add(this.frameGroup);
    }

    createNodes() {
        // We use small elegant octahedrons to represent precise academic nodes
        const nodeNames = ['QUESTION', 'ANSWER', 'EVIDENCE', 'CRITERION'];
        const geometry = new THREE.OctahedronGeometry(0.08, 0);
        
        nodeNames.forEach((name, index) => {
            // Alternate between teal and gold accents for distinction
            const color = (index % 2 === 0) ? this.colors.tealAccent : this.colors.goldAccent;
            const material = new THREE.MeshStandardMaterial({
                color: color,
                metalness: 0.4,
                roughness: 0.2,
                transparent: true,
                opacity: 0
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            // Label could be added here using a Text/Canvas approach, 
            // but for this abstract structure we'll keep it pure geometry.
            
            this.nodes[name] = mesh;
            this.group.add(mesh);
        });
    }

    createTethers() {
        // Connect QUESTION -> ANSWER -> EVIDENCE -> CRITERION
        const material = new THREE.LineBasicMaterial({
            color: this.colors.slate,
            transparent: true,
            opacity: 0
        });

        // 3 lines to connect 4 nodes
        for (let i = 0; i < 3; i++) {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(6); 
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            
            const line = new THREE.Line(geometry, material);
            this.tethers.push(line);
            this.group.add(line);
        }
    }

    updateTethers() {
        const keys = ['QUESTION', 'ANSWER', 'EVIDENCE', 'CRITERION'];
        
        for (let i = 0; i < 3; i++) {
            const p1 = this.nodes[keys[i]].position;
            const p2 = this.nodes[keys[i+1]].position;
            
            const positions = this.tethers[i].geometry.attributes.position.array;
            positions[0] = p1.x; positions[1] = p1.y; positions[2] = p1.z;
            positions[3] = p2.x; positions[4] = p2.y; positions[5] = p2.z;
            
            this.tethers[i].geometry.attributes.position.needsUpdate = true;
        }
    }

    /**
     * Activates the lens visualization.
     * @param {THREE.Vector3} sourcePoint Origin of the focus frame.
     * @param {Object} targetPoints Map of keys ('QUESTION', etc.) to THREE.Vector3 target coordinates.
     */
    activate(sourcePoint, targetPoints) {
        this.group.visible = true;
        
        // Reset frame
        this.frameGroup.position.copy(sourcePoint);
        this.frameGroup.scale.set(0.8, 0.8, 0.8);
        this.frame.material.opacity = 0;
        this.pane.material.opacity = 0;

        // Frame entry animation
        gsap.to(this.frameGroup.scale, {
            x: 1, y: 1, z: 1,
            duration: 1.2,
            ease: "power3.out"
        });
        gsap.to(this.frame.material, {
            opacity: 0.4,
            duration: 1.0,
            ease: "power2.out"
        });
        gsap.to(this.pane.material, {
            opacity: 0.1,
            duration: 1.0,
            ease: "power2.out"
        });

        // Nodes & Tethers entry animation
        const keys = ['QUESTION', 'ANSWER', 'EVIDENCE', 'CRITERION'];
        
        keys.forEach((key, i) => {
            const node = this.nodes[key];
            // Default spacing if targetPoints are partially missing
            const fallbackPos = new THREE.Vector3((i - 1.5) * 1.5, 0, 1);
            const targetPos = (targetPoints && targetPoints[key]) ? targetPoints[key] : fallbackPos;
            
            // Nodes originate from the center of the frame, expanding outward
            node.position.copy(sourcePoint);
            node.material.opacity = 0;
            node.scale.set(0.1, 0.1, 0.1);

            // Animate node translation
            gsap.to(node.position, {
                x: targetPos.x,
                y: targetPos.y,
                z: targetPos.z,
                duration: 1.4,
                delay: i * 0.1,
                ease: "expo.out",
                onUpdate: () => this.updateTethers()
            });

            // Animate node appearance
            gsap.to(node.scale, {
                x: 1, y: 1, z: 1,
                duration: 1.0,
                delay: i * 0.1,
                ease: "back.out(1.2)"
            });
            gsap.to(node.material, {
                opacity: 0.9,
                duration: 0.8,
                delay: i * 0.1
            });
        });

        // Tethers fade in progressively
        this.tethers.forEach((tether, i) => {
            gsap.to(tether.material, {
                opacity: 0.3,
                duration: 0.8,
                delay: 0.4 + (i * 0.15),
                ease: "power1.inOut"
            });
        });
    }

    deactivate() {
        // Graceful fade out
        gsap.to(this.frameGroup.scale, {
            x: 0.9, y: 0.9, z: 0.9,
            duration: 0.6,
            ease: "power2.in"
        });
        gsap.to(this.frame.material, { opacity: 0, duration: 0.5 });
        gsap.to(this.pane.material, { opacity: 0, duration: 0.5 });
        
        Object.values(this.nodes).forEach((node, i) => {
            gsap.to(node.material, { opacity: 0, duration: 0.4, delay: i * 0.05 });
            gsap.to(node.scale, { x: 0.1, y: 0.1, z: 0.1, duration: 0.5, delay: i * 0.05 });
        });
        
        this.tethers.forEach((tether, i) => {
            gsap.to(tether.material, { opacity: 0, duration: 0.3 });
        });

        // Hide group after completed
        gsap.delayedCall(0.8, () => {
            this.group.visible = false;
        });
    }
}
