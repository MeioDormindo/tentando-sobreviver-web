import Phaser from 'phaser';
import { uiView } from '../ui/uiScale';
import { COLORS, SCENE_KEYS } from '../config/game.config';
import { accountConfig, isOnlineConfigured } from '../config/online.config';
import { currentUser, signIn, signOut, signUp } from '../online/auth';
import { onSyncStatus, syncNow, syncStatus } from '../online/cloudSync';
import { MENU_FONT, menuButton, menuTitle, onResize } from '../ui/menuWidgets';

const FIELD_W = 260;

/**
 * Conta na nuvem: entrar/criar conta com usuário e senha para levar o progresso para outros
 * aparelhos. A senha vai direto para o servidor (HTTPS) e nunca é guardada no aparelho.
 */
export class AccountScene extends Phaser.Scene {
  private message!: Phaser.GameObjects.Text;
  private busy = false;

  constructor() {
    super(SCENE_KEYS.account);
  }

  create(): void {
    this.busy = false;
    this.input.setDefaultCursor('default');
    const title = menuTitle(this, 'CONTA', 52);
    this.message = this.add.text(0, 0, '', { fontFamily: MENU_FONT, fontSize: '15px', color: COLORS.textDim, align: 'center' }).setOrigin(0.5);
    const back = menuButton(this, '[ VOLTAR ]', () => this.scene.start(SCENE_KEYS.menu), 22);
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start(SCENE_KEYS.menu));

    const layoutBody = !isOnlineConfigured() ? this.offline() : currentUser() ? this.loggedIn() : this.loginForm();
    onResize(this, () => {
      const { width, height } = uiView(this);
      title.setPosition(width / 2, height * 0.12);
      back.setPosition(width / 2, height - 40);
      layoutBody(width, height);
      this.message.setWordWrapWidth(width - 32).setPosition(width / 2, height * 0.12 + 280);
    });
  }

  private offline(): (w: number, h: number) => void {
    this.message.setText('Contas online indisponíveis nesta versão.');
    return () => undefined;
  }

  private loggedIn(): (w: number, h: number) => void {
    const who = this.add.text(0, 0, `LOGADO COMO ${currentUser()?.toUpperCase() ?? ''}`, { fontFamily: MENU_FONT, fontSize: '20px', color: '#e3c77a' }).setOrigin(0.5);
    const status = this.add.text(0, 0, '', { fontFamily: MENU_FONT, fontSize: '14px', color: COLORS.textDim }).setOrigin(0.5);
    const refresh = (): void => {
      const s = syncStatus();
      if (s.busy) status.setText('Sincronizando...');
      else if (s.error) status.setText(s.error).setColor('#e05a4a');
      else if (s.lastSyncAt > 0) status.setText(`Progresso salvo na nuvem · ${new Date(s.lastSyncAt).toLocaleTimeString('pt-BR')}`).setColor(COLORS.textDim);
      else status.setText('O progresso é salvo na nuvem automaticamente').setColor(COLORS.textDim);
    };
    refresh();
    const off = onSyncStatus(() => this.scene.isActive() && refresh());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    const sync = menuButton(this, '[ SINCRONIZAR AGORA ]', () => void syncNow(), 20);
    const logout = menuButton(this, '[ SAIR DA CONTA ]', () => {
      void signOut().then(() => this.scene.isActive() && this.scene.restart());
    }, 20);
    return (width, height) => {
      const y = height * 0.12;
      who.setPosition(width / 2, y + 80);
      status.setPosition(width / 2, y + 112);
      sync.setPosition(width / 2, y + 170);
      logout.setPosition(width / 2, y + 216);
    };
  }

  private loginForm(): (w: number, h: number) => void {
    const user = this.field('text', 'Usuário', 'username', 16);
    const pass = this.field('password', 'Senha', 'current-password', accountConfig.passwordMax);
    const userLabel = this.add.text(0, 0, 'USUÁRIO', { fontFamily: MENU_FONT, fontSize: '14px', color: COLORS.textDim }).setOrigin(0.5);
    const passLabel = this.add.text(0, 0, 'SENHA', { fontFamily: MENU_FONT, fontSize: '14px', color: COLORS.textDim }).setOrigin(0.5);
    const run = (action: typeof signIn): void => {
      if (this.busy) return;
      this.busy = true;
      this.message.setText('Conectando...').setColor(COLORS.textDim);
      const password = pass.el.value;
      void action(user.el.value, password).then(async (err) => {
        if (!this.scene.isActive()) return;
        pass.el.value = '';
        if (err) {
          this.busy = false;
          this.message.setText(err).setColor('#e05a4a');
          return;
        }
        this.message.setText('Sincronizando o progresso...');
        await syncNow(true);
        if (this.scene.isActive()) this.scene.restart();
      });
    };
    const enter = menuButton(this, '[ ENTRAR ]', () => run(signIn), 20);
    const create = menuButton(this, '[ CRIAR CONTA ]', () => run(signUp), 20);
    for (const f of [user, pass]) {
      f.el.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') run(signIn);
      });
    }
    this.message.setText('Entre para salvar o progresso na nuvem e jogar em qualquer aparelho.\nNão há recuperação por e-mail: guarde bem a sua senha.');
    return (width, height) => {
      const y = height * 0.12;
      userLabel.setPosition(width / 2, y + 62);
      user.dom.setPosition(width / 2, y + 90);
      passLabel.setPosition(width / 2, y + 128);
      pass.dom.setPosition(width / 2, y + 156);
      enter.setPosition(width / 2 - 110, y + 214);
      create.setPosition(width / 2 + 110, y + 214);
    };
  }

  /** Campo HTML (abre o teclado no celular; o navegador pode oferecer salvar a senha). */
  private field(type: 'text' | 'password', label: string, autocomplete: string, maxLength: number): { el: HTMLInputElement; dom: Phaser.GameObjects.DOMElement } {
    const el = document.createElement('input');
    el.type = type;
    el.maxLength = maxLength;
    el.setAttribute('autocomplete', autocomplete);
    el.spellcheck = false;
    el.setAttribute('autocapitalize', 'none');
    el.setAttribute('aria-label', label);
    Object.assign(el.style, {
      width: `${FIELD_W}px`,
      font: '18px monospace',
      padding: '6px',
      background: '#15171a',
      color: '#e8e2c8',
      border: '1px solid #c9a45c',
      textAlign: 'center',
    });
    const dom = this.add.dom(0, 0, el);
    return { el, dom };
  }
}
