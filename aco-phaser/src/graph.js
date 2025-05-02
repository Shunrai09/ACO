import Phaser from 'phaser';
import CONFIG from './config';

export default class Graph {
  constructor(scene) {
    this.scene = scene;
    this.nodes = [];
    this.edges = [];
    this.pheromones = [];
    this.specialEdges = new Set(CONFIG.SPECIAL_EDGES);
    this.edgeStates = new Map();
    
    this.init();
  }

  init() {
    this.createNodes();
    this.createEdges();
    this.initPheromones();
    this.initSpecialEdges();
  }

  createNodes() {
    // Definición de posiciones de los nodos
    this.nodes = [
      {x:400,y:100}, {x:271,y:100}, {x:186,y:143}, {x:143,y:186},
      {x:100,y:229}, {x:100,y:314}, {x:100,y:400}, {x:100,y:486},
      {x:100,y:571}, {x:186,y:657}, {x:271,y:700}, {x:486,y:143},
      {x:529,y:186}, {x:571,y:229}, {x:571,y:314}, {x:571,y:400},
      {x:571,y:486}, {x:571,y:571}, {x:400,y:700}, {x:486,y:657},
      {x:186,y:229}, {x:271,y:314}, {x:186,y:571}, {x:400,y:143},
      {x:271,y:186}, {x:271,y:143}, {x:400,y:186}, {x:486,y:186},
      {x:271,y:657}, {x:271,y:571}, {x:271,y:486}, {x:271,y:400},
      {x:271,y:229}, {x:186,y:486}, {x:186,y:400}, {x:186,y:314},
      {x:400,y:186}, {x:400,y:486}, {x:400,y:400}, {x:400,y:229},
      {x:400,y:314}, {x:400,y:571}, {x:400,y:657}, {x:486,y:314},
      {x:486,y:486}, {x:486,y:400}, {x:486,y:229}
    ];

    // Dibujar nodos en la escena
    if (CONFIG.SHOW_NODES) {
      this.drawNodes();
    }
  }

  drawNodes() {
    this.nodes.forEach((node, i) => {
      const color = this.getNodeColor(i);
      this.scene.add.circle(node.x, node.y, CONFIG.NODE_RADIUS, color);
      
      if (CONFIG.SHOW_NODE_LABELS) {
        this.scene.add.text(
          node.x - 5, 
          node.y - 5, 
          `${i}`, 
          { font: '10px Arial', fill: '#000' }
        );
      }
    });
  }

  getNodeColor(index) {
    const specialNodes = {
      0: 0xffff00, 18: 0x00ff00,
      6: 0x0000ff, 15: 0x00ffff,
      16: 0xff69b4, 7: 0xff00ff,
      10: 0xffa500, 1: 0xff6347
    };
    return specialNodes[index] || 0xffffff;
  }

  createEdges() {
    // Crear aristas básicas
    this.createBasicEdges();
    
    // Asegurar conectividad
    this.ensureConnectivity();
    
    // Añadir aristas críticas adicionales
    this.addCriticalEdges();
    
    if (CONFIG.DEBUG) {
      console.log(`Grafo creado con ${this.nodes.length} nodos y ${this.edges.length} aristas`);
    }
  }

  createBasicEdges() {
    const T = CONFIG.EDGE_THRESHOLD;
    
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const A = this.nodes[i], B = this.nodes[j];
        const dx = Math.abs(A.x - B.x), dy = Math.abs(A.y - B.y);
        
        if ((dx < 5 && dy <= T) || (dy < 5 && dx <= T)) {
          this.edges.push([i, j]);
        }
      }
    }
  }

  ensureConnectivity() {
    const parent = this.nodes.map((_, i) => i);
    
    const find = u => {
      while (parent[u] !== u) {
        parent[u] = parent[parent[u]];
        u = parent[u];
      }
      return u;
    };
    
    const union = (u, v) => {
      const ru = find(u), rv = find(v);
      if (ru !== rv) parent[rv] = ru;
    };

    // Ordenar aristas por distancia
    this.edges.sort(([u1, v1], [u2, v2]) => {
      const d1 = this.getEdgeDistance(u1, v1);
      const d2 = this.getEdgeDistance(u2, v2);
      return d1 - d2;
    });

    // Construir MST
    this.edges.forEach(([u, v]) => union(u, v));

    // Conectar componentes desconectados si es necesario
    this.connectDisconnectedComponents(parent, find, union);
  }

  connectDisconnectedComponents(parent, find, union) {
    const components = new Set();
    this.nodes.forEach((_, i) => components.add(find(i)));
    
    if (components.size > 1) {
      const nodesByComponent = Array.from(components).map(c => 
        this.nodes.map((_, i) => i).filter(i => find(i) === c)
      );
      
      for (let i = 0; i < nodesByComponent.length - 1; i++) {
        this.connectToNearestComponent(nodesByComponent, i, union);
      }
    }
  }

  connectToNearestComponent(nodesByComponent, i, union) {
    let minDist = Infinity;
    let bestPair = null;
    
    for (let j = i + 1; j < nodesByComponent.length; j++) {
      nodesByComponent[i].forEach(u => {
        nodesByComponent[j].forEach(v => {
          const sameX = Math.abs(this.nodes[u].x - this.nodes[v].x) < 5;
          const sameY = Math.abs(this.nodes[u].y - this.nodes[v].y) < 5;
          
          if (sameX || sameY) {
            const dist = this.getEdgeDistance(u, v);
            if (dist < minDist) {
              minDist = dist;
              bestPair = [u, v];
            }
          }
        });
      });
    }
    
    if (bestPair) {
      this.edges.push(bestPair);
      union(bestPair[0], bestPair[1]);
    }
  }

  addCriticalEdges() {
    const criticalEdges = [
      [0, 23], [1, 25], [2, 20], [3, 4], [5, 6], [7, 8], [10, 18],
      [11, 12], [13, 14], [19, 17], [10, 9], [9, 8], [1, 2], [17, 41], [19, 18],
      [22, 29], [2, 3], [0, 11], [12, 13], [24, 25], [26, 36], [30, 31], [34, 35], [37, 38], [40, 41],
      [31, 38], [6, 34], [5, 35], [25, 23], [24, 36], [21, 35], [21, 40], [32, 39], [38, 45], [43, 45],
      [40, 43], [7, 33], [33, 30], [29, 41], [28, 42], [42, 41], [44, 19], [44, 37], [39, 46], [44, 45],
      [36, 27], [46, 43]
    ];
    
    criticalEdges.forEach(([i, j]) => {
      if (i < this.nodes.length && j < this.nodes.length) {
        const exists = this.edges.some(([u, v]) => 
          (u === i && v === j) || (u === j && v === i)
        );
        
        if (!exists) {
          this.edges.push([i, j]);
        }
      }
    });
  }

  initPheromones() {
    const N = this.nodes.length;
    this.pheromones = Array(N).fill().map(() => Array(N).fill(0));
    
    // Inicializar feromonas basadas en distancia inversa
    this.edges.forEach(([i, j]) => {
      const d = this.getEdgeDistance(i, j);
      this.pheromones[i][j] = this.pheromones[j][i] = 1 / Math.max(d, 0.1);
    });
    
    // Asegurar mínimo de feromonas
    this.ensureMinPheromones();
  }

  ensureMinPheromones() {
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = 0; j < this.nodes.length; j++) {
        if (this.pheromones[i][j] < CONFIG.MIN_PHEROMONE) {
          this.pheromones[i][j] = CONFIG.MIN_PHEROMONE;
        }
      }
    }
  }

  initSpecialEdges() {
    // Inicializar estados de semáforos (verde por defecto)
    this.specialEdges.forEach(key => {
      this.edgeStates.set(key, true);
    });
  }

  getEdgeDistance(u, v) {
    return Phaser.Math.Distance.BetweenPoints(this.nodes[u], this.nodes[v]);
  }

  getEdgeKey(u, v) {
    return `${Math.min(u, v)}-${Math.max(u, v)}`;
  }

  toggleTrafficLights() {
    this.specialEdges.forEach(key => {
      this.edgeStates.set(key, !this.edgeStates.get(key));
    });
    
    if (CONFIG.DEBUG) {
      console.log('Semáforos cambiados:', this.edgeStates);
    }
  }

  resetPheromones() {
    this.initPheromones();
  }

  getNeighbors(nodeIndex) {
    return this.edges
      .filter(([u, v]) => u === nodeIndex || v === nodeIndex)
      .map(([u, v]) => (u === nodeIndex ? v : u));
  }

  render(graphics) {
    graphics.clear();
    
    // Dibujar aristas normales
    this.renderNormalEdges(graphics);
    
    // Dibujar aristas especiales (semáforos)
    this.renderSpecialEdges(graphics);
  }

  renderNormalEdges(graphics) {
    const maxP = this.getMaxPheromone();
    
    this.edges.forEach(([i, j]) => {
      const key = this.getEdgeKey(i, j);
      
      if (!this.specialEdges.has(key)) {
        const norm = maxP > 0 ? this.pheromones[i][j] / maxP : 0;
        const width = 1 + norm * 3;
        const color = Phaser.Display.Color.GetColor(255, 255 - norm * 255, 0);
        
        graphics.lineStyle(width, color);
        graphics.lineBetween(
          this.nodes[i].x, this.nodes[i].y,
          this.nodes[j].x, this.nodes[j].y
        );
      }
    });
  }

  renderSpecialEdges(graphics) {
    this.specialEdges.forEach(key => {
      const [i, j] = key.split('-').map(Number);
      const color = this.edgeStates.get(key) ? 0x00ff00 : 0xff0000;
      
      graphics.lineStyle(3, color);
      graphics.lineBetween(
        this.nodes[i].x, this.nodes[i].y,
        this.nodes[j].x, this.nodes[j].y
      );
      
      // Dibujar semáforo en el centro
      const midX = (this.nodes[i].x + this.nodes[j].x) / 2;
      const midY = (this.nodes[i].y + this.nodes[j].y) / 2;
      
      graphics.fillStyle(0x333333);
      graphics.fillCircle(midX, midY, 10);
      graphics.fillStyle(color);
      graphics.fillCircle(midX, midY, 6);
    });
  }

  getMaxPheromone() {
    return this.edges.reduce((max, [i, j]) => 
      Math.max(max, this.pheromones[i][j]), 0);
  }
}