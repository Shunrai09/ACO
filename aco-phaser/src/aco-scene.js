import Phaser from 'phaser';
import CONFIG from './config';
import Ant from './ant';
import Colony from './colony';
import Graph from './graph';

export default class ACOScene extends Phaser.Scene {
    constructor() {
        super('ACOScene');

        // Parámetros ACO optimizados
        this.alpha = 1.2;
        this.beta = 2.5;
        this.evaporationRate = 0.97;
        this.numAntsPerColony = 8;
        this.timeScale = 1;

        // Estructuras de datos
        this.nodes = [];
        this.edges = [];
        this.pheromones = [];
        this.ants = [];
        this.colonies = [];
        this.specialEdges = new Set();
        this.edgeStates = new Map();

        // Elementos visuales
        this.graphics = null;
        this.debugGraphics = null;
        this.statsText = null;
    }

    preload() {
        // Precarga de assets si es necesario
    }

    create() {
        console.log("DEBUG 0 - Escena creada"); // Paso 1

        // 1. Crear nodos manuales
        const testNodes = [
            { x: 100, y: 100 }, // Nodo 0
            { x: 700, y: 700 }  // Nodo 1
        ];

        // 2. Crear hormiga manual
        console.log("DEBUG 1 - Intentando crear hormiga manual"); // Paso 2
        try {
            const testAnt = {
                sprite: this.add.circle(
                    testNodes[0].x,
                    testNodes[0].y,
                    10,
                    0xff0000
                )
            };
            console.log("DEBUG 2 - Hormiga manual creada:", testAnt); // Paso 3
        } catch (error) {
            console.error("DEBUG ERROR - Fallo al crear hormiga manual:", error);
        }

        // 3. Dibujar conexión
        this.graphics = this.add.graphics();
        this.graphics.lineStyle(3, 0x00ff00);
        this.graphics.strokeLine(
            testNodes[0].x, testNodes[0].y,
            testNodes[1].x, testNodes[1].y
        );
        console.log("DEBUG 3 - Línea dibujada"); // Paso 4
    }


    debugNodes() {
        // Mostrar todos los nodos como puntos verdes
        this.graph.nodes.forEach((node, index) => {
            this.add.circle(node.x, node.y, 5, 0x00ff00)
                .setDepth(10);
            this.add.text(node.x - 10, node.y - 15, `${index}`,
                { color: '#ffffff', fontSize: '12px' });
        });
    }
    update() {
        // Renderizar el grafo en cada frame
        this.graph.render(this.graphics);

        // Actualizar feromonas si es necesario
        this.updatePheromones();
    }
    initGraphics() {
        this.graphics = this.add.graphics();
        this.debugGraphics = this.add.graphics().setVisible(false);
    }

    setupNodes() {
        // Definición de nodos (mejor organizada)
        this.nodes = this.createNodePositions();

        // Dibujar nodos
        this.nodes.forEach((node, i) => {
            const isSpecial = this.isSpecialNode(i);
            const color = isSpecial ? this.getNodeColor(i) : 0xffffff;

            this.add.circle(node.x, node.y, CONFIG.NODE_RADIUS, color);

            if (CONFIG.SHOW_NODE_LABELS) {
                this.add.text(
                    node.x - 5,
                    node.y - 5,
                    `${i}`,
                    { font: '10px Arial', fill: '#000' }
                );
            }
        });
    }

    createNodePositions() {
        return [
            { x: 400, y: 100 }, { x: 271, y: 100 }, { x: 186, y: 143 }, { x: 143, y: 186 },
            // ... (resto de tus nodos)
            { x: 486, y: 400 }, { x: 486, y: 229 }
        ];
    }

    isSpecialNode(index) {
        const specialNodes = {
            0: true, 18: true,
            6: true, 15: true,
            16: true, 7: true,
            10: true, 1: true
        };
        return specialNodes[index] || false;
    }

    getNodeColor(index) {
        const colors = {
            0: 0xffff00, 18: 0x00ff00,
            6: 0x0000ff, 15: 0x00ffff,
            16: 0xff69b4, 7: 0xff00ff,
            10: 0xffa500, 1: 0xff6347
        };
        return colors[index] || 0xffffff;
    }

    setupEdges() {
        this.edges = this.createBasicEdges();
        this.ensureConnectivity();
        this.addCriticalEdges();
        this.setupSpecialEdges();
    }

    createBasicEdges() {
        const edges = [];
        const T = CONFIG.EDGE_THRESHOLD;

        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const A = this.nodes[i], B = this.nodes[j];
                const dx = Math.abs(A.x - B.x), dy = Math.abs(A.y - B.y);

                if ((dx < 5 && dy <= T) || (dy < 5 && dx <= T)) {
                    edges.push([i, j]);
                }
            }
        }
        return edges;
    }

    ensureConnectivity() {
        // Implementación mejorada con Kruskal's algorithm
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
            const d1 = Phaser.Math.Distance.BetweenPoints(this.nodes[u1], this.nodes[v1]);
            const d2 = Phaser.Math.Distance.BetweenPoints(this.nodes[u2], this.nodes[v2]);
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

            // Conectar cada componente con el más cercano
            for (let i = 0; i < nodesByComponent.length - 1; i++) {
                this.connectToNearestComponent(nodesByComponent, i, union);
            }
        }
    }

    connectToNearestComponent(nodesByComponent, i, union) {
        let minDist = Infinity;
        let bestPair = null;

        // Buscar la conexión más corta entre este componente y cualquier otro
        for (let j = i + 1; j < nodesByComponent.length; j++) {
            nodesByComponent[i].forEach(u => {
                nodesByComponent[j].forEach(v => {
                    const sameX = Math.abs(this.nodes[u].x - this.nodes[v].x) < 5;
                    const sameY = Math.abs(this.nodes[u].y - this.nodes[v].y) < 5;

                    if (sameX || sameY) {
                        const dist = Phaser.Math.Distance.BetweenPoints(this.nodes[u], this.nodes[v]);
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
            // ... (resto de tus aristas críticas)
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

    setupSpecialEdges() {
        // Configurar aristas especiales con semáforos
        const specials = ['30-31', '31-38', '37-38', '30-37'];

        specials.forEach(key => {
            this.specialEdges.add(key);
            this.edgeStates.set(key, true); // Inicialmente verde
        });

        // Evento para alternar semáforos
        this.time.addEvent({
            delay: CONFIG.TRAFFIC_INTERVAL,
            loop: true,
            callback: this.toggleTrafficLights,
            callbackScope: this
        });
    }

    toggleTrafficLights() {
        this.specialEdges.forEach(key => {
            this.edgeStates.set(key, !this.edgeStates.get(key));
        });

        if (CONFIG.DEBUG) {
            console.log('Semáforos cambiados:', this.edgeStates);
        }
    }

    initPheromones() {
        const N = this.nodes.length;
        this.pheromones = Array(N).fill().map(() => Array(N).fill(0));

        // Inicializar feromonas basadas en distancia inversa
        this.edges.forEach(([i, j]) => {
            const d = Phaser.Math.Distance.BetweenPoints(this.nodes[i], this.nodes[j]);
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

    setupColonies() {
        this.colonies = [
            { name: 'Roja', start: 0, target: 18, color: 0xff0000, ants: [], spawnCount: 0, arrivedCount: 0 },
            { name: 'Azul', start: 6, target: 15, color: 0x0000ff, ants: [], spawnCount: 0, arrivedCount: 0 },
            { name: 'Rosa', start: 16, target: 7, color: 0xff69b4, ants: [], spawnCount: 0, arrivedCount: 0 },
            { name: 'Naranja', start: 10, target: 1, color: 0xffa500, ants: [], spawnCount: 0, arrivedCount: 0 }
        ];

        // Crear representación visual de colonias
        this.colonies.forEach((colony, index) => {
            this.createColonyUI(colony, index);
        });
    }

    createColonyUI(colony, index) {
        // Texto de estado
        colony.text = this.add.text(
            20, 50 + 25 * index,
            `Colonia ${colony.name}: 0/${this.numAntsPerColony}`,
            {
                font: '14px Arial',
                fill: `#${colony.color.toString(16).padStart(6, '0')}`
            }
        );

        // Indicador visual
        colony.indicator = this.add.circle(150, 58 + 25 * index, 8, colony.color);
    }

    createUI() {
        // Título
        this.add.text(20, 20, 'ACO – Múltiples Colonias', {
            font: '16px Arial',
            fill: '#fff',
            stroke: '#000',
            strokeThickness: 2
        });

        // Botón de reinicio
        const resetBtn = this.add.rectangle(700, 30, 150, 30, 0x333333)
            .setInteractive()
            .on('pointerdown', () => this.resetSimulation());

        this.add.text(625, 25, 'Reiniciar Simulación', {
            font: '14px Arial',
            fill: '#fff'
        });

        // Panel de estadísticas
        this.statsText = this.add.text(20, 750, '', {
            font: '14px Arial',
            fill: '#ffffff',
            backgroundColor: '#00000066',
            padding: { x: 10, y: 5 }
        });

        // Actualizar estadísticas periódicamente
        this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: this.updateStats,
            callbackScope: this
        });
    }

    updateStats() {
        const activeAnts = this.ants.filter(a => !a.arrived).length;
        const avgPathLength = this.ants.length > 0
            ? (this.ants.reduce((sum, a) => sum + a.path.length, 0) / this.ants.length)
            : 0;
        const stats = [
            `Hormigas activas: ${activeAnts}`,
            `Hormigas totales: ${this.ants.length}`,
            `Long. media camino: ${avgPathLength.toFixed(1)} nodos`,
            `Feromona máxima: ${this.getMaxPheromone().toFixed(4)}`
        ];

        this.statsText.setText(stats.join('\n'));
    }

    getMaxPheromone() {
        return this.edges.reduce((max, [i, j]) =>
            Math.max(max, this.pheromones[i][j]), 0);
    }

    setupEventListeners() {
        // Eventos personalizados
        this.events.on('antArrived', colony => {
            colony.text.setText(`Colonia ${colony.name}: ${colony.arrivedCount}/${colony.spawnCount}`);
        });
    }

    startTimers() {
        this.colonies.forEach(colony => {
            console.log(`Configurando timer para colonia ${colony.config.name}`); // Debug 15

            // Spawn inmediato para prueba
            colony.spawnAnt();

            // Timer periódico (comenta temporalmente esto para pruebas)
            colony.spawnEvent = this.time.addEvent({
                delay: CONFIG.SPAWN_INTERVAL,
                callback: () => {
                    console.log(`Intentando spawnear hormiga en ${colony.config.name}`); // Debug 16
                    const ant = colony.spawnAnt();
                    if (ant) this.ants.push(ant);
                },
                callbackScope: this,
                loop: true
            });
        });
    }

    runACOCycle() {
        this.moveAnts();
        this.updatePheromones();
        this.renderPheromones();

        if (CONFIG.DEBUG) {
            this.debugGraphics.clear();
        }
    }

    moveAnts() {
        this.ants.forEach(ant => {
            if (!ant.arrived && !ant.isMoving) {
                ant.tryMove(this);
            }
        });
    }

    updatePheromones() {
        // Evaporación
        this.applyEvaporation();

        // Depósito de feromonas por hormigas
        this.updateAntPheromones();

        // Asegurar mínimo de feromonas
        this.ensureMinPheromones();
    }

    applyEvaporation() {
        const evaporationFactor = Math.pow(this.evaporationRate, this.timeScale);

        this.edges.forEach(([i, j]) => {
            this.pheromones[i][j] *= evaporationFactor;
            this.pheromones[j][i] *= evaporationFactor;
        });
    }

    updateAntPheromones() {
        this.ants.forEach(ant => {
            if (ant.arrived && !ant.counted) {
                this.handleAntArrival(ant);
            }

            if (ant.arrived) {
                this.depositPheromones(ant);
            }
        });
    }

    handleAntArrival(ant) {
        ant.counted = true;
        const colony = this.colonies.find(c => c.start === ant.path[0]);

        if (colony) {
            colony.arrivedCount++;
            colony.ants.push(ant);
            this.events.emit('antArrived', colony);

            // Actualizar mejor camino de la colonia
            if (!colony.bestDistance || ant.totalDistance < colony.bestDistance) {
                colony.bestDistance = ant.totalDistance;
                colony.bestPath = [...ant.path];
            }
        }
    }

    depositPheromones(ant) {
        const pherAdd = 100 / ant.totalDistance;
        const colony = this.colonies.find(c => c.start === ant.path[0]);
        const isBestPath = colony && colony.bestPath &&
            ant.path.length === colony.bestPath.length &&
            ant.path.every((v, i) => v === colony.bestPath[i]);

        // Bonus para el mejor camino
        const bonusFactor = isBestPath ? 2 : 1;

        for (let k = 0; k < ant.path.length - 1; k++) {
            const u = ant.path[k], v = ant.path[k + 1];
            this.pheromones[u][v] += pherAdd * bonusFactor;
            this.pheromones[v][u] += pherAdd * bonusFactor;
        }
    }

    renderPheromones() {
        this.graphics.clear();
        const maxP = this.getMaxPheromone();

        // Dibujar todas las aristas
        this.edges.forEach(([i, j]) => {
            this.drawEdge(i, j, maxP);
        });

        // Dibujar semáforos
        this.drawTrafficLights();
    }

    drawEdge(i, j, maxP) {
        const norm = maxP > 0 ? this.pheromones[i][j] / maxP : 0;
        const key = `${Math.min(i, j)}-${Math.max(i, j)}`;

        if (this.specialEdges.has(key)) {
            // Arista especial (semáforo)
            const color = this.edgeStates.get(key) ? 0x00ff00 : 0xff0000;
            this.graphics.lineStyle(3, color);
        } else {
            // Arista normal (intensidad por feromonas)
            const width = 1 + norm * 3;
            const color = Phaser.Display.Color.GetColor(255, 255 - norm * 255, 0);
            this.graphics.lineStyle(width, color);
        }

        this.graphics.beginPath();
        this.graphics.moveTo(this.nodes[i].x, this.nodes[i].y);
        this.graphics.lineTo(this.nodes[j].x, this.nodes[j].y);
        this.graphics.strokePath();
    }

    drawTrafficLights() {
        this.graphics.fillStyle(0x333333);

        this.specialEdges.forEach(key => {
            const [i, j] = key.split('-').map(Number);
            const midX = (this.nodes[i].x + this.nodes[j].x) / 2;
            const midY = (this.nodes[i].y + this.nodes[j].y) / 2;

            // Base del semáforo
            this.graphics.fillCircle(midX, midY, 10);

            // Luz del semáforo
            this.graphics.fillStyle(this.edgeStates.get(key) ? 0x00ff00 : 0xff0000);
            this.graphics.fillCircle(midX, midY, 6);
            this.graphics.fillStyle(0x333333);
        });
    }

    spawnAnt(colony) {
        if (colony.spawnCount >= this.numAntsPerColony) return;

        const ant = new Ant(
            colony.start,
            colony.target,
            this.nodes,
            this,
            colony.color,
            Phaser.Math.FloatBetween(...CONFIG.SPEED_RANGE)
        );

        this.ants.push(ant);
        colony.spawnCount++;
        colony.text.setText(`Colonia ${colony.name}: ${colony.arrivedCount}/${colony.spawnCount}`);
    }

    resetSimulation() {
        // Limpiar hormigas
        this.ants.forEach(ant => ant.destroy());
        this.ants = [];

        // Reiniciar feromonas
        this.initPheromones();

        // Reiniciar colonias
        this.colonies.forEach(colony => {
            colony.spawnCount = 0;
            colony.arrivedCount = 0;
            colony.ants = [];
            colony.bestDistance = null;
            colony.bestPath = null;
            colony.text.setText(`Colonia ${colony.name}: 0/${this.numAntsPerColony}`);
            colony.spawnEvent.reset({
                repeat: this.numAntsPerColony - 1,
                delay: CONFIG.SPAWN_INTERVAL
            });
        });

        // Limpiar gráficos
        this.graphics.clear();

        if (CONFIG.DEBUG) {
            this.debugGraphics.clear();
        }
    }

    setupDebug() {
        // Mostrar coordenadas al hacer clic
        this.input.on('pointerdown', pointer => {
            console.log(`Posición: (${pointer.worldX.toFixed(0)}, ${pointer.worldY.toFixed(0)})`);
        });

        // Tecla D para toggle debug
        this.input.keyboard.on('keydown-D', () => {
            this.debugGraphics.setVisible(!this.debugGraphics.visible);
            console.log('Modo debug:', this.debugGraphics.visible);
        });
    }
}