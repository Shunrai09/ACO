// src/main.js
import Phaser from 'phaser';

// —— Constantes de configuración ——
const JITTER = 4;
const SPEED_RANGE = [0.8, 1.2];
const DURATION_FACTOR = 25;
const SPAWN_INTERVAL = 1500; // ms entre spawns por colonia
const CYCLE_INTERVAL = 150;  // ms entre ciclos ACO
const TRAFFIC_INTERVAL = 10000; // ms entre cambio de semáforos (10s)

// —— Clase Ant ——
class Ant {
  constructor(startIndex, targetIndex, nodes, scene, color) {
    this.scene = scene;
    this.current = startIndex;
    this.target = targetIndex;
    this.path = [startIndex];
    this.totalDistance = 0;
    this.nodes = nodes;
    this.color = color;
    this.arrived = false;
    this.isMoving = false;
    this.counted = false;
    this.speed = Phaser.Math.FloatBetween(...SPEED_RANGE);

    const { x, y } = nodes[startIndex];
    this.sprite = scene.add.circle(
      x + Phaser.Math.Between(-JITTER, JITTER),
      y + Phaser.Math.Between(-JITTER, JITTER),
      5,
      color
    );
  }

  tryMove(ctx) {
    if (this.arrived || this.isMoving) return;

    // 1) vecinos directos
    let neighbors = ctx.edges
      .filter(([u, v]) => u === this.current || v === this.current)
      .map(([u, v]) => (u === this.current ? v : u));

    // 2) si es la primera iteración, ignoramos colisiones
    if (this.path.length > 1) {
      // excluimos nodos ocupados por hormigas de distinto color
      const occupied = new Set(
        ctx.ants
          .filter(a => a !== this && a.color !== this.color)
          .map(a => a.current)
      );
      const free = neighbors.filter(n => !occupied.has(n));
      if (free.length > 0) {
        neighbors = free;
      } else if (this.path.length >= 2) {
        neighbors = [this.path[this.path.length - 2]]; // backtrack
      }
    }

    if (neighbors.length === 0) return;

    neighbors = neighbors.filter(n => {
      const edgeKey = `${Math.min(this.current, n)}-${Math.max(this.current, n)}`;
      // si alguna semáforo está rojo y bloquea esta arista, la descartamos
      return !Object.entries(ctx.blockMap).some(([sKey, blockedList]) =>
        ctx.specialEdges.has(sKey) &&
        ctx.edgeStates[sKey] === false &&
        blockedList.includes(edgeKey)
      );
    });
    if (neighbors.length === 0) return;
    
    // 3) elegimos siguiente nodo
    const next = neighbors.length === 1
      ? neighbors[0]
      : ctx.selectNextNode(this, neighbors);

      const key = `${Math.min(this.current, next)}-${Math.max(this.current, next)}`;
      if (ctx.specialEdges.has(key) && ctx.edgeStates[key] === false) {
        return; // se queda esperando
    }

    // 5) mover hormiga
    const dist = Phaser.Math.Distance.BetweenPoints(
      this.nodes[this.current],
      this.nodes[next]
    );
    this.moveTo(next, dist, ctx);
  }

  moveTo(nextNodeIndex, distance, ctx) {
    this.isMoving = true;
    this.current = nextNodeIndex;
    this.path.push(nextNodeIndex);
    this.totalDistance += distance;

    if (nextNodeIndex === this.target) {
      this.arrived = true;
      this.sprite.setFillStyle(this.color);
      this.isMoving = false;
      return;
    }

    const { x, y } = this.nodes[nextNodeIndex];
    ctx.tweens.add({
      targets: this.sprite,
      x, y,
      duration: distance * DURATION_FACTOR * this.speed,
      ease: 'Linear',
      onComplete: () => this.isMoving = false
    });
  }
}

