import Phaser from 'phaser';
import { gunIconKey } from '../config/assets.config';
import { COLORS, SCENE_KEYS } from '../config/game.config';
import { upgradeWeaponConfig, weapons, type Rarity, type WeaponConfig } from '../config/weapons.config';
import { RARITY_COLORS } from '../entities/MysteryBox';
import { AREAS, STATIONS } from '../map/terminal/layout';
import { MENU_FONT, MENU_TITLE_FONT, menuButton, menuTitle, onResize } from '../ui/menuWidgets';

/** Altura do painel de detalhes (px de desenho, antes de escalar). */
const DETAIL_H = 420;

const RARITY_NAMES: Record<Rarity, string> = {
  common: 'COMUM',
  uncommon: 'INCOMUM',
  rare: 'RARA',
  epic: 'ÉPICA',
  legendary: 'LENDÁRIA',
};

/** Texto da mecânica especial de cada arma exclusiva da caixa. */
function specialText(cfg: WeaponConfig): string {
  const sp = cfg.special;
  if (!sp) return cfg.pierce ? `Atravessa até ${cfg.pierce} zumbis por tiro.` : '';
  switch (sp.type) {
    case 'grenade':
      return `Granada explode no impacto: ${sp.blastDamage} de dano em área (raio ${sp.blastRadius}). Não fere você.`;
    case 'flame':
      return `Jato contínuo que incendeia: ${sp.burnDps} de dano por segundo durante ${(sp.burnMs / 1000).toFixed(1)} s.`;
    case 'arc':
      return `Raio instantâneo que salta entre até ${sp.chains} zumbis e os atordoa.`;
    case 'plasma':
      return `Esfera que atravessa a horda e explode numa descarga elétrica (${sp.blastDamage} em área).`;
  }
}

/** Onde conseguir a arma: arma inicial, maleta (preço e área) ou só na Mystery Box. */
function sourceText(cfg: WeaponConfig): string {
  if (cfg.boxOnly) return 'Só na Mystery Box';
  if (cfg.price === 0) return 'Arma inicial';
  const station = STATIONS.find((s) => s.type === 'weapon' && s.weaponId === cfg.id);
  const area = station
    ? AREAS.find((a) => a.rects.some((r) => station.tx >= r.x && station.tx < r.x + r.w && station.ty >= r.y && station.ty < r.y + r.h))
    : undefined;
  return `Maleta: $${cfg.price.toLocaleString('pt-BR')}${area ? ` · ${area.name}` : ''} · também na Mystery Box`;
}

interface Stat {
  label: string;
  value: (c: WeaponConfig) => number;
  format: (c: WeaponConfig) => string;
  max: number;
}

const STATS: Stat[] = [
  { label: 'DANO', value: (c) => c.damage * c.pellets, format: (c) => (c.pellets > 1 ? `${c.damage} × ${c.pellets}` : `${c.damage}`), max: 420 },
  { label: 'CADÊNCIA', value: (c) => 1000 / c.fireRate, format: (c) => `${(1000 / c.fireRate).toFixed(1)}/s`, max: 22 },
  { label: 'PENTE', value: (c) => c.magazineSize, format: (c) => `${c.magazineSize}`, max: 120 },
  { label: 'RESERVA', value: (c) => c.reserveAmmo, format: (c) => `${c.reserveAmmo}`, max: 480 },
  { label: 'RECARGA', value: (c) => 4000 - c.reloadTime, format: (c) => `${(c.reloadTime / 1000).toFixed(1)} s`, max: 3000 },
  { label: 'ALCANCE', value: (c) => c.range, format: (c) => `${c.range}`, max: 1400 },
];

/** Catálogo de armas (Menu → ARMAS): lista à esquerda, detalhes da selecionada à direita. */
export class ArmoryScene extends Phaser.Scene {
  private list: WeaponConfig[] = [];
  private selected = 0;
  private page = 0;
  private perPage = 8;
  private rows: Phaser.GameObjects.GameObject[] = [];
  private detail: Phaser.GameObjects.GameObject[] = [];
  private showMk2 = false;

  constructor() {
    super(SCENE_KEYS.armory);
  }

