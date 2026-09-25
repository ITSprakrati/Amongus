import gsap from 'gsap';
import * as THREE from 'three';
import { Booklet3D } from './booklet.js';
import { EvaluationLens3D } from './lens.js';
import { AgentSystem3D } from './agents.js';

export class SceneController {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.camera = engine.camera;
    
    // Initialize components
    this.booklet = new Booklet3D(this.scene, window.EvalOS.state.data);
    this.lens = new EvaluationLens3D(this.scene);
    this.agents = new AgentSystem3D(this.scene);
    
    // Stage configurations (Camera pos, lookAt, active agent & co-pilot position)
    // Note: Ensuring camPos.x == camLookAt.x on desk views prevents camera gimbal roll tilt!
    this.stageConfigs = {
      1: { // Upload & Configure
        camPos: new THREE.Vector3(0, 14, 18),
        camLookAt: new THREE.Vector3(0, 0, 0),
        agent: 'Registrar',
        agentPos: { x: 0, y: 3.8, z: 1.0 },
        setup: () => {
          this.booklet.openToPage(0);
          this.lens.deactivate();
        }
      },
      2: { // Document Intelligence (OCR)
        camPos: new THREE.Vector3(-2.0, 8.5, 5.0),
        camLookAt: new THREE.Vector3(-2.0, 0, 0.2),
        agent: 'Assessor',
        agentPos: { x: -2.0, y: 3.5, z: -1.0 },
        setup: () => {
          this.booklet.openToPage(0);
          setTimeout(() => this.lens.activate(new THREE.Vector3(-2, 0.5, 0), [new THREE.Vector3(2, 0.5, 2)]), 800);
        }
      },
      3: { // AI Categorise
        camPos: new THREE.Vector3(0, 14, 12),
        camLookAt: new THREE.Vector3(0, 0, 0),
        agent: 'Assessor',
        agentPos: { x: 0, y: 4.5, z: -1.0 },
        setup: () => {
          this.booklet.openToPage(0);
          this.lens.deactivate();
        }
      },
      4: { // Human Examiner Check — Clean, Straight Desk Perspective
        camPos: new THREE.Vector3(-2.2, 7.5, 4.2),
        camLookAt: new THREE.Vector3(-2.2, 0, 0.2),
        agent: 'Assessor', // Co-pilot hovering to the left of the booklet
        agentPos: { x: -4.8, y: 2.5, z: 0.5 },
        setup: () => {
          this.booklet.openToPage(1);
          this.lens.deactivate();
        }
      },
      5: { // Submit Checked Copy
        camPos: new THREE.Vector3(0, 10, 12),
        camLookAt: new THREE.Vector3(0, 0, 0),
        agent: 'Proctor',
        agentPos: { x: 0, y: 3.5, z: 0 },
        setup: () => {
          this.booklet.openToPage(0);
        }
      },
      6: { // AI Post-Verify
        camPos: new THREE.Vector3(0, 12, 10),
        camLookAt: new THREE.Vector3(0, 0, 0),
        agent: 'Proctor',
        agentPos: { x: 0, y: 4.0, z: -1.0 },
        setup: () => {
          this.booklet.openToPage(2);
        }
      },
      7: { // Moderation
        camPos: new THREE.Vector3(-2.0, 8.5, 6.0),
        camLookAt: new THREE.Vector3(-2.0, 0, 0.2),
        agent: 'Archivist',
        agentPos: { x: -4.5, y: 3.0, z: 0.5 },
        setup: () => {
          this.booklet.openToPage(3);
        }
      },
      8: { // Result Ready
        camPos: new THREE.Vector3(0, 14, 12),
        camLookAt: new THREE.Vector3(0, 0, 0),
        agent: 'Auditor',
        agentPos: { x: 0, y: 4.5, z: -1.0 },
        setup: () => {
          this.booklet.openToPage(0);
        }
      },
      9: { // Analytics & Learning
        camPos: new THREE.Vector3(0, 18, 16),
        camLookAt: new THREE.Vector3(0, 0, 0),
        agent: 'Auditor',
        agentPos: { x: 0, y: 5.5, z: -2.0 },
        setup: () => {
          this.booklet.openToPage(0);
        }
      }
    };

    // Attach to engine render loop
    if (!this.engine.updatables) this.engine.updatables = [];
    this.engine.updatables.push(this.agents);
    this.engine.updatables.push(this.lens);
  }

  transitionToStage(stageNum) {
    const config = this.stageConfigs[stageNum];
    if (!config) return;

    // Animate Camera
    const dummyTarget = this.engine.controls && this.engine.controls.target ? { ...this.engine.controls.target } : { x: 0, y: 0, z: 0 };
    
    gsap.to(this.camera.position, {
      x: config.camPos.x,
      y: config.camPos.y,
      z: config.camPos.z,
      duration: 1.5,
      ease: "power3.inOut"
    });

    gsap.to(dummyTarget, {
      x: config.camLookAt.x,
      y: config.camLookAt.y,
      z: config.camLookAt.z,
      duration: 1.5,
      ease: "power3.inOut",
      onUpdate: () => {
        this.camera.lookAt(dummyTarget.x, dummyTarget.y, dummyTarget.z);
        if (this.engine.controls && this.engine.controls.target) {
            this.engine.controls.target.copy(dummyTarget);
        }
      }
    });

    // Agents
    if (config.agent) {
      this.agents.activateAgent(config.agent, config.agentPos);
    } else {
      this.agents.deactivateAll();
    }

    // Specific Setup
    if (config.setup) {
      config.setup();
    }
  }
}
