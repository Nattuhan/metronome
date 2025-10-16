// 言語管理クラス
export class LanguageManager {
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
                musicVolume: '曲の音量',
                countInEnabled: '再生前にカウントイン'
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
                musicVolume: 'Music Volume',
                countInEnabled: 'Count-in before playback'
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
