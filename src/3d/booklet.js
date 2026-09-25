import * as THREE from 'three';
import { gsap } from 'gsap';

export class Booklet3D {
    constructor(scene, data = {}) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.pages = [];
        this.pageCount = 12;

        const PAGE_WIDTH = 4;
        const PAGE_THICKNESS = 0.01;
        const PAGE_LENGTH = 5.5;

        // Create the geometry and translate origin to the left edge for pivoting
        const geometry = new THREE.BoxGeometry(PAGE_WIDTH, PAGE_THICKNESS, PAGE_LENGTH);
        geometry.translate(PAGE_WIDTH / 2, 0, 0);

        for (let i = 0; i < this.pageCount; i++) {
            const isFront = (i === 0);
            const materials = this.createMaterials(isFront, data);
            
            const mesh = new THREE.Mesh(geometry, materials);
            
            // Stack pages from bottom to top; index 0 is the topmost page (cover)
            const yPos = (this.pageCount - i - 1) * PAGE_THICKNESS * 1.05;
            
            // Crisp, flat desk alignment
            const xOff = 0;
            const zOff = 0;
            const rotYOff = 0;

            mesh.position.set(xOff, yPos, zOff);
            mesh.rotation.y = rotYOff;
            
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            mesh.userData = {
                originalY: yPos,
                originalX: xOff,
                originalZ: zOff,
                originalRotY: rotYOff,
                isOpen: false
            };

            this.pages.push(mesh);
            this.group.add(mesh);
        }

