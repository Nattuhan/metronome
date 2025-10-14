// メトロノームクラス
class Metronome {
    constructor() {
        this.audioContext = null;
        this.isPlaying = false;
        this.currentBeat = 0;
        this.totalBeats = 0; // 振り子アニメーション用のグローバルカウンター

        // デフォルト設定
        this.defaults = {
            tempo: 120,
            beatsPerBar: 4,
            volume: 70,
            soundType: 'click',
            rhythmPattern: 'simple',
            animationType: 'pendulum'
        };

        // 保存された設定を読み込むか、デフォルトを使用
        this.tempo = parseInt(localStorage.getItem('tempo')) || this.defaults.tempo;
        this.beatsPerBar = parseInt(localStorage.getItem('beatsPerBar')) || this.defaults.beatsPerBar;
        this.volume = (parseInt(localStorage.getItem('volume')) || this.defaults.volume) / 100;
        this.soundType = localStorage.getItem('soundType') || this.defaults.soundType;
        this.rhythmPattern = localStorage.getItem('rhythmPattern') || this.defaults.rhythmPattern;
        this.animationType = localStorage.getItem('animationType') || this.defaults.animationType;

        this.noteTime = 0.0;
        this.scheduleAheadTime = 0.1;
        this.nextNoteTime = 0.0;
        this.timerID = null;

        // タップテンポ用
        this.tapTimes = [];
        this.tapTimeout = null;

        this.initAudioContext();
        this.loadSettings();
        this.initEventListeners();
    }

    initAudioContext() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // 設定を読み込んでUIに反映
    loadSettings() {
        this.setTempo(this.tempo);
        this.setBeatsPerBar(this.beatsPerBar);
        this.setVolume(this.volume * 100);
        document.getElementById('soundType').value = this.soundType;
        document.getElementById('rhythmPattern').value = this.rhythmPattern;
        document.getElementById('animationType').value = this.animationType;
        this.setAnimationType(this.animationType);
    }

    // 設定を保存
    saveSettings() {
        localStorage.setItem('tempo', this.tempo);
        localStorage.setItem('beatsPerBar', this.beatsPerBar);
        localStorage.setItem('volume', Math.round(this.volume * 100));
        localStorage.setItem('soundType', this.soundType);
        localStorage.setItem('rhythmPattern', this.rhythmPattern);
        localStorage.setItem('animationType', this.animationType);
    }

    // 設定をリセット
    resetSettings() {
        if (this.isPlaying) {
            this.stop();
        }

        this.tempo = this.defaults.tempo;
        this.beatsPerBar = this.defaults.beatsPerBar;
        this.volume = this.defaults.volume / 100;
        this.soundType = this.defaults.soundType;
        this.rhythmPattern = this.defaults.rhythmPattern;
        this.animationType = this.defaults.animationType;

        this.loadSettings();
        this.saveSettings();
    }

    // 音を生成
    playSound(time, isAccent = false) {
        const osc = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        osc.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // 音色に応じた周波数設定
        switch(this.soundType) {
            case 'click':
                osc.frequency.value = isAccent ? 1000 : 800;
                gainNode.gain.value = this.volume * (isAccent ? 1.5 : 1);
                osc.type = 'sine';
                break;
            case 'beep':
                osc.frequency.value = isAccent ? 880 : 440;
                gainNode.gain.value = this.volume;
                osc.type = 'square';
                break;
            case 'wood':
                osc.frequency.value = isAccent ? 220 : 180;
                gainNode.gain.value = this.volume * 0.8;
                osc.type = 'triangle';
                break;
            case 'cowbell':
                osc.frequency.value = isAccent ? 540 : 400;
                gainNode.gain.value = this.volume * 0.9;
                osc.type = 'square';
                break;
        }

        // エンベロープ設定
        const attackTime = 0.001;
        const releaseTime = 0.05;

        gainNode.gain.setValueAtTime(gainNode.gain.value, time);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + releaseTime);

