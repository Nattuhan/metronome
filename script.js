// メトロノームクラス
class Metronome {
    constructor() {
        this.audioContext = null;
        this.isPlaying = false;
        this.currentBeat = 0;
        this.tempo = 120;
        this.beatsPerBar = 4;
        this.noteTime = 0.0;
        this.scheduleAheadTime = 0.1;
        this.nextNoteTime = 0.0;
        this.timerID = null;
        this.volume = 0.7;
        this.soundType = 'click';
        this.rhythmPattern = 'simple';
        this.animationType = 'pendulum';

        // タップテンポ用
        this.tapTimes = [];
        this.tapTimeout = null;

        this.initAudioContext();
        this.initEventListeners();
    }

    initAudioContext() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
        setTimeout(() => {
            this.updateVisuals(isAccent);
        }, delay);
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
        this.nextNoteTime = this.audioContext.currentTime;
        this.timerID = setInterval(() => this.scheduler(), 25);

        this.updatePlayButton();
    }

    stop() {
        if (!this.isPlaying) return;

        this.isPlaying = false;
        clearInterval(this.timerID);
        this.currentBeat = 0;

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
    }

    setBeatsPerBar(beats) {
        this.beatsPerBar = parseInt(beats);
        this.currentBeat = 0;
        this.updateBeatIndicator();
    }

    setVolume(vol) {
        this.volume = vol / 100;
        document.getElementById('volumeValue').textContent = vol + '%';
    }

    setSoundType(type) {
        this.soundType = type;
    }

    setRhythmPattern(pattern) {
        this.rhythmPattern = pattern;
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
    }

    // ビジュアル更新
    updateVisuals(isAccent) {
        this.updateBeatIndicator();

        const visualDisplay = document.querySelector('.visual-display');
        const bpmDisplay = document.getElementById('bpm-display');
        const pendulum = document.getElementById('pendulum');

        switch(this.animationType) {
            case 'pendulum':
                const maxAngle = 30;
                const direction = this.currentBeat % 2 === 0 ? 1 : -1;
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
        pendulum.style.transform = 'rotate(0deg)';
        pendulum.classList.remove('accent');

        const bpmDisplay = document.getElementById('bpm-display');
        bpmDisplay.classList.remove('pulse', 'flash');

        const visualDisplay = document.querySelector('.visual-display');
        visualDisplay.classList.remove('flash-active');

        this.updateBeatIndicator();
    }

    updateBeatIndicator() {
        const indicator = document.getElementById('beat-indicator');
        const currentBeatDisplay = this.isPlaying ? this.currentBeat + 1 : 1;
        indicator.textContent = `${currentBeatDisplay}/${this.beatsPerBar}`;
    }

    updatePlayButton() {
        const playBtn = document.getElementById('playBtn');
        const playIcon = document.getElementById('playIcon');
        const playText = document.getElementById('playText');

        if (this.isPlaying) {
            playBtn.classList.add('playing');
            playIcon.textContent = '■';
            playText.textContent = 'ストップ';
        } else {
            playBtn.classList.remove('playing');
            playIcon.textContent = '▶';
            playText.textContent = 'スタート';
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

        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            // スペースキー: 再生/停止
            if (e.code === 'Space') {
                e.preventDefault();
                this.toggle();
            }

            // 上矢印: テンポ+1
            if (e.code === 'ArrowUp') {
                e.preventDefault();
                this.setTempo(this.tempo + 1);
            }

            // 下矢印: テンポ-1
            if (e.code === 'ArrowDown') {
                e.preventDefault();
                this.setTempo(this.tempo - 1);
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

// アプリケーション初期化
let metronome;
let themeManager;

window.addEventListener('DOMContentLoaded', () => {
    metronome = new Metronome();
    themeManager = new ThemeManager();
    console.log('メトロノームアプリが起動しました');
});