        this.scene.add(this.group);
    }

    createMaterials(isFront, data, providedCanvas = null) {
        let frontTex;
        if (providedCanvas) {
            frontTex = new THREE.CanvasTexture(providedCanvas);
        } else {
            frontTex = isFront ? this.createFrontPageTexture(data) : this.createInternalPageTexture();
        }
        const backTex = this.createInternalPageTexture();
        
        frontTex.colorSpace = THREE.SRGBColorSpace;
        backTex.colorSpace = THREE.SRGBColorSpace;

        const matTop = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            map: frontTex,
            roughness: 0.9 
        });
        const matBottom = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            map: backTex,
            roughness: 0.9 
        });
        const matEdge = new THREE.MeshStandardMaterial({ color: 0xFAF8F5, roughness: 1.0 });

        return [
            matEdge.clone(), // right
            matEdge.clone(), // left
            matTop,          // top
            matBottom,       // bottom
            matEdge.clone(), // front
            matEdge.clone()  // back
        ];
    }

    createFrontPageTexture(data) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1448;
        const ctx = canvas.getContext('2d');
        
        // Base ivory background
        ctx.fillStyle = '#FAF8F5'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Header text in slate ink
        ctx.fillStyle = '#1E242B'; 
        ctx.font = 'bold 70px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(data.title || 'EXAMINATION BOOKLET', canvas.width / 2, 200);
        
        // Body details
        ctx.font = '40px "Newsreader", serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Candidate ID : ${data.candidateId || 'XXXX-XXXX'}`, 150, 400);
        ctx.fillText(`Subject      : ${data.subject || 'General Studies'}`, 150, 480);
        ctx.fillText(`Date         : ${data.date || '2026-09-19'}`, 150, 560);
        
        // Ornamental border
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#1E242B';
        ctx.strokeRect(80, 80, canvas.width - 160, canvas.height - 160);
        ctx.strokeRect(95, 95, canvas.width - 190, canvas.height - 190);
        
        // Mock barcode
        ctx.fillStyle = '#1E242B';
        for(let i = 0; i < 20; i++) {
            ctx.fillRect(150 + i * 20 + (Math.random() * 5), 700, 10 + Math.random() * 10, 100);
        }

        // ThreeJS BoxGeometry typically maps top canvas correctly if aspect ratio aligns
        return new THREE.CanvasTexture(canvas);
    }

    createInternalPageTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1448;
        const ctx = canvas.getContext('2d');
        
        // Base ivory background
        ctx.fillStyle = '#FAF8F5';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Margin line in slate ink
        ctx.strokeStyle = '#1E242B';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(200, 0);
        ctx.lineTo(200, canvas.height);
        ctx.stroke();

        // Ruled lines in a lighter slate opacity
        ctx.strokeStyle = 'rgba(30, 36, 43, 0.2)';
        ctx.lineWidth = 2;
        for(let y = 150; y < canvas.height - 100; y += 45) {
            ctx.beginPath();
            ctx.moveTo(200, y);
            ctx.lineTo(canvas.width - 50, y);
            ctx.stroke();
        }
        
        return new THREE.CanvasTexture(canvas);
    }

    updateTexturesFromRealSession(canvases) {
        const newPageCount = canvases.length;
        const oldPageCount = this.pageCount;
        this.pageCount = newPageCount;

        const PAGE_WIDTH = 4;
        const PAGE_THICKNESS = 0.01;
        const PAGE_LENGTH = 5.5;

        const geometry = new THREE.BoxGeometry(PAGE_WIDTH, PAGE_THICKNESS, PAGE_LENGTH);
        geometry.translate(PAGE_WIDTH / 2, 0, 0);

        for (let i = 0; i < Math.max(newPageCount, oldPageCount); i++) {
            if (i < newPageCount) {
                const materials = this.createMaterials(i === 0, {}, canvases[i]);

                if (i < oldPageCount) {
                    const page = this.pages[i];
                    
                    if (page.material) {
                        page.material.forEach(mat => {
                            if (mat.map) mat.map.dispose();
                            mat.dispose();
                        });
                    }
                    
                    page.material = materials;
                } else {
                    const mesh = new THREE.Mesh(geometry, materials);
                    const yPos = (this.pageCount - i - 1) * PAGE_THICKNESS * 1.05;
                    
                    const xOff = 0;
                    const zOff = 0;
                    const rotYOff = 0;

                    mesh.position.set(xOff, yPos, zOff);
                    mesh.rotation.y = rotYOff;
                    
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;

                    mesh.userData = {
                        originalY: yPos,
                        originalX: xOff,
                        originalZ: zOff,
                        originalRotY: rotYOff,
                        isOpen: false
                    };

                    this.pages.push(mesh);
                    this.group.add(mesh);
                }
            } else {
                const page = this.pages.pop();
                if (page) {
                    if (page.material) {
                        page.material.forEach(mat => {
                            if (mat.map) mat.map.dispose();
                            mat.dispose();
                        });
                    }
                    if (page.geometry) page.geometry.dispose();
                    this.group.remove(page);
                }
            }
        }
        
        for (let i = 0; i < this.pageCount; i++) {
            const page = this.pages[i];
            const yPos = (this.pageCount - i - 1) * PAGE_THICKNESS * 1.05;
            page.userData.originalY = yPos;
            if (!page.userData.isOpen) {
                page.position.y = yPos;
            }
        }
    }

    /**
     * Flips pages like a real book to reveal the target index
     * @param {number} pageIndex The index to turn to (0 = front cover)
     */
    openToPage(pageIndex) {
        const targetPage = Math.max(0, Math.min(pageIndex, this.pageCount));

        this.pages.forEach((page, i) => {
            if (i < targetPage) {
                // Open page (flip to left side)
                if (!page.userData.isOpen) {
                    gsap.to(page.rotation, {
                        z: Math.PI - 0.02 * (targetPage - i), // Fanned out slightly
                        duration: 1.2,
                        ease: "power3.inOut",
                        delay: i * 0.05
                    });
                    page.userData.isOpen = true;
                }
            } else {
                // Keep page closed (flip to right side)
                if (page.userData.isOpen) {
                    gsap.to(page.rotation, {
                        z: 0,
                        duration: 1.2,
                        ease: "power3.inOut",
                        delay: (this.pageCount - i) * 0.05
                    });
                    page.userData.isOpen = false;
                }
            }
        });
    }

    /**
     * Raises a specific page out of the stack and shifts its color. 
     * Simulates the 'Hero 04' warning animation.
     * @param {number} pageIndex 
     * @param {string} colorHex Warning color (e.g. slate or an alert red)
     */
    raisePage(pageIndex, colorHex = '#e07a5f') {
        const page = this.pages[pageIndex];
        if (!page) return;

        // Lift out vertically
        gsap.to(page.position, {
            y: page.userData.originalY + 0.8,
            duration: 0.8,
            ease: "back.out(1.5)"
        });
        
        // Smoothly tint the top and bottom materials
        const topMat = page.material[2];
        const bottomMat = page.material[3];
        const color = new THREE.Color(colorHex);

        gsap.to(topMat.color, { r: color.r, g: color.g, b: color.b, duration: 0.8 });
        gsap.to(bottomMat.color, { r: color.r, g: color.g, b: color.b, duration: 0.8 });
    }

    /**
     * Settles a raised page back into its natural stack position
     * and restores its original ivory tint.
     * @param {number} pageIndex 
     */
    settlePage(pageIndex) {
        const page = this.pages[pageIndex];
        if (!page) return;

        // Return to stack
        gsap.to(page.position, {
            y: page.userData.originalY,
            duration: 0.8,
            ease: "power2.inOut"
        });
        
        const topMat = page.material[2];
        const bottomMat = page.material[3];
        
        // Reset tint to original white (CanvasTexture already has the ivory background)
        gsap.to(topMat.color, { r: 1, g: 1, b: 1, duration: 0.8 });
        gsap.to(bottomMat.color, { r: 1, g: 1, b: 1, duration: 0.8 });
    }
}
