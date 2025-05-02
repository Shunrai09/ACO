import Phaser from 'phaser';
import CONFIG from './config';

export default class Ant {
    constructor(startIndex, targetIndex, nodes, scene, color) {
      // 1. Validación básica
      if (!nodes || nodes.length === 0) {
        console.error("Error: nodos no definidos");
        return;
      }
      
      // 2. Posición inicial
      const startNode = nodes[startIndex];
      if (!startNode) {
        console.error(`Error: nodo inicial ${startIndex} no existe`);
        return;
      }
      
      // 3. Creación visual
      this.sprite = scene.add.circle(
        startNode.x,
        startNode.y,
        8, // Radio grande para debug
        color
      )
      .setStrokeStyle(2, 0xffffff); // Borde blanco
      
      console.log("Hormiga creada en:", startNode.x, startNode.y); // Debug 18
    }
  }