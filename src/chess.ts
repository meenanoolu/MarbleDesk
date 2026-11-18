import { Chess } from 'chess.js';
import * as THREE from 'three';
import { System, World } from '@iwsdk/core';

export class ChessSystem extends System {
  private chess = new Chess();
  private boardGroup = new THREE.Group();
  private pieces: Map<string, THREE.Mesh> = new Map();
  private selected: THREE.Mesh | null = null;
  private turnText: THREE.Sprite | null = null;
  private squareSize = 0.05;
  private boardPlaced = false;

  init(world: World) {
    super.init(world);
    this.createBoard();
    this.createPieces();
    this.createTurnIndicator();
    this.boardGroup.position.set(0, 0.8, -0.5);
    world.scene.add(this.boardGroup);
  }

  private createBoard() {
    const board = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const light = new THREE.MeshStandardMaterial({ color: 0xf5deb3 });
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const square = new THREE.Mesh(
          new THREE.BoxGeometry(this.squareSize, 0.005, this.squareSize),
          (r + c) % 2 === 0 ? light : dark
        );
        square.position.set(
          (c - 3.5) * this.squareSize,
          0,
          (r - 3.5) * this.squareSize
        );
        board.add(square);
      }
    }
    this.boardGroup.add(board);
  }

  private createPieces() {
    const pieceGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.04, 8);
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x222222 });

    const start = this.chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = start[r][c];
        if (!piece) continue;
        const mesh = new THREE.Mesh(
          pieceGeo,
          piece.color === 'w' ? whiteMat : blackMat
        );
        mesh.userData = { square: this.coordsToSquare(r, c), piece };
        mesh.position.set(
          (c - 3.5) * this.squareSize,
          0.025,
          (r - 3.5) * this.squareSize
        );
        mesh.castShadow = true;
        this.boardGroup.add(mesh);
        this.pieces.set(this.coordsToSquare(r, c), mesh);
      }
    }
  }

  private createTurnIndicator() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.font = 'bold 32px Arial';
    ctx.fillText("White's turn", 10, 40);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex });
    this.turnText = new THREE.Sprite(mat);
    this.turnText.scale.set(0.3, 0.075, 1);
    this.turnText.position.set(0, 0.15, 0);
    this.boardGroup.add(this.turnText);
  }

  private coordsToSquare(row: number, col: number): string {
    return String.fromCharCode(97 + col) + (8 - row);
  }

  private squareToCoords(sq: string): [number, number] {
    const col = sq.charCodeAt(0) - 97;
    const row = 8 - parseInt(sq[1]);
    return [row, col];
  }

  update() {
    // Hand pinch integration point: use world.input for XR hands
  }

  tryMove(from: string, to: string) {
    const move = this.chess.move({ from, to, promotion: 'q' });
    if (move) {
      this.updatePiecePositions();
      this.updateTurnText();
      console.log(move.color === 'w' ? 'White reacts: Good move!' : 'Black reacts: Interesting...');
    }
  }

  private updatePiecePositions() {
    this.pieces.forEach((mesh) => this.boardGroup.remove(mesh));
    this.pieces.clear();
    const board = this.chess.board();
    const pieceGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.04, 8);
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;
        const mesh = new THREE.Mesh(
          pieceGeo,
          piece.color === 'w' ? whiteMat : blackMat
        );
        mesh.userData = { square: this.coordsToSquare(r, c) };
        mesh.position.set(
          (c - 3.5) * this.squareSize,
          0.025,
          (r - 3.5) * this.squareSize
        );
        this.boardGroup.add(mesh);
        this.pieces.set(this.coordsToSquare(r, c), mesh);
      }
    }
  }

  private updateTurnText() {
    if (!this.turnText) return;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.font = 'bold 28px Arial';
    const turn = this.chess.turn() === 'w' ? "White's turn" : "Black's turn";
    ctx.fillText(turn, 10, 40);
    (this.turnText.material as THREE.SpriteMaterial).map = new THREE.CanvasTexture(canvas);
    (this.turnText.material as THREE.SpriteMaterial).map.needsUpdate = true;
  }
}