// —— Clase ACOScene ——
class ACOScene extends Phaser.Scene {
  constructor() {
    super('ACOScene');

    // Parámetros ACO
    this.alpha = 1;
    this.beta = 2;
    this.evaporationRate = 0.95;
    this.numAntsPerColony = 10;

    // Estructuras
    this.nodes = [];
    this.edges = [];
    this.pheromones = [];
    this.ants = [];

    // Definición de colonias
    this.colonies = [
      { name: 'Roja', start: 0, target: 18, color: 0xff0000 },
      { name: 'Azul', start: 6, target: 15, color: 0x0000ff },
      { name: 'Rosa', start: 16, target: 7, color: 0xff69b4 },
      { name: 'Naranja', start: 10, target: 1, color: 0xffa500 }
    ];

    // Calles especiales con semáforo
    this.specialEdges = new Set([
      '30-31', '31-38', '37-38', '30-37'
    ]);
    this.edgeStates = {};
    this.specialEdges.forEach(key => this.edgeStates[key] = true);
    this.specialEdgeTimers = {};
    this.blockMap = {
      '30-37': ['30-33','37-44'],
      '37-38': ['37-41','38-40'],
      '30-31': ['29-30','21-31'],
      '31-38': ['31-34','38-46'],
    };
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

  // ——— Configuración de nodos y aristas ———
  setupNodes() {
    this.nodes = [
      { x: 400, y: 100 }, { x: 271, y: 100 }, { x: 186, y: 143 }, { x: 143, y: 186 },
      { x: 100, y: 229 }, { x: 100, y: 314 }, { x: 100, y: 400 }, { x: 100, y: 486 },
      { x: 100, y: 571 }, { x: 186, y: 657 }, { x: 271, y: 700 }, { x: 486, y: 143 },
      { x: 529, y: 186 }, { x: 571, y: 229 }, { x: 571, y: 314 }, { x: 571, y: 400 },
      { x: 571, y: 486 }, { x: 571, y: 571 }, { x: 400, y: 700 }, { x: 486, y: 657 },
      { x: 186, y: 229 }, { x: 271, y: 314 }, { x: 186, y: 571 }, { x: 400, y: 143 },
      { x: 271, y: 186 }, { x: 271, y: 143 }, { x: 400, y: 186 }, { x: 486, y: 186 },
      { x: 271, y: 657 }, { x: 271, y: 571 }, { x: 271, y: 486 }, { x: 271, y: 400 },
      { x: 271, y: 229 }, { x: 186, y: 486 }, { x: 186, y: 400 }, { x: 186, y: 314 },
      { x: 400, y: 186 }, { x: 400, y: 486 }, { x: 400, y: 400 }, { x: 400, y: 229 },
      { x: 400, y: 314 }, { x: 400, y: 571 }, { x: 400, y: 657 }, { x: 486, y: 314 },
      { x: 486, y: 486 }, { x: 486, y: 400 }, { x: 486, y: 229 }
    ];
    const specials = {
      0: 0xffff00, 18: 0x00ff00,
      6: 0x0000ff, 15: 0x00ffff,
      16: 0xff69b4, 7: 0xff00ff,
      10: 0xffa500, 1: 0xff6347
    };
    this.nodes.forEach((n, i) => {
      this.add.circle(n.x, n.y, 8, specials[i] || 0xffffff);
      this.add.text(n.x - 5, n.y - 5, `${i}`, { font: '10px Arial', fill: '#000' });
    });
  }

  setupEdges() {
    const T = 80;
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const A = this.nodes[i], B = this.nodes[j],
          dx = Math.abs(A.x - B.x), dy = Math.abs(A.y - B.y);
        if ((dx < 5 && dy <= T) || (dy < 5 && dx <= T)) {
          this.edges.push([i, j]);
        }
      }
    }
    this.ensureConnectivity();
    this.addCriticalEdges();
  }

  ensureConnectivity() {
    const parent = this.nodes.map((_, i) => i);
    const find = u => { while (parent[u] !== u) { parent[u] = parent[parent[u]]; u = parent[u]; } return u; };
    const union = (u, v) => { const ru = find(u), rv = find(v); if (ru !== rv) parent[rv] = ru; };
    this.edges.forEach(([u, v]) => union(u, v));
    const root = find(0);
    for (let i = 1; i < this.nodes.length; i++) {
      if (find(i) !== root) {
        let minD = Infinity, closest = 0;
        for (let j = 0; j < this.nodes.length; j++) {
          if (find(j) === root) {
            const sameX = Math.abs(this.nodes[j].x - this.nodes[i].x) < 5;
            const sameY = Math.abs(this.nodes[j].y - this.nodes[i].y) < 5;
            if (sameX || sameY) {
              const d = Phaser.Math.Distance.BetweenPoints(this.nodes[j], this.nodes[i]);
              if (d < minD) { minD = d; closest = j; }
            }
          }
        }
        if (minD < Infinity) { this.edges.push([closest, i]); union(closest, i); }
      }
    }
  }

  addCriticalEdges() {
    [
      [0, 23], [1, 25], [2, 20], [3, 4], [5, 6], [7, 8], [10, 18],
      [11, 12], [13, 14], [19, 17], [10, 9], [9, 8], [1, 2], [17, 41], [19, 18],
      [22, 29], [2, 3], [0, 11], [12, 13], [24, 25], [26, 36], [30, 31], [34, 35], [37, 38], [40, 41],
      [31, 38], [6, 34], [5, 35], [25, 23], [24, 36], [21, 35], [21, 40], [32, 39], [38, 45], [43, 45],
      [40, 43], [7, 33], [33, 30], [29, 41], [28, 42], [42, 41], [44, 19], [44, 37], [39, 46], [44, 45],
      [36, 27], [46, 43]

    ].forEach(([i, j]) => {
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

  // ——— Colonias y UI ———
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

  // ——— Bucle principal ACO ———
  runCycle() {
    this.moveAnts();
    this.updatePheromones();
    this.renderPheromones();
  }

  moveAnts() {
    this.ants.forEach(ant => ant.tryMove(this));
  }

  selectNextNode(ant, neighbors) {
    if (neighbors.length === 1) return neighbors[0];
    const probs = neighbors.map(n => {
      const pher = this.pheromones[ant.current][n];
      const heur = 1 / Phaser.Math.Distance.BetweenPoints(
        this.nodes[ant.current], this.nodes[n]
      );
      return Math.pow(pher, this.alpha) * Math.pow(heur, this.beta);
    });
    const total = probs.reduce((s, p) => s + p, 0);
    let rnd = Math.random(), sum = 0;
    for (let i = 0; i < neighbors.length; i++) {
      sum += probs[i] / total;
      if (rnd <= sum) return neighbors[i];
    }
    return neighbors[neighbors.length - 1];
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

// —— Inicializar Phaser ——
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 800,
  backgroundColor: '#000011',
  scene: ACOScene
};

new Phaser.Game(config);
