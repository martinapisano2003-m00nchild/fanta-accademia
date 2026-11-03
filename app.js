// ============================================================
// FANTA-ACCADEMIA 2026 - APPLICATION CONTROLLER & LOGIC
// ============================================================

class FantaApp {
  constructor() {
    this.initStorage();
    this.currentUser = this.getActiveUser();
    this.currentTab = 'home';
    this.soundEnabled = localStorage.getItem('fanta_sound') !== 'false';
    this.audioCtx = null;
    
    // Temporary builder state
    this.selectedDocenti = [];
    this.selectedCollega = null;

    // Report photo upload state (Caricamento foto da galleria / fotocamera)
    this.reportUploadedPhoto = null;

    // PWA & Notifiche Push
    this.deferredPrompt = null;
    this._prevReportsSnapshot = null;
    this._prevNoticesSnapshot = null;
    this._prevTipsSnapshot = null;

    // Master live scoring state
    this.scoringSelectedCharId = 'door-e';

    // Master Halloween Event state (concluso)
    this.halloweenScoringMode = 'single';
    this.halloweenSelectedCollegaId = 'collega-marco';
    this.halloweenMultiSelectedColleghiIds = [];
    this.halloweenThrillerSelectedCoaches = [];

    this.initAudio();
    this.initDOM();
    this.ensureHalloweenNotice();
    if (this.currentUser) {
      this.applyUserPalette(this.currentUser.username);
    }
    this.render();
    this.checkAndShowNewNotices();

    // Se l'utente non è autenticato e il gatekeeper è sbloccato, chiedi subito il login
    if (this.checkGatekeeper() && !this.currentUser) {
      this.openModal('loginModal');
    }
  }

  ensureHalloweenNotice() {
    try {
      const notices = this.getData('fanta_notices') || [];
      const hasHalloween = notices.some(n => n.id === 'notice-halloween-2026');
      if (!hasHalloween) {
        const halloweenNotice = (typeof INITIAL_NOTICES !== 'undefined' ? INITIAL_NOTICES : []).find(n => n.id === 'notice-halloween-2026');
        if (halloweenNotice) {
          notices.unshift(halloweenNotice);
          this.saveData('fanta_notices', notices);
        }
      }
    } catch (e) {
      console.warn("Could not ensure halloween notice", e);
    }
  }

  // --- AUDIO SYNTHESIS ---
  initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {
      console.warn("AudioContext not supported", e);
    }
  }

  playSound(type) {
    if (!this.soundEnabled || !this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'coin') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(987.77, now);
      osc.frequency.setValueAtTime(1318.51, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.1);
      osc.frequency.setValueAtTime(783.99, now + 0.2);
      osc.frequency.setValueAtTime(1046.50, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
      osc.start(now);
      osc.stop(now + 0.55);
    } else if (type === 'glitch') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.setValueAtTime(800, now + 0.04);
      osc.frequency.setValueAtTime(150, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  }

  // --- STORAGE & CLEAN INITIALIZATION ---
  // Keys synced via Firebase (shared across all devices)
  // Keys kept local: fanta_users, fanta_gatekeeper_unlocked, fanta_active_user, fanta_sound, fanta_initialized_v4
  get FIREBASE_KEYS() {
    return ['fanta_teams', 'fanta_notices', 'fanta_reports', 'fanta_tips', 'fanta_profiles'];
  }

  initStorage() {
    // v4: Firebase è la fonte di verità per le chiavi condivise.
    // NON cancelliamo mai dati esistenti — solo aggiorniamo utenti locali e avviamo i listener.
    // La prima volta che un dispositivo si connette, Firebase popolerà la cache tramite i listener.
    // firebaseInitIfEmpty scrive i dati default SOLO se Firebase è completamente vuoto (primo avvio assoluto).
    if (localStorage.getItem('fanta_initialized_v4') !== 'true') {
      // Solo al primissimo avvio assoluto: inizializza Firebase con dati default (se vuoto)
      this.firebaseInitIfEmpty('fanta_teams', INITIAL_TEAMS);
      this.firebaseInitIfEmpty('fanta_notices', INITIAL_NOTICES);
      this.firebaseInitIfEmpty('fanta_reports', INITIAL_REPORTS);
      this.firebaseInitIfEmpty('fanta_tips', MASTER_TIPS);
      this.firebaseInitIfEmpty('fanta_profiles', {});
      localStorage.setItem('fanta_initialized_v4', 'true');
    }
    // Sempre: aggiorna credenziali utenti locali (mai su Firebase)
    localStorage.setItem('fanta_users', JSON.stringify(INITIAL_USERS));
    // Avvia i listener in tempo reale di Firebase
    this.startFirebaseListeners();
  }

  firebaseInitIfEmpty(key, defaultVal) {
    if (!window.fantaDB) return;
    // SICUREZZA: legge prima — scrive SOLO se la chiave non esiste affatto su Firebase
    window.fantaDB.ref(key).once('value').then(snap => {
      if (!snap.exists()) {
        console.log(`[Firebase] Inizializzo ${key} con dati default (prima accensione)`);
        window.fantaDB.ref(key).set(defaultVal);
      } else {
        console.log(`[Firebase] ${key} già presente su Firebase — dati preservati`);
      }
    }).catch(e => console.warn('[Firebase] Errore init per', key, e));
  }

  startFirebaseListeners() {
    if (!window.fantaDB) return;
    // Ascolta cambiamenti in tempo reale e aggiorna la UI
    this.FIREBASE_KEYS.forEach(key => {
      window.fantaDB.ref(key).on('value', snap => {
        const val = snap.val();
        if (val !== null) {
          // Notifiche di sistema push sul dispositivo per nuovi eventi
          this.handleFirebaseRealtimeNotification(key, val);
          // Cache locale per accesso sincrono
          localStorage.setItem('_fb_cache_' + key, JSON.stringify(val));
          // Aggiorna UI se l'app è già inizializzata
          if (this._appReady) {
            this.render();
          }
        }
      }, e => console.warn('Firebase listener error', key, e));
    });
  }

  getData(key) {
    try {
      if (this.FIREBASE_KEYS.includes(key)) {
        // Legge dalla cache locale aggiornata dai listener Firebase
        const cached = localStorage.getItem('_fb_cache_' + key);
        if (cached) return JSON.parse(cached);
        // Fallback ai dati iniziali se la cache non è ancora pronta
        const defaults = { 
          fanta_teams: INITIAL_TEAMS, 
          fanta_notices: INITIAL_NOTICES, 
          fanta_reports: INITIAL_REPORTS, 
          fanta_tips: MASTER_TIPS,
          fanta_profiles: {}
        };
        return defaults[key] || null;
      }
      return JSON.parse(localStorage.getItem(key));
    } catch (e) {
      return null;
    }
  }

  saveData(key, val) {
    if (this.FIREBASE_KEYS.includes(key) && window.fantaDB) {
      // Scrivi su Firebase (il listener aggiornerà automaticamente la cache locale e la UI)
      window.fantaDB.ref(key).set(val).catch(e => console.warn('Firebase write error', key, e));
      // Aggiorna anche la cache locale immediatamente per risposta UI istantanea
      localStorage.setItem('_fb_cache_' + key, JSON.stringify(val));
    } else {
      localStorage.setItem(key, JSON.stringify(val));
    }
  }

  getActiveUser() {
    const saved = localStorage.getItem('fanta_active_user');
    const users = this.getData('fanta_users') || INITIAL_USERS;
    if (saved) {
      const found = users.find(u => u.username === saved);
      if (found) return found;
    }
    return null;
  }

  setActiveUser(username) {
    localStorage.setItem('fanta_active_user', username);
    this.currentUser = this.getActiveUser();
    this.loadUserBuilderState();
    this.applyUserPalette(username);
    this.render();
    this.showToast(`Accesso effettuato come ${this.currentUser.username} (${this.currentUser.role === 'master' ? '👑 Master' : 'Allenatore'})`, 'info');
    setTimeout(() => this.checkAndShowNewNotices(), 400);
  }

  logout() {
    localStorage.removeItem('fanta_active_user');
    this.currentUser = null;
    this.render();
    this.playSound('click');
    this.showToast("Disconnessione effettuata. Inserisci le credenziali per rientrare.", "info");
    this.openModal('loginModal');
  }

  isUserTeamConfirmed() {
    if (!this.currentUser) return false;
    const teams = this.getData('fanta_teams') || {};
    const myTeam = teams[this.currentUser.username];
    return !!(myTeam && myTeam.confirmed);
  }

  // --- GATEKEEPER PASS ---
  checkGatekeeper() {
    return localStorage.getItem('fanta_gatekeeper_unlocked') === 'true';
  }

  unlockGatekeeper(pwd) {
    if (pwd === GLOBAL_PASSWORD) {
      localStorage.setItem('fanta_gatekeeper_unlocked', 'true');
      const overlay = document.getElementById('gatekeeperOverlay');
      if (overlay) {
        overlay.classList.add('hidden');
      }
      this.playSound('success');
      this.showToast("🔓 Accesso Accademico autorizzato!", "success");

      if (!this.currentUser) {
        setTimeout(() => this.openModal('loginModal'), 400);
      }
      return true;
    }
    return false;
  }

  lockGatekeeper() {
    localStorage.removeItem('fanta_gatekeeper_unlocked');
    const overlay = document.getElementById('gatekeeperOverlay');
    if (overlay) {
      overlay.classList.remove('hidden');
    }
    this.showToast("🔒 Portale bloccato con successo.", "info");
  }

  // --- HTML ESCAPING ---
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- NOTIFICHE PUSH FLOTTANTI & TRACKING LETTI ---
  getSeenNoticeIds() {
    const userKey = this.currentUser ? this.currentUser.username : 'guest';
    try {
      return JSON.parse(localStorage.getItem(`fanta_seen_notices_${userKey}`)) || [];
    } catch {
      return [];
    }
  }

  markAllNoticesAsSeen() {
    const userKey = this.currentUser ? this.currentUser.username : 'guest';
    const notices = this.getData('fanta_notices') || [];
    const allIds = notices.map(n => n.id);
    localStorage.setItem(`fanta_seen_notices_${userKey}`, JSON.stringify(allIds));
    const card = document.getElementById('pushNotifCard');
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      card.style.transition = 'all 0.3s ease';
      setTimeout(() => card.remove(), 300);
    }
  }

  checkAndShowNewNotices() {
    if (!this.currentUser) return;

    // Se l'utente si trova già nella scheda Home, sta già visualizzando gli avvisi direttamente:
    // contrassegniamo tutti gli avvisi come visti e non mostriamo il pop-up.
    if (this.currentTab === 'home') {
      this.markAllNoticesAsSeen();
      return;
    }

    const notices = this.getData('fanta_notices') || [];
    const seen = this.getSeenNoticeIds();
    const unread = notices.filter(n => !seen.includes(n.id));

    if (unread.length > 0) {
      this.showPushNotificationCard(unread[0], unread.length);
    } else {
      const old = document.getElementById('pushNotifCard');
      if (old) old.remove();
    }
  }

  showPushNotificationCard(notice, totalUnread = 1) {
    const old = document.getElementById('pushNotifCard');
    if (old) old.remove();

    const card = document.createElement('div');
    card.id = 'pushNotifCard';
    card.className = 'push-notif-card';
    card.onclick = (e) => {
      // Se clicca sul pulsante chiudi, segna come letto e chiude senza cambiare tab
      if (e.target.closest('.push-notif-close')) {
        this.markAllNoticesAsSeen();
        return;
      }
      this.switchTab('home');
      this.markAllNoticesAsSeen();
    };

    const countBadge = totalUnread > 1 ? `<span class="push-notif-counter">${totalUnread} nuovi</span>` : '';

    card.innerHTML = `
      <div class="push-notif-icon-col">📢</div>
      <div class="push-notif-content-col">
        <div class="push-notif-title-row">
          <strong>Ci sono nuovi avvisi nella Home</strong>
          ${countBadge}
        </div>
        <div class="push-notif-sub">Tocca qui per visualizzarli</div>
      </div>
      <button type="button" class="push-notif-close" title="Chiudi e segna come letto">✕</button>
    `;

    document.body.appendChild(card);
  }

  // --- INITIALIZE DOM & EVENTS ---
  initDOM() {
    const gateInput = document.getElementById('gatekeeperPassword');
    const gateBtn = document.getElementById('gatekeeperSubmit');
    const gateOverlay = document.getElementById('gatekeeperOverlay');

    if (this.checkGatekeeper() && gateOverlay) {
      gateOverlay.classList.add('hidden');
    }

    if (gateBtn && gateInput) {
      gateBtn.addEventListener('click', () => {
        const val = gateInput.value.trim();
        if (this.unlockGatekeeper(val)) {
          gateInput.value = '';
        } else {
          this.playSound('glitch');
          this.showToast("❌ Parola d'ordine errata! Riprova.", "danger");
          gateInput.focus();
        }
      });

      gateInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          gateBtn.click();
        }
      });
    }

    const toggleGatePwd = document.getElementById('toggleGatePwd');
    if (toggleGatePwd && gateInput) {
      toggleGatePwd.addEventListener('click', () => {
        gateInput.type = gateInput.type === 'password' ? 'text' : 'password';
        toggleGatePwd.innerText = gateInput.type === 'password' ? '👁️' : '🔒';
      });
    }

    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    const soundBtn = document.getElementById('soundToggleBtn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        this.soundEnabled = !this.soundEnabled;
        localStorage.setItem('fanta_sound', this.soundEnabled ? 'true' : 'false');
        soundBtn.innerText = this.soundEnabled ? '🔊' : '🔇';
        this.showToast(`Audio ${this.soundEnabled ? 'Attivato' : 'Disattivato'}`, 'info');
      });
    }

    document.querySelectorAll('.modal-close-btn, [data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!this.currentUser && document.getElementById('loginModal')?.classList.contains('active')) {
          this.showToast("⚠️ Devi accedere con un profilo per continuare!", "danger");
          return;
        }
        this.closeAllModals();
      });
    });

    const userBadgeBtn = document.getElementById('userBadgeBtn');
    if (userBadgeBtn) {
      userBadgeBtn.addEventListener('click', () => {
        if (this.currentUser) {
          this.openProfileModal();
        } else {
          this.openModal('loginModal');
        }
      });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.logout();
      });
    }

    this.setupLoginForm();
    this.setupReportForm();
    this.setupNoticeForm();
    this.setupTipForm();
    this.setupManualPointsForm();
    this.setupMasterDirectEventForm();

    // Chiusura menu drawer o modali con tasto Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeDrawer();
        this.closeAllModals();
      }
    });

    // PWA & Notifiche
    this.initPwa();
    this.updateNotificationButtonState();

    this.loadUserBuilderState();
  }

  // --- DRAWER MENU A TENDINA A SCOMPARSA (LATO SINISTRO) ---
  toggleDrawer() {
    const drawer = document.getElementById('appDrawer');
    if (drawer && (drawer.classList.contains('open') || drawer.classList.contains('active'))) {
      this.closeDrawer();
    } else {
      this.openDrawer();
    }
  }

  openDrawer() {
    const drawer = document.getElementById('appDrawer');
    const overlay = document.getElementById('drawerOverlay');
    if (drawer) {
      drawer.classList.add('open');
      drawer.classList.add('active');
    }
    if (overlay) {
      overlay.classList.add('open');
      overlay.classList.add('active');
    }
    document.body.classList.add('drawer-open');
    this.updateNotificationButtonState();
  }

  closeDrawer() {
    const drawer = document.getElementById('appDrawer');
    const overlay = document.getElementById('drawerOverlay');
    if (drawer) {
      drawer.classList.remove('open');
      drawer.classList.remove('active');
    }
    if (overlay) {
      overlay.classList.remove('open');
      overlay.classList.remove('active');
    }
    document.body.classList.remove('drawer-open');
  }

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  }

  openModal(modalId) {
    this.closeAllModals();
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  }

  switchTab(tabName) {
    if (!this.currentUser) {
      this.openModal('loginModal');
      return;
    }

    if (tabName === 'master' && this.currentUser.role !== 'master') {
      this.playSound('glitch');
      this.showToast("⛔ Accesso Negato! Il Pannello Master è riservato a Martina.", "danger");
      return;
    }

    const isMaster = this.currentUser.role === 'master';
    const isConfirmed = this.isUserTeamConfirmed();

    if (!isConfirmed && !isMaster) {
      if (tabName === 'classifica' || tabName === 'social') {
        this.playSound('glitch');
        this.showToast("🔒 Sezione Bloccata! Devi prima confermare la tua Squadra per accedere.", "danger");
        this.switchTab('squadra');
        return;
      }
      if (tabName === 'secret') {
        this.playSound('glitch');
        this.showToast("🔒 Le Secret Rules sono sbloccate solo dopo aver confermato la tua Squadra!", "danger");
        this.switchTab('squadra');
        return;
      }
      if (tabName === 'soffiate') {
        this.playSound('glitch');
        this.showToast("🔒 Sezione protetta dal Master!", "danger");
        this.switchTab('squadra');
        return;
      }
    }

    // Controllo specifico Soffiate Master: visibile SOLO a chi ha Martina in squadra (Masi, Mar) oppure Martina Master
    if (tabName === 'soffiate') {
      const teams = this.getData('fanta_teams') || {};
      const myTeam = this.currentUser ? teams[this.currentUser.username] : null;
      const hasMartina = myTeam && myTeam.confirmed && myTeam.collega === 'collega-martina';
      if (!hasMartina && !isMaster) {
        this.playSound('glitch');
        this.showToast("🔒 Le Soffiate del Master sono visibili solo a chi ha Martina in squadra!", "danger");
        this.switchTab('squadra');
        return;
      }
    }

    this.currentTab = tabName;
    this.playSound('click');
    this.closeDrawer();

    if (tabName === 'home') {
      this.markAllNoticesAsSeen();
    } else {
      setTimeout(() => this.checkAndShowNewNotices(), 300);
    }

    document.querySelectorAll('[data-tab]').forEach(el => {
      if (el.getAttribute('data-tab') === tabName) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    document.querySelectorAll('.tab-section').forEach(sec => {
      if (sec.id === `tab-${tabName}`) {
        sec.classList.add('active');
      } else {
        sec.classList.remove('active');
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.render();
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `fanta-toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'danger') icon = '⚠️';
    if (type === 'bonus') icon = '🌟';

    toast.innerHTML = `<span>${icon}</span><div>${message}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // --- RENDER MAIN UI ---
  render() {
    this.renderHeader();
    this.renderHome();
    this.renderBuilder();
    this.renderCatalog();
    this.renderEvent();
    this.renderSecretRules();
    this.renderMasterTips();
    this.renderLeaderboard();
    this.renderSocialFeed();
    this.renderMasterDashboard();
    this._appReady = true; // segnala ai listener Firebase che l'app è pronta
  }

  renderHeader() {
    const nameEl = document.getElementById('headerUserName');
    const roleEl = document.getElementById('headerUserRole');
    const avatarEl = document.getElementById('headerUserAvatar');
    const logoutBtn = document.getElementById('logoutBtn');

    if (!this.currentUser) {
      if (nameEl) nameEl.innerText = "Accedi";
      if (avatarEl) avatarEl.innerHTML = "👤";
      if (roleEl) {
        roleEl.innerText = "Non Connesso";
        roleEl.className = "user-badge-role";
      }
      if (logoutBtn) logoutBtn.style.display = 'none';
      return;
    }

    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
    if (nameEl) nameEl.innerText = this.currentUser.username;
    if (avatarEl) avatarEl.innerHTML = this.getUserAvatarHtml(this.currentUser.username, '26px', '1.2rem');
    if (roleEl) {
      if (this.currentUser.role === 'master') {
        roleEl.innerText = "👑 Master / Admin";
        roleEl.className = "user-badge-role role-master";
      } else {
        roleEl.innerText = "Allenatore";
        roleEl.className = "user-badge-role role-coach";
      }
    }

    const isMaster = this.currentUser.role === 'master';
    const masterNavItems = document.querySelectorAll('.nav-master-only');
    masterNavItems.forEach(el => {
      el.style.display = isMaster ? 'flex' : 'none';
    });

    // Visibilità Soffiate Master: SOLO chi ha Martina in squadra (Masi, Mar) oppure Master
    const teams = this.getData('fanta_teams') || {};
    const myTeam = this.currentUser ? teams[this.currentUser.username] : null;
    const hasMartina = myTeam && myTeam.confirmed && myTeam.collega === 'collega-martina';

    document.querySelectorAll('.nav-soffiate-only').forEach(el => {
      el.style.display = (hasMartina || isMaster) ? 'flex' : 'none';
    });

    const isConfirmed = this.isUserTeamConfirmed();
    const isUnlocked = isConfirmed || isMaster;

    document.querySelectorAll('[data-tab="classifica"], [data-tab="social"], [data-tab="secret"]').forEach(tab => {
      if (!isUnlocked) {
        tab.classList.add('locked-nav');
        if (!tab.querySelector('.nav-lock-icon')) {
          const lockSpan = document.createElement('span');
          lockSpan.className = 'nav-lock-icon';
          lockSpan.innerText = ' 🔒';
          tab.appendChild(lockSpan);
        }
      } else {
        tab.classList.remove('locked-nav');
        tab.querySelector('.nav-lock-icon')?.remove();
      }
    });
  }

  // --- SECTION: HOME ---
  renderHome() {
    const notices = this.getData('fanta_notices') || [];
    const masterContainer = document.getElementById('homeMasterNoticesList');
    const reportsContainer = document.getElementById('homeReportsNoticesList');
    const fallbackContainer = document.getElementById('homeNoticesList');

    // Separazione degli avvisi: quelli del Master in alto, gli esiti automatici/convalide in basso
    const masterNotices = notices.filter(n => n.tipo !== 'RISULTATO SEGNALAZIONE');
    const reportNotices = notices.filter(n => n.tipo === 'RISULTATO SEGNALAZIONE');

    const renderCardHtml = (n) => `
      <div class="notice-card annuncio ${n.id && n.id.includes('halloween') ? 'halloween-notice-card' : ''}">
        <div class="notice-top">
          <span class="notice-badge">${n.icona || '📢'} ${n.badge || n.tipo}</span>
          <span class="notice-date">${n.data}</span>
        </div>
        <h4 class="notice-title">${this.escapeHtml(n.titolo)}</h4>
        <p class="notice-body">${this.escapeHtml(n.testo)}</p>
        ${n.actionBtn ? `
          <button type="button" class="btn-notice-cta" onclick="app.switchTab('${n.actionBtn.tab}')">
            ${n.actionBtn.label}
          </button>
        ` : ''}
      </div>
    `;

    if (masterContainer) {
      if (masterNotices.length > 0) {
        masterContainer.innerHTML = masterNotices.map(renderCardHtml).join('');
      } else {
        masterContainer.innerHTML = '<p style="color:var(--text-muted);font-size:0.88rem;padding:12px;">Nessun avviso ufficiale al momento.</p>';
      }
    }

    if (reportsContainer) {
      if (reportNotices.length > 0) {
        reportsContainer.innerHTML = reportNotices.map(renderCardHtml).join('');
      } else {
        reportsContainer.innerHTML = '<p style="color:var(--text-muted);font-size:0.88rem;padding:12px;">Nessun esito o convalida registrata finora.</p>';
      }
    }

    if (fallbackContainer) {
      fallbackContainer.innerHTML = notices.map(renderCardHtml).join('');
    }

    const lockedHomeArea = document.getElementById('homeLockedCallout');
    const isConfirmed = this.isUserTeamConfirmed();
    const isMaster = this.currentUser && this.currentUser.role === 'master';

    if (lockedHomeArea) {
      if (!isConfirmed && !isMaster) {
        lockedHomeArea.style.display = 'block';
        lockedHomeArea.innerHTML = `
          <div class="locked-home-card">
            <div class="lock-icon-big">🔒</div>
            <h3>Classifica Live e Bacheca Social Bloccate</h3>
            <p>
              Per accedere alla <strong>Classifica Live</strong>, alla <strong>Bacheca Social</strong> e alle <strong>Secret Rules</strong>, devi prima comporre e confermare la tua Squadra ufficiale di 4 Docenti e 1 Collega (budget 100 CFA).
            </p>
            <button class="btn-confirm-squad" style="width: auto; margin: 0 auto; padding: 10px 24px;" onclick="app.switchTab('squadra')">
              ⚽ Vai a Comporre la Tua Squadra
            </button>
          </div>
        `;
      } else {
        lockedHomeArea.style.display = 'none';
      }
    }

    const teams = this.getData('fanta_teams') || {};
    const confirmedCount = Object.values(teams).filter(t => t.confirmed).length;
    const reports = this.getData('fanta_reports') || [];
    const approvedReports = reports.filter(r => r.stato === 'approvata').length;

    const statTeamsEl = document.getElementById('statConfirmedTeams');
    const statApprovedEl = document.getElementById('statApprovedEvents');
    if (statTeamsEl) statTeamsEl.innerText = `${confirmedCount} / 11`;
    if (statApprovedEl) statApprovedEl.innerText = approvedReports;

    this.renderUserProfile('userProfilePanel');
  }

  // --- SECTION: BUILDER & SQUADRA MERCATO ---
  loadUserBuilderState() {
    if (!this.currentUser) return;
    const teams = this.getData('fanta_teams') || {};
    const myTeam = teams[this.currentUser.username];
    if (myTeam && myTeam.confirmed) {
      this.selectedDocenti = [...(myTeam.docenti || [])];
      this.selectedCollega = myTeam.collega || null;
    } else {
      this.selectedDocenti = [];
      this.selectedCollega = null;
    }
  }

  calculateCFA() {
    let spent = 0;
    this.selectedDocenti.forEach(id => {
      const doc = DOCENTI.find(d => d.id === id);
      if (doc) spent += doc.costoCFA;
    });
    if (this.selectedCollega) {
      const col = COLLEGHI.find(c => c.id === this.selectedCollega);
      if (col) spent += col.costoCFA;
    }
    return {
      spent,
      remaining: 100 - spent,
      isValidBudget: spent <= 100
    };
  }

  renderBuilder() {
    if (!this.currentUser) return;

    const isConfirmed = this.isUserTeamConfirmed();
    const { spent, remaining, isValidBudget } = this.calculateCFA();

    const sealedBanner = document.getElementById('teamSealedBanner');
    if (sealedBanner) {
      sealedBanner.style.display = isConfirmed ? 'flex' : 'none';
    }

    const spentEl = document.getElementById('builderCfaSpent');
    const remEl = document.getElementById('builderCfaRemaining');
    if (spentEl) spentEl.innerText = spent;
    if (remEl) {
      remEl.innerText = remaining;
      remEl.style.color = remaining < 0 ? '#ef4444' : '#fbbf24';
    }

    const slotsWrap = document.getElementById('builderSlots');
    if (!slotsWrap) return;

    let html = '';
    for (let i = 0; i < 4; i++) {
      const docId = this.selectedDocenti[i];
      if (docId) {
        const doc = DOCENTI.find(d => d.id === docId);
        html += `
          <div class="slot-card filled">
            ${!isConfirmed ? `
              <button class="slot-remove-btn" onclick="app.removeDocente('${doc.id}')" title="Rimuovi">✕</button>
            ` : ''}
            <div class="slot-avatar">${doc.avatar}</div>
            <div class="slot-name">${doc.nome}</div>
            <div class="slot-cost">${doc.costoCFA} CFA</div>
            <div class="slot-type-label">Docente #${i + 1}</div>
          </div>
        `;
      } else {
        html += `
          <div class="slot-card">
            <div class="slot-avatar" style="opacity: 0.35;">👤</div>
            <div class="slot-name" style="color: var(--text-dark);">Docente Vuoto</div>
            <div class="slot-type-label">Slot Docente #${i + 1}</div>
          </div>
        `;
      }
    }

    if (this.selectedCollega) {
      const col = COLLEGHI.find(c => c.id === this.selectedCollega);
      html += `
        <div class="slot-card collega-slot filled">
          ${!isConfirmed ? `
            <button class="slot-remove-btn" onclick="app.removeCollega()" title="Rimuovi">✕</button>
          ` : ''}
          <div class="slot-avatar">${col.avatar}</div>
          <div class="slot-name">${col.nome}</div>
          <div class="slot-cost">${col.costoCFA} CFA</div>
          <div class="slot-type-label" style="color: #fbbf24;">Collega</div>
        </div>
      `;
    } else {
      html += `
        <div class="slot-card collega-slot">
          <div class="slot-avatar" style="opacity: 0.35;">🤝</div>
          <div class="slot-name" style="color: var(--text-dark);">Nessun Collega</div>
          <div class="slot-type-label" style="color: #fbbf24;">Slot Collega (1 Obbligatorio)</div>
        </div>
      `;
    }

    slotsWrap.innerHTML = html;

    const confirmBtn = document.getElementById('btnConfirmSquad');
    const isComplete = this.selectedDocenti.length === 4 && this.selectedCollega !== null;
    const canConfirm = isComplete && isValidBudget;

    if (confirmBtn) {
      if (isConfirmed) {
        confirmBtn.disabled = true;
        confirmBtn.style.background = 'rgba(16, 185, 129, 0.2)';
        confirmBtn.style.borderColor = 'rgba(16, 185, 129, 0.5)';
        confirmBtn.style.color = '#6ee7b7';
        confirmBtn.innerHTML = `🔒 Squadra Confermata e Bloccata Definitivamente (${spent} CFA)`;
      } else {
        confirmBtn.disabled = !canConfirm;
        confirmBtn.style.background = '';
        confirmBtn.style.borderColor = '';
        confirmBtn.style.color = '';
        if (!isComplete) {
          confirmBtn.innerHTML = `⚠️ Seleziona 4 Docenti e 1 Collega (${this.selectedDocenti.length}/4 Docenti, ${this.selectedCollega ? '1/1' : '0/1'} Collega)`;
        } else if (!isValidBudget) {
          confirmBtn.innerHTML = `⛔ Budget superato! Rimuovi ${Math.abs(remaining)} CFA per confermare`;
        } else {
          confirmBtn.innerHTML = `✨ Conferma e Blocca Definitivamente la Squadra (${spent} CFA)`;
        }
      }
    }

    this.renderDocentiMarket();
    this.renderColleghiMarket();
  }

  renderDocentiMarket() {
    const container = document.getElementById('docentiMarketList');
    if (!container) return;

    const isConfirmed = this.isUserTeamConfirmed();

    container.innerHTML = DOCENTI.map(doc => {
      const isSelected = this.selectedDocenti.includes(doc.id);
      return `
        <div class="character-card ${isSelected ? 'in-squad' : ''}">
          <div class="char-top">
            <div class="char-avatar-box">${doc.avatar}</div>
            <div class="char-badge-cost">
              <span class="cost-tag">${doc.costoCFA} CFA</span>
              <span class="tier-label">${doc.fascia}</span>
            </div>
          </div>
          <h4 class="char-name">${doc.nome}</h4>
          <p class="char-bio">${doc.bio}</p>
          <div class="char-actions">
            ${isConfirmed ? `
              <button class="btn-recruit" disabled style="opacity: 0.6;">
                ${isSelected ? '✓ In Squadra' : 'Non schierato'}
              </button>
            ` : isSelected ? `
              <button class="btn-recruit selected" onclick="app.removeDocente('${doc.id}')">
                ✓ In Squadra (Rimuovi)
              </button>
            ` : `
              <button class="btn-recruit" onclick="app.addDocente('${doc.id}')" ${this.selectedDocenti.length >= 4 ? 'disabled title="Hai già 4 docenti"' : ''}>
                + Schiera Docente
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  renderColleghiMarket() {
    const container = document.getElementById('colleghiMarketList');
    if (!container) return;

    const currentUserNameLower = (this.currentUser?.username || '').toLowerCase();
    const isConfirmed = this.isUserTeamConfirmed();

    container.innerHTML = COLLEGHI.map(col => {
      const isSelected = this.selectedCollega === col.id;
      const isSelf = col.nome.toLowerCase() === currentUserNameLower;

      return `
        <div class="character-card ${isSelected ? 'in-squad' : ''} ${isSelf ? 'self-excluded' : ''}">
          <div class="char-top">
            <div class="char-avatar-box">${col.avatar}</div>
            <div class="char-badge-cost">
              <span class="cost-tag">${col.costoCFA} CFA</span>
              <span class="tier-label">${col.fascia}</span>
            </div>
          </div>
          <h4 class="char-name">${col.nome} ${isSelf ? '<span style="font-size: 0.75rem; color: #ef4444;">(Sei tu!)</span>' : ''}</h4>

          <div class="char-actions">
            ${isSelf ? `
              <button class="btn-recruit" disabled style="color: #ef4444; border-color: rgba(239, 68, 68, 0.4);">
                🚫 Auto-Escluso (Regola)
              </button>
            ` : isConfirmed ? `
              <button class="btn-recruit" disabled style="opacity: 0.6;">
                ${isSelected ? '✓ In Squadra' : 'Non schierato'}
              </button>
            ` : isSelected ? `
              <button class="btn-recruit selected" onclick="app.removeCollega()">
                ✓ In Squadra (Rimuovi)
              </button>
            ` : `
              <button class="btn-recruit" onclick="app.setCollega('${col.id}')">
                + Schiera Collega
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  addDocente(id) {
    if (this.isUserTeamConfirmed()) return;
    if (this.selectedDocenti.length >= 4) {
      this.showToast("⚠️ Puoi avere al massimo 4 docenti!", "danger");
      return;
    }
    if (!this.selectedDocenti.includes(id)) {
      this.selectedDocenti.push(id);
      this.playSound('coin');
      this.renderBuilder();
    }
  }

  removeDocente(id) {
    if (this.isUserTeamConfirmed()) return;
    this.selectedDocenti = this.selectedDocenti.filter(d => d !== id);
    this.playSound('click');
    this.renderBuilder();
  }

  setCollega(id) {
    if (this.isUserTeamConfirmed()) return;
    const col = COLLEGHI.find(c => c.id === id);
    if (!col) return;

    if (col.nome.toLowerCase() === this.currentUser.username.toLowerCase()) {
      this.playSound('glitch');
      this.showToast("🚫 Regola di Auto-Esclusione: Non puoi selezionare te stesso come Collega!", "danger");
      return;
    }

    this.selectedCollega = id;
    this.playSound('coin');
    this.renderBuilder();
  }

  removeCollega() {
    if (this.isUserTeamConfirmed()) return;
    this.selectedCollega = null;
    this.playSound('click');
    this.renderBuilder();
  }

  confirmSquad() {
    if (this.isUserTeamConfirmed()) return;

    const { spent, isValidBudget } = this.calculateCFA();
    if (this.selectedDocenti.length !== 4 || !this.selectedCollega) {
      this.showToast("⚠️ Devi selezionare esattamente 4 Docenti e 1 Collega!", "danger");
      return;
    }
    if (!isValidBudget) {
      this.showToast("⛔ Budget superato! Hai speso più di 100 CFA.", "danger");
      return;
    }

    // Modal di conferma personalizzato (sostituisce confirm() che è bloccato su iOS/Safari)
    this.showConfirmModal(
      "🔒 Conferma Squadra",
      `Sei sicuro di voler confermare la tua squadra con <strong>${spent} CFA</strong>?<br><br>
      ⚠️ Una volta confermata sarà <strong>bloccata definitivamente</strong> e non potrai più modificarla!`,
      () => this._doConfirmSquad(spent)
    );
  }

  _doConfirmSquad(spent) {
    const teams = this.getData('fanta_teams') || {};

    // Merge con i default per garantire che tutti i campi esistano
    // (i dati Firebase potrebbero mancare di puntiBase/puntiStorico se re-inseriti manualmente)
    const existingTeam = teams[this.currentUser.username] || {};
    const myTeam = {
      confirmed: false,
      puntiBase: 0,
      puntiStorico: [],
      docenti: [],
      collega: null,
      cfaSpesi: 0,
      ...existingTeam
    };

    // Assicura che puntiStorico sia sempre un array (sicurezza extra)
    if (!Array.isArray(myTeam.puntiStorico)) myTeam.puntiStorico = [];
    if (typeof myTeam.puntiBase !== 'number') myTeam.puntiBase = 0;

    const selectedCollegaObj = COLLEGHI.find(c => c.id === this.selectedCollega);
    if (!selectedCollegaObj) {
      this.showToast("⚠️ Errore: collega non trovato. Riprova.", "danger");
      return;
    }

    myTeam.confirmed = true;
    myTeam.docenti = [...this.selectedDocenti];
    myTeam.collega = this.selectedCollega;
    myTeam.cfaSpesi = spent;

    myTeam.puntiBase = 0;

    // Trigger automatici
    if (selectedCollegaObj.nome === "Kiril" || selectedCollegaObj.nome === "Nicole") {
      myTeam.puntiStorico.push({
        data: new Date().toLocaleDateString('it-IT'),
        motivo: `🎖️ Bonus Coraggio: Schierato ${selectedCollegaObj.nome}`,
        pt: 20
      });
      this.showToast(`🎖️ Sorpresa! Accredito Coraggio: +20 pt per aver schierato ${selectedCollegaObj.nome}!`, 'bonus');
    }

    if (selectedCollegaObj.nome === "Martina") {
      myTeam.puntiStorico.push({
        data: new Date().toLocaleDateString('it-IT'),
        motivo: `👑 Mascotte Martina: +100 pt automatici e sblocco Soffiate dal Master`,
        pt: 100
      });
      this.showToast(`👑 Sorpresa! Benedizione Master: +100 pt e sblocco esclusivo delle Soffiate dal Master!`, 'bonus');
    }

    teams[this.currentUser.username] = myTeam;
    this.saveData('fanta_teams', teams);

    this.playSound('success');
    this.fireConfetti();
    this.showToast("🎉 Squadra confermata e sigillata con successo! Ora hai accesso a Classifica, Bacheca e Secret Rules!", "success");

    this.render();
  }


  showConfirmModal(title, message, onConfirm) {
    // Rimuove eventuali modal precedenti
    const existing = document.getElementById('customConfirmModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'customConfirmModal';
    modal.style.cssText = `
      position: fixed; inset: 0; z-index: 99998;
      background: rgba(0,0,0,0.75); display: flex;
      align-items: center; justify-content: center; padding: 20px;
    `;
    modal.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #1a1f35 0%, #0e1423 100%);
        border: 1px solid rgba(251,191,36,0.3);
        border-radius: 16px; padding: 28px 24px;
        max-width: 420px; width: 100%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.6);
        text-align: center;
      ">
        <div style="font-size: 2rem; margin-bottom: 12px;">🔒</div>
        <h3 style="color: #fbbf24; margin: 0 0 14px; font-size: 1.1rem;">${title}</h3>
        <p style="color: #cbd5e1; font-size: 0.92rem; line-height: 1.6; margin: 0 0 24px;">${message}</p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="confirmModalCancel" style="
            flex: 1; padding: 12px; border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.15);
            background: rgba(255,255,255,0.05); color: #94a3b8;
            font-size: 0.9rem; cursor: pointer; font-weight: 600;
          ">❌ Annulla</button>
          <button id="confirmModalOk" style="
            flex: 1; padding: 12px; border-radius: 8px;
            border: 1px solid rgba(251,191,36,0.4);
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: #000; font-size: 0.9rem; cursor: pointer; font-weight: 700;
          ">✅ Conferma</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('confirmModalOk').onclick = () => {
      modal.remove();
      onConfirm();
    };
    document.getElementById('confirmModalCancel').onclick = () => modal.remove();
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }


  fireConfetti() {
    const conf = document.createElement('div');
    conf.style.position = 'fixed';
    conf.style.inset = '0';
    conf.style.pointerEvents = 'none';
    conf.style.zIndex = '99999';
    conf.innerHTML = `
      <div style="position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%); font-size: 5rem; animation: pulseRotate 1s ease forwards;">
        🎊 ⚽ 🏆 🔒
      </div>
    `;
    document.body.appendChild(conf);
    setTimeout(() => conf.remove(), 1800);
  }

  // --- SECTION: EVENTO SPECIALE (HALLOWEEN 2026 - MODULARE) ---
  renderEvent() {
    const container = document.getElementById('eventSectionContent');
    if (!container) return;

    const event = typeof CURRENT_EVENT !== 'undefined' ? CURRENT_EVENT : null;
    if (!event || !event.active) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px 24px; border: 1px solid rgba(255,255,255,0.08); background: linear-gradient(135deg, rgba(20,16,38,0.9), rgba(12,9,25,0.95)); border-radius: 20px;">
          <div style="font-size: 3.5rem; margin-bottom: 14px;">🎪🔒</div>
          <h2 style="color: #fff; font-size: 1.55rem; font-weight: 800; margin-bottom: 8px;">Sezione Evento Momentaneamente Chiusa</h2>
          <div style="display: inline-block; padding: 4px 14px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 20px; color: #fbbf24; font-size: 0.85rem; font-weight: 700; margin-bottom: 16px;">
            🎃 Evento Halloween 2026 Concluso
          </div>
          <p style="color: var(--text-muted); max-width: 520px; margin: 0 auto 22px; font-size: 0.95rem; line-height: 1.6;">
            L'evento speciale di Halloween del 30 e 31 Ottobre si è concluso con successo e tutti i bonus e malus sono stati conteggiati nella classifica generale.<br>
            Questa sezione si riaprirà in occasione del prossimo evento a sorpresa annunciato dal Master!
          </p>
          <button type="button" class="btn-confirm-squad" style="width: auto; margin: 0 auto; padding: 10px 24px;" onclick="app.switchTab('classifica')">
            🏆 Vai alla Classifica Live
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <!-- Event Hero Banner -->
      <div class="event-hero">
        <div class="event-hero-badge">${event.badge}</div>
        <h2 class="event-hero-title">
          <span>🎃</span>
          <span>${event.titolo}</span>
          <span style="font-size: 1.05rem; color: #fbbf24; font-weight: 700;">(${event.dateLabel})</span>
        </h2>
        <p class="event-hero-desc">
          ${event.intro}
        </p>
      </div>

      <!-- Regola Speciale per Squadra: Thriller -->
      <div class="event-special-team-card">
        <div style="display: flex; align-items: flex-start; gap: 14px; flex-wrap: wrap;">
          <span style="font-size: 2.8rem; line-height: 1;">${event.specialTeam.icon}</span>
          <div style="flex: 1; min-width: 240px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 6px; flex-wrap: wrap;">
              <h3 style="font-size: 1.2rem; color: #fbbf24; font-weight: 800; display: flex; align-items: center; gap: 8px;">
                <span>🎵</span> Regola Speciale Squadra: ${event.specialTeam.nome}
              </h3>
              <span class="event-rule-badge-bonus" style="font-size: 0.92rem; background: rgba(245, 158, 11, 0.2); border-color: rgba(245, 158, 11, 0.6); color: #fbbf24;">
                +${event.specialTeam.pt} pt a ciascuna squadra presente
              </span>
            </div>
            <p style="color: #fde68a; font-size: 0.92rem; line-height: 1.5;">
              ${event.specialTeam.desc}
            </p>
          </div>
        </div>
      </div>

      <!-- Sezione Bonus Collega -->
      <div style="margin-bottom: 28px;">
        <h3 style="color: #34d399; font-size: 1.3rem; font-weight: 800; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
          <span>🎖️</span> Bonus Collega (${event.bonus.length} Azioni)
        </h3>
        <p style="color: var(--text-muted); font-size: 0.86rem; margin-bottom: 16px;">
          I punti bonus conseguiti dal collega al Madween o durante la festa vengono accreditati a tutte le squadre che lo hanno schierato compagno di banco!
        </p>
        <div class="event-rules-grid">
          ${event.bonus.map(b => `
            <div class="event-rule-card bonus">
              <div class="event-rule-card-top">
                <span class="event-rule-name">
                  <span>${b.icon}</span>
                  <span>${b.nome}</span>
                </span>
                <span class="event-rule-badge-bonus">+${b.pt} pt</span>
              </div>
              <p class="event-rule-desc">${b.desc}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Sezione Malus Collega -->
      <div style="margin-bottom: 28px;">
        <h3 style="color: #f87171; font-size: 1.3rem; font-weight: 800; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
          <span>💀</span> Malus Collega (${event.malus.length} Penalità)
        </h3>
        <p style="color: var(--text-muted); font-size: 0.86rem; margin-bottom: 16px;">
          Se il collega incorre in una di queste situazioni, i punti di penalità verranno sottratti da tutte le squadre che lo hanno in formazione.
        </p>
        <div class="event-rules-grid">
          ${event.malus.map(m => `
            <div class="event-rule-card malus">
              <div class="event-rule-card-top">
                <span class="event-rule-name">
                  <span>${m.icon}</span>
                  <span>${m.nome}</span>
                </span>
                <span class="event-rule-badge-malus">${m.pt} pt</span>
              </div>
              <p class="event-rule-desc">${m.desc}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // --- SECTION: SECRET RULES ---
  renderSecretRules() {
    const container = document.getElementById('secretRulesList');
    if (!container) return;

    const isConfirmed = this.isUserTeamConfirmed();
    const isMaster = this.currentUser && this.currentUser.role === 'master';
    const teams = this.getData('fanta_teams') || {};
    const myTeam = teams[this.currentUser?.username];
    const myCollegaId = myTeam?.collega;

    container.innerHTML = COLLEGHI.map(col => {
      const isDeployedInMyTeam = isConfirmed && (col.id === myCollegaId);
      const isUnlocked = isDeployedInMyTeam || isMaster;

      return `
        <div class="secret-card ${isUnlocked ? 'unlocked' : 'locked'}">
          <div class="secret-header">
            <div class="secret-collega-info">
              <span class="secret-collega-avatar">${col.avatar}</span>
              <div>
                <h3 class="secret-collega-name">${col.nome}</h3>
                <span style="font-size: 0.72rem; color: var(--text-dark);">${col.fascia} (${col.costoCFA} CFA)</span>
              </div>
            </div>
            <div>
              ${isUnlocked ? `
                <span class="secret-status-tag status-unlocked">
                  ${isDeployedInMyTeam ? '🔓 Sbloccata in Squadra' : '👑 Master Preview'}
                </span>
              ` : `
                <span class="secret-status-tag status-locked">
                  🔒 Top Secret
                </span>
              `}
            </div>
          </div>

          ${isUnlocked ? `
            <div class="unlocked-rules-list">
              ${col.secretRules.map(rule => `
                <div class="rule-item">
                  <span class="rule-pts ${rule.tipo}">
                    ${rule.pt > 0 ? '+' + rule.pt : rule.pt} pt
                  </span>
                  <div class="rule-desc">${rule.desc}</div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="cipher-box">
              <div class="cipher-redacted">
                ████████████████████████████████████████████████
              </div>
              <div class="cipher-hint">
                🔒 Regola criptata! Schiera <strong>${col.nome}</strong> e conferma definitivamente la tua squadra per decrittare questa regola segreta.
              </div>
            </div>
          `}
        </div>
      `;
    }).join('');
  }

  // --- SECTION: SOFFIATE DAL MASTER ---
  renderMasterTips() {
    const container = document.getElementById('masterTipsList');
    const lockedMsg = document.getElementById('masterTipsLockedMsg');
    if (!container || !lockedMsg) return;

    const isConfirmed = this.isUserTeamConfirmed();
    const teams = this.getData('fanta_teams') || {};
    const myTeam = teams[this.currentUser?.username];
    const hasMartina = isConfirmed && (myTeam?.collega === 'collega-martina');
    const isMaster = this.currentUser && this.currentUser.role === 'master';

    if (hasMartina || isMaster) {
      lockedMsg.style.display = 'none';
      container.style.display = 'block';

      const tips = this.getData('fanta_tips') || [];
      container.innerHTML = tips.map(tip => `
        <div class="card" style="margin-bottom: 16px; border-left: 4px solid #fbbf24; background: linear-gradient(135deg, rgba(30, 27, 75, 0.7), rgba(15, 23, 42, 0.85));">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 0.75rem; font-weight: 800; color: #fbbf24; text-transform: uppercase;">
              👑 CANALE RISERVATO MASTER
            </span>
            <span style="font-size: 0.75rem; color: var(--text-dark); font-family: 'JetBrains Mono', monospace;">
              ${tip.data}
            </span>
          </div>
          <h3 style="font-size: 1.1rem; color: #fff; margin-bottom: 6px;">${tip.titolo}</h3>
          <p style="color: var(--text-muted); font-size: 0.92rem; line-height: 1.5;">${tip.testo}</p>
        </div>
      `).join('');
    } else {
      lockedMsg.style.display = 'block';
      container.style.display = 'none';
    }
  }

  // --- SECTION: CATALOGO PERSONAGGI & CFA (CON LE DESCRIZIONI ORIGINALI ESATTE) ---
  renderCatalog() {
    // 1. Rendering Docenti suddivisi per le 5 fasce di costo esatte
    const docentiCatalogContainer = document.getElementById('catalogDocentiList');
    if (docentiCatalogContainer) {
      const tiers = [
        { name: "Molto Costosi (30 CFA)", color: "#ef4444", list: DOCENTI.filter(d => d.costoCFA === 30) },
        { name: "Costosi (22 CFA)", color: "#f59e0b", list: DOCENTI.filter(d => d.costoCFA === 22) },
        { name: "Medi (15 CFA)", color: "#3b82f6", list: DOCENTI.filter(d => d.costoCFA === 15) },
        { name: "Poco Costosi (10 CFA)", color: "#10b981", list: DOCENTI.filter(d => d.costoCFA === 10) },
        { name: "Occasione (5 CFA)", color: "#8b5cf6", list: DOCENTI.filter(d => d.costoCFA === 5) }
      ];

      docentiCatalogContainer.innerHTML = tiers.map(t => `
        <div style="margin-bottom: 24px;">
          <h4 style="color: ${t.color}; font-size: 1.15rem; font-weight: 800; margin-bottom: 12px; border-left: 4px solid ${t.color}; padding-left: 10px;">
            ${t.name}
          </h4>
          <div class="grid-4">
            ${t.list.map(doc => `
              <div class="character-card">
                <div class="char-top">
                  <div class="char-avatar-box">${doc.avatar}</div>
                  <div class="char-badge-cost">
                    <span class="cost-tag">${doc.costoCFA} CFA</span>
                    <span class="tier-label">${doc.fascia}</span>
                  </div>
                </div>
                <h4 class="char-name">${doc.nome}</h4>
                <p class="char-bio">${doc.bio}</p>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
    }

    // 2. Rendering Colleghi (senza spoiler dei bonus segreti)
    const colleghiCatalogContainer = document.getElementById('catalogColleghiList');
    if (colleghiCatalogContainer) {
      colleghiCatalogContainer.innerHTML = COLLEGHI.map(col => `
        <div class="character-card">
          <div class="char-top">
            <div class="char-avatar-box">${col.avatar}</div>
            <div class="char-badge-cost">
              <span class="cost-tag">${col.costoCFA} CFA</span>
              <span class="tier-label">${col.fascia}</span>
            </div>
          </div>
          <h4 class="char-name">${col.nome}</h4>
        </div>
      `).join('');
    }

    // 3. Regolamento Eventi
    const attContainer = document.getElementById('regolamentoAttivitaList');
    if (attContainer) {
      attContainer.innerHTML = EVENTI_CATALOGO.attivita.map(e => `
        <div class="rule-item" style="margin-bottom: 8px; justify-content: space-between;">
          <div>
            <strong>${e.nome}</strong>: <span style="color: var(--text-muted); font-size: 0.85rem;">${e.desc}</span>
          </div>
          <span class="rule-pts bonus" style="margin-left: 10px;">+${e.pt} pt</span>
        </div>
      `).join('');
    }

    const campusContainer = document.getElementById('regolamentoCampusList');
    if (campusContainer) {
      campusContainer.innerHTML = EVENTI_CATALOGO.campus.map(e => `
        <div class="rule-item" style="margin-bottom: 8px; justify-content: space-between;">
          <div>
            <strong>${e.nome}</strong>: <span style="color: var(--text-muted); font-size: 0.85rem;">${e.desc}</span>
          </div>
          <span class="rule-pts ${e.pt > 0 ? 'bonus' : 'malus'}" style="margin-left: 10px;">
            ${e.pt > 0 ? '+' + e.pt : e.pt} pt
          </span>
        </div>
      `).join('');
    }

    const docSpecificContainer = document.getElementById('regolamentoDocentiSpecifici');
    if (docSpecificContainer) {
      docSpecificContainer.innerHTML = DOCENTI.map(d => `
        <div class="card" style="margin-bottom: 12px; padding: 14px 18px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <span style="font-size: 1.4rem;">${d.avatar}</span>
            <strong style="color: #fff; font-size: 1rem;">${d.nome}</strong>
            <span style="font-size: 0.72rem; color: #fbbf24; font-family: 'JetBrains Mono', monospace;">${d.costoCFA} CFA</span>
          </div>
          <div>
            ${d.specificEvents.map(se => `
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; margin-top: 4px; padding: 4px 0; border-top: 1px solid rgba(255,255,255,0.04);">
                <span style="color: var(--text-muted);">${se.desc}</span>
                <span class="rule-pts bonus" style="margin-left: 8px;">+${se.pt} pt</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
    }
  }

  // --- SECTION: LEADERBOARD (CLASSIFICA) ---
  renderLeaderboard() {
    const tbody = document.getElementById('leaderboardBody');
    if (!tbody) return;

    const users = this.getData('fanta_users') || INITIAL_USERS;
    const teams = this.getData('fanta_teams') || {};

    const ranks = users.map(u => {
      const team = teams[u.username] || {
        confirmed: false,
        docenti: [],
        collega: null,
        cfaSpesi: 0,
        puntiBase: 0,
        puntiStorico: []
      };

      const totalPoints = (team.puntiStorico || []).reduce((acc, h) => acc + (h.pt || 0), team.puntiBase || 0);

      return {
        username: u.username,
        avatar: u.avatar,
        role: u.role,
        team,
        totalPoints
      };
    });

    ranks.sort((a, b) => b.totalPoints - a.totalPoints);

    tbody.innerHTML = ranks.map((item, idx) => {
      let rankBadgeClass = 'rank-other';
      if (idx === 0) rankBadgeClass = 'rank-1';
      else if (idx === 1) rankBadgeClass = 'rank-2';
      else if (idx === 2) rankBadgeClass = 'rank-3';

      const isCurrent = this.currentUser && (item.username === this.currentUser.username);

      let squadPills = '';
      if (item.team.confirmed) {
        const docPills = (item.team.docenti || []).map(docId => {
          const d = DOCENTI.find(x => x.id === docId);
          return d ? `<span class="char-tiny-pill">${d.avatar} ${d.nome}</span>` : '';
        }).join('');

        const colObj = COLLEGHI.find(x => x.id === item.team.collega);
        const colPill = colObj ? `<span class="char-tiny-pill collega-pill">${colObj.avatar} ${colObj.nome}</span>` : '';

        squadPills = `<div class="team-pill-list">${docPills} ${colPill}</div>`;
      } else {
        squadPills = `<span style="font-size: 0.8rem; color: var(--text-dark); font-style: italic;">Squadra non ancora confermata</span>`;
      }

      return `
        <tr style="${isCurrent ? 'background: rgba(139, 92, 246, 0.12);' : ''}">
          <td style="width: 50px;">
            <div class="rank-badge ${rankBadgeClass}">${idx + 1}</div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${this.getUserAvatarHtml(item.username, '28px', '1.3rem')}
              <div>
                <strong style="color: #fff;">${item.username}</strong>
                ${item.role === 'master' ? '<span class="user-badge-role role-master" style="margin-left: 6px;">MASTER</span>' : ''}
                ${isCurrent ? '<span style="font-size: 0.7rem; color: #67e8f9; margin-left: 4px;">(TU)</span>' : ''}
              </div>
            </div>
          </td>
          <td>${squadPills}</td>
          <td style="font-family: 'JetBrains Mono', monospace; font-size: 0.88rem; color: #fbbf24;">
            ${item.team.confirmed ? item.team.cfaSpesi + ' CFA' : '-'}
          </td>
          <td class="points-cell">${item.totalPoints} pt</td>
          <td>
            <button class="btn-recruit" style="padding: 4px 10px; font-size: 0.75rem;" onclick="app.inspectCoach('${item.username}')">
              Dettagli
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  inspectCoach(username) {
    const users = this.getData('fanta_users') || INITIAL_USERS;
    const teams = this.getData('fanta_teams') || {};
    const user = users.find(u => u.username === username);
    const team = teams[username];

    if (!user || !team) return;

    const modalBody = document.getElementById('coachDetailsModalBody');
    if (!modalBody) return;

    let docentiHtml = '';
    (team.docenti || []).forEach(docId => {
      const d = DOCENTI.find(x => x.id === docId);
      if (d) {
        docentiHtml += `
          <div style="background: rgba(10, 15, 28, 0.6); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); display: flex; align-items: center; gap: 8px;">
            <span>${d.avatar}</span>
            <strong>${d.nome}</strong>
            <span style="margin-left: auto; color: #fbbf24; font-family: 'JetBrains Mono'; font-size: 0.8rem;">${d.costoCFA} CFA</span>
          </div>
        `;
      }
    });

    const colObj = COLLEGHI.find(x => x.id === team.collega);

    let historyHtml = (team.puntiStorico || []).map(h => `
      <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <div>
          <span style="color: var(--text-dark); font-family: 'JetBrains Mono'; font-size: 0.75rem;">[${h.data}]</span>
          <span style="color: #fff; margin-left: 6px;">${h.motivo}</span>
        </div>
        <strong style="color: ${h.pt >= 0 ? '#34d399' : '#ef4444'}; font-family: 'JetBrains Mono';">
          ${h.pt >= 0 ? '+' + h.pt : h.pt} pt
        </strong>
      </div>
    `).join('') || '<p style="color: var(--text-muted); font-size: 0.85rem;">Nessun evento ancora registrato.</p>';

    const totalPts = (team.puntiStorico || []).reduce((acc, h) => acc + (h.pt || 0), team.puntiBase || 0);

    modalBody.innerHTML = `
      <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 20px;">
        ${this.getUserAvatarHtml(user.username, '64px', '3rem')}
        <div>
          <h2 style="color: #fff; font-size: 1.4rem;">Squadra di ${user.username}</h2>
          <p style="color: var(--text-muted); font-size: 0.85rem;">${user.bio}</p>
        </div>
        <div style="margin-left: auto; text-align: right;">
          <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-dark);">Punteggio</div>
          <div style="font-family: 'JetBrains Mono'; font-size: 1.6rem; font-weight: 800; color: #34d399;">${totalPts} pt</div>
        </div>
      </div>

      <h4 style="font-size: 0.95rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px;">Docenti Schierati</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin-bottom: 18px;">
        ${docentiHtml || '<p style="color: var(--text-muted);">Nessun docente schierato</p>'}
      </div>

      <h4 style="font-size: 0.95rem; text-transform: uppercase; color: #fbbf24; margin-bottom: 10px;">Collega Schierato</h4>
      ${colObj ? `
        <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.4); padding: 10px 14px; border-radius: 8px; display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <span style="font-size: 1.5rem;">${colObj.avatar}</span>
          <div>
            <strong style="color: #fff;">${colObj.nome}</strong>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${colObj.bio}</div>
          </div>
          <span style="margin-left: auto; color: #fbbf24; font-family: 'JetBrains Mono'; font-weight: 800;">${colObj.costoCFA} CFA</span>
        </div>
      ` : '<p style="color: var(--text-muted); margin-bottom: 20px;">Nessun collega</p>'}

      <h4 style="font-size: 0.95rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px;">Storico Eventi & Punti</h4>
      <div style="max-height: 180px; overflow-y: auto; background: rgba(9, 13, 24, 0.6); padding: 12px; border-radius: 8px;">
        ${historyHtml}
      </div>
    `;

    this.openModal('coachDetailsModal');
  }

  // --- SECTION: SOCIAL FEED (SEGNALAZIONI) ---
  renderSocialFeed() {
    const container = document.getElementById('socialReportsList');
    if (!container) return;

    const reports = this.getData('fanta_reports') || [];

    if (reports.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px 20px;">
          <div style="font-size: 2.5rem; margin-bottom: 10px;">📸</div>
          <h4 style="color: #fff; font-size: 1.15rem; margin-bottom: 6px;">Bacheca Social Pulita</h4>
          <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 480px; margin: 0 auto 18px auto;">
            Non ci sono ancora segnalazioni inviate. Sii il primo a documentare una gaffe, un meme o un evento accademico!
          </p>
          <button class="btn-confirm-squad" style="width: auto; margin: 0 auto; padding: 10px 20px;" onclick="app.openModal('newReportModal')">
            + Invia la Prima Segnalazione
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = reports.map(r => {
      const myVote = (r.voters && this.currentUser && r.voters[this.currentUser.username]) || 0;
      let statusBadge = '';
      if (r.stato === 'approvata') {
        statusBadge = `<span class="secret-status-tag status-unlocked">✓ Approvata (+${r.punti}pt)</span>`;
      } else if (r.stato === 'rifiutata') {
        statusBadge = `<span class="secret-status-tag status-locked">✕ Rifiutata</span>`;
      } else {
        statusBadge = `<span class="secret-status-tag" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);">⏳ In attesa Master</span>`;
      }

      return `
        <div class="report-card">
          <div class="report-header">
            <div class="report-author-box">
              ${this.getUserAvatarHtml(r.autore, '32px', '1.4rem')}
              <div>
                <strong style="color: #fff; font-size: 0.95rem;">${r.autore}</strong>
                <div style="font-size: 0.75rem; color: var(--text-dark);">${r.data}</div>
              </div>
            </div>
            <div>${statusBadge}</div>
          </div>

          <h3 class="report-title">${this.escapeHtml(r.titolo)}</h3>
          <p class="report-desc">${this.escapeHtml(r.descrizione)}</p>

          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px;">
            <span class="char-tiny-pill" style="background: rgba(6, 182, 212, 0.15); border-color: rgba(6, 182, 212, 0.4); color: #67e8f9;">
              🎯 Personaggi: ${this.escapeHtml(r.personaggiNomi || r.personaggioNome)}
            </span>
            <span class="char-tiny-pill" style="background: rgba(245, 158, 11, 0.15); border-color: rgba(245, 158, 11, 0.4); color: #fbbf24;">
              🏆 Categoria: ${this.escapeHtml(r.categoria)}
            </span>
            <span class="char-tiny-pill" style="background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.4); color: #34d399;">
              ${r.punti >= 0 ? '+' + r.punti : r.punti} pt
            </span>
          </div>

          ${r.foto ? `
            <img src="${r.foto}" alt="Prova Segnalazione" class="report-media-preview" onerror="this.style.display='none'" />
          ` : ''}

          <div class="report-footer">
            <div class="vote-controls">
              <button class="btn-vote ${myVote === 1 ? 'active-up' : ''}" onclick="app.voteReport('${r.id}', 1)">
                ▲ Upvote <strong>${r.upvotes || 0}</strong>
              </button>
              <button class="btn-vote ${myVote === -1 ? 'active-down' : ''}" onclick="app.voteReport('${r.id}', -1)">
                ▼ Downvote <strong>${r.downvotes || 0}</strong>
              </button>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-dark);">
              ID: #${r.id}
            </div>
          </div>

          <!-- SEZIONE COMMENTI & PROPOSTE PUNTEGGI -->
          <div class="report-comments-section">
            <div class="comments-list" id="comments-${r.id}">
              ${(r.commenti || []).map(c => `
                <div class="comment-item">
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span class="comment-author">${this.getUserAvatarHtml(c.autore, '16px', '0.85rem')} ${this.escapeHtml(c.autore)}</span>
                    <span class="comment-date">${c.data}</span>
                  </div>
                  <div class="comment-text">${this.escapeHtml(c.testo)}</div>
                </div>
              `).join('')}
              ${(!r.commenti || r.commenti.length === 0) ? '<p class="no-comments">Nessun commento ancora. Sii il primo a commentare o proporre un punteggio diverso!</p>' : ''}
            </div>
            <div class="comment-input-row">
              <input type="text" class="comment-input" id="commentInput-${r.id}" placeholder="Scrivi un commento o proponi un punteggio..." maxlength="200" onkeypress="if(event.key==='Enter') app.addComment('${r.id}')">
              <button class="btn-comment-send" onclick="app.addComment('${r.id}')" type="button">💬 Invia</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  addComment(reportId) {
    if (!this.currentUser) {
      this.showToast("Accedi per inviare commenti!", "danger");
      return;
    }
    const input = document.getElementById(`commentInput-${reportId}`);
    if (!input) return;
    const testo = input.value.trim();
    if (!testo) return;

    const reports = this.getData('fanta_reports') || [];
    const rep = reports.find(r => r.id === reportId);
    if (!rep) return;

    if (!Array.isArray(rep.commenti)) rep.commenti = [];
    rep.commenti.push({
      id: 'c-' + Date.now(),
      autore: this.currentUser.username,
      testo,
      data: new Date().toLocaleDateString('it-IT') + ' ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    });

    this.saveData('fanta_reports', reports);
    this._prevReportsSnapshot = JSON.parse(JSON.stringify(reports));
    input.value = '';
    this.playSound('coin');
    this.showToast("💬 Commento pubblicato!", "info");
    this.renderSocialFeed();
  }

  voteReport(reportId, voteVal) {
    if (!this.currentUser) return;
    const reports = this.getData('fanta_reports') || [];
    const rep = reports.find(r => r.id === reportId);
    if (!rep) return;

    if (!rep.voters) rep.voters = {};
    const prevVote = rep.voters[this.currentUser.username] || 0;

    if (prevVote === voteVal) {
      if (voteVal === 1) rep.upvotes = Math.max(0, (rep.upvotes || 1) - 1);
      if (voteVal === -1) rep.downvotes = Math.max(0, (rep.downvotes || 1) - 1);
      delete rep.voters[this.currentUser.username];
    } else {
      if (prevVote === 1) rep.upvotes = Math.max(0, (rep.upvotes || 1) - 1);
      if (prevVote === -1) rep.downvotes = Math.max(0, (rep.downvotes || 1) - 1);

      if (voteVal === 1) rep.upvotes = (rep.upvotes || 0) + 1;
      if (voteVal === -1) rep.downvotes = (rep.downvotes || 0) + 1;

      rep.voters[this.currentUser.username] = voteVal;
    }

    this.saveData('fanta_reports', reports);
    this.playSound('click');
    this.renderSocialFeed();
  }

  // --- SECTION: MASTER DASHBOARD & 1-CLICK LIVE SCORING ENGINE ---
  renderMasterDashboard() {
    if (!this.currentUser || this.currentUser.role !== 'master') return;

    const reports = this.getData('fanta_reports') || [];
    const pendingReports = reports.filter(r => r.stato === 'in_attesa');
    const container = document.getElementById('masterPendingReportsList');

    if (container) {
      if (pendingReports.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">Nessuna segnalazione in attesa di approvazione.</p>`;
      } else {
        container.innerHTML = pendingReports.map(r => `
          <div class="card" style="margin-bottom: 14px; border: 1.5px solid rgba(245, 158, 11, 0.4);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px;">
              <div>
                <strong style="color: #fff; font-size: 1.05rem;">${r.titolo}</strong>
                <div style="font-size: 0.78rem; color: var(--text-muted);">
                  Inviata da <strong>${r.autore}</strong> il ${r.data} • Personaggio/i: <strong>${r.personaggiNomi || r.personaggioNome}</strong>
                </div>
              </div>
              <span class="cost-tag" style="color: #34d399; border-color: #34d399;">
                ${r.punti >= 0 ? '+' + r.punti : r.punti} pt
              </span>
            </div>
            <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 12px;">${r.descrizione}</p>
            ${r.foto ? `<img src="${r.foto}" style="max-height: 180px; border-radius: 8px; margin-bottom: 12px;" />` : ''}

            <!-- Modifica Punti Master -->
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 8px;">
              <label style="color: #fbbf24; font-size: 0.82rem; font-weight: 700; white-space: nowrap;">✏️ Modifica Punti Master:</label>
              <input type="number" id="masterPtEdit-${r.id}" value="${r.punti}" class="form-control" style="width: 100px; padding: 6px 10px; font-weight: 700;">
              <span style="font-size: 0.75rem; color: var(--text-muted);">(Sovrascrive i pt proposti prima di approvare)</span>
            </div>

            <div class="master-action-row">
              <button class="btn-master-approve" onclick="app.approveReport('${r.id}')">
                ✓ Approva e Assegna Punti Automatici
              </button>
              <button class="btn-master-reject" onclick="app.rejectReport('${r.id}')">
                ✕ Rifiuta Segnalazione
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    this.renderMasterHalloweenPanel();
    this.renderMasterLiveScoring();
    this.renderMasterUnlockControls();
  }

  // --- SECTION: PANNELLO MASTER SPECIALE EVENTO HALLOWEEN ---
  setHalloweenMode(mode) {
    this.halloweenScoringMode = mode;
    this.renderMasterHalloweenPanel();
  }

  selectHalloweenCollega(collegaId) {
    this.halloweenSelectedCollegaId = collegaId;
    this.renderMasterHalloweenPanel();
  }

  toggleHalloweenMultiCollega(collegaId) {
    const idx = this.halloweenMultiSelectedColleghiIds.indexOf(collegaId);
    if (idx >= 0) {
      this.halloweenMultiSelectedColleghiIds.splice(idx, 1);
    } else {
      this.halloweenMultiSelectedColleghiIds.push(collegaId);
    }
    this.renderMasterHalloweenPanel();
  }

  selectAllHalloweenMulti() {
    this.halloweenMultiSelectedColleghiIds = COLLEGHI.map(c => c.id);
    this.renderMasterHalloweenPanel();
  }

  deselectAllHalloweenMulti() {
    this.halloweenMultiSelectedColleghiIds = [];
    this.renderMasterHalloweenPanel();
  }

  toggleHalloweenThrillerCoach(username) {
    const idx = this.halloweenThrillerSelectedCoaches.indexOf(username);
    if (idx >= 0) {
      this.halloweenThrillerSelectedCoaches.splice(idx, 1);
    } else {
      this.halloweenThrillerSelectedCoaches.push(username);
    }
    this.renderMasterHalloweenPanel();
  }

  selectAllHalloweenThrillerCoaches() {
    const users = (this.getData('fanta_users') || INITIAL_USERS).map(u => u.username);
    this.halloweenThrillerSelectedCoaches = [...users];
    this.renderMasterHalloweenPanel();
  }

  deselectAllHalloweenThrillerCoaches() {
    this.halloweenThrillerSelectedCoaches = [];
    this.renderMasterHalloweenPanel();
  }

  assignHalloweenPoints(charId, ruleId) {
    if (!this.currentUser || this.currentUser.role !== 'master') return;
    const event = typeof CURRENT_EVENT !== 'undefined' ? CURRENT_EVENT : null;
    if (!event) return;

    const allRules = [...event.bonus, ...event.malus];
    const rule = allRules.find(r => r.id === ruleId);
    const charObj = COLLEGHI.find(c => c.id === charId);
    if (!rule || !charObj) return;

    const teams = this.getData('fanta_teams') || {};
    const impactedCoaches = [];

    Object.entries(teams).forEach(([coachName, team]) => {
      if (team.confirmed && team.collega === charId) {
        if (!team.puntiStorico) team.puntiStorico = [];
        team.puntiStorico.push({
          data: new Date().toLocaleDateString('it-IT') + ' ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
          motivo: `🎃 [Halloween] ${charObj.nome}: ${rule.nome}`,
          pt: rule.pt
        });
        impactedCoaches.push(coachName);
      }
    });

    this.saveData('fanta_teams', teams);

    // Notifica automatica negli esiti della home
    const notices = this.getData('fanta_notices') || [];
    notices.unshift({
      id: 'notice-halloween-event-' + Date.now(),
      tipo: 'RISULTATO SEGNALAZIONE',
      icona: '🎃',
      badge: rule.pt >= 0 ? `+${rule.pt} pt Halloween` : `${rule.pt} pt Halloween`,
      titolo: `🎃 Evento Halloween: ${charObj.nome} — ${rule.nome}`,
      data: new Date().toLocaleDateString('it-IT'),
      testo: `Il Master ha convalidato "${rule.nome}" (${rule.desc}) per ${charObj.nome}. ${rule.pt >= 0 ? '+' : ''}${rule.pt} pt assegnati a tutte le squadre che lo schierano (${impactedCoaches.length > 0 ? impactedCoaches.join(', ') : 'Nessuna squadra'}).`
    });
    this.saveData('fanta_notices', notices);

    this.playSound(rule.pt >= 0 ? 'success' : 'glitch');
    this.showToast(`🎃 Evento assegnato a ${charObj.nome} (${rule.pt >= 0 ? '+' : ''}${rule.pt} pt)! Squadre coinvolte: ${impactedCoaches.length > 0 ? impactedCoaches.join(', ') : 'Nessuna'}`, 'success');
    this.render();
  }

  assignHalloweenPointsMulti(ruleId) {
    if (!this.currentUser || this.currentUser.role !== 'master') return;
    if (!this.halloweenMultiSelectedColleghiIds.length) {
      this.showToast("⚠️ Seleziona almeno un collega con la spunta!", "danger");
      return;
    }
    const event = typeof CURRENT_EVENT !== 'undefined' ? CURRENT_EVENT : null;
    if (!event) return;

    const allRules = [...event.bonus, ...event.malus];
    const rule = allRules.find(r => r.id === ruleId);
    if (!rule) return;

    const teams = this.getData('fanta_teams') || {};
    const impactedCoachesSet = new Set();
    const colleagueNames = [];

    this.halloweenMultiSelectedColleghiIds.forEach(charId => {
      const charObj = COLLEGHI.find(c => c.id === charId);
      if (!charObj) return;
      colleagueNames.push(charObj.nome);

      Object.entries(teams).forEach(([coachName, team]) => {
        if (team.confirmed && team.collega === charId) {
          if (!team.puntiStorico) team.puntiStorico = [];
          team.puntiStorico.push({
            data: new Date().toLocaleDateString('it-IT') + ' ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
            motivo: `🎃 [Halloween] ${charObj.nome}: ${rule.nome}`,
            pt: rule.pt
          });
          impactedCoachesSet.add(coachName);
        }
      });
    });

    this.saveData('fanta_teams', teams);

    const impactedCoaches = Array.from(impactedCoachesSet);
    const notices = this.getData('fanta_notices') || [];
    notices.unshift({
      id: 'notice-halloween-multi-' + Date.now(),
      tipo: 'RISULTATO SEGNALAZIONE',
      icona: '🎃',
      badge: rule.pt >= 0 ? `+${rule.pt} pt Halloween` : `${rule.pt} pt Halloween`,
      titolo: `🎃 Evento Halloween Multiplo: ${colleagueNames.join(', ')} — ${rule.nome}`,
      data: new Date().toLocaleDateString('it-IT'),
      testo: `Il Master ha convalidato "${rule.nome}" per: ${colleagueNames.join(', ')}. ${rule.pt >= 0 ? '+' : ''}${rule.pt} pt assegnati a tutte le squadre che li schierano (${impactedCoaches.length > 0 ? impactedCoaches.join(', ') : 'Nessuna squadra'}).`
    });
    this.saveData('fanta_notices', notices);

    this.playSound(rule.pt >= 0 ? 'success' : 'glitch');
    this.showToast(`🎃 Bonus/Malus '${rule.nome}' assegnato a ${colleagueNames.length} colleghi!`, 'success');
    this.render();
  }

  assignHalloweenThrillerTeamPoints() {
    if (!this.currentUser || this.currentUser.role !== 'master') return;
    if (!this.halloweenThrillerSelectedCoaches.length) {
      this.showToast("⚠️ Seleziona almeno un allenatore presente al Madween!", "danger");
      return;
    }

    const teams = this.getData('fanta_teams') || {};
    const selectedCoaches = [...this.halloweenThrillerSelectedCoaches];

    selectedCoaches.forEach(coachName => {
      if (!teams[coachName]) {
        teams[coachName] = { confirmed: false, puntiBase: 0, puntiStorico: [] };
      }
      if (!teams[coachName].puntiStorico) teams[coachName].puntiStorico = [];
      teams[coachName].puntiStorico.push({
        data: new Date().toLocaleDateString('it-IT') + ' ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        motivo: `🎃 [Halloween] Inizio Serata con Thriller di Michael Jackson (Squadra Presente)`,
        pt: 100
      });
    });

    this.saveData('fanta_teams', teams);

    const notices = this.getData('fanta_notices') || [];
    notices.unshift({
      id: 'notice-halloween-thriller-' + Date.now(),
      tipo: 'RISULTATO SEGNALAZIONE',
      icona: '🧟',
      badge: '+100 pt Squadra',
      titolo: `🧟 Speciale Thriller Michael Jackson: +100 pt alle squadre presenti!`,
      data: new Date().toLocaleDateString('it-IT'),
      testo: `La serata al Madween è iniziata con Thriller di Michael Jackson! Il Master ha accreditato +100 pt direttamente nelle squadre dei presenti: ${selectedCoaches.join(', ')}.`
    });
    this.saveData('fanta_notices', notices);
    this._prevNoticesSnapshot = JSON.parse(JSON.stringify(notices));

    this.playSound('success');
    this.showToast(`🧟 Thriller Michael Jackson convalidato! +100 pt accreditati alle squadre di: ${selectedCoaches.join(', ')}`, 'bonus');
    this.render();
  }

  renderMasterHalloweenPanel() {
    const container = document.getElementById('masterHalloweenSection');
    if (!container) return;

    const event = typeof CURRENT_EVENT !== 'undefined' ? CURRENT_EVENT : null;
    if (!event || !event.active) {
      container.innerHTML = '';
      return;
    }

    const teams = this.getData('fanta_teams') || {};
    const allCoaches = (this.getData('fanta_users') || INITIAL_USERS).map(u => u.username);

    // Per il collega singolo attualmente selezionato
    const currentChar = COLLEGHI.find(c => c.id === this.halloweenSelectedCollegaId) || COLLEGHI[0];
    const owners = [];
    Object.entries(teams).forEach(([cName, team]) => {
      if (team.confirmed && team.collega === currentChar.id) {
        owners.push(cName);
      }
    });

    container.innerHTML = `
      <div class="master-halloween-card">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 14px;">
          <div>
            <h3 style="color: #fb923c; font-size: 1.3rem; font-weight: 800; display: flex; align-items: center; gap: 8px;">
              <span>🎃</span> Gestione Rapida Evento Halloween
            </h3>
            <p style="color: #fdba74; font-size: 0.86rem;">
              Assegna i bonus/malus del regolamento speciale direttamente agli 11 Colleghi.
            </p>
          </div>
          <span style="background: rgba(249, 115, 22, 0.25); border: 1px solid rgba(249, 115, 22, 0.6); color: #fed7aa; padding: 4px 12px; border-radius: 20px; font-weight: 800; font-size: 0.78rem;">
            🎃 30 & 31 OTTOBRE
          </span>
        </div>

        <!-- Selettore modalità -->
        <div class="master-mode-selector">
          <button type="button" class="master-mode-btn ${this.halloweenScoringMode === 'single' ? 'active' : ''}" onclick="app.setHalloweenMode('single')">
            ⚡ Assegnazione Singola (1 Collega)
          </button>
          <button type="button" class="master-mode-btn ${this.halloweenScoringMode === 'multi' ? 'active' : ''}" onclick="app.setHalloweenMode('multi')">
            👥 Assegnazione Multipla (${this.halloweenMultiSelectedColleghiIds.length} Selezionati)
          </button>
        </div>

        ${this.halloweenScoringMode === 'single' ? `
          <!-- MODALITÀ SINGOLA -->
          <div style="margin-bottom: 12px;">
            <label style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-dark); font-weight: 700;">1. Scegli il Collega:</label>
            <div class="matrix-char-picker" style="margin-top: 6px;">
              ${COLLEGHI.map(c => `
                <button type="button" class="char-chip ${c.id === currentChar.id ? 'active' : ''}" onclick="app.selectHalloweenCollega('${c.id}')">
                  <span>${c.avatar}</span>
                  <span>${c.nome}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <div style="background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.1); padding: 12px 16px; border-radius: 10px; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 2rem;">${currentChar.avatar}</span>
              <div>
                <strong style="color: #fff; font-size: 1.1rem;">${currentChar.nome}</strong>
                <div style="font-size: 0.76rem; color: #fbbf24;">Collega Compagno di Banco</div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.75rem; color: var(--text-dark); text-transform: uppercase;">Schierato in squadra da (${owners.length}):</div>
              <strong style="color: ${owners.length > 0 ? '#34d399' : '#f87171'}; font-size: 0.95rem;">
                ${owners.length > 0 ? owners.join(', ') : 'Nessuna squadra'}
              </strong>
            </div>
          </div>

          <!-- Pulsanti Rapidi Bonus -->
          <div style="margin-bottom: 16px;">
            <label style="font-size: 0.8rem; text-transform: uppercase; color: #34d399; font-weight: 800; display: block; margin-bottom: 8px;">
              2. Clicca un Bonus da assegnare a ${currentChar.nome}:
            </label>
            <div class="halloween-action-grid">
              ${event.bonus.map(b => `
                <button type="button" class="btn-halloween-action bonus-btn" onclick="app.assignHalloweenPoints('${currentChar.id}', '${b.id}')">
                  <span>${b.icon} ${b.nome}</span>
                  <span style="color: #34d399; font-weight: 800;">+${b.pt} pt</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Pulsanti Rapidi Malus -->
          <div style="margin-bottom: 22px;">
            <label style="font-size: 0.8rem; text-transform: uppercase; color: #f87171; font-weight: 800; display: block; margin-bottom: 8px;">
              Oppure clicca un Malus:
            </label>
            <div class="halloween-action-grid">
              ${event.malus.map(m => `
                <button type="button" class="btn-halloween-action malus-btn" onclick="app.assignHalloweenPoints('${currentChar.id}', '${m.id}')">
                  <span>${m.icon} ${m.nome}</span>
                  <span style="color: #f87171; font-weight: 800;">${m.pt} pt</span>
                </button>
              `).join('')}
            </div>
          </div>
        ` : `
          <!-- MODALITÀ MULTIPLA -->
          <div style="margin-bottom: 18px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
              <label style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-dark); font-weight: 700;">
                1. Spunta i Colleghi che hanno compiuto l'azione:
              </label>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="btn-recruit" style="padding: 4px 10px; font-size: 0.76rem;" onclick="app.selectAllHalloweenMulti()">✓ Tutti</button>
                <button type="button" class="btn-recruit" style="padding: 4px 10px; font-size: 0.76rem; border-color: rgba(239,68,68,0.4); color: #fca5a5;" onclick="app.deselectAllHalloweenMulti()">✕ Nessuno</button>
              </div>
            </div>
            <div class="colleghi-multi-grid">
              ${COLLEGHI.map(c => {
                const isChecked = this.halloweenMultiSelectedColleghiIds.includes(c.id);
                return `
                  <label class="collega-multi-label ${isChecked ? 'selected' : ''}" onclick="app.toggleHalloweenMultiCollega('${c.id}')">
                    <input type="checkbox" ${isChecked ? 'checked' : ''} style="pointer-events: none;">
                    <span>${c.avatar}</span>
                    <strong style="font-size: 0.88rem;">${c.nome}</strong>
                  </label>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Pulsanti Rapidi Multipli Bonus -->
          <div style="margin-bottom: 16px;">
            <label style="font-size: 0.8rem; text-transform: uppercase; color: #34d399; font-weight: 800; display: block; margin-bottom: 8px;">
              2. Assegna questo Bonus a TUTTI i colleghi selezionati (${this.halloweenMultiSelectedColleghiIds.length}):
            </label>
            <div class="halloween-action-grid">
              ${event.bonus.map(b => `
                <button type="button" class="btn-halloween-action bonus-btn" onclick="app.assignHalloweenPointsMulti('${b.id}')">
                  <span>${b.icon} ${b.nome}</span>
                  <span style="color: #34d399; font-weight: 800;">+${b.pt} pt</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Pulsanti Rapidi Multipli Malus -->
          <div style="margin-bottom: 22px;">
            <label style="font-size: 0.8rem; text-transform: uppercase; color: #f87171; font-weight: 800; display: block; margin-bottom: 8px;">
              Oppure assegna questo Malus a tutti i selezionati:
            </label>
            <div class="halloween-action-grid">
              ${event.malus.map(m => `
                <button type="button" class="btn-halloween-action malus-btn" onclick="app.assignHalloweenPointsMulti('${m.id}')">
                  <span>${m.icon} ${m.nome}</span>
                  <span style="color: #f87171; font-weight: 800;">${m.pt} pt</span>
                </button>
              `).join('')}
            </div>
          </div>
        `}

        <!-- CARD SPECIALE THRILLER MICHAEL JACKSON -->
        <div style="border-top: 1px dashed rgba(249, 115, 22, 0.4); padding-top: 18px; margin-top: 10px;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">
            <h4 style="color: #fbbf24; font-size: 1.05rem; font-weight: 800; display: flex; align-items: center; gap: 8px;">
              <span>🧟</span> Accredito Squadra: Thriller di Michael Jackson (+100 pt)
            </h4>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn-recruit" style="padding: 4px 10px; font-size: 0.76rem;" onclick="app.selectAllHalloweenThrillerCoaches()">✓ Seleziona Tutti i Presenti</button>
              <button type="button" class="btn-recruit" style="padding: 4px 10px; font-size: 0.76rem; border-color: rgba(239,68,68,0.4); color: #fca5a5;" onclick="app.deselectAllHalloweenThrillerCoaches()">✕ Nessuno</button>
            </div>
          </div>
          <p style="color: #cbd5e1; font-size: 0.85rem; margin-bottom: 12px;">
            Seleziona gli allenatori che erano presenti al Madween per accreditare i +100 pt direttamente nella classifica delle loro squadre:
          </p>
          <div class="colleghi-multi-grid" style="margin-bottom: 14px;">
            ${allCoaches.map(cName => {
              const isChecked = this.halloweenThrillerSelectedCoaches.includes(cName);
              const uObj = (this.getData('fanta_users') || INITIAL_USERS).find(u => u.username === cName);
              return `
                <label class="collega-multi-label ${isChecked ? 'selected' : ''}" onclick="app.toggleHalloweenThrillerCoach('${cName}')">
                  <input type="checkbox" ${isChecked ? 'checked' : ''} style="pointer-events: none;">
                  <span>${uObj?.avatar || '👤'}</span>
                  <strong style="font-size: 0.88rem;">${cName}</strong>
                </label>
              `;
            }).join('')}
          </div>
          <button type="button" class="btn-thriller-special" onclick="app.assignHalloweenThrillerTeamPoints()">
            🎵 Assegna +100 pt Thriller alle ${this.halloweenThrillerSelectedCoaches.length} Squadre Selezionate
          </button>
        </div>
      </div>
    `;
  }

  renderMasterLiveScoring() {
    const chipsContainer = document.getElementById('masterScoringCharChips');
    const eventsContainer = document.getElementById('masterScoringEventsGrid');
    const selectedCharInfo = document.getElementById('masterScoringSelectedInfo');
    if (!chipsContainer || !eventsContainer) return;

    const allCharacters = [
      ...DOCENTI.map(d => ({ ...d, tipo: 'Docente' })),
      ...COLLEGHI.map(c => ({ ...c, tipo: 'Collega' }))
    ];

    chipsContainer.innerHTML = allCharacters.map(char => `
      <button type="button" class="char-chip ${char.id === this.scoringSelectedCharId ? 'active' : ''}" onclick="app.selectScoringChar('${char.id}')">
        <span>${char.avatar}</span>
        <span>${char.nome}</span>
      </button>
    `).join('');

    const currentChar = allCharacters.find(c => c.id === this.scoringSelectedCharId) || allCharacters[0];
    if (!currentChar) return;

    const teams = this.getData('fanta_teams') || {};
    const owners = [];
    Object.entries(teams).forEach(([coachName, team]) => {
      if (team.confirmed) {
        if ((team.docenti || []).includes(currentChar.id) || team.collega === currentChar.id) {
          owners.push(coachName);
        }
      }
    });

    if (selectedCharInfo) {
      selectedCharInfo.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; background: rgba(10, 16, 30, 0.8); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 2rem;">${currentChar.avatar}</span>
            <div>
              <strong style="color: #fff; font-size: 1.1rem;">${currentChar.nome}</strong>
              <div style="font-size: 0.78rem; color: #fbbf24;">${currentChar.tipo} (${currentChar.costoCFA} CFA)</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-dark);">Schierato da (${owners.length} Squadre):</div>
            <strong style="color: ${owners.length > 0 ? '#34d399' : '#f87171'}; font-size: 0.95rem;">
              ${owners.length > 0 ? owners.join(', ') : 'Nessuna squadra confermata'}
            </strong>
          </div>
        </div>
      `;
    }

    let eventsList = [];

    if (currentChar.specificEvents) {
      currentChar.specificEvents.forEach(se => {
        eventsList.push({
          titolo: se.nome,
          desc: se.desc,
          pt: se.pt,
          categoria: 'Specifico Docente'
        });
      });
    }

    if (currentChar.secretRules) {
      currentChar.secretRules.forEach(sr => {
        if (sr.pt !== 0) {
          eventsList.push({
            titolo: sr.desc.split('(')[0],
            desc: sr.desc,
            pt: sr.pt,
            categoria: 'Secret Rule Collega'
          });
        }
      });
    }

    EVENTI_CATALOGO.attivita.forEach(ae => {
      eventsList.push({
        titolo: ae.nome,
        desc: ae.desc,
        pt: ae.pt,
        categoria: 'Attività & Lezioni'
      });
    });

    EVENTI_CATALOGO.campus.forEach(ce => {
      eventsList.push({
        titolo: ce.nome,
        desc: ce.desc,
        pt: ce.pt,
        categoria: 'Vita da Campus'
      });
    });

    eventsContainer.innerHTML = eventsList.map((ev, i) => `
      <button type="button" class="matrix-event-btn" onclick="app.triggerLiveScore('${currentChar.id}', ${i})">
        <div>
          <strong style="display: block; font-size: 0.92rem;">${ev.titolo}</strong>
          <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">${ev.categoria}</span>
        </div>
        <span class="rule-pts ${ev.pt >= 0 ? 'bonus' : 'malus'}" style="font-size: 0.85rem;">
          ${ev.pt >= 0 ? '+' + ev.pt : ev.pt} pt
        </span>
      </button>
    `).join('');

    this.currentMatrixEvents = eventsList;
  }

  selectScoringChar(charId) {
    this.scoringSelectedCharId = charId;
    this.playSound('click');
    this.renderMasterLiveScoring();
  }

  triggerLiveScore(charId, eventIndex) {
    if (!this.currentUser || this.currentUser.role !== 'master') return;

    const event = this.currentMatrixEvents[eventIndex];
    if (!event) return;

    const allCharacters = [...DOCENTI, ...COLLEGHI];
    const charObj = allCharacters.find(c => c.id === charId);
    if (!charObj) return;

    const teams = this.getData('fanta_teams') || {};
    const impactedCoaches = [];

    Object.entries(teams).forEach(([coachName, team]) => {
      if (!team.confirmed) return;

      const hasInDocenti = (team.docenti || []).includes(charId);
      const hasInCollega = (team.collega === charId);

      if (hasInDocenti || hasInCollega) {
        if (!team.puntiStorico) team.puntiStorico = [];
        team.puntiStorico.push({
          data: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
          motivo: `⚡ ${charObj.nome}: ${event.titolo}`,
          pt: event.pt
        });
        impactedCoaches.push(coachName);
      }
    });

    this.saveData('fanta_teams', teams);
    this.playSound(event.pt >= 0 ? 'coin' : 'glitch');

    if (impactedCoaches.length > 0) {
      this.showToast(`⚡ ${charObj.nome} (${event.pt >= 0 ? '+' : ''}${event.pt} pt) accreditato a: ${impactedCoaches.join(', ')}!`, 'bonus');
    } else {
      this.showToast(`⚡ Evento ${charObj.nome} registrato (${event.pt >= 0 ? '+' : ''}${event.pt} pt), ma nessuna squadra confermata possiede questo personaggio.`, 'info');
    }

    this.render();
  }

  renderMasterUnlockControls() {
    const selUnlock = document.getElementById('masterUnlockCoachSelect');
    if (!selUnlock) return;

    const teams = this.getData('fanta_teams') || {};
    const confirmedCoaches = Object.keys(teams).filter(c => teams[c].confirmed);

    if (confirmedCoaches.length === 0) {
      selUnlock.innerHTML = '<option value="">Nessuna squadra confermata</option>';
    } else {
      selUnlock.innerHTML = confirmedCoaches.map(c => `
        <option value="${c}">${c}</option>
      `).join('');
    }
  }

  masterUnlockCoach() {
    if (!this.currentUser || this.currentUser.role !== 'master') return;
    const selUnlock = document.getElementById('masterUnlockCoachSelect');
    const coachName = selUnlock.value;
    if (!coachName) return;

    const teams = this.getData('fanta_teams') || {};
    if (teams[coachName]) {
      teams[coachName].confirmed = false;
      this.saveData('fanta_teams', teams);
      this.playSound('click');
      this.showToast(`🔓 Squadra di ${coachName} sbloccata! L'allenatore può ora effettuare le modifiche richieste.`, 'info');
      this.render();
    }
  }

  approveReport(reportId) {
    if (!this.currentUser || this.currentUser.role !== 'master') return;

    const reports = this.getData('fanta_reports') || [];
    const rep = reports.find(r => r.id === reportId);
    if (!rep) return;

    // Lettura eventuale punteggio modificato dal Master
    const editInput = document.getElementById(`masterPtEdit-${reportId}`);
    if (editInput) {
      const parsed = parseInt(editInput.value, 10);
      if (!isNaN(parsed)) {
        rep.punti = parsed;
      }
    }

    rep.stato = 'approvata';
    this.saveData('fanta_reports', reports);
    this._prevReportsSnapshot = JSON.parse(JSON.stringify(reports));

    // Supporto sia singolo personaggio che multi-personaggi
    const targetCharIds = Array.isArray(rep.personaggiIds) && rep.personaggiIds.length > 0
      ? rep.personaggiIds
      : [rep.personaggioId].filter(Boolean);

    const teams = this.getData('fanta_teams') || {};
    const impactedCoaches = [];

    Object.entries(teams).forEach(([coachName, team]) => {
      if (!team.confirmed) return;

      const hasChar = targetCharIds.some(charId => 
        (team.docenti || []).includes(charId) || team.collega === charId
      );

      if (hasChar) {
        if (!team.puntiStorico) team.puntiStorico = [];
        team.puntiStorico.push({
          data: new Date().toLocaleDateString('it-IT'),
          motivo: `${rep.personaggiNomi || rep.personaggioNome}: ${rep.titolo} (Approvata dal Master)`,
          pt: rep.punti
        });
        impactedCoaches.push(coachName);
      }
    });

    this.saveData('fanta_teams', teams);

    // Auto-pubblicazione avviso ufficiale in Home
    const notices = this.getData('fanta_notices') || [];
    notices.unshift({
      id: 'notice-approved-' + Date.now(),
      tipo: 'RISULTATO SEGNALAZIONE',
      icona: '✅',
      badge: 'Approvata',
      titolo: `✅ Segnalazione Approvata: ${rep.personaggiNomi || rep.personaggioNome}`,
      data: new Date().toLocaleDateString('it-IT'),
      testo: `Il Master ha approvato: "${rep.titolo}" (${rep.punti >= 0 ? '+' : ''}${rep.punti} pt). Punti accreditati alle squadre con: ${rep.personaggiNomi || rep.personaggioNome}.`
    });
    this.saveData('fanta_notices', notices);
    this._prevNoticesSnapshot = JSON.parse(JSON.stringify(notices));

    this.playSound('success');
    this.showToast(`✅ Segnalazione approvata! Punti accreditati a: ${impactedCoaches.length > 0 ? impactedCoaches.join(', ') : 'Nessuna squadra ha questo personaggio'}`, 'success');

    this.render();
  }

  rejectReport(reportId) {
    if (!this.currentUser || this.currentUser.role !== 'master') return;

    const reports = this.getData('fanta_reports') || [];
    const rep = reports.find(r => r.id === reportId);
    if (!rep) return;

    rep.stato = 'rifiutata';
    this.saveData('fanta_reports', reports);
    this._prevReportsSnapshot = JSON.parse(JSON.stringify(reports));

    // Auto-pubblicazione avviso ufficiale in Home
    const notices = this.getData('fanta_notices') || [];
    notices.unshift({
      id: 'notice-rejected-' + Date.now(),
      tipo: 'RISULTATO SEGNALAZIONE',
      icona: '❌',
      badge: 'Non Convalidata',
      titolo: `❌ Segnalazione Non Convalidata: ${rep.personaggiNomi || rep.personaggioNome}`,
      data: new Date().toLocaleDateString('it-IT'),
      testo: `Il Master ha esaminato e non convalidato: "${rep.titolo}". Nessun punto assegnato.`
    });
    this.saveData('fanta_notices', notices);
    this._prevNoticesSnapshot = JSON.parse(JSON.stringify(notices));

    this.playSound('click');
    this.showToast(`Segnalazione #${reportId} rifiutata.`, 'info');
    this.render();
  }

  // --- FORM HANDLERS (SOLO CREDENZIALI NOME UTENTE E PASSWORD) ---
  setupLoginForm() {
    const manualForm = document.getElementById('formManualLogin');
    if (manualForm) {
      manualForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const u = document.getElementById('loginUsername').value.trim();
        const p = document.getElementById('loginPassword').value.trim();
        const users = this.getData('fanta_users') || INITIAL_USERS;

        const found = users.find(x => x.username.toLowerCase() === u.toLowerCase() && x.password === p);

        if (found) {
          this.setActiveUser(found.username);
          this.closeAllModals();
          manualForm.reset();
        } else {
          this.playSound('glitch');
          this.showToast("❌ Credenziali non valide! Verifica nome utente e password.", "danger");
        }
      });
    }
  }

  // --- MULTI-CHARACTER PICKER (SEGNALAZIONI) ---
  renderReportCharPicker() {
    const container = document.getElementById('reportCharPickerMulti');
    const hiddenInput = document.getElementById('reportSelectedCharsHidden');
    if (!container) return;

    if (!Array.isArray(this._selectedReportCharIds)) {
      this._selectedReportCharIds = [];
    }

    const allChars = [
      ...DOCENTI.map(d => ({ ...d, tipo: 'Docente' })),
      ...COLLEGHI.map(c => ({ ...c, tipo: 'Collega' }))
    ];

    container.innerHTML = allChars.map(c => {
      const isSelected = this._selectedReportCharIds.includes(c.id);
      return `
        <button type="button" class="char-chip-pill ${isSelected ? 'active' : ''}" onclick="app.toggleReportChar('${c.id}')">
          <span>${c.avatar}</span>
          <span>${c.nome}</span>
          <span class="chip-check">✓</span>
        </button>
      `;
    }).join('');

    if (hiddenInput) {
      hiddenInput.value = this._selectedReportCharIds.join(',');
    }
  }

  toggleReportChar(charId) {
    if (!Array.isArray(this._selectedReportCharIds)) {
      this._selectedReportCharIds = [];
    }
    const idx = this._selectedReportCharIds.indexOf(charId);
    if (idx >= 0) {
      this._selectedReportCharIds.splice(idx, 1);
    } else {
      this._selectedReportCharIds.push(charId);
    }
    this.renderReportCharPicker();
  }

  setupReportForm() {
    const btnOpen = document.getElementById('btnOpenNewReportModal');
    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        if (!this.isUserTeamConfirmed() && this.currentUser.role !== 'master') {
          this.showToast("🔒 Devi prima confermare la tua Squadra per inviare segnalazioni!", "danger");
          return;
        }
        this._selectedReportCharIds = [];
        this.removeReportPhotoUpload();
        this.renderReportCharPicker();
        this.openModal('newReportModal');
      });
    }

    const selEvent = document.getElementById('reportEventoSelect');
    if (selEvent) {
      let evHtml = '<option value="" data-pts="0">-- Seleziona Evento da Regolamento (oppure scrivi sotto) --</option>';
      optHtmlGroup: {
        evHtml += '<optgroup label="Attività & Lezioni">';
        EVENTI_CATALOGO.attivita.forEach(e => {
          evHtml += `<option value="${e.nome}" data-pts="${e.pt}">[+${e.pt}pt] ${e.nome}</option>`;
        });
        evHtml += '</optgroup><optgroup label="Vita da Campus">';
        EVENTI_CATALOGO.campus.forEach(e => {
          evHtml += `<option value="${e.nome}" data-pts="${e.pt}">[${e.pt > 0 ? '+' : ''}${e.pt}pt] ${e.nome}</option>`;
        });
        evHtml += '</optgroup>';
      }
      selEvent.innerHTML = evHtml;

      selEvent.addEventListener('change', () => {
        const selectedOpt = selEvent.options[selEvent.selectedIndex];
        const pts = selectedOpt.getAttribute('data-pts');
        const ptsInput = document.getElementById('reportPuntiInput');
        if (ptsInput && pts && pts !== '0') ptsInput.value = pts;
      });
    }

    const form = document.getElementById('formNewReport');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const titolo = document.getElementById('reportTitoloInput').value.trim();
        const desc = document.getElementById('reportDescInput').value.trim();
        const catSelect = document.getElementById('reportEventoSelect');
        const catVal = catSelect.value || document.getElementById('reportCustomCatInput').value.trim() || 'Evento Straordinario';
        const punti = parseInt(document.getElementById('reportPuntiInput').value, 10) || 20;
        const fotoUrlInput = document.getElementById('reportFotoUrlInput');
        const fotoUrl = fotoUrlInput ? fotoUrlInput.value.trim() : '';
        const fotoFinal = this.reportUploadedPhoto || fotoUrl || null;

        if (!this._selectedReportCharIds || this._selectedReportCharIds.length === 0) {
          this.showToast("⚠️ Seleziona almeno un personaggio coinvolto!", "danger");
          return;
        }

        if (!titolo || !desc) {
          this.showToast("⚠️ Compila tutti i campi obbligatori!", "danger");
          return;
        }

        const allChars = [...DOCENTI, ...COLLEGHI];
        const selectedObjs = this._selectedReportCharIds.map(id => allChars.find(c => c.id === id)).filter(Boolean);
        const joinedNames = selectedObjs.map(c => c.nome).join(', ');
        const firstId = this._selectedReportCharIds[0];

        const reports = this.getData('fanta_reports') || [];
        const newRep = {
          id: 'rep-' + Date.now(),
          titolo,
          descrizione: desc,
          personaggioId: firstId,
          personaggioNome: joinedNames,
          personaggiIds: [...this._selectedReportCharIds],
          personaggiNomi: joinedNames,
          categoria: catVal,
          punti,
          autore: this.currentUser.username,
          data: new Date().toLocaleDateString('it-IT') + ' ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
          foto: fotoFinal,
          stato: 'in_attesa',
          upvotes: 1,
          downvotes: 0,
          voters: { [this.currentUser.username]: 1 },
          commenti: []
        };

        reports.unshift(newRep);
        this.saveData('fanta_reports', reports);
        this._prevReportsSnapshot = JSON.parse(JSON.stringify(reports));

        this.playSound('success');
        this.closeAllModals();
        form.reset();
        this.removeReportPhotoUpload();
        this._selectedReportCharIds = [];
        this.showToast("🚀 Segnalazione inviata con successo! In attesa di approvazione Master.", "success");
        this.switchTab('social');
      });
    }
  }

  // --- CARICAMENTO FOTO DA GALLERIA O FOTOCAMERA ---
  handleReportPhotoUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showToast("⚠️ Seleziona un file immagine valido!", "danger");
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const img = new Image();
      img.onload = () => {
        // Ridimensionamento su Canvas per leggerezza (max 800px width/height, JPEG 0.8)
        const maxDim = 800;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        this.reportUploadedPhoto = dataUrl;

        const previewContainer = document.getElementById('reportPhotoPreviewContainer');
        const previewImg = document.getElementById('reportPhotoPreviewImg');
        if (previewImg && previewContainer) {
          previewImg.src = dataUrl;
          previewContainer.style.display = 'block';
        }
        this.playSound('click');
        this.showToast("📸 Foto caricata con successo!", "success");
      };
      img.src = loadEvent.target.result;
    };
    reader.readAsDataURL(file);
  }

  removeReportPhotoUpload() {
    this.reportUploadedPhoto = null;
    const fileInput = document.getElementById('reportPhotoFileInput');
    if (fileInput) fileInput.value = '';
    const previewContainer = document.getElementById('reportPhotoPreviewContainer');
    const previewImg = document.getElementById('reportPhotoPreviewImg');
    if (previewContainer) previewContainer.style.display = 'none';
    if (previewImg) previewImg.src = '';
  }

  // ============================================================
  // PWA & SISTEMA NOTIFICHE TELEFONO / BROWSER (100% GRATUITO)
  // ============================================================
  initPwa() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
          console.log('[PWA] Service Worker registrato con successo:', reg.scope);
        }).catch(err => {
          console.warn('[PWA] Registrazione Service Worker non riuscita:', err);
        });
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      const pwaBtn = document.getElementById('drawerPwaInstallBtn');
      if (pwaBtn) pwaBtn.style.display = 'inline-flex';
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      const pwaBtn = document.getElementById('drawerPwaInstallBtn');
      if (pwaBtn) pwaBtn.style.display = 'none';
      this.showToast("📲 Fanta-Accademia installata nella schermata Home!", "success");
    });
  }

  promptPwaInstall() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      this.deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          this.showToast("📲 Fanta-Accademia aggiunta alla schermata Home!", "success");
        }
        this.deferredPrompt = null;
        const pwaBtn = document.getElementById('drawerPwaInstallBtn');
        if (pwaBtn) pwaBtn.style.display = 'none';
      });
    } else {
      const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
      if (isIos) {
        this.showToast("📱 Su iPhone: tocca l'icona Condividi in Safari e scegli 'Aggiungi alla schermata Home'.", "info");
      } else {
        this.showToast("📱 Apri il menu del browser (3 puntini) e seleziona 'Aggiungi a schermata Home' o 'Installa app'.", "info");
      }
    }
  }

  updateNotificationButtonState() {
    const btn = document.getElementById('drawerNotifBtn');
    const icon = document.getElementById('drawerNotifIcon');
    const label = document.getElementById('drawerNotifLabel');
    if (!btn || !label) return;

    if (!('Notification' in window)) {
      label.innerText = 'Notifiche Non Supportate';
      btn.style.opacity = '0.5';
      return;
    }

    if (Notification.permission === 'granted') {
      if (icon) icon.innerText = '🔔';
      label.innerText = 'Notifiche Attive';
      btn.style.borderColor = 'rgba(16, 185, 129, 0.45)';
      btn.style.color = '#34d399';
    } else if (Notification.permission === 'denied') {
      if (icon) icon.innerText = '🔕';
      label.innerText = 'Notifiche Bloccate';
      btn.style.borderColor = 'rgba(239, 68, 68, 0.45)';
      btn.style.color = '#f87171';
    } else {
      if (icon) icon.innerText = '🔔';
      label.innerText = 'Attiva Notifiche Telefono';
      btn.style.borderColor = 'rgba(139, 92, 246, 0.3)';
      btn.style.color = 'var(--text-light)';
    }
  }

  async toggleNotifications() {
    if (!('Notification' in window)) {
      this.showToast("⚠️ Il tuo browser non supporta le notifiche di sistema.", "danger");
      return;
    }

    if (Notification.permission === 'granted') {
      this.showToast("🔔 Le notifiche sono già attive sul tuo dispositivo!", "info");
      this.sendSystemNotification("🔔 Fanta-Accademia 2026", "Le notifiche sono già configurate e attive!", "./index.html", "test-notif");
      return;
    }

    if (Notification.permission === 'denied') {
      this.showToast("🔕 Le notifiche sono bloccate nelle impostazioni del browser. Abilitale per riceverle.", "danger");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      this.updateNotificationButtonState();
      if (permission === 'granted') {
        this.playSound('success');
        this.showToast("✅ Notifiche attivate con successo!", "success");
        this.sendSystemNotification(
          "🔔 Fanta-Accademia 2026",
          "Riceverai notifiche sul telefono per nuove segnalazioni, commenti ed esiti del Master!",
          "./index.html",
          "welcome-notif"
        );
      } else {
        this.showToast("⚠️ Permesso notifiche non concesso.", "info");
      }
    } catch (e) {
      console.warn("Errore richiesta permesso notifiche", e);
    }
  }

  sendSystemNotification(title, body, url = './index.html', tag = 'fanta') {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const options = {
      body,
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏛️</text></svg>",
      badge: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏛️</text></svg>",
      tag: tag || 'fanta-notif-' + Date.now(),
      renotify: true,
      data: { url }
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, options);
      }).catch(() => {
        try { new Notification(title, options); } catch (e) {}
      });
    } else {
      try { new Notification(title, options); } catch (e) {}
    }
  }

  handleFirebaseRealtimeNotification(key, val) {
    if (!val) return;

    if (key === 'fanta_reports') {
      if (!this._prevReportsSnapshot) {
        this._prevReportsSnapshot = JSON.parse(JSON.stringify(val));
        return;
      }
      if (Array.isArray(val)) {
        // 1. Nuove segnalazioni aggiunte da altri coach
        val.forEach(rep => {
          const exists = this._prevReportsSnapshot.some(prev => prev.id === rep.id);
          if (!exists) {
            if (rep.autore !== this.currentUser?.username) {
              this.sendSystemNotification(
                "📸 Nuova Segnalazione!",
                `${rep.autore} ha pubblicato: "${rep.titolo}" (${rep.personaggioNome || 'Personaggio'})`,
                "./index.html#social",
                "rep-" + rep.id
              );
              this.showToast(`📸 Nuova segnalazione pubblicata da <b>${rep.autore}</b>: ${rep.titolo}`, 'info');
              this.playSound('coin');
            }
          }
        });

        // 2. Modifiche di stato (approvata o rifiutata dal Master)
        val.forEach(rep => {
          const old = this._prevReportsSnapshot.find(prev => prev.id === rep.id);
          if (old && old.stato !== rep.stato) {
            if (rep.stato === 'approvata') {
              this.sendSystemNotification(
                "🎉 Segnalazione Approvata!",
                `Il Master ha approvato: "${rep.titolo}" (+${rep.punti}pt)`,
                "./index.html#social",
                "rep-status-" + rep.id
              );
              this.showToast(`🎉 Segnalazione convalidata dal Master: <b>${rep.titolo}</b> (+${rep.punti}pt)`, 'success');
              this.playSound('bonus');
            } else if (rep.stato === 'rifiutata') {
              this.sendSystemNotification(
                "❌ Segnalazione Non Convalidata",
                `Il Master ha respinto la segnalazione: "${rep.titolo}"`,
                "./index.html#social",
                "rep-status-" + rep.id
              );
              this.showToast(`❌ Segnalazione non convalidata: <b>${rep.titolo}</b>`, 'danger');
              this.playSound('glitch');
            }
          }

          // 3. Nuovi commenti su una segnalazione
          if (old && Array.isArray(rep.commenti)) {
            const oldCount = Array.isArray(old.commenti) ? old.commenti.length : 0;
            if (rep.commenti.length > oldCount) {
              const newComments = rep.commenti.slice(oldCount);
              newComments.forEach(comm => {
                if (comm.autore !== this.currentUser?.username) {
                  this.sendSystemNotification(
                    "💬 Nuovo Commento!",
                    `${comm.autore} su "${rep.titolo}": "${comm.testo}"`,
                    "./index.html#social",
                    "comment-" + (comm.id || Date.now())
                  );
                  this.showToast(`💬 Nuovo commento di <b>${comm.autore}</b> su "${rep.titolo}"`, 'info');
                  this.playSound('click');
                }
              });
            }
          }
        });
      }
      this._prevReportsSnapshot = JSON.parse(JSON.stringify(val));
    }

    if (key === 'fanta_notices') {
      if (!this._prevNoticesSnapshot) {
        this._prevNoticesSnapshot = JSON.parse(JSON.stringify(val));
        return;
      }
      if (Array.isArray(val)) {
        val.forEach(notice => {
          const exists = this._prevNoticesSnapshot.some(prev => prev.id === notice.id);
          if (!exists) {
            // Notifica avvisi diretti del Master (escludendo gli esiti automatici già notificati sopra)
            if (notice.tipo !== 'RISULTATO SEGNALAZIONE') {
              this.sendSystemNotification(
                "📢 Avviso del Master!",
                `${notice.titolo}: ${notice.testo}`,
                "./index.html#home",
                "notice-" + notice.id
              );
              this.showToast(`📢 Nuovo avviso in Home: <b>${notice.titolo}</b>`, 'info');
              this.playSound('coin');
            }
          }
        });
      }
      this._prevNoticesSnapshot = JSON.parse(JSON.stringify(val));
    }

    if (key === 'fanta_tips') {
      if (!this._prevTipsSnapshot) {
        this._prevTipsSnapshot = JSON.parse(JSON.stringify(val));
        return;
      }
      if (Array.isArray(val)) {
        val.forEach(tip => {
          const exists = this._prevTipsSnapshot.some(prev => prev.id === tip.id);
          if (!exists) {
            // Notifica SOLO a chi ha Martina in squadra (Masi, Mar) oppure Master
            const teams = this.getData('fanta_teams') || {};
            const myTeam = this.currentUser ? teams[this.currentUser.username] : null;
            const hasMartina = myTeam && myTeam.confirmed && myTeam.collega === 'collega-martina';
            const isMaster = this.currentUser && this.currentUser.role === 'master';

            if (hasMartina || isMaster) {
              this.sendSystemNotification(
                "👑 Nuova Soffiata del Master!",
                `Nuovo suggerimento segreto per chi ha Martina in squadra: "${tip.titolo}"`,
                "./index.html#soffiate",
                "tip-" + tip.id
              );
              this.showToast(`👑 Nuova Soffiata del Master: <b>${tip.titolo}</b>`, 'bonus');
              this.playSound('bonus');
            }
          }
        });
      }
      this._prevTipsSnapshot = JSON.parse(JSON.stringify(val));
    }
  }

  // --- MASTER DIRECT EVENT HANDLER ---
  setupMasterDirectEventForm() {
    const selChar = document.getElementById('directEventCharSelect');
    if (selChar) {
      let optHtml = '<option value="">-- Seleziona Personaggio Coinvolto --</option>';
      optHtml += '<optgroup label="Docenti">';
      DOCENTI.forEach(d => {
        optHtml += `<option value="${d.id}">${d.avatar} ${d.nome} (${d.costoCFA} CFA)</option>`;
      });
      optHtml += '</optgroup><optgroup label="Colleghi">';
      COLLEGHI.forEach(c => {
        optHtml += `<option value="${c.id}">${c.avatar} ${c.nome} (${c.costoCFA} CFA)</option>`;
      });
      optHtml += '</optgroup>';
      selChar.innerHTML = optHtml;
    }

    const form = document.getElementById('formMasterDirectEvent');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!this.currentUser || this.currentUser.role !== 'master') return;

        const charId = document.getElementById('directEventCharSelect').value;
        const titolo = document.getElementById('directEventTitleInput').value.trim();
        const punti = parseInt(document.getElementById('directEventPointsInput').value, 10);
        const desc = document.getElementById('directEventDescInput').value.trim();

        if (!charId || !titolo || isNaN(punti) || !desc) {
          this.showToast("⚠️ Compila tutti i campi obbligatori!", "danger");
          return;
        }

        const allChars = [...DOCENTI, ...COLLEGHI];
        const charObj = allChars.find(c => c.id === charId);
        if (!charObj) return;

        const teams = this.getData('fanta_teams') || {};
        const impactedCoaches = [];

        Object.entries(teams).forEach(([coachName, team]) => {
          if (!team.confirmed) return;
          const hasInDocenti = (team.docenti || []).includes(charId);
          const hasInCollega = (team.collega === charId);

          if (hasInDocenti || hasInCollega) {
            if (!team.puntiStorico) team.puntiStorico = [];
            team.puntiStorico.push({
              data: new Date().toLocaleDateString('it-IT'),
              motivo: `⚡ [Master] ${charObj.nome}: ${titolo}`,
              pt: punti
            });
            impactedCoaches.push(coachName);
          }
        });

        this.saveData('fanta_teams', teams);

        // Pubblica automaticamente avviso in Home (senza passare dalla bacheca)
        const notices = this.getData('fanta_notices') || [];
        notices.unshift({
          id: 'notice-direct-' + Date.now(),
          tipo: punti >= 0 ? 'IMPREVISTO SETTIMANALE' : 'MALUS UFFICIALE',
          icona: punti >= 0 ? '⚡' : '💥',
          badge: punti >= 0 ? `+${punti} pt` : `${punti} pt`,
          titolo: `⚡ ${titolo} (${charObj.nome})`,
          data: new Date().toLocaleDateString('it-IT'),
          testo: `${desc} — ${punti >= 0 ? '+' : ''}${punti} pt accreditati a tutte le squadre che schierano ${charObj.nome}.`
        });
        this.saveData('fanta_notices', notices);
        this._prevNoticesSnapshot = JSON.parse(JSON.stringify(notices));

        this.playSound(punti >= 0 ? 'success' : 'glitch');
        form.reset();
        this.showToast(`⚡ Evento Master pubblicato! Punti (${punti >= 0 ? '+' : ''}${punti} pt) assegnati a: ${impactedCoaches.length > 0 ? impactedCoaches.join(', ') : 'Nessuna squadra'} e pubblicato in Home!`, 'success');
        this.render();
      });
    }
  }

  setupNoticeForm() {
    const form = document.getElementById('formNewNotice');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!this.currentUser || this.currentUser.role !== 'master') return;

        const tipo = document.getElementById('noticeTipoSelect').value;
        const titolo = document.getElementById('noticeTitoloInput').value.trim();
        const testo = document.getElementById('noticeTestoInput').value.trim();

        let icona = '📢';
        if (tipo.includes('IMPREVISTO')) icona = '⚡';
        if (tipo.includes('LORE')) icona = '👁️';

        const notices = this.getData('fanta_notices') || [];
        notices.unshift({
          id: 'notice-' + Date.now(),
          tipo,
          icona,
          badge: 'Nuovo',
          titolo,
          data: new Date().toLocaleDateString('it-IT'),
          testo
        });

        this.saveData('fanta_notices', notices);
        this._prevNoticesSnapshot = JSON.parse(JSON.stringify(notices));
        this.playSound('success');
        this.showToast("📢 Avviso pubblicato in Home!", "success");
        form.reset();
        this.renderHome();
      });
    }
  }

  setupTipForm() {
    const form = document.getElementById('formNewTip');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!this.currentUser || this.currentUser.role !== 'master') return;

        const titolo = document.getElementById('tipTitoloInput').value.trim();
        const testo = document.getElementById('tipTestoInput').value.trim();

        const tips = this.getData('fanta_tips') || [];
        tips.unshift({
          id: Date.now(),
          titolo,
          data: new Date().toLocaleDateString('it-IT'),
          testo
        });

        this.saveData('fanta_tips', tips);
        this._prevTipsSnapshot = JSON.parse(JSON.stringify(tips));
        this.playSound('success');
        this.showToast("👑 Soffiata Master aggiunta!", "success");
        form.reset();
        this.renderMasterTips();
      });
    }
  }

  setupManualPointsForm() {
    const selCoach = document.getElementById('manualCoachSelect');
    if (selCoach) {
      selCoach.innerHTML = INITIAL_USERS.map(u => `
        <option value="${u.username}">${u.avatar} ${u.username}</option>
      `).join('');
    }

    const form = document.getElementById('formManualPoints');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!this.currentUser || this.currentUser.role !== 'master') return;

        const coach = document.getElementById('manualCoachSelect').value;
        const pts = parseInt(document.getElementById('manualPointsInput').value, 10);
        const motivo = document.getElementById('manualMotivoInput').value.trim();

        const teams = this.getData('fanta_teams') || {};
        if (!teams[coach]) {
          teams[coach] = { confirmed: false, puntiBase: 0, puntiStorico: [] };
        }
        if (!teams[coach].puntiStorico) teams[coach].puntiStorico = [];

        teams[coach].puntiStorico.push({
          data: new Date().toLocaleDateString('it-IT'),
          motivo: `👑 Assegnazione Master: ${motivo}`,
          pt: pts
        });

        this.saveData('fanta_teams', teams);
        this.playSound('success');
        this.showToast(`Punti assegnati a ${coach} (${pts >= 0 ? '+' : ''}${pts} pt)`, 'success');
        form.reset();
        this.render();
      });
    }
  }

  // --- USER PROFILE & GRAPHIC CUSTOMIZATION ---
  getUserProfile(username) {
    const profiles = this.getData('fanta_profiles') || {};
    return profiles[username] || {};
  }

  saveUserProfile(partial) {
    if (!this.currentUser) return;
    const profiles = this.getData('fanta_profiles') || {};
    const cur = profiles[this.currentUser.username] || {};
    profiles[this.currentUser.username] = { ...cur, ...partial };
    this.saveData('fanta_profiles', profiles);
  }

  getUserAvatarHtml(username, size = '28px', fontSize = '1.3rem') {
    const prof = this.getUserProfile(username);
    const users = this.getData('fanta_users') || INITIAL_USERS;
    const u = users.find(x => x.username === username);
    const defaultAvatar = u?.avatar || '👤';

    if (prof.avatarPhoto) {
      return `<img src="${prof.avatarPhoto}" alt="${this.escapeHtml(username)}" style="width:${size};height:${size};border-radius:50%;object-fit:cover;vertical-align:middle;display:inline-block;border:1.5px solid var(--primary);box-shadow:0 0 6px var(--primary-glow);" />`;
    }

    const emoji = prof.avatarEmoji || defaultAvatar;
    return `<span style="font-size:${fontSize};vertical-align:middle;display:inline-flex;align-items:center;justify-content:center;line-height:1;">${emoji}</span>`;
  }

  applyUserPalette(username) {
    const prof = this.getUserProfile(username);
    const paletteId = prof.paletteId || 'default';
    const palettes = typeof COLOR_PALETTES !== 'undefined' ? COLOR_PALETTES : [];
    const p = palettes.find(x => x.id === paletteId || (paletteId === 'viola' && x.id === 'default')) || palettes[0];
    if (!p || !p.vars) return;

    const root = document.documentElement;
    Object.entries(p.vars).forEach(([k, v]) => {
      root.style.setProperty(k, v);
    });
  }

  setUserPalette(paletteId) {
    this.saveUserProfile({ paletteId });
    this.applyUserPalette(this.currentUser.username);
    this.renderUserProfile('userProfilePanel');
    const modalBody = document.getElementById('profileModalBody');
    if (modalBody && document.getElementById('profileModal')?.classList.contains('active')) {
      this.renderUserProfile('profileModalBody');
    }
    const palettes = typeof COLOR_PALETTES !== 'undefined' ? COLOR_PALETTES : [];
    const p = palettes.find(x => x.id === paletteId || (paletteId === 'viola' && x.id === 'default'));
    this.showToast(`🎨 Tema "${p?.nome || paletteId}" applicato con successo!`, 'success');
  }

  setProfileEmoji(emoji) {
    this.saveUserProfile({ avatarEmoji: emoji, avatarPhoto: null });
    this.renderHeader();
    this.renderUserProfile('userProfilePanel');
    const modalBody = document.getElementById('profileModalBody');
    if (modalBody && document.getElementById('profileModal')?.classList.contains('active')) {
      this.renderUserProfile('profileModalBody');
    }
    this.renderLeaderboard();
    this.showToast(`😀 Avatar aggiornato con emoji ${emoji}!`, 'success');
  }

  handleProfilePhotoUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.showToast("⚠️ File troppo grande (max 5MB)", "danger");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 140;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
        } else {
          if (h > maxDim) { h = Math.round((w * maxDim) / h); h = maxDim; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

        this.saveUserProfile({ avatarPhoto: dataUrl, avatarEmoji: null });
        this.renderHeader();
        this.renderUserProfile('userProfilePanel');
        const modalBody = document.getElementById('profileModalBody');
        if (modalBody && document.getElementById('profileModal')?.classList.contains('active')) {
          this.renderUserProfile('profileModalBody');
        }
        this.renderLeaderboard();
        this.showToast("📷 Foto profilo salvata e sincronizzata con successo!", "success");
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }

  removeProfilePhoto() {
    this.saveUserProfile({ avatarPhoto: null });
    this.renderHeader();
    this.renderUserProfile('userProfilePanel');
    const modalBody = document.getElementById('profileModalBody');
    if (modalBody && document.getElementById('profileModal')?.classList.contains('active')) {
      this.renderUserProfile('profileModalBody');
    }
    this.renderLeaderboard();
    this.showToast("Foto profilo rimossa. Ripristinato avatar standard.", "info");
  }

  openProfileModal() {
    if (!this.currentUser) return;
    this.renderUserProfile('profileModalBody');
    this.openModal('profileModal');
  }

  renderUserProfile(containerId = 'userProfilePanel') {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!this.currentUser) {
      container.innerHTML = '';
      return;
    }

    const prof = this.getUserProfile(this.currentUser.username);
    const currentPaletteId = prof.paletteId || 'default';
    const normalizedPaletteId = currentPaletteId === 'viola' ? 'default' : currentPaletteId;
    const palettes = typeof COLOR_PALETTES !== 'undefined' ? COLOR_PALETTES : [];
    const quickEmojis = ['👑', '🎨', '🎭', '🦊', '🐱', '☕', '🍷', '⚽', '🚀', '💎', '🌸', '⚡', '🕶️', '🎀', '📚'];

    const avatarPreviewHtml = prof.avatarPhoto
      ? `<img src="${prof.avatarPhoto}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
      : `<span style="font-size:2.8rem;">${prof.avatarEmoji || this.currentUser.avatar || '👤'}</span>`;

    container.innerHTML = `
      <div class="profile-panel-card">
        <h3 style="color:#fff;font-size:1.2rem;margin-bottom:6px;display:flex;align-items:center;gap:8px;">
          <span>👤</span> Profilo & Personalizzazione Grafica
        </h3>
        <p style="color:var(--text-muted);font-size:0.86rem;margin-bottom:18px;">
          Personalizza il tuo avatar (carica una foto o scegli un'emoji) e seleziona il colore della tua interfaccia.
        </p>

        <!-- Avatar Row -->
        <div class="profile-avatar-row">
          <div class="profile-avatar-display">
            ${avatarPreviewHtml}
          </div>
          <div style="flex:1;min-width:200px;">
            <div style="font-weight:700;color:#fff;font-size:1rem;margin-bottom:4px;">
              ${this.escapeHtml(this.currentUser.username)}
              <span class="user-badge-role ${this.currentUser.role === 'master' ? 'role-master' : 'role-coach'}" style="margin-left:6px;">
                ${this.currentUser.role === 'master' ? '👑 Master' : 'Allenatore'}
              </span>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px;">
              <label class="btn-upload-file">
                📷 Carica Foto Profilo
                <input type="file" accept="image/*" style="display:none;" onchange="app.handleProfilePhotoUpload(event)">
              </label>
              ${prof.avatarPhoto ? `
                <button type="button" class="btn-recruit" style="padding:7px 12px;font-size:0.8rem;border-color:rgba(239,68,68,0.5);color:#fca5a5;" onclick="app.removeProfilePhoto()">
                  ✕ Rimuovi Foto
                </button>
              ` : ''}
            </div>

            <!-- Quick Emojis -->
            <div style="margin-top:12px;">
              <span style="font-size:0.75rem;color:var(--text-dark);text-transform:uppercase;font-weight:700;">Oppure scegli un'emoji rapida:</span>
              <div class="emoji-quick-grid">
                ${quickEmojis.map(em => `
                  <button type="button" class="emoji-quick-btn" onclick="app.setProfileEmoji('${em}')" title="${em}">
                    ${em}
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Palette Theme Row -->
        <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;margin-top:10px;">
          <label class="form-label" style="font-weight:700;color:#fff;">🎨 Tavolozza Colori Tema Personale</label>
          <div class="palette-grid">
            ${palettes.map(p => {
              const isActive = p.id === normalizedPaletteId;
              const primaryColor = p.vars['--primary'] || '#8b5cf6';
              return `
                <button type="button" class="palette-card-btn ${isActive ? 'active' : ''}" onclick="app.setUserPalette('${p.id}')" style="border-color:${isActive ? primaryColor : 'rgba(255,255,255,0.1)'}">
                  <span class="palette-color-preview" style="background:${primaryColor};"></span>
                  <div style="display:flex;align-items:center;gap:4px;font-size:0.88rem;font-weight:700;">
                    <span>${p.emoji}</span>
                    <span>${this.escapeHtml(p.nome)}</span>
                  </div>
                  ${isActive ? '<span style="font-size:0.7rem;color:#34d399;font-weight:800;">● ATTIVO</span>' : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }
}

// Global instance initiation
let app = null;
window.addEventListener('DOMContentLoaded', () => {
  app = new FantaApp();
  window.app = app;
});