        osc.start(time);
        osc.stop(time + releaseTime);
    }

    // リズムパターンに基づいたスケジュール
    scheduleNote(beatNumber, time) {
        const isAccent = (beatNumber % this.beatsPerBar === 0);

        switch(this.rhythmPattern) {
            case 'simple':
                this.playSound(time, isAccent);
                break;
            case 'eighth':
                this.playSound(time, isAccent);
                this.playSound(time + (60.0 / this.tempo) / 2, false);
                break;
            case 'triplet':
                this.playSound(time, isAccent);
                this.playSound(time + (60.0 / this.tempo) / 3, false);
                this.playSound(time + (60.0 / this.tempo) * 2 / 3, false);
                break;
            case 'sixteenth':
                for(let i = 0; i < 4; i++) {
                    this.playSound(time + (60.0 / this.tempo) * i / 4, isAccent && i === 0);
                }
                break;
        }

        // ビジュアルフィードバック
        const delay = (time - this.audioContext.currentTime) * 1000;
        const totalBeatCount = this.totalBeats; // 現在のグローバル拍数をキャプチャ
        setTimeout(() => {
            this.updateVisuals(isAccent, beatNumber, totalBeatCount);
        }, delay);

        // グローバルカウンターをインクリメント
        this.totalBeats++;
    }

    // 次のノートをスケジュール
    scheduler() {
        while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.currentBeat, this.nextNoteTime);
            this.nextNote();
        }
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.tempo;
        this.nextNoteTime += secondsPerBeat;

        this.currentBeat++;
        if (this.currentBeat >= this.beatsPerBar) {
            this.currentBeat = 0;
        }
    }

    start() {
        if (this.isPlaying) return;

        if (!this.audioContext) {
            this.initAudioContext();
        }

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.isPlaying = true;
        this.currentBeat = 0;
        this.totalBeats = 0;
        this.nextNoteTime = this.audioContext.currentTime;
        this.timerID = setInterval(() => this.scheduler(), 25);

        this.updatePlayButton();
    }

    stop() {
        if (!this.isPlaying) return;

        this.isPlaying = false;
        clearInterval(this.timerID);
        this.currentBeat = 0;
        this.totalBeats = 0;

        this.updatePlayButton();
        this.resetVisuals();
    }

    toggle() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.start();
        }
    }

    setTempo(bpm) {
        this.tempo = Math.max(1, Math.min(300, bpm));
        document.getElementById('tempoSlider').value = this.tempo;
        document.getElementById('tempoInput').value = this.tempo;
        document.getElementById('bpm-display').textContent = this.tempo;
        this.saveSettings();
    }

    setBeatsPerBar(beats) {
        this.beatsPerBar = parseInt(beats);
        this.currentBeat = 0;
        this.updateBeatIndicator();
        this.saveSettings();
    }

    setVolume(vol) {
        this.volume = vol / 100;
        document.getElementById('volumeValue').textContent = vol + '%';
        this.saveSettings();
    }

    setSoundType(type) {
        this.soundType = type;
        this.saveSettings();
    }

    setRhythmPattern(pattern) {
        this.rhythmPattern = pattern;
        this.saveSettings();
    }

    setAnimationType(type) {
        this.animationType = type;

        // アニメーションクラスをリセット
        const visualDisplay = document.querySelector('.visual-display');
        visualDisplay.classList.remove('pulse-mode', 'flash-mode');

        if (type === 'pulse') {
            visualDisplay.classList.add('pulse-mode');
        } else if (type === 'flash') {
            visualDisplay.classList.add('flash-mode');
        }

        this.saveSettings();
    }

    // ビジュアル更新
    updateVisuals(isAccent, beatNumber, totalBeatCount) {
        this.updateBeatIndicator(beatNumber);

        const visualDisplay = document.querySelector('.visual-display');
        const bpmDisplay = document.getElementById('bpm-display');
        const pendulum = document.getElementById('pendulum');

        switch(this.animationType) {
            case 'pendulum':
                const maxAngle = 30;
                // グローバルカウンターで左右交互に振る（小節をまたいでも連続）
                // 初期位置を左側(-30deg)にするため、偶数で左(-1)、奇数で右(1)
                const direction = totalBeatCount % 2 === 0 ? -1 : 1;
                const angle = maxAngle * direction;

                // トランジション時間を拍の長さに合わせる
                const beatDuration = 60.0 / this.tempo;
                pendulum.style.transition = `transform ${beatDuration}s linear`;
                pendulum.style.transform = `rotate(${angle}deg)`;

                if (isAccent) {
                    pendulum.classList.add('accent');
                    setTimeout(() => pendulum.classList.remove('accent'), 300);
                }
                break;

            case 'pulse':
                bpmDisplay.classList.add('pulse');
                setTimeout(() => bpmDisplay.classList.remove('pulse'), 200);
                break;

            case 'flash':
                if (isAccent) {
                    bpmDisplay.classList.add('flash');
                    setTimeout(() => bpmDisplay.classList.remove('flash'), 150);
                }
                visualDisplay.classList.add('flash-active');
                setTimeout(() => visualDisplay.classList.remove('flash-active'), 100);
                break;
        }
    }

    resetVisuals() {
        const pendulum = document.getElementById('pendulum');
        pendulum.style.transform = 'rotate(-30deg)'; // 初期位置を左側に
        pendulum.classList.remove('accent');

        const bpmDisplay = document.getElementById('bpm-display');
        bpmDisplay.classList.remove('pulse', 'flash');

        const visualDisplay = document.querySelector('.visual-display');
        visualDisplay.classList.remove('flash-active');

        this.updateBeatIndicator();
    }

    updateBeatIndicator(beatNumber) {
        const indicator = document.getElementById('beat-indicator');
        if (beatNumber !== undefined) {
            // 再生中で特定のビート番号が指定された場合
            const currentBeatDisplay = beatNumber + 1;
            indicator.textContent = `${currentBeatDisplay}/${this.beatsPerBar}`;
        } else {
            // 停止中や初期化時
            indicator.textContent = `1/${this.beatsPerBar}`;
        }
    }

    updatePlayButton() {
        const playBtn = document.getElementById('playBtn');
        const playIcon = document.getElementById('playIcon');

        if (this.isPlaying) {
            playBtn.classList.add('playing');
            playIcon.textContent = '■';
        } else {
            playBtn.classList.remove('playing');
            playIcon.textContent = '▶';
        }
    }

    // タップテンポ機能
    handleTap() {
        const now = Date.now();
        this.tapTimes.push(now);

        // 2秒以上前のタップを削除
        this.tapTimes = this.tapTimes.filter(time => now - time < 2000);

        // タップタイムアウトをリセット
        if (this.tapTimeout) {
            clearTimeout(this.tapTimeout);
        }
        this.tapTimeout = setTimeout(() => {
            this.tapTimes = [];
        }, 2000);

        // 最低2回のタップが必要
        if (this.tapTimes.length >= 2) {
            const intervals = [];
            for (let i = 1; i < this.tapTimes.length; i++) {
                intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
            }

            const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
            const bpm = Math.round(60000 / avgInterval);

            this.setTempo(bpm);
        }
    }

    // イベントリスナー初期化
    initEventListeners() {
        // 再生/停止ボタン
        document.getElementById('playBtn').addEventListener('click', () => {
            this.toggle();
        });

        // タップテンポボタン
        document.getElementById('tapBtn').addEventListener('click', () => {
            this.handleTap();
        });

        // テンポスライダー
        document.getElementById('tempoSlider').addEventListener('input', (e) => {
            this.setTempo(parseInt(e.target.value));
        });

        // テンポ入力
        document.getElementById('tempoInput').addEventListener('input', (e) => {
            this.setTempo(parseInt(e.target.value));
        });

        // 拍子選択
        document.getElementById('beatsPerBar').addEventListener('change', (e) => {
            this.setBeatsPerBar(e.target.value);
        });

        // リズムパターン
        document.getElementById('rhythmPattern').addEventListener('change', (e) => {
            this.setRhythmPattern(e.target.value);
        });

        // 音色選択
        document.getElementById('soundType').addEventListener('change', (e) => {
            this.setSoundType(e.target.value);
        });

        // 音量スライダー
        document.getElementById('volumeSlider').addEventListener('input', (e) => {
            this.setVolume(parseInt(e.target.value));
        });

        // アニメーション選択
        document.getElementById('animationType').addEventListener('change', (e) => {
            this.setAnimationType(e.target.value);
        });

        // プリセットボタン
        document.querySelectorAll('.btn-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const bpm = parseInt(e.target.dataset.bpm);
                this.setTempo(bpm);
            });
        });

        // リセットボタン
        document.getElementById('resetBtn').addEventListener('click', () => {
            if (confirm(languageManager.currentLang === 'ja'
                ? '設定を初期状態にリセットしますか？'
                : 'Reset all settings to default?')) {
                this.resetSettings();
            }
        });

        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            // スペースキー: 再生/停止
            if (e.code === 'Space') {
                e.preventDefault();
                this.toggle();
            }

            // 上矢印: テンポ+1 (Shift押下時は+10)
            if (e.code === 'ArrowUp') {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                this.setTempo(this.tempo + step);
            }

            // 下矢印: テンポ-1 (Shift押下時は-10)
            if (e.code === 'ArrowDown') {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                this.setTempo(this.tempo - step);
            }

            // Tキー: タップテンポ
            if (e.code === 'KeyT') {
                e.preventDefault();
                this.handleTap();
            }
        });
    }
}

// テーマ切り替え機能
class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('theme') || 'dark';
        this.themeToggle = document.getElementById('themeToggle');

        this.init();
    }

    init() {
        // 保存されたテーマを適用
        this.applyTheme(this.currentTheme);

        // チェックボックスの変更イベント
        this.themeToggle.addEventListener('change', () => {
            this.toggleTheme();
        });
    }

    applyTheme(theme) {
        if (theme === 'light') {
            document.body.classList.add('light-mode');
            this.themeToggle.checked = true;
        } else {
            document.body.classList.remove('light-mode');
            this.themeToggle.checked = false;
        }
        this.currentTheme = theme;
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    }
}

// 言語管理クラス
class LanguageManager {
    constructor() {
        this.currentLang = localStorage.getItem('language') || 'ja';
        this.langToggle = document.getElementById('langToggle');

        // 翻訳辞書
        this.translations = {
            ja: {
                title: 'Metronome',
                start: 'スタート',
                tapTempo: 'タップテンポ',
                tempo: 'テンポ',
                timeSignature: '拍子',
                beats1: '1拍',
                beats2: '2拍',
                beats3: '3拍',
                beats4: '4拍',
                beats5: '5拍',
                beats6: '6拍',
                beats7: '7拍',
                beats8: '8拍',
                rhythm: 'リズムパターン',
                simple: 'シンプル',
                eighth: '8分音符',
                triplet: '3連符',
                sixteenth: '16分音符',
                sound: '音色',
                soundClick: 'クリック',
                soundBeep: 'ビープ',
                soundWood: 'ウッド',
                soundCowbell: 'カウベル',
                volume: '音量',
                animation: 'アニメーション',
                pendulum: '振り子',
                pulse: 'パルス',
                flash: '点滅',
                none: 'なし',
                presets: 'プリセット',
                shortcuts: 'キーボードショートカット',
                shortcutPlay: '再生/停止',
                shortcutTempo: 'テンポ ±1 (Shift押下で ±10)',
                shortcutTap: 'タップテンポ',
                reset: '設定をリセット'
            },
            en: {
                title: 'Metronome',
                start: 'Start',
                tapTempo: 'Tap Tempo',
                tempo: 'Tempo',
                timeSignature: 'Time Signature',
                beats1: '1 beat',
                beats2: '2 beats',
                beats3: '3 beats',
                beats4: '4 beats',
                beats5: '5 beats',
                beats6: '6 beats',
                beats7: '7 beats',
                beats8: '8 beats',
                rhythm: 'Rhythm Pattern',
                simple: 'Simple',
                eighth: 'Eighth Notes',
                triplet: 'Triplets',
                sixteenth: 'Sixteenth Notes',
                sound: 'Sound',
                soundClick: 'Click',
                soundBeep: 'Beep',
                soundWood: 'Wood',
                soundCowbell: 'Cowbell',
                volume: 'Volume',
                animation: 'Animation',
                pendulum: 'Pendulum',
                pulse: 'Pulse',
                flash: 'Flash',
                none: 'None',
                presets: 'Presets',
                shortcuts: 'Keyboard Shortcuts',
                shortcutPlay: 'Play/Stop',
                shortcutTempo: 'Tempo ±1 (Shift for ±10)',
                shortcutTap: 'Tap Tempo',
                reset: 'Reset Settings'
            }
        };

        this.init();
    }

    init() {
        // 保存された言語を適用
        this.applyLanguage(this.currentLang);

        // チェックボックスの変更イベント
        this.langToggle.addEventListener('change', () => {
            this.toggleLanguage();
        });
    }

    applyLanguage(lang) {
        if (lang === 'en') {
            this.langToggle.checked = true;
        } else {
            this.langToggle.checked = false;
        }
        this.currentLang = lang;
        this.updateTexts();
    }

    updateTexts() {
        const translations = this.translations[this.currentLang];

        // data-i18n属性を持つすべての要素を更新
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (translations[key]) {
                if (element.tagName === 'OPTION') {
                    element.textContent = translations[key];
                } else if (element.tagName === 'INPUT') {
                    element.value = translations[key];
                } else {
                    element.textContent = translations[key];
                }
            }
        });

        // 再生ボタンのテキストを更新
        const playText = document.getElementById('playText');
        if (playText) {
            playText.textContent = translations.start;
        }
    }

    toggleLanguage() {
        const newLang = this.currentLang === 'ja' ? 'en' : 'ja';
        this.applyLanguage(newLang);
        localStorage.setItem('language', newLang);
    }
}

// アプリケーション初期化
let metronome;
let themeManager;
let languageManager;

window.addEventListener('DOMContentLoaded', () => {
    metronome = new Metronome();
    themeManager = new ThemeManager();
    languageManager = new LanguageManager();
    console.log('メトロノームアプリが起動しました');
});
