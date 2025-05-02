import Phaser from 'phaser';
import CONFIG from './config';
import Ant from './ant';

export default class Colony {
    constructor(scene, config) {
      console.log(`Creando colonia ${config.name}`); // Debug 8
      this.scene = scene;
      this.config = config;
      this.ants = [];
      
      // Debug visual de posición inicial
      const startNode = scene.graph.nodes[config.start];
      this.debugMarker = scene.add.circle(startNode.x, startNode.y, 10, config.color)
        .setAlpha(0.5)
        .setDepth(15);
        
      console.log(`Posición inicial colonia ${config.name}:`, startNode); // Debug 9
    }
    
    spawnAnt() {
      console.log(`Intentando spawnear hormiga en colonia ${this.config.name}`); // Debug 10
      
      try {
        const ant = new Ant(
          this.config.start,
          this.config.target,
          this.scene.graph.nodes,
          this.scene,
          this.config.color
        );
        
        console.log("Hormiga creada:", ant); // Debug 11
        this.ants.push(ant);
        return ant;
      } catch (error) {
        console.error("Error al crear hormiga:", error);
        return null;
      }
    }
  }