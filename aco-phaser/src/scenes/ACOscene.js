import Phaser from 'phaser';
import { Ant } from '../entities/Ant';
import { 
  JITTER, SPEED_RANGE, DURATION_FACTOR, 
  SPAWN_INTERVAL, CYCLE_INTERVAL, TRAFFIC_INTERVAL,
  ACO_PARAMS 
} from '../config/constants';
import { COLONIES } from '../config/colonies';
import { NODES, SPECIAL_NODES } from '../config/nodes';
import { BASE_EDGES } from '../config/edges';
import { SPECIAL_EDGES, BLOCK_MAP } from '../config/traffic';
import { generateBaseEdges, ensureConnectivity } from '../utils/helpers';

export class ACOScene extends Phaser.Scene {
  constructor() {
    super('ACOScene');
    
    // Parámetros ACO
    this.alpha = ACO_PARAMS.alpha;
    this.beta = ACO_PARAMS.beta;
    this.evaporationRate = ACO_PARAMS.evaporationRate;
    this.numAntsPerColony = ACO_PARAMS.numAntsPerColony;

    // Estructuras
    this.nodes = NODES;
    this.edges = [];
    this.pheromones = [];
    this.ants = [];

    // Colonias
    this.colonies = COLONIES;

    // Semáforos
    this.specialEdges = SPECIAL_EDGES;
    this.edgeStates = {};
    this.specialEdges.forEach(key => this.edgeStates[key] = true);
    this.specialEdgeTimers = {};
    this.blockMap = BLOCK_MAP;
  }

  preload() { }

  create() {
    this.graphics = this.add.graphics();

    this.setupNodes();
    this.setupEdges();
    this.initPheromones();
    this.setupColonies();
    this.createUI();
    this.startTimers();

    // alternar semáforos cada 10 segundos
    this.specialEdges.forEach(key => {
      this.specialEdgeTimers[key] = this.time.addEvent({
        delay: TRAFFIC_INTERVAL,
        loop: true,
        callback: () => {
          this.edgeStates[key] = !this.edgeStates[key];
        }
      });
    });
  }

  setupNodes() {
    this.nodes.forEach((n, i) => {
      this.add.circle(n.x, n.y, 8, SPECIAL_NODES[i] || 0xffffff);
      this.add.text(n.x - 5, n.y - 5, `${i}`, { font: '10px Arial', fill: '#000' });
    });
  }

  setupEdges() {
    this.edges = generateBaseEdges(this.nodes);
    this.edges = ensureConnectivity(this.nodes, this.edges);
    
    // Añadir aristas críticas
    BASE_EDGES.forEach(([i, j]) => {
      if (i < this.nodes.length && j < this.nodes.length &&
        !this.edges.some(e => (e[0] === i && e[1] === j) || (e[0] === j && e[1] === i))) {
        this.edges.push([i, j]);
      }
    });
  }

  initPheromones() {
    const N = this.nodes.length;
    this.pheromones = Array(N).fill().map(() => Array(N).fill(0.1));
    this.edges.forEach(([i, j]) => {
      const d = Phaser.Math.Distance.BetweenPoints(this.nodes[i], this.nodes[j]);
      this.pheromones[i][j] = this.pheromones[j][i] = 1 / d;
    });
  }

  setupColonies() {
    this.colonies.forEach((col, index) => {
      col.spawnCount = 0;
      col.arrivedCount = 0;
      col.text = this.add.text(
        20, 50 + 25 * index,
        `Colonia ${col.name}: 0/${this.numAntsPerColony}`,
        { font: '14px Arial', fill: Phaser.Display.Color.IntegerToColor(col.color).rgba }
      );
    });
  }

  createUI() {
    this.add.text(20, 20, 'ACO – Múltiples Colonias', { font: '16px Arial', fill: '#fff' });
    this.add.rectangle(700, 30, 150, 30, 0x333333)
      .setInteractive()
      .on('pointerdown', () => this.resetSimulation());
    this.add.text(625, 25, 'Reiniciar Simulación', { font: '14px Arial', fill: '#fff' });
  }

  startTimers() {
    this.colonies.forEach(col => {
      col.spawnEvent = this.time.addEvent({
        delay: SPAWN_INTERVAL,
        callback: () => this.spawnAnt(col),
        callbackScope: this,
        repeat: this.numAntsPerColony - 1
      });
    });
    this.time.addEvent({
      delay: CYCLE_INTERVAL,
      loop: true,
      callback: () => this.runCycle()
    });
  }

  resetSimulation() {
    this.ants.forEach(a => a.sprite.destroy());
    this.ants = [];
    this.graphics.clear();
    this.initPheromones();
    this.colonies.forEach(col => {
      col.spawnCount = col.arrivedCount = 0;
      col.text.setText(`Colonia ${col.name}: 0/${this.numAntsPerColony}`);
      col.spawnEvent.reset({ repeat: this.numAntsPerColony - 1, delay: SPAWN_INTERVAL });
    });
  }

  spawnAnt(colony) {
    const ant = new Ant(colony.start, colony.target, this.nodes, this, colony.color);
    this.ants.push(ant);
    colony.spawnCount++;
    colony.text.setText(`Colonia ${colony.name}: ${colony.arrivedCount}/${colony.spawnCount}`);
  }

  runCycle() {
    this.moveAnts();
    this.updatePheromones();
    this.renderPheromones();
  }

  moveAnts() {
    this.ants.forEach(ant => ant.tryMove(this));
  }

  selectNextNode(ant, neighbors) {
    if (neighbors.length === 1) return neighbors[0];  // Si solo hay un vecino, regresa ese nodo
    
    // Excluir el nodo anterior para evitar que la hormiga retroceda
    const previousNode = ant.path[ant.path.length - 2];  // El nodo previo (último nodo en el camino)
    const validNeighbors = neighbors.filter(n => n !== previousNode);  // Filtrar el nodo anterior
    
    // Si no hay vecinos válidos, regresar al nodo original (puedes agregar un mecanismo para manejar esto, si es necesario)
    if (validNeighbors.length === 0) return neighbors[0];
  
    // Calcular probabilidades para los vecinos válidos
    const probs = validNeighbors.map(n => {
      const pher = this.pheromones[ant.current][n];
      const heur = 1 / Phaser.Math.Distance.BetweenPoints(this.nodes[ant.current], this.nodes[n]);
      return Math.pow(pher, this.alpha) * Math.pow(heur, this.beta);
    });
  
    // Normalizar las probabilidades
    const total = probs.reduce((s, p) => s + p, 0);
    let rnd = Math.random(), sum = 0;
  
    // Seleccionar el siguiente nodo basándonos en las probabilidades
    for (let i = 0; i < validNeighbors.length; i++) {
      sum += probs[i] / total;
      if (rnd <= sum) return validNeighbors[i];
    }

    return validNeighbors[validNeighbors.length - 1];  // Regresar el último nodo válido si no se encuentra uno por probabilidad
  }

  updatePheromones() {
    // evaporación
    this.edges.forEach(([i, j]) => {
      this.pheromones[i][j] *= this.evaporationRate;
      this.pheromones[j][i] *= this.evaporationRate;
    });

    // contar llegadas y refuerzo
    this.ants.forEach(ant => {
      if (ant.arrived && !ant.counted) {
        ant.counted = true;
        const col = this.colonies.find(c => c.start === ant.path[0]);
        if (col) {
          col.arrivedCount++;
          col.text.setText(`Colonia ${col.name}: ${col.arrivedCount}/${col.spawnCount}`);
        }
      }
      if (ant.arrived) {
        const pherAdd = 100 / ant.totalDistance;
        for (let k = 0; k < ant.path.length - 1; k++) {
          const u = ant.path[k], v = ant.path[k + 1];
          this.pheromones[u][v] += pherAdd;
          this.pheromones[v][u] += pherAdd;
        }
      }
    });
  }

  renderPheromones() {
    this.graphics.clear();
    const maxP = Math.max(...this.edges.map(([i, j]) => this.pheromones[i][j]));
    this.edges.forEach(([i, j]) => {
      const norm = maxP ? this.pheromones[i][j] / maxP : 0;
      const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
      let color, width;

      if (this.specialEdges.has(key)) {
        // semáforo: rojo=bloqueado, verde=libre
        if (!this.edgeStates[key]) {
          color = 0xff0000;
        } else {
          color = 0x00ff00;
        }
        width = 3;
      } else {
        color = Phaser.Display.Color.GetColor(255, 255 - norm * 255, 0);
        width = 1 + norm * 3;
      }

      this.graphics.lineStyle(width, color);
      this.graphics.lineBetween(
        this.nodes[i].x, this.nodes[i].y,
        this.nodes[j].x, this.nodes[j].y
      );
    });
  }
}