  create(): void {
    this.input.setDefaultCursor('default');
    const order: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    this.list = Object.values(weapons).sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity) || a.price - b.price);
    this.selected = 0;
    this.page = 0;
    this.rows = [];
    this.detail = [];
    const title = menuTitle(this, 'ARMAS', 48);
    const back = menuButton(this, '[ VOLTAR ]', () => this.scene.start(SCENE_KEYS.menu), 22);
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start(SCENE_KEYS.menu));
    this.input.keyboard?.on('keydown-UP', () => this.select(this.selected - 1));
    this.input.keyboard?.on('keydown-DOWN', () => this.select(this.selected + 1));
    onResize(this, () => {
      const { width, height } = this.scale;
      title.setScale(Math.min(1, height / 600)).setPosition(width / 2, Math.min(56, height * 0.09));
      back.setPosition(width / 2, height - 30);
      this.perPage = Math.max(4, Math.floor((height - 190) / 34));
      this.redraw();
    });
  }

  private select(i: number): void {
    this.selected = Phaser.Math.Clamp(i, 0, this.list.length - 1);
    this.page = Math.floor(this.selected / this.perPage);
    this.redraw();
  }

  private redraw(): void {
    this.rows.forEach((o) => o.destroy());
    this.detail.forEach((o) => o.destroy());
    this.rows = [];
    this.detail = [];
    const { width, height } = this.scale;
    const top = Math.min(56, height * 0.09) + 50;
    const listW = Math.min(300, width * 0.4);
    const x0 = Math.max(16, width / 2 - (listW + 20 + Math.min(520, width * 0.55)) / 2);

    // Lista (paginada)
    const pages = Math.ceil(this.list.length / this.perPage);
    this.page = Phaser.Math.Clamp(this.page, 0, pages - 1);
    const start = this.page * this.perPage;
    this.list.slice(start, start + this.perPage).forEach((cfg, i) => {
      const idx = start + i;
      const y = top + i * 34;
      const bg = this.add.rectangle(x0, y, listW, 30, idx === this.selected ? 0x2a2c2f : 0x15171a, 0.95).setOrigin(0).setStrokeStyle(1, idx === this.selected ? 0xc9a45c : 0x2a2d30);
      bg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.select(idx));
      const name = this.add.text(x0 + 10, y + 7, cfg.name.toUpperCase(), { fontFamily: MENU_FONT, fontSize: '14px', color: RARITY_COLORS[cfg.rarity] });
      this.rows.push(bg, name);
    });
    if (pages > 1) {
      const py = top + this.perPage * 34 + 4;
      const prev = menuButton(this, '◀', this.page > 0 ? () => { this.page--; this.redraw(); } : null, 20).setPosition(x0 + 24, py + 10);
      const info = this.add.text(x0 + listW / 2, py + 10, `${this.page + 1} / ${pages}`, { fontFamily: MENU_FONT, fontSize: '13px', color: COLORS.textDim }).setOrigin(0.5);
      const next = menuButton(this, '▶', this.page < pages - 1 ? () => { this.page++; this.redraw(); } : null, 20).setPosition(x0 + listW - 24, py + 10);
      this.rows.push(prev, info, next);
    }

    // Detalhes da arma selecionada (painel escalado para caber em telas baixas, ex. celular)
    const base = this.list[this.selected];
    const cfg = this.showMk2 ? upgradeWeaponConfig(base) : base;
    const dx = x0 + listW + 20;
    const scale = Math.min(1, (height - top - 48) / DETAIL_H);
    const dw = Math.min(520, width - dx - 16) / scale;
    const color = Phaser.Display.Color.HexStringToColor(RARITY_COLORS[cfg.rarity]).color;
    const box = this.add.container(dx, top).setScale(scale);
    this.detail.push(box);
    box.add([
      this.add.rectangle(0, 0, dw, DETAIL_H, 0x15171a, 0.95).setOrigin(0).setStrokeStyle(1, 0x3a3d40),
      this.add.image(dw / 2, 38, gunIconKey(cfg.kind)).setScale(Math.min(1.6, (dw - 40) / 160)).setTint(color),
      this.add.text(dw / 2, 72, cfg.name.toUpperCase(), { fontFamily: MENU_TITLE_FONT, fontSize: '26px', color: RARITY_COLORS[cfg.rarity] }).setOrigin(0.5, 0),
      this.add
        .text(dw / 2, 104, `${RARITY_NAMES[cfg.rarity]} · ${cfg.automatic ? 'AUTOMÁTICA' : 'SEMIAUTOMÁTICA'}`, { fontFamily: MENU_FONT, fontSize: '12px', color: COLORS.textDim })
        .setOrigin(0.5, 0),
    ]);
    const barX = Math.min(120, dw * 0.3);
    const barW = dw - barX - 70;
    STATS.forEach((st, i) => {
      const y = 132 + i * 24;
      const ratio = Phaser.Math.Clamp(st.value(cfg) / st.max, 0.03, 1);
      box.add([
        this.add.text(14, y, st.label, { fontFamily: MENU_FONT, fontSize: '12px', color: COLORS.textDim }),
        this.add.rectangle(barX, y + 3, barW, 9, 0x2a2c2f).setOrigin(0),
        this.add.rectangle(barX, y + 3, barW * ratio, 9, color).setOrigin(0),
        this.add.text(dw - 12, y, st.format(cfg), { fontFamily: MENU_FONT, fontSize: '12px', color: COLORS.text }).setOrigin(1, 0),
      ]);
    });
    const info = [sourceText(base), specialText(cfg), 'Weapon Lab ($5.000): versão Mk II — mais dano, pente e reserva, recarga menor.']
      .filter(Boolean)
      .join('\n\n');
    box.add(this.add.text(14, 132 + STATS.length * 24 + 8, info, { fontFamily: MENU_FONT, fontSize: '12px', color: '#c8c3b0', wordWrap: { width: dw - 28 }, lineSpacing: 2 }));
    const mk2 = menuButton(this, this.showMk2 ? '[ VER NORMAL ]' : '[ VER MK II ]', () => { this.showMk2 = !this.showMk2; this.redraw(); }, 14);
    box.add(mk2.setPosition(dw - 70, 18));
  }
}
