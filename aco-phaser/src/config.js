
const CONFIG = {
  // 1. Configuración general de la simulación
  DEBUG: false,                     // Modo de depuración activado
  SIMULATION_SPEED: 1.0,            // Velocidad de simulación (1.0 = normal)
  
  // 2. Configuración de visualización
  NODE_RADIUS: 8,                   
  ANT_RADIUS: 5,                    
  JITTER: 4,                        
  SHOW_NODE_LABELS: true,           
  SHOW_BEST_PATHS: true,            
  BEST_PATH_OPACITY: 0.3,           
  ANT_MOVE_EFFECTS: true,           
  
  // 3. Parámetros de las colonias
  COLONIES: [
    {
      name: 'Roja',
      start: 0,
      target: 18,
      color: 0xff0000,              // Rojo
      antsPerColony: 8
    },
    {
      name: 'Azul',
      start: 6,
      target: 15,
      color: 0x0000ff,              // Azul
      antsPerColony: 8
    },
    {
      name: 'Rosa',
      start: 16,
      target: 7,
      color: 0xff69b4,              // Rosa
      antsPerColony: 8
    },
    {
      name: 'Naranja',
      start: 10,
      target: 1,
      color: 0xffa500,              // Naranja
      antsPerColony: 8
    }
  ],
  
  // 4. Parámetros de las hormigas
  ANT_SPEED_RANGE: [0.8, 1.2],      // Rango de velocidad de las hormigas
  DECISION_COOLDOWN: 100,            // Tiempo entre decisiones (ms)
  MAX_WAIT_TIME: 2000,              // Máximo tiempo de espera antes de retroceder (ms)
  
  // 5. Parámetros del algoritmo ACO
  ALPHA: 1.2,                       // Influencia de las feromonas
  BETA: 2.5,                        // Influencia de la heurística (distancia)
  EVAPORATION_RATE: 0.97,           // Tasa de evaporación de feromonas
  PHEROMONE_DEPOSIT: 100,           // Cantidad base de feromonas a depositar
  MIN_PHEROMONE: 0.001,             // Mínimo valor de feromonas
  
  // 6. Temporizadores
  SPAWN_INTERVAL: 1000,             // Intervalo entre generación de hormigas (ms)
  CYCLE_INTERVAL: 150,              // Intervalo entre ciclos ACO (ms)
  TRAFFIC_INTERVAL: 10000,          // Intervalo entre cambios de semáforo (ms)
  
  // 7. Configuración del grafo
  EDGE_THRESHOLD: 80,               // Distancia máxima para crear aristas
  DURATION_FACTOR: 25,              // Factor de duración de animaciones
  
  // 8. Calles especiales con semáforos
  SPECIAL_EDGES: [
    '30-31', '31-38', '37-38', '30-37'
  ],
  
  // 9. Colores de la interfaz
  UI_COLORS: {
    background: 0x000011,           // Color de fondo
    text: 0xffffff,                 // Color de texto principal
    button: 0x333333,               // Color de botones
    buttonText: 0xffffff            // Color de texto en botones
  }
};

// Configuración para desarrollo
if (process.env.NODE_ENV === 'development') {
  CONFIG.DEBUG = true;
  CONFIG.SHOW_NODE_LABELS = true;
  CONFIG.ANTS_PER_COLONY = 5;       // Menos hormigas en desarrollo
}

export default CONFIG;