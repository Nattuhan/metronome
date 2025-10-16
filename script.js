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
        this.subdivisionSound = localStorage.getItem('subdivisionSound') === 'true';
        this.subdivisionVolume = (parseInt(localStorage.getItem('subdivisionVolume')) || 50) / 100;

        this.noteTime = 0.0;
        this.scheduleAheadTime = 0.1;
        this.nextNoteTime = 0.0;
        this.timerID = null;

        // タップテンポ用
        this.tapTimes = [];
        this.tapTimeout = null;

        // タイマー機能
        this.timerEnabled = false;
        this.timerMinutes = 0;
        this.timerSeconds = 0;
        this.timerRemaining = 0; // 残り時間（秒）
        this.timerInterval = null;

        // カスタムプリセット
        this.customPresets = this.loadCustomPresets();
        this.activePresetId = null;

        this.initAudioContext();
        this.loadSettings();
        this.initEventListeners();
        this.renderPresetsList();
    }

    initAudioContext() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // 設定を読み込んでUIに反映
    loadSettings() {
        this.setTempo(this.tempo);
        this.setBeatsPerBar(this.beatsPerBar);
        this.setVolume(this.volume * 100);
        document.getElementById('beatsPerBar').value = this.beatsPerBar;
        document.getElementById('soundType').value = this.soundType;
        document.getElementById('rhythmPattern').value = this.rhythmPattern;
        document.getElementById('animationType').value = this.animationType;
        document.getElementById('subdivisionSound').checked = this.subdivisionSound;
        this.setSubdivisionVolume(this.subdivisionVolume * 100);
        this.toggleSubdivisionVolumeControl();
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
        localStorage.setItem('subdivisionSound', this.subdivisionSound);
        localStorage.setItem('subdivisionVolume', Math.round(this.subdivisionVolume * 100));
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
        this.subdivisionSound = false;
        this.subdivisionVolume = 0.5;

        this.loadSettings();
        this.saveSettings();
    }

    // 音を生成
    playSound(time, isAccent = false, isSubdivision = false) {
        const osc = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        osc.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // 細分化された音の場合、別の音を使用
        if (isSubdivision && this.subdivisionSound) {
            // 弱拍専用の音（より低く、短く、音量は調整可能）
            switch(this.soundType) {
                case 'click':
                    osc.frequency.value = 400;
                    gainNode.gain.value = this.volume * this.subdivisionVolume;
                    osc.type = 'sine';
                    break;
                case 'beep':
                    osc.frequency.value = 220;
                    gainNode.gain.value = this.volume * this.subdivisionVolume;
                    osc.type = 'square';
                    break;
                case 'wood':
                    osc.frequency.value = 100;
                    gainNode.gain.value = this.volume * this.subdivisionVolume * 0.8;
                    osc.type = 'triangle';
                    break;
                case 'cowbell':
                    osc.frequency.value = 200;
                    gainNode.gain.value = this.volume * this.subdivisionVolume;
                    osc.type = 'square';
                    break;
            }
        } else {
            // 通常の音色に応じた周波数設定
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
        }

        // エンベロープ設定
        const attackTime = 0.001;
        const releaseTime = isSubdivision && this.subdivisionSound ? 0.03 : 0.05; // 弱拍は短く

        gainNode.gain.setValueAtTime(gainNode.gain.value, time);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + releaseTime);

        osc.start(time);
        osc.stop(time + releaseTime);
    }

    // リズムパターンに基づいて音を再生（共通ロジック）
    playRhythmPattern(beatNumber, time) {
        const isAccent = (beatNumber % this.beatsPerBar === 0);

        switch(this.rhythmPattern) {
            case 'simple':
                this.playSound(time, isAccent, false);
                break;
            case 'eighth':
                this.playSound(time, isAccent, false);
                this.playSound(time + (60.0 / this.tempo) / 2, false, true); // 弱拍
                break;
            case 'triplet':
                this.playSound(time, isAccent, false);
                this.playSound(time + (60.0 / this.tempo) / 3, false, true); // 弱拍
                this.playSound(time + (60.0 / this.tempo) * 2 / 3, false, true); // 弱拍
                break;
            case 'sixteenth':
                for(let i = 0; i < 4; i++) {
                    this.playSound(time + (60.0 / this.tempo) * i / 4, isAccent && i === 0, i > 0); // i > 0は弱拍
                }
                break;
            case 'sextuplet':
                for(let i = 0; i < 6; i++) {
                    this.playSound(time + (60.0 / this.tempo) * i / 6, isAccent && i === 0, i > 0); // i > 0は弱拍
                }
                break;
        }
    }

    // リズムパターンに基づいたスケジュール
    scheduleNote(beatNumber, time) {
        const isAccent = (beatNumber % this.beatsPerBar === 0);

        // 音を再生
        this.playRhythmPattern(beatNumber, time);

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

        // 1拍目を即座に再生（音とビジュアル）
        this.playRhythmPattern(0, this.audioContext.currentTime);
        this.updateVisuals(true, 0, 1); // totalBeatCount=1で右側に動かす
        // totalBeatsは0のまま（次のscheduleNoteで1になる）

        // 次の拍のスケジュール時間を設定
        const secondsPerBeat = 60.0 / this.tempo;
        this.nextNoteTime += secondsPerBeat;
        this.currentBeat = 1; // 次は2拍目から

        this.timerID = setInterval(() => this.scheduler(), 25);

        // タイマーが有効な場合、カウントダウンを開始
        if (this.timerEnabled) {
            this.startTimer();
        }

        this.updatePlayButton();
    }

    stop() {
        if (!this.isPlaying) return;

        this.isPlaying = false;
        clearInterval(this.timerID);
        this.currentBeat = 0;
        this.totalBeats = 0;

        // タイマーを停止
        this.stopTimer();

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
        // 小数点第一位まで対応（1.0〜300.0）
        this.tempo = Math.max(1, Math.min(300, parseFloat(bpm)));

        // スライダーは整数のみ（小数点は反映しない）
        document.getElementById('tempoSlider').value = Math.round(this.tempo);

        // 入力とBPM表示は小数点第一位まで表示
        const tempoDisplay = Number.isInteger(this.tempo) ? this.tempo : this.tempo.toFixed(1);
        document.getElementById('tempoInput').value = tempoDisplay;
        document.getElementById('bpm-display').textContent = tempoDisplay;

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

    setSubdivisionVolume(vol) {
        this.subdivisionVolume = vol / 100;
        document.getElementById('subdivisionVolumeSlider').value = vol;
        document.getElementById('subdivisionVolumeValue').textContent = vol + '%';
        this.saveSettings();
    }

    toggleSubdivisionVolumeControl() {
        const control = document.getElementById('subdivisionVolumeControl');
        if (this.subdivisionSound) {
            control.style.display = 'block';
        } else {
            control.style.display = 'none';
        }
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

    // タイマー機能
    startTimer() {
        // 残り時間を計算（分と秒から秒数に変換）
        this.timerRemaining = this.timerMinutes * 60 + this.timerSeconds;

        if (this.timerRemaining <= 0) {
            return;
        }

        this.updateTimerDisplay();

        // 1秒ごとにカウントダウン
        this.timerInterval = setInterval(() => {
            this.timerRemaining--;
            this.updateTimerDisplay();

            // 残り10秒以下で警告表示
            const timerDisplay = document.getElementById('timerDisplayHeader');
            if (this.timerRemaining <= 10 && this.timerRemaining > 0) {
                timerDisplay.classList.add('warning');
            }

            // タイマー終了
            if (this.timerRemaining <= 0) {
                this.onTimerComplete();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        const timerDisplay = document.getElementById('timerDisplayHeader');
        timerDisplay.classList.remove('warning');

        // タイマーを初期表示に戻す
        if (this.timerEnabled) {
            const totalSeconds = this.timerMinutes * 60 + this.timerSeconds;
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        } else {
            timerDisplay.textContent = '--:--';
        }
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timerRemaining / 60);
        const seconds = this.timerRemaining % 60;
        const timerDisplay = document.getElementById('timerDisplayHeader');
        timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    onTimerComplete() {
        // タイマー終了処理
        this.stopTimer();
        this.stop(); // メトロノームを停止

        // アラーム音を鳴らす（短く3回）
        this.playAlarm();
    }

    playAlarm() {
        const alarmTimes = [0, 0.15, 0.3]; // 3回のアラーム音

        alarmTimes.forEach(offset => {
            setTimeout(() => {
                const osc = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();

                osc.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                // アラーム音: 高めの周波数で目立つように
                osc.frequency.value = 1200;
                osc.type = 'sine';
                gainNode.gain.value = this.volume * 1.2;

                const now = this.audioContext.currentTime;
                gainNode.gain.setValueAtTime(gainNode.gain.value, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

                osc.start(now);
                osc.stop(now + 0.1);
            }, offset * 1000);
        });
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

        // テンポ入力（小数点対応）
        document.getElementById('tempoInput').addEventListener('input', (e) => {
            this.setTempo(parseFloat(e.target.value));
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

        // 弱拍音オプション
        document.getElementById('subdivisionSound').addEventListener('change', (e) => {
            this.subdivisionSound = e.target.checked;
            this.toggleSubdivisionVolumeControl();
            this.saveSettings();
        });

        // 細分化拍音量スライダー
        document.getElementById('subdivisionVolumeSlider').addEventListener('input', (e) => {
            this.setSubdivisionVolume(parseInt(e.target.value));
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
            const lang = localStorage.getItem('language') || 'ja';
            if (confirm(lang === 'ja'
                ? '設定を初期状態にリセットしますか？'
                : 'Reset all settings to default?')) {
                this.resetSettings();
            }
        });

        // プリセット保存ボタン
        document.getElementById('savePresetBtn').addEventListener('click', () => {
            this.saveCurrentAsPreset();
        });

        // タイマー設定
        document.getElementById('timerMinutes').addEventListener('input', (e) => {
            this.timerMinutes = Math.max(0, parseInt(e.target.value) || 0);
            this.updateTimerPreview();
        });

        document.getElementById('timerSeconds').addEventListener('input', (e) => {
            let seconds = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
            e.target.value = seconds;
            this.timerSeconds = seconds;
            this.updateTimerPreview();
        });

        document.getElementById('timerEnabled').addEventListener('change', (e) => {
            this.timerEnabled = e.target.checked;
            this.updateTimerPreview();
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

    // タイマープレビューを更新
    updateTimerPreview() {
        const timerDisplay = document.getElementById('timerDisplayHeader');

        if (this.timerEnabled) {
            const totalSeconds = this.timerMinutes * 60 + this.timerSeconds;
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        } else {
            timerDisplay.textContent = '--:--';
        }
    }

    // カスタムプリセット管理
    loadCustomPresets() {
        const saved = localStorage.getItem('customPresets');
        return saved ? JSON.parse(saved) : [];
    }

    saveCustomPresets() {
        localStorage.setItem('customPresets', JSON.stringify(this.customPresets));
    }

    saveCurrentAsPreset() {
        const lang = localStorage.getItem('language') || 'ja';
        const name = prompt(lang === 'ja'
            ? 'プリセット名を入力してください:'
            : 'Enter preset name:');

        if (!name || name.trim() === '') return;

        const preset = {
            id: Date.now(),
            name: name.trim(),
            tempo: this.tempo,
            beatsPerBar: this.beatsPerBar,
            rhythmPattern: this.rhythmPattern
        };

        this.customPresets.push(preset);
        this.saveCustomPresets();
        this.renderPresetsList();
    }

    loadPreset(presetId) {
        const preset = this.customPresets.find(p => p.id === presetId);
        if (!preset) return;

        this.setTempo(preset.tempo);
        this.setBeatsPerBar(preset.beatsPerBar);
        this.setRhythmPattern(preset.rhythmPattern);

        // UIを更新
        document.getElementById('beatsPerBar').value = preset.beatsPerBar;
        document.getElementById('rhythmPattern').value = preset.rhythmPattern;

        this.activePresetId = presetId;
        this.renderPresetsList();
    }

    deletePreset(presetId) {
        const preset = this.customPresets.find(p => p.id === presetId);
        if (!preset) return;

        const lang = localStorage.getItem('language') || 'ja';
        const confirmMsg = lang === 'ja'
            ? `「${preset.name}」を削除しますか？`
            : `Delete "${preset.name}"?`;

        if (!confirm(confirmMsg)) return;

        this.customPresets = this.customPresets.filter(p => p.id !== presetId);
        if (this.activePresetId === presetId) {
            this.activePresetId = null;
        }
        this.saveCustomPresets();
        this.renderPresetsList();
    }

    getRhythmPatternName(pattern) {
        const lang = localStorage.getItem('language') || 'ja';
        const translationsMap = {
            ja: {
                simple: '4分音符',
                eighth: '8分音符',
                triplet: '3連符',
                sixteenth: '16分音符',
                sextuplet: '6連符'
            },
            en: {
                simple: 'Quarter Notes',
                eighth: 'Eighth Notes',
                triplet: 'Triplets',
                sixteenth: 'Sixteenth Notes',
                sextuplet: 'Sextuplets'
            }
        };
        return translationsMap[lang][pattern] || pattern;
    }

    renderPresetsList() {
        const container = document.getElementById('savedPresetsList');
        container.innerHTML = '';

        if (this.customPresets.length === 0) {
            const lang = localStorage.getItem('language') || 'ja';
            const empty = document.createElement('div');
            empty.style.color = '#888';
            empty.style.textAlign = 'center';
            empty.style.padding = '20px 0';
            empty.style.fontSize = '0.9rem';
            empty.textContent = lang === 'ja'
                ? '保存されたプリセットはありません'
                : 'No saved presets';
            container.appendChild(empty);
            return;
        }

        this.customPresets.forEach(preset => {
            const item = document.createElement('div');
            item.className = 'preset-item';
            if (preset.id === this.activePresetId) {
                item.classList.add('active');
            }

            const header = document.createElement('div');
            header.className = 'preset-item-header';

            const name = document.createElement('div');
            name.className = 'preset-name';
            name.textContent = preset.name;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'preset-delete-btn';
            deleteBtn.textContent = '×';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deletePreset(preset.id);
            });

            header.appendChild(name);
            header.appendChild(deleteBtn);

            const info = document.createElement('div');
            info.className = 'preset-info';

            const tempoRow = document.createElement('div');
            tempoRow.className = 'preset-info-row';
            tempoRow.innerHTML = `
                <span class="preset-info-label">Tempo:</span>
                <span class="preset-info-value">${preset.tempo} BPM</span>
            `;

            const lang = localStorage.getItem('language') || 'ja';
            const beatRow = document.createElement('div');
            beatRow.className = 'preset-info-row';
            beatRow.innerHTML = `
                <span class="preset-info-label">${lang === 'ja' ? '拍子:' : 'Beats:'}</span>
                <span class="preset-info-value">${preset.beatsPerBar}/4</span>
            `;

            const rhythmRow = document.createElement('div');
            rhythmRow.className = 'preset-info-row';
            rhythmRow.innerHTML = `
                <span class="preset-info-label">${lang === 'ja' ? 'リズム:' : 'Rhythm:'}</span>
                <span class="preset-info-value">${this.getRhythmPatternName(preset.rhythmPattern)}</span>
            `;

            info.appendChild(tempoRow);
            info.appendChild(beatRow);
            info.appendChild(rhythmRow);

            item.appendChild(header);
            item.appendChild(info);

            // アイテムクリックでロード
            item.addEventListener('click', () => {
                this.loadPreset(preset.id);
            });

            container.appendChild(item);
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
                simple: '4分音符',
                eighth: '8分音符',
                triplet: '3連符',
                sixteenth: '16分音符',
                sextuplet: '6連符',
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
                reset: '設定をリセット',
                subdivisionSound: '細分化拍で別の音を使用',
                subdivisionVolume: '細分化拍の音量',
                timer: 'タイマー',
                minutes: '分',
                seconds: '秒',
                timerEnabled: 'タイマーを有効にする',
                savedPresets: 'プリセット',
                savePreset: '+ 保存',
                musicAnalysis: '音楽解析',
                uploadMusic: '音楽をアップロード',
                uploadHint: 'クリックまたはドラッグ&ドロップ',
                fileName: 'ファイル',
                detectedBPM: '検出BPM',
                playMusic: '▶ 再生',
                stopMusic: '■ 停止',
                removeMusic: '× 削除',
                syncWithMetronome: 'メトロノームと同期',
                analyzing: '解析中...',
                musicVolume: '曲の音量'
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
                simple: 'Quarter Notes',
                eighth: 'Eighth Notes',
                triplet: 'Triplets',
                sixteenth: 'Sixteenth Notes',
                sextuplet: 'Sextuplets',
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
                reset: 'Reset Settings',
                subdivisionSound: 'Different sound for subdivisions',
                subdivisionVolume: 'Subdivision Volume',
                timer: 'Timer',
                minutes: 'min',
                seconds: 'sec',
                timerEnabled: 'Enable timer',
                savedPresets: 'Presets',
                savePreset: '+ Save',
                musicAnalysis: 'Music Analysis',
                uploadMusic: 'Upload Music',
                uploadHint: 'Click or drag & drop',
                fileName: 'File',
                detectedBPM: 'Detected BPM',
                playMusic: '▶ Play',
                stopMusic: '■ Stop',
                removeMusic: '× Remove',
                syncWithMetronome: 'Sync with metronome',
                analyzing: 'Analyzing...',
                musicVolume: 'Music Volume'
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

        // プリセットリストを再レンダリング（言語が変わったので）
        if (window.metronome) {
            metronome.renderPresetsList();
        }
    }
}

// 音楽解析クラス
class MusicAnalyzer {
    constructor(metronome) {
        this.metronome = metronome;
        this.audioContext = metronome.audioContext;
        this.audioBuffer = null;
        this.sourceNode = null;
        this.gainNode = null; // 音量調整用
        this.musicVolume = 0.7; // デフォルト音量70%
        this.isPlaying = false;
        this.fileName = null;
        this.detectedBPM = null;
        this.syncWithMetronome = true; // デフォルトでオン
        this.startTime = 0;
        this.pausedAt = 0; // 一時停止した位置（秒）
        this.firstBeatOffset = 0; // 最初の音の開始位置（秒）
        this.playheadUpdateInterval = null; // 再生線更新用

        this.initEventListeners();
    }

    initEventListeners() {
        // ファイル入力
        const fileInput = document.getElementById('audioFileInput');
        const uploadArea = document.getElementById('fileUploadArea');
        const uploadPlaceholder = document.getElementById('uploadPlaceholder');

        // クリックでファイル選択
        uploadPlaceholder.addEventListener('click', () => {
            fileInput.click();
        });

        // ファイル選択
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadAudioFile(file);
            }
        });

        // ドラッグ&ドロップ
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');

            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('audio/')) {
                this.loadAudioFile(file);
            }
        });

        // 再生/停止ボタン
        document.getElementById('playMusicBtn').addEventListener('click', () => {
            this.togglePlayback();
        });

        // 削除ボタン
        document.getElementById('removeMusicBtn').addEventListener('click', () => {
            this.removeMusic();
        });

        // 同期チェックボックス
        document.getElementById('syncWithMetronome').addEventListener('change', (e) => {
            this.syncWithMetronome = e.target.checked;
        });

        // 曲の音量スライダー
        document.getElementById('musicVolumeSlider').addEventListener('input', (e) => {
            this.setMusicVolume(parseInt(e.target.value));
        });

        // 波形クリックでジャンプ
        const waveformContainer = document.getElementById('waveformContainer');
        waveformContainer.addEventListener('click', (e) => {
            if (!this.audioBuffer) return;

            const rect = waveformContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const ratio = clickX / rect.width;

            this.seekTo(ratio);
        });
    }

    setMusicVolume(vol) {
        this.musicVolume = vol / 100;
        document.getElementById('musicVolumeValue').textContent = vol + '%';

        // GainNodeが存在する場合、リアルタイムで音量を更新
        if (this.gainNode) {
            this.gainNode.gain.value = this.musicVolume;
        }
    }

    async loadAudioFile(file) {
        this.fileName = file.name;

        // UI更新: 解析中表示
        this.showProgress(true);

        try {
            // ファイルを読み込む
            const arrayBuffer = await file.arrayBuffer();

            // Web Audio APIでデコード
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

            // BPM検出と最初の音の位置検出
            this.detectedBPM = await this.detectBPM();
            this.firstBeatOffset = await this.detectFirstBeat();

            // UI更新
            this.showMusicInfo();
            this.drawWaveform(); // 波形を描画
            this.showProgress(false);

            // 検出されたBPMをメトロノームに反映
            if (this.detectedBPM) {
                this.metronome.setTempo(this.detectedBPM);
            }

        } catch (error) {
            console.error('Audio loading error:', error);
            alert('音楽ファイルの読み込みに失敗しました。');
            this.showProgress(false);
        }
    }

    async detectBPM() {
        // BPM検出アルゴリズム（複素正弦波との相関）
        // 参考: https://www.wizard-notes.com/entry/music-analysis/compute-bpm
        const channelData = this.audioBuffer.getChannelData(0);
        const sampleRate = this.audioBuffer.sampleRate;

        // 最初の100秒を解析（長時間解析でより高精度に）
        const duration = 100;
        const maxSamples = Math.min(channelData.length, sampleRate * duration);

        // エネルギーエンベロープを計算（振幅の絶対値）
        const windowSize = Math.floor(sampleRate * 0.05); // 50ms
        const hopSize = Math.floor(sampleRate * 0.01);    // 10ms
        const envelope = [];

        for (let i = 0; i < maxSamples - windowSize; i += hopSize) {
            let sum = 0;
            for (let j = 0; j < windowSize; j++) {
                sum += Math.abs(channelData[i + j]);
            }
            envelope.push(sum / windowSize);
        }

        console.log(`エンベロープサンプル数: ${envelope.length}`);

        // 200Hzにダウンサンプリング（エンベロープの実効サンプルレート）
        const envelopeSampleRate = sampleRate / hopSize;

        // 各BPM候補に対して複素正弦波との内積を計算
        // まず粗い探索(0.1刻み)で範囲を絞る
        const minBPM = 60;
        const maxBPM = 240;
        const coarseStep = 0.1;

        const coarseCorrelations = [];

        for (let bpm = minBPM; bpm <= maxBPM; bpm += coarseStep) {
            const omega = 2 * Math.PI * (bpm / 60) / envelopeSampleRate;
            let real = 0;
            let imag = 0;

            for (let i = 0; i < envelope.length; i++) {
                real += envelope[i] * Math.cos(omega * i);
                imag += envelope[i] * Math.sin(omega * i);
            }

            const magnitude = Math.sqrt(real * real + imag * imag);
            coarseCorrelations.push({ bpm, magnitude });
        }

        // 上位複数ピークを見つける
        coarseCorrelations.sort((a, b) => b.magnitude - a.magnitude);

        // 上位10ピークとその2倍のBPM周辺を細かく探索
        const peaksToRefine = new Set();
        for (let i = 0; i < Math.min(10, coarseCorrelations.length); i++) {
            const peakBPM = coarseCorrelations[i].bpm;
            peaksToRefine.add(peakBPM);

            // 2倍も追加（オクターブエラー対策）
            if (peakBPM * 2 <= maxBPM) {
                peaksToRefine.add(peakBPM * 2);
            }
        }

        console.log(`粗い探索のピーク（細かく探索する範囲）:`, Array.from(peaksToRefine).slice(0, 5).join(', '));

        // 各ピーク周辺を細かく探索(0.01刻み、±3 BPMの範囲)
        const fineStep = 0.01;
        const correlations = [];

        for (const centerBPM of peaksToRefine) {
            const fineMin = Math.max(minBPM, centerBPM - 3);
            const fineMax = Math.min(maxBPM, centerBPM + 3);

            for (let bpm = fineMin; bpm <= fineMax; bpm += fineStep) {
                const omega = 2 * Math.PI * (bpm / 60) / envelopeSampleRate;
                let real = 0;
                let imag = 0;

                for (let i = 0; i < envelope.length; i++) {
                    real += envelope[i] * Math.cos(omega * i);
                    imag += envelope[i] * Math.sin(omega * i);
                }

                const magnitude = Math.sqrt(real * real + imag * imag);
                correlations.push({ bpm, magnitude });
            }
        }

        // BPMで重複を排除（同じBPM値の場合は強度が高い方を残す）
        const seenBPMs = new Map();

        for (const corr of correlations) {
            // 0.001精度でキー化（より細かく）
            const bpmKey = Math.round(corr.bpm * 1000);
            if (!seenBPMs.has(bpmKey) || seenBPMs.get(bpmKey).magnitude < corr.magnitude) {
                seenBPMs.set(bpmKey, corr);
            }
        }

        // 重複を排除した配列に置き換え
        correlations.length = 0;
        for (const corr of seenBPMs.values()) {
            correlations.push(corr);
        }

        // 最大相関を持つBPMを探す
        correlations.sort((a, b) => b.magnitude - a.magnitude);

        console.log('上位BPM候補 (ユニーク):', correlations.slice(0, 10).map(c =>
            `BPM ${c.bpm.toFixed(1)} (強度: ${c.magnitude.toFixed(2)})`
        ).join(', '));

        // 特定BPM付近の強度を確認（デバッグ用）
        const around192 = correlations.filter(c => c.bpm >= 190 && c.bpm <= 194);
        console.log('190-194付近:', around192.slice(0, 5).map(c =>
            `BPM ${c.bpm.toFixed(1)} (強度: ${c.magnitude.toFixed(2)})`
        ).join(', '));

        // オクターブエラー補正: 最上位候補が100未満なら2倍を検討
        const topBPM = correlations[0].bpm;
        const topMagnitude = correlations[0].magnitude;

        let detectedBPM;

        if (topBPM < 100) {
            // topBPMの2倍付近（±5 BPM）に有意な信号があるかチェック
            const expectedDouble = topBPM * 2; // 96 * 2 = 192
            const searchMin = expectedDouble - 5; // 187
            const searchMax = expectedDouble + 5; // 197

            // この範囲でローカルピークを探す（周辺より強度が高いポイント）
            const highRangeCandidates = correlations.filter(c =>
                c.bpm >= searchMin && c.bpm <= searchMax
            );

            console.log(`高BPM範囲 (${searchMin.toFixed(1)}-${searchMax.toFixed(1)}): ${highRangeCandidates.length}個`);

            if (highRangeCandidates.length > 0) {
                // この範囲の最大値を見つける
                highRangeCandidates.sort((a, b) => b.magnitude - a.magnitude);
                const localPeak = highRangeCandidates[0];

                console.log(`高BPM範囲のローカルピーク: BPM ${localPeak.bpm.toFixed(2)} (強度: ${localPeak.magnitude.toFixed(2)})`);

                // ローカルピーク周辺±0.3 BPMの加重平均を計算（より狭い範囲で精密に）
                const nearPeak = highRangeCandidates.filter(c =>
                    Math.abs(c.bpm - localPeak.bpm) <= 0.3
                );

                let weightedSum = 0;
                let totalWeight = 0;

                for (const corr of nearPeak) {
                    weightedSum += corr.bpm * corr.magnitude;
                    totalWeight += corr.magnitude;
                }

                const weightedAvg = weightedSum / totalWeight;
                detectedBPM = Math.round(weightedAvg * 100) / 100; // 0.01刻み

                console.log(`ローカルピーク周辺の加重平均: ${nearPeak.length}個, 加重平均=${weightedAvg.toFixed(3)} → ${detectedBPM}`);
            } else {
                // 190-200付近に信号がない場合のみ、96付近を2倍する
                let weightedSum = 0;
                let totalWeight = 0;
                const candidates = [];

                for (let i = 0; i < Math.min(20, correlations.length); i++) {
                    const corr = correlations[i];
                    if (corr.bpm >= 90 && corr.bpm <= 100) {
                        const bpm2x = corr.bpm * 2;
                        weightedSum += bpm2x * corr.magnitude;
                        totalWeight += corr.magnitude;
                        candidates.push({ bpm: corr.bpm, bpm2x, magnitude: corr.magnitude });
                    }
                }

                const doubledBPMs = candidates.map(c => c.bpm2x);

                if (doubledBPMs.length > 0) {
                    const weightedAvg = weightedSum / totalWeight;
                    detectedBPM = Math.round(weightedAvg * 100) / 100; // 0.01刻み

                    const simpleAvg = doubledBPMs.reduce((a, b) => a + b) / doubledBPMs.length;
                    console.log(`2倍補正: ${doubledBPMs.length}個, 単純平均=${simpleAvg.toFixed(3)}, 加重平均=${weightedAvg.toFixed(3)} → ${detectedBPM}`);
                } else {
                    detectedBPM = Math.round(topBPM * 100) / 100;
                }
            }
        } else {
            // 100以上ならそのまま採用
            detectedBPM = Math.round(topBPM * 10) / 10;
        }

        console.log(`✓ 検出BPM: ${detectedBPM}`);

        return detectedBPM;
    }

    async detectFirstBeat() {
        // 最初の音の開始位置を検出
        const channelData = this.audioBuffer.getChannelData(0);
        const sampleRate = this.audioBuffer.sampleRate;

        // 最大音量を探す（効率的に）
        let maxAmplitude = 0;
        for (let i = 0; i < channelData.length; i++) {
            const abs = Math.abs(channelData[i]);
            if (abs > maxAmplitude) {
                maxAmplitude = abs;
            }
        }

        // 閾値を設定（最大音量の5%）
        const threshold = maxAmplitude * 0.05;

        // 最初に閾値を超えるサンプルを探す
        for (let i = 0; i < channelData.length; i++) {
            if (Math.abs(channelData[i]) > threshold) {
                // サンプル位置を秒に変換
                return i / sampleRate;
            }
        }

        return 0; // 見つからなければ0を返す
    }

    togglePlayback() {
        if (this.isPlaying) {
            this.stopMusic();
        } else {
            this.playMusic();
        }
    }

    playMusic() {
        console.log('========== playMusic START ==========');
        console.log(`audioBuffer exists=${!!this.audioBuffer}`);
        console.log(`isPlaying=${this.isPlaying}`);
        console.log(`pausedAt=${this.pausedAt}`);
        console.log(`firstBeatOffset=${this.firstBeatOffset}`);

        if (!this.audioBuffer) {
            console.log('No audioBuffer, returning');
            return;
        }

        // 既存のソースがあれば停止してonendedをクリア
        if (this.sourceNode) {
            try {
                console.log('Stopping existing sourceNode in playMusic...');
                this.sourceNode.onended = null; // イベントハンドラをクリア
                this.sourceNode.stop();
            } catch (e) {
                console.log('sourceNode stop error in playMusic:', e.message);
            }
            this.sourceNode = null;
        }

        const offset = this.pausedAt || this.firstBeatOffset;
        console.log(`offset=${offset}秒, audioBuffer.duration=${this.audioBuffer.duration}秒`);

        // offsetが曲の長さを超えていないかチェック
        if (offset >= this.audioBuffer.duration) {
            console.log('ERROR: offset exceeds duration, resetting to 0');
            this.pausedAt = 0;
            offset = this.firstBeatOffset;
        }

        // 新しいソースノードとGainNodeを作成
        this.sourceNode = this.audioContext.createBufferSource();
        this.gainNode = this.audioContext.createGain();
        this.sourceNode.buffer = this.audioBuffer;
        this.gainNode.gain.value = this.musicVolume;
        this.sourceNode.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
        console.log('New sourceNode created and connected');

        // 再生終了時の処理（このsourceNodeへの参照を保持）
        const currentSourceNode = this.sourceNode;
        this.sourceNode.onended = () => {
            console.log('sourceNode ended event fired');
            // このイベントが現在のsourceNodeのものか確認
            if (this.sourceNode === currentSourceNode) {
                console.log('Ending playback (valid onended event)');
                this.isPlaying = false;
                this.pausedAt = 0;
                this.updatePlayButton();
                this.stopPlayheadUpdate();
                if (this.syncWithMetronome) {
                    this.metronome.stop();
                }
            } else {
                console.log('Ignoring onended event from old sourceNode');
            }
        };

        // 曲を再生開始
        this.sourceNode.start(this.audioContext.currentTime, offset);
        this.isPlaying = true;
        this.startTime = this.audioContext.currentTime - offset;
        console.log(`sourceNode started at offset=${offset}, isPlaying=${this.isPlaying}, startTime=${this.startTime}`);

        this.updatePlayButton();
        this.startPlayheadUpdate();
        console.log('PlayButton and Playhead updated');

        // メトロノームと同期する場合
        if (this.syncWithMetronome) {
            console.log('Syncing with metronome...');
            console.log(`metronome.isPlaying before stop=${this.metronome.isPlaying}`);

            // メトロノームが再生中なら停止
            if (this.metronome.isPlaying) {
                console.log('Stopping metronome...');
                this.metronome.stop();
                console.log(`metronome.isPlaying after stop=${this.metronome.isPlaying}`);
            }

            // メトロノームを開始し、現在の再生位置に基づいて拍を計算
            console.log('Starting metronome...');
            this.metronome.start();
            console.log(`metronome.isPlaying after start=${this.metronome.isPlaying}`);

            // 曲の再生位置から拍の位置を計算
            const elapsedBeats = (offset / 60.0) * this.detectedBPM;
            const beatInBar = Math.floor(elapsedBeats) % this.metronome.beatsPerBar;

            // メトロノームの現在拍を調整
            this.metronome.currentBeat = beatInBar;
            this.metronome.totalBeats = Math.floor(elapsedBeats);

            console.log(`Metronome sync: offset=${offset}秒, elapsedBeats=${elapsedBeats}, currentBeat=${beatInBar}, totalBeats=${this.metronome.totalBeats}`);
        }

        console.log('========== playMusic END ==========');
    }

    stopMusic() {
        if (this.sourceNode) {
            // 現在の再生位置を保存
            const currentTime = this.audioContext.currentTime;
            this.pausedAt = currentTime - this.startTime;

            this.sourceNode.stop();
            this.sourceNode = null;
        }
        this.isPlaying = false;
        this.updatePlayButton();
        this.stopPlayheadUpdate();

        // メトロノームも停止
        if (this.syncWithMetronome && this.metronome.isPlaying) {
            this.metronome.stop();
        }
    }

    removeMusic() {
        this.stopMusic();
        this.audioBuffer = null;
        this.fileName = null;
        this.detectedBPM = null;
        this.pausedAt = 0;

        // UI更新
        document.getElementById('uploadPlaceholder').style.display = 'flex';
        document.getElementById('musicInfo').style.display = 'none';
        document.getElementById('audioFileInput').value = '';
    }

    seekTo(ratio) {
        // 波形上のクリック位置（0.0〜1.0）から秒数を計算
        const duration = this.audioBuffer.duration;
        const targetTime = ratio * duration;

        console.log('========== seekTo START ==========');
        console.log(`ratio=${ratio}, targetTime=${targetTime}秒`);
        console.log(`wasPlaying=${this.isPlaying}`);
        console.log(`sourceNode exists=${!!this.sourceNode}`);
        console.log(`playheadUpdateInterval exists=${!!this.playheadUpdateInterval}`);
        console.log(`metronome.isPlaying=${this.metronome.isPlaying}`);

        const wasPlaying = this.isPlaying;

        // 現在のソースを停止（エラーハンドリング付き）
        if (this.sourceNode) {
            try {
                console.log('Stopping sourceNode...');
                this.sourceNode.stop();
                console.log('sourceNode stopped successfully');
            } catch (e) {
                console.log('sourceNode stop error:', e.message);
            }
            this.sourceNode = null;
        }

        // 再生線更新を停止
        if (this.playheadUpdateInterval) {
            console.log('Clearing playheadUpdateInterval...');
            clearInterval(this.playheadUpdateInterval);
            this.playheadUpdateInterval = null;
        }

        // シーク位置を設定
        this.pausedAt = targetTime;
        console.log(`pausedAt set to ${this.pausedAt}`);

        // 再生中だった場合は再開
        if (wasPlaying) {
            console.log('Was playing, restarting playback...');
            this.isPlaying = false; // playMusic内で再設定される
            this.playMusic();
        } else {
            console.log('Was not playing, updating playhead only...');
            // 停止中の場合は再生線だけ更新（表示する）
            const playhead = document.getElementById('waveformPlayhead');
            playhead.classList.add('playing');
            this.updatePlayhead();
            console.log('Playhead updated');
        }

        console.log('========== seekTo END ==========');
    }

    startPlayheadUpdate() {
        const playhead = document.getElementById('waveformPlayhead');
        playhead.classList.add('playing');

        this.playheadUpdateInterval = setInterval(() => {
            this.updatePlayhead();
        }, 50); // 50msごとに更新
    }

    stopPlayheadUpdate() {
        if (this.playheadUpdateInterval) {
            clearInterval(this.playheadUpdateInterval);
            this.playheadUpdateInterval = null;
        }

        const playhead = document.getElementById('waveformPlayhead');
        playhead.classList.remove('playing');
    }

    updatePlayhead() {
        const playhead = document.getElementById('waveformPlayhead');
        const container = document.getElementById('waveformContainer');

        if (!this.audioBuffer) return;

        const currentTime = this.isPlaying
            ? this.audioContext.currentTime - this.startTime
            : this.pausedAt;

        const duration = this.audioBuffer.duration;
        const ratio = Math.min(1.0, Math.max(0, currentTime / duration));

        const containerWidth = container.offsetWidth;
        const left = ratio * containerWidth;

        playhead.style.left = `${left}px`;
    }

    showMusicInfo() {
        // アップロードエリアを隠す
        document.getElementById('uploadPlaceholder').style.display = 'none';

        // 音楽情報を表示
        const musicInfo = document.getElementById('musicInfo');
        musicInfo.style.display = 'block';

        document.getElementById('musicFileName').textContent = this.fileName;

        // BPM表示（小数点がある場合は第一位まで表示）
        if (this.detectedBPM) {
            const bpmDisplay = Number.isInteger(this.detectedBPM)
                ? this.detectedBPM
                : this.detectedBPM.toFixed(1);
            document.getElementById('detectedBPM').textContent = `${bpmDisplay} BPM`;
        } else {
            document.getElementById('detectedBPM').textContent = '-';
        }
    }

    showProgress(show) {
        const progress = document.getElementById('analysisProgress');
        if (show) {
            progress.style.display = 'flex';
            document.getElementById('progressFill').style.width = '70%';
        } else {
            progress.style.display = 'none';
        }
    }

    updatePlayButton() {
        const btn = document.getElementById('playMusicBtn');
        const lang = localStorage.getItem('language') || 'ja';

        if (this.isPlaying) {
            btn.classList.add('playing');
            btn.textContent = lang === 'ja' ? '■ 停止' : '■ Stop';
        } else {
            btn.classList.remove('playing');
            btn.textContent = lang === 'ja' ? '▶ 再生' : '▶ Play';
        }
    }

    drawWaveform() {
        const canvas = document.getElementById('waveformCanvas');
        if (!canvas || !this.audioBuffer) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;

        // Canvas解像度を設定
        canvas.width = width;
        canvas.height = height;

        // 背景をクリア
        const isDarkMode = !document.body.classList.contains('light-mode');
        ctx.fillStyle = isDarkMode ? '#2c2c2c' : '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // 中央線を描画
        ctx.strokeStyle = isDarkMode ? '#444' : '#ddd';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // 波形データを取得
        const channelData = this.audioBuffer.getChannelData(0);
        const step = Math.ceil(channelData.length / width);
        const amp = height / 2;

        // 波形を塗りつぶしで描画（より見やすく）
        ctx.fillStyle = isDarkMode ? 'rgba(74, 144, 226, 0.7)' : 'rgba(74, 144, 226, 0.7)';
        ctx.beginPath();
        ctx.moveTo(0, height / 2);

        // 上側の波形
        for (let i = 0; i < width; i++) {
            const slice = channelData.slice(i * step, (i + 1) * step);
            let max = 0;
            for (let j = 0; j < slice.length; j++) {
                if (Math.abs(slice[j]) > Math.abs(max)) {
                    max = slice[j];
                }
            }
            const y = (1 - max) * amp;
            ctx.lineTo(i, y);
        }

        // 下側の波形（逆順）
        for (let i = width - 1; i >= 0; i--) {
            const slice = channelData.slice(i * step, (i + 1) * step);
            let min = 0;
            for (let j = 0; j < slice.length; j++) {
                if (Math.abs(slice[j]) > Math.abs(min) && slice[j] < 0) {
                    min = slice[j];
                }
            }
            const y = (1 - min) * amp;
            ctx.lineTo(i, y);
        }

        ctx.closePath();
        ctx.fill();
    }
}

// アプリケーション初期化
let metronome;
let themeManager;
let languageManager;
let musicAnalyzer;

window.addEventListener('DOMContentLoaded', () => {
    metronome = new Metronome();
    themeManager = new ThemeManager();
    languageManager = new LanguageManager();
    musicAnalyzer = new MusicAnalyzer(metronome);
    console.log('メトロノームアプリが起動しました');
});
