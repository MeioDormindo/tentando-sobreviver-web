import Phaser from 'phaser';
import { cameraConfig } from '../config/visual.config';
import { touchInput } from '../input/touchInput';
import { save } from '../save/SaveStore';

/**
 * Câmera no estilo de survival top-down: zoom adaptado à altura da janela,
 * acompanhamento suave e deslocamento na direção da mira (vê-se mais à frente).
 */
export class CameraController {
  private readonly scene: Phaser.Scene;
  private readonly cam: Phaser.Cameras.Scene2D.Camera;
  private readonly offset = new Phaser.Math.Vector2();
  private readonly desired = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject, boundsW: number, boundsH: number) {
    this.scene = scene;
    this.cam = scene.cameras.main;
    this.cam.setBounds(0, 0, boundsW, boundsH);
    this.cam.startFollow(target, true, cameraConfig.followLerp, cameraConfig.followLerp);
    this.cam.setRoundPixels(false);
    this.applyZoom();
    this.applyPostFx();
    // Configuração "Tremor de tela" desligada: os tremores viram nada.
    if (!save.setting('screenShake')) this.cam.shake = () => this.cam;

    scene.scale.on(Phaser.Scale.Events.RESIZE, this.applyZoom, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.scale.off(Phaser.Scale.Events.RESIZE, this.applyZoom, this);
    });
  }

  update(): void {
    const pointer = this.scene.input.activePointer;
    const moved = pointer.x !== 0 || pointer.y !== 0;
    if (touchInput.enabled) {
      const [dx, dy] = touchInput.aiming ? [touchInput.aimX, touchInput.aimY] : [touchInput.moveX, touchInput.moveY];
      this.desired.set(dx, dy).scale(cameraConfig.maxLookAhead * 0.7);
    } else if (moved) {
      const cam = this.cam;
      this.desired
        .set(pointer.x - cam.width / 2, pointer.y - cam.height / 2)
        .scale(cameraConfig.lookAhead / cam.zoom)
        .limit(cameraConfig.maxLookAhead);
    }
    this.offset.lerp(this.desired, cameraConfig.lookAheadLerp);
    // followOffset é subtraído do alvo: negativo = câmera adiantada.
    this.cam.setFollowOffset(-this.offset.x, -this.offset.y);
  }

  private applyZoom(): void {
    const zoom = Phaser.Math.Clamp(this.scene.scale.height / cameraConfig.viewHeight, cameraConfig.minZoom, cameraConfig.maxZoom);
    this.cam.setZoom(zoom);
  }

  /** Vinheta e cores dessaturadas (somente WebGL). */
  private applyPostFx(): void {
    if (this.scene.game.renderer.type !== Phaser.WEBGL) return;
    this.cam.postFX.addVignette(0.5, 0.5, cameraConfig.vignetteRadius, cameraConfig.vignetteStrength);
    const grade = this.cam.postFX.addColorMatrix();
    grade.saturate(cameraConfig.saturation);
    grade.contrast(cameraConfig.contrast, true);
  }
}
