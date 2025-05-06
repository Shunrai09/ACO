import { JITTER, SPEED_RANGE, DURATION_FACTOR } from '../config/constants';

export class Ant {
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