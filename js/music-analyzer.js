// 音楽解析クラス
export class MusicAnalyzer {
    constructor(metronome) {
        this.metronome = metronome;
        this.audioContext = metronome.audioContext;
        this.audioBuffer = null; // BPM検出と波形表示用
        this.audioElement = null; // 再生用の<audio>要素
        this.sourceNode = null; // MediaElementAudioSourceNode
        this.gainNode = null; // 音量調整用

        // 保存された設定を読み込み
        const savedMusicVolume = localStorage.getItem('musicVolume');
        const savedSyncWithMetronome = localStorage.getItem('syncWithMetronome');
        const savedCountInEnabled = localStorage.getItem('countInEnabled');
        const savedPlaybackRate = localStorage.getItem('playbackRate');

        this.musicVolume = savedMusicVolume !== null ? parseFloat(savedMusicVolume) : 0.7; // デフォルト70%
        this.syncWithMetronome = savedSyncWithMetronome !== null ? savedSyncWithMetronome === 'true' : true; // デフォルトON
        this.countInEnabled = savedCountInEnabled !== null ? savedCountInEnabled === 'true' : false; // デフォルトOFF
        this.playbackRate = savedPlaybackRate !== null ? parseFloat(savedPlaybackRate) : 1.0; // デフォルト1.0倍

        this.isPlaying = false;
        this.fileName = null;
        this.detectedBPM = null;
        this.detectedKey = null; // 検出されたキー（例: "C Major"）
        this.chordProgression = []; // コード進行データ: [{ bar, beat, chord }, ...]
        this.audioURL = null; // Blob URLを保存
        this.audioStartOffset = 0; // 最初の音の開始位置（秒、検出後変更されない）
        this.metronomeBeatOffset = 0; // メトロノームの拍位置（秒、ボタンで調整可能）
        this.playheadUpdateInterval = null; // 再生線更新用

        // ループ範囲選択用
        this.loopStart = null; // ループ開始位置（秒）
        this.loopEnd = null; // ループ終了位置（秒）
        this.isDragging = false; // ドラッグ中フラグ
        this.dragStartX = 0; // ドラッグ開始X座標

        this.initEventListeners();
        this.loadSettings(); // UIに設定を反映
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
            localStorage.setItem('syncWithMetronome', this.syncWithMetronome);
        });

        // カウントインチェックボックス
        document.getElementById('countInEnabled').addEventListener('change', (e) => {
            this.countInEnabled = e.target.checked;
            localStorage.setItem('countInEnabled', this.countInEnabled);
        });

        // 曲の音量スライダー
        document.getElementById('musicVolumeSlider').addEventListener('input', (e) => {
            this.setMusicVolume(parseInt(e.target.value));
        });

        // 再生速度スライダー
        document.getElementById('playbackRateSlider').addEventListener('input', (e) => {
            this.setPlaybackRate(parseFloat(e.target.value));
        });

        // 再生速度入力
        document.getElementById('playbackRateInput').addEventListener('input', (e) => {
            this.setPlaybackRate(parseFloat(e.target.value));
        });

        // 拍位置を半拍ずらすボタン（旧UI、将来的に削除予定）
        const shiftBeatBtn = document.getElementById('shiftBeatBtn');
        if (shiftBeatBtn) {
            shiftBeatBtn.addEventListener('click', () => {
                this.shiftBeatOffset();
            });
        }

        // 拍位置を前にずらすボタン
        document.getElementById('shiftBeatBackwardBtn').addEventListener('click', () => {
            this.shiftBeatOffsetBackward();
        });

        // 拍位置を後ろにずらすボタン
        document.getElementById('shiftBeatForwardBtn').addEventListener('click', () => {
            this.shiftBeatOffsetForward();
        });

        // 波形ドラッグで範囲選択、クリックでジャンプ
        const waveformContainer = document.getElementById('waveformContainer');

        waveformContainer.addEventListener('mousedown', (e) => {
            if (!this.audioBuffer) return;

            const rect = waveformContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;

            this.isDragging = true;
            this.dragStartX = clickX;
        });

        waveformContainer.addEventListener('mousemove', (e) => {
            if (!this.isDragging || !this.audioBuffer) return;

            const rect = waveformContainer.getBoundingClientRect();
            const currentX = e.clientX - rect.left;

            // 選択範囲を表示
            const startX = Math.min(this.dragStartX, currentX);
            const endX = Math.max(this.dragStartX, currentX);

            this.updateSelectionDisplay(startX, endX, rect.width);
        });

        waveformContainer.addEventListener('mouseup', (e) => {
            if (!this.isDragging || !this.audioBuffer) return;

            const rect = waveformContainer.getBoundingClientRect();
            const endX = e.clientX - rect.left;
            const duration = this.audioBuffer.duration;

            // ドラッグ距離が短い場合はクリックと判定
            if (Math.abs(endX - this.dragStartX) < 5) {
                // クリック: シークする
                const ratio = this.dragStartX / rect.width;
                this.seekTo(ratio);
                this.clearSelection();
            } else {
                // ドラッグ: ループ範囲を設定
                const startRatio = Math.min(this.dragStartX, endX) / rect.width;
                const endRatio = Math.max(this.dragStartX, endX) / rect.width;

                const loopStart = startRatio * duration;
                const loopEnd = endRatio * duration;
                const loopDuration = loopEnd - loopStart;

                // 1秒未満の場合はクリックと同じ扱い
                if (loopDuration < 1.0) {
                    console.log(`Loop range too short (${loopDuration.toFixed(2)}s < 1.0s), treating as click`);
                    const ratio = this.dragStartX / rect.width;
                    this.seekTo(ratio);
                    this.clearSelection();
                } else {
                    // 1秒以上の場合はループ範囲を設定
                    this.loopStart = loopStart;
                    this.loopEnd = loopEnd;

                    console.log(`Loop range set: ${this.loopStart.toFixed(2)}s - ${this.loopEnd.toFixed(2)}s (duration: ${loopDuration.toFixed(2)}s)`);

                    // ループ範囲の始点にジャンプ
                    this.seekTo(startRatio);
                }
            }

            this.isDragging = false;
        });

        waveformContainer.addEventListener('mouseleave', () => {
            this.isDragging = false;
        });

        // BPM調整ボタン
        document.getElementById('bpmHalfBtn').addEventListener('click', () => {
            this.adjustDetectedBPM(0.5);
        });

        document.getElementById('bpmDoubleBtn').addEventListener('click', () => {
            this.adjustDetectedBPM(2.0);
        });
    }

    loadSettings() {
        // 曲の音量スライダーとチェックボックスをUIに反映
        const musicVolumeSlider = document.getElementById('musicVolumeSlider');
        const playbackRateSlider = document.getElementById('playbackRateSlider');
        const playbackRateInput = document.getElementById('playbackRateInput');
        const syncCheckbox = document.getElementById('syncWithMetronome');
        const countInCheckbox = document.getElementById('countInEnabled');

        const volumePercent = Math.round(this.musicVolume * 100);
        musicVolumeSlider.value = volumePercent;
        document.getElementById('musicVolumeValue').textContent = volumePercent + '%';

        playbackRateSlider.value = this.playbackRate;
        playbackRateInput.value = this.playbackRate.toFixed(2);

        syncCheckbox.checked = this.syncWithMetronome;
        countInCheckbox.checked = this.countInEnabled;
    }

    setMusicVolume(vol) {
        this.musicVolume = vol / 100;
        document.getElementById('musicVolumeValue').textContent = vol + '%';
        localStorage.setItem('musicVolume', this.musicVolume);

        // GainNodeが存在する場合、リアルタイムで音量を更新
        if (this.gainNode) {
            this.gainNode.gain.value = this.musicVolume;
        }
    }

    setPlaybackRate(rate) {
        // 範囲を0.1～2.0に制限
        rate = Math.max(0.1, Math.min(2.0, rate));

        // 1.0付近で吸着（±0.03の範囲）
        if (Math.abs(rate - 1.0) < 0.03) {
            rate = 1.0;
        }

        this.playbackRate = rate;

        // UIを更新
        document.getElementById('playbackRateSlider').value = rate;
        document.getElementById('playbackRateInput').value = rate.toFixed(2);

        // localStorageに保存
        localStorage.setItem('playbackRate', this.playbackRate);

        // audioElementが存在する場合、リアルタイムで再生速度を更新
        if (this.audioElement) {
            this.audioElement.playbackRate = this.playbackRate;
        }

        // メトロノームと同期している場合、テンポを更新
        if (this.syncWithMetronome && this.detectedBPM) {
            const adjustedBPM = this.detectedBPM * this.playbackRate;
            this.metronome.setTempo(adjustedBPM);
        }
    }

    shiftBeatOffsetBackward() {
        // メトロノームの拍位置を半拍前にずらす
        if (!this.detectedBPM || !this.audioElement) {
            console.log('BPM not detected or no audio loaded, cannot shift beat');
            return;
        }

        const halfBeatDuration = (60.0 / this.detectedBPM) / 2;
        this.adjustBeatOffset(-halfBeatDuration);
    }

    shiftBeatOffsetForward() {
        // メトロノームの拍位置を半拍後ろにずらす
        if (!this.detectedBPM || !this.audioElement) {
            console.log('BPM not detected or no audio loaded, cannot shift beat');
            return;
        }

        const halfBeatDuration = (60.0 / this.detectedBPM) / 2;
        this.adjustBeatOffset(halfBeatDuration);
    }

    adjustBeatOffset(offsetChange) {
        // メトロノームの拍位置を調整する共通メソッド
        // 再生中の場合、シフト前の値で現在の拍位置を計算してから更新
        if (this.isPlaying && this.syncWithMetronome && this.metronome.isPlaying) {
            const currentTime = this.audioElement.currentTime;
            const adjustedBPM = this.detectedBPM * this.playbackRate;

            // シフト前のmetronomeBeatOffsetで計算
            const oldElapsedBeats = ((currentTime - this.metronomeBeatOffset) / 60.0) * adjustedBPM;

            // metronomeBeatOffsetを調整
            this.metronomeBeatOffset += offsetChange;

            // シフト後の新しいmetronomeBeatOffsetで再計算
            const newElapsedBeats = ((currentTime - this.metronomeBeatOffset) / 60.0) * adjustedBPM;
            const beatInBar = Math.floor(newElapsedBeats) % this.metronome.beatsPerBar;
            const totalBeats = Math.floor(newElapsedBeats);

            console.log(`メトロノーム拍位置を調整: ${offsetChange >= 0 ? '+' : ''}${offsetChange.toFixed(3)}秒, 新しいオフセット: ${this.metronomeBeatOffset.toFixed(3)}秒`);
            console.log(`メトロノーム同期を再調整: oldElapsedBeats=${oldElapsedBeats.toFixed(2)}, newElapsedBeats=${newElapsedBeats.toFixed(2)}, beatInBar=${beatInBar}, totalBeats=${totalBeats}`);

            this.metronome.currentBeat = beatInBar;
            this.metronome.totalBeats = totalBeats;
            this.metronome.updateVisuals(0);
        } else {
            // 再生中でない場合は、metronomeBeatOffsetを更新してcurrentTimeを0にリセット
            this.metronomeBeatOffset += offsetChange;
            this.audioElement.currentTime = 0;

            console.log(`メトロノーム拍位置を調整: ${offsetChange >= 0 ? '+' : ''}${offsetChange.toFixed(3)}秒, 新しいオフセット: ${this.metronomeBeatOffset.toFixed(3)}秒`);
            console.log('再生位置を0にリセット（次回再生時は最初から）');
        }

        // UI表示を更新
        this.updateBeatOffsetDisplay();
    }

    updateBeatOffsetDisplay() {
        // 拍オフセット値を表示
        const offsetValue = document.getElementById('beatOffsetValue');
        if (offsetValue) {
            const offsetSeconds = this.metronomeBeatOffset - this.audioStartOffset;
            offsetValue.textContent = offsetSeconds.toFixed(3);
        }
    }

    adjustDetectedBPM(multiplier) {
        // 検出BPMを調整する（×0.5または×2）
        if (!this.detectedBPM) {
            console.log('No BPM detected, cannot adjust');
            return;
        }

        // BPMを調整
        this.detectedBPM = this.detectedBPM * multiplier;

        console.log(`Adjusted BPM: ${this.detectedBPM} (×${multiplier})`);

        // UI更新
        const bpmDisplay = Number.isInteger(this.detectedBPM)
            ? this.detectedBPM
            : this.detectedBPM.toFixed(1);
        document.getElementById('detectedBPM').textContent = `${bpmDisplay} BPM`;

        // メトロノームのテンポも更新
        this.metronome.setTempo(this.detectedBPM);

        // 再生中の場合、再生速度を考慮した調整BPMでメトロノームを更新
        if (this.isPlaying && this.syncWithMetronome) {
            const adjustedBPM = this.detectedBPM * this.playbackRate;
            this.metronome.setTempo(adjustedBPM);
        }
    }

    shiftBeatOffset() {
        // メトロノームの拍位置を半拍ずらす（後方互換性のため残す）
        this.shiftBeatOffsetForward();
    }

    async loadAudioFile(file) {
        this.fileName = file.name;

        // UI更新: 解析中表示
        this.showProgress(true);

        try {
            // ファイルを読み込む
            const arrayBuffer = await file.arrayBuffer();

            // Web Audio APIでデコード（BPM検出と波形表示用）
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

            // Blob URLを作成（<audio>要素での再生用）
            if (this.audioURL) {
                URL.revokeObjectURL(this.audioURL); // 古いURLを解放
            }
            this.audioURL = URL.createObjectURL(file);

            // <audio>要素を作成
            this.createAudioElement();

            // BPM検出と最初の音の位置検出
            this.detectedBPM = await this.detectBPM();
            this.audioStartOffset = await this.detectFirstBeat();
            this.metronomeBeatOffset = this.audioStartOffset; // 初期値は音の開始位置

            // キー検出
            this.detectedKey = await this.detectKey();

            // コード進行検出
            this.chordProgression = await this.detectChordProgression();

            // UI更新
            this.showMusicInfo();
            this.drawWaveform(); // 波形を描画
            this.updateBeatOffsetDisplay(); // オフセット表示を初期化
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

    createAudioElement() {
        // 既存のノードを切断
        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }

        // 既存の<audio>要素があれば削除
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.src = '';
            this.audioElement = null;
        }

        // 新しい<audio>要素を作成
        this.audioElement = new Audio();
        this.audioElement.src = this.audioURL;
        this.audioElement.preservesPitch = true; // ピッチ保持を有効化
        this.audioElement.playbackRate = this.playbackRate;

        // イベントリスナーを追加
        this.audioElement.addEventListener('ended', () => {
            console.log('Audio ended');
            this.isPlaying = false;
            this.updatePlayButton();
            this.stopPlayheadUpdate();

            // メトロノームも停止
            if (this.syncWithMetronome && this.metronome.isPlaying) {
                this.metronome.stop();
            }
        });

        this.audioElement.addEventListener('error', (e) => {
            console.error('Audio element error:', e);
            alert('音楽の再生中にエラーが発生しました。');
            this.isPlaying = false;
            this.updatePlayButton();
            this.stopPlayheadUpdate();
        });

        // MediaElementAudioSourceNodeとGainNodeを作成
        this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = this.musicVolume;

        this.sourceNode.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);

        console.log('Audio element created with preservesPitch=true');
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
        // 最初の音の位置を検出（シンプルな閾値ベース）
        const channelData = this.audioBuffer.getChannelData(0);
        const sampleRate = this.audioBuffer.sampleRate;

        for (let i = 0; i < channelData.length; i++) {
            if (Math.abs(channelData[i]) > 0.01) {
                return i / sampleRate;
            }
        }
        return 0;
    }

    async detectKey() {
        // Meyda.jsを使用してクロマグラムを抽出し、Krumhansl-Schmucklerアルゴリズムでキーを検出
        console.log('========== キー検出開始 ==========');

        if (!window.Meyda) {
            console.error('Meyda.js is not loaded');
            return null;
        }

        const channelData = this.audioBuffer.getChannelData(0);
        const sampleRate = this.audioBuffer.sampleRate;

        // クロマグラムの集計用配列（12音階: C, C#, D, D#, E, F, F#, G, G#, A, A#, B）
        const chromaSum = new Array(12).fill(0);
        let frameCount = 0;

        // フレームサイズとホップサイズを設定
        const frameSize = 8192; // 大きくして低音域の解像度を向上
        const hopSize = frameSize / 2; // 50%オーバーラップ

        // 曲全体を解析
        const maxSamples = channelData.length;
        console.log(`キー検出: 曲全体 (${(maxSamples / sampleRate).toFixed(1)}秒) を解析中...`);

        // フレームごとにクロマグラムを抽出
        for (let i = 0; i < maxSamples - frameSize; i += hopSize) {
            // フレームを抽出
            const frame = channelData.slice(i, i + frameSize);

            // 自前でクロマグラムを計算（Meyda.jsが不正確なため）
            const chroma = this.computeChroma(frame, sampleRate);

            if (chroma && chroma.length === 12) {
                for (let j = 0; j < 12; j++) {
                    chromaSum[j] += chroma[j];
                }
                frameCount++;
            }
        }

        // 平均クロマグラムを計算
        const chromaAverage = chromaSum.map(sum => sum / frameCount);

        console.log('平均クロマグラム:', chromaAverage.map((v, i) => {
            const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            return `${notes[i]}: ${v.toFixed(3)}`;
        }).join(', '));

        // Krumhansl-Schmucklerアルゴリズムでキーを検出
        const detectedKey = this.krumhanslSchmuckler(chromaAverage);

        console.log(`✓ 検出キー: ${detectedKey}`);
        console.log('========== キー検出終了 ==========');

        return detectedKey;
    }

    computeChroma(frame, sampleRate) {
        // FFTベースのクロマグラム計算（最適化版）
        const fftSize = frame.length;
        const chroma = new Array(12).fill(0);
        const A4_freq = 440.0;

        // MIDI 28 (E1=41Hz) から MIDI 103 (G7=3136Hz) まで（人間の可聴範囲に絞る）
        for (let midi = 28; midi <= 103; midi++) {
            const freq = A4_freq * Math.pow(2, (midi - 69) / 12.0);
            const binIndex = Math.round(freq * fftSize / sampleRate);

            if (binIndex >= 0 && binIndex < fftSize / 2) {
                // DFT計算（該当ビンのみ）
                let real = 0;
                let imag = 0;
                const omega = -2 * Math.PI * binIndex / fftSize;

                // 8サンプルごとにスキップして高速化（精度とのトレードオフ）
                const step = 8;
                for (let i = 0; i < fftSize; i += step) {
                    const angle = omega * i;
                    real += frame[i] * Math.cos(angle);
                    imag += frame[i] * Math.sin(angle);
                }

                const magnitude = Math.sqrt(real * real + imag * imag);
                const chromaIndex = midi % 12;
                chroma[chromaIndex] += magnitude;
            }
        }

        return chroma;
    }

    krumhanslSchmuckler(chroma) {
        // Krumhansl-Schmucklerのキープロファイル（メジャーとマイナー）
        // 参考: https://rnhart.net/articles/key-finding/
        const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
        const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        let bestKey = null;
        let bestCorrelation = -Infinity;

        // 12音階すべてでメジャー/マイナーをテスト
        for (let shift = 0; shift < 12; shift++) {
            // メジャーキーの相関を計算
            const majorCorr = this.correlation(chroma, this.rotateArray(majorProfile, shift));
            if (majorCorr > bestCorrelation) {
                bestCorrelation = majorCorr;
                bestKey = `${noteNames[shift]} Major`;
            }

            // マイナーキーの相関を計算
            const minorCorr = this.correlation(chroma, this.rotateArray(minorProfile, shift));
            if (minorCorr > bestCorrelation) {
                bestCorrelation = minorCorr;
                bestKey = `${noteNames[shift]} Minor`;
            }
        }

        return bestKey;
    }

    rotateArray(arr, n) {
        // 配列を右にn回転
        const rotated = [];
        for (let i = 0; i < arr.length; i++) {
            rotated[i] = arr[(i - n + arr.length) % arr.length];
        }
        return rotated;
    }

    correlation(x, y) {
        // ピアソン相関係数を計算
        const n = x.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

        for (let i = 0; i < n; i++) {
            sumX += x[i];
            sumY += y[i];
            sumXY += x[i] * y[i];
            sumX2 += x[i] * x[i];
            sumY2 += y[i] * y[i];
        }

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

        if (denominator === 0) return 0;

        return numerator / denominator;
    }

    getChordTemplates() {
        // 和音テンプレート（よく使われるコードのみ）
        // 0=C, 1=C#, 2=D, 3=D#, 4=E, 5=F, 6=F#, 7=G, 8=G#, 9=A, 10=A#, 11=B
        return {
            // メジャー系
            '': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],         // Major (C, E, G) → C
            'M7': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],       // Major 7th (C, E, G, B) → CM7
            '7': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],        // Dominant 7th (C, E, G, Bb) → C7
            'sus4': [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],     // sus4 (C, F, G) → Csus4
            'add9': [1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0],     // add9 (C, D, E, G) → Cadd9

            // マイナー系
            'm': [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],        // Minor (C, Eb, G) → Cm
            'm7': [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],       // Minor 7th (C, Eb, G, Bb) → Cm7

            // その他
            'dim': [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0]       // Diminished (C, Eb, Gb) → Cdim
        };
    }

    async detectChordProgression() {
        // 小節ごとにコードを検出（曲全体を解析）
        console.log('========== コード進行検出開始 ==========');

        if (!window.Meyda || !this.detectedBPM) {
            console.error('Meyda.js not loaded or BPM not detected');
            return [];
        }

        const channelData = this.audioBuffer.getChannelData(0);
        const sampleRate = this.audioBuffer.sampleRate;
        const beatsPerBar = this.metronome.beatsPerBar;

        // 1拍の長さ（秒）
        const beatDuration = 60.0 / this.detectedBPM;
        const beatSamples = Math.floor(beatDuration * sampleRate);
        // 1小節の長さ
        const barSamples = beatSamples * beatsPerBar;

        console.log(`BPM: ${this.detectedBPM}, 拍子: ${beatsPerBar}/4, 1拍の長さ: ${beatDuration.toFixed(3)}秒`);

        const chordProgression = [];

        // 最初の音の位置から開始
        const startSample = Math.floor(this.audioStartOffset * sampleRate);

        // 曲全体を解析
        const maxSamples = channelData.length;
        const duration = (maxSamples - startSample) / sampleRate;
        console.log(`コード進行検出: 曲全体 (${duration.toFixed(1)}秒) を解析中...`);

        let currentBar = 1;
        let lastChord = null;
        let lastChordCount = 0; // 連続して同じコードが何回続いているか

        // 時間的スムージング用: 過去のクロマグラムを保存
        const chromaHistory = [];
        const smoothingWindow = 5; // 5小節の移動平均（安定性向上）

        // 小節ごとにクロマグラムを抽出してコード判定
        for (let samplePos = startSample; samplePos < maxSamples - barSamples; samplePos += barSamples) {
            // この小節の範囲のクロマグラムを計算
            const barChroma = this.extractBeatChroma(channelData, samplePos, barSamples);

            if (barChroma) {
                // クロマ履歴に追加
                chromaHistory.push(barChroma);

                // スムージングウィンドウサイズを超えたら古いものを削除
                if (chromaHistory.length > smoothingWindow) {
                    chromaHistory.shift();
                }

                // 移動平均を計算
                const smoothedChroma = new Array(12).fill(0);
                for (const chroma of chromaHistory) {
                    for (let i = 0; i < 12; i++) {
                        smoothedChroma[i] += chroma[i];
                    }
                }
                for (let i = 0; i < 12; i++) {
                    smoothedChroma[i] /= chromaHistory.length;
                }

                // スムージング後のクロマでコード判定
                const chord = this.detectChordFromChroma(smoothedChroma);

                // 前の小節と異なるコード、または最初の小節の場合は記録
                if (chord !== lastChord) {
                    chordProgression.push({
                        bar: currentBar,
                        beat: 1, // 小節の開始位置
                        chord: chord,
                        time: (samplePos - startSample) / sampleRate
                    });
                    lastChord = chord;
                    lastChordCount = 1;
                } else {
                    lastChordCount++;
                }
            }

            currentBar++;
        }

        console.log(`✓ 検出されたコード進行: ${chordProgression.length}個のコードチェンジ`);
        console.log('コード進行サンプル:', chordProgression.slice(0, 20).map(c =>
            `${c.bar}:${c.beat} ${c.chord}`
        ).join(' -> '));
        console.log('========== コード進行検出終了 ==========');

        return chordProgression;
    }

    extractBeatChroma(channelData, startSample, beatSamples) {
        // 1拍分のクロマグラムを抽出（対数圧縮と正規化を適用）
        const frameSize = 8192; // 大きくして低音域の解像度を向上
        const hopSize = frameSize / 2;
        const chromaSum = new Array(12).fill(0);
        let frameCount = 0;

        // この拍の範囲でフレームごとにクロマを抽出
        const sampleRate = this.audioBuffer.sampleRate;
        for (let i = startSample; i < startSample + beatSamples - frameSize; i += hopSize) {
            const frame = channelData.slice(i, i + frameSize);

            // 自前でクロマグラムを計算（Meyda.jsが不正確なため）
            const chroma = this.computeChroma(frame, sampleRate);

            if (chroma && chroma.length === 12) {
                for (let j = 0; j < 12; j++) {
                    chromaSum[j] += chroma[j];
                }
                frameCount++;
            }
        }

        if (frameCount === 0) return null;

        // 平均クロマグラムを計算
        const chromaAverage = chromaSum.map(sum => sum / frameCount);

        // 対数圧縮のみを適用（正規化は削除）
        // 正規化すると特徴が平坦化されすぎてコード判別が困難になる
        return chromaAverage;
    }

    detectChordFromChroma(chroma) {
        // クロマグラムから最適なコードを検出
        const templates = this.getChordTemplates();
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        let bestChord = 'N.C.';
        let bestScore = -Infinity;

        // 12音階すべてでテンプレートマッチング
        for (let root = 0; root < 12; root++) {
            for (const [chordType, template] of Object.entries(templates)) {
                // テンプレートをroot音に合わせて回転
                const rotatedTemplate = this.rotateArray(template, root);

                // クロマグラムとテンプレートの相関を計算
                const score = this.correlation(chroma, rotatedTemplate);

                if (score > bestScore) {
                    bestScore = score;
                    bestChord = `${noteNames[root]}${chordType}`;
                }
            }
        }

        // スコアが低すぎる場合はN.C.（ノーコード）
        // 対数圧縮後の適切な閾値: 0.35
        if (bestScore < 0.35) {
            return 'N.C.';
        }

        return bestChord;
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
        console.log(`audioElement exists=${!!this.audioElement}`);
        console.log(`isPlaying=${this.isPlaying}`);
        console.log(`audioElement.currentTime=${this.audioElement ? this.audioElement.currentTime : 'N/A'}`);
        console.log(`audioStartOffset=${this.audioStartOffset}`);
        console.log(`metronomeBeatOffset=${this.metronomeBeatOffset}`);
        console.log(`loopStart=${this.loopStart}, loopEnd=${this.loopEnd}`);
        console.log(`countInEnabled=${this.countInEnabled}`);

        if (!this.audioElement) {
            console.log('No audioElement, returning');
            return;
        }

        // 停止状態（currentTime=0）から再生する場合、無音部分をスキップ
        if (this.audioElement.currentTime === 0 && this.audioStartOffset > 0) {
            console.log(`Skipping silence: jumping to ${this.audioStartOffset}秒`);
            this.audioElement.currentTime = this.audioStartOffset;
        }

        // カウントインが有効で、かつ最初から再生する場合のみカウントインを実行
        if (this.countInEnabled && this.audioElement.currentTime === this.audioStartOffset && this.syncWithMetronome) {
            console.log('Executing count-in...');
            this.executeCountIn();
            return; // カウントイン後に自動的にplayMusicが再度呼ばれる
        }

        // 現在の再生位置を取得
        const startOffset = this.audioElement.currentTime;
        console.log(`Starting playback from ${startOffset}秒`);

        // <audio>要素で再生開始
        this.audioElement.play().then(() => {
            console.log('Audio element playing');
            this.isPlaying = true;
            this.updatePlayButton();
            this.startPlayheadUpdate();

            // メトロノームと同期する場合
            if (this.syncWithMetronome) {
                console.log('Syncing with metronome...');

                // メトロノームが再生中なら停止
                if (this.metronome.isPlaying) {
                    console.log('Stopping metronome...');
                    this.metronome.stop();
                }

                // 再生速度を考慮した調整BPMを計算
                const adjustedBPM = this.detectedBPM * this.playbackRate;
                console.log(`Adjusted BPM: ${this.detectedBPM} * ${this.playbackRate} = ${adjustedBPM}`);

                // メトロノームのテンポを調整BPMに設定
                this.metronome.setTempo(adjustedBPM);

                // 曲の再生位置から拍の位置を計算（メトロノーム拍オフセットを使用）
                let elapsedBeats = ((startOffset - this.metronomeBeatOffset) / 60.0) * adjustedBPM;

                // 負の値の場合、beatsPerBarを加算して正の範囲に持ってくる
                while (elapsedBeats < 0) {
                    elapsedBeats += this.metronome.beatsPerBar;
                }

                const beatInBar = Math.floor(elapsedBeats) % this.metronome.beatsPerBar;
                const totalBeats = Math.floor(elapsedBeats);

                console.log(`Metronome sync: offset=${startOffset}秒, metronomeBeatOffset=${this.metronomeBeatOffset}秒, elapsedBeats=${elapsedBeats}, currentBeat=${beatInBar}, totalBeats=${totalBeats}`);

                // メトロノームの拍位置を事前に設定
                this.metronome.currentBeat = beatInBar;
                this.metronome.totalBeats = totalBeats;

                // メトロノームを開始
                console.log('Starting metronome with skipFirstBeat=true...');
                this.metronome.start(true);

                // 次の拍までの時間を計算
                // metronomeBeatOffsetからの経過拍数に基づいて、次の拍位置を計算
                const beatDuration = 60.0 / adjustedBPM;
                const nextBeatNumber = Math.floor(elapsedBeats) + 1; // 次の拍番号
                const timeToNextBeat = (nextBeatNumber - elapsedBeats) * beatDuration;

                // nextNoteTimeを調整して、次の拍で音が鳴るようにする
                this.metronome.nextNoteTime = this.audioContext.currentTime + timeToNextBeat;

                console.log(`Adjusted nextNoteTime: elapsedBeats=${elapsedBeats.toFixed(3)}, nextBeatNumber=${nextBeatNumber}, timeToNextBeat=${timeToNextBeat.toFixed(3)}秒, nextNoteTime=${this.metronome.nextNoteTime.toFixed(3)}`);
            }

            console.log('========== playMusic END ==========');
        }).catch(error => {
            console.error('Playback error:', error);
        });
    }

    stopMusic() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0; // 停止したら最初から再生するようにリセット
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

        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.src = '';
            this.audioElement = null;
        }

        if (this.audioURL) {
            URL.revokeObjectURL(this.audioURL);
            this.audioURL = null;
        }

        this.audioBuffer = null;
        this.fileName = null;
        this.detectedBPM = null;

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

        if (!this.audioElement) {
            console.log('No audioElement, returning');
            return;
        }

        const wasPlaying = this.isPlaying;

        // 一時停止して位置を設定
        if (wasPlaying) {
            this.audioElement.pause();
        }

        this.audioElement.currentTime = targetTime;
        console.log(`audioElement.currentTime set to ${targetTime}`);

        // 再生中だった場合は再開してメトロノームも同期
        if (wasPlaying) {
            console.log('Was playing, resuming playback...');
            this.audioElement.play();

            // メトロノームと同期している場合、拍位置を再計算
            if (this.syncWithMetronome && this.metronome.isPlaying) {
                const adjustedBPM = this.detectedBPM * this.playbackRate;
                let elapsedBeats = ((targetTime - this.metronomeBeatOffset) / 60.0) * adjustedBPM;

                // 負の値の場合、beatsPerBarを加算して正の範囲に持ってくる
                while (elapsedBeats < 0) {
                    elapsedBeats += this.metronome.beatsPerBar;
                }

                const beatInBar = Math.floor(elapsedBeats) % this.metronome.beatsPerBar;
                const totalBeats = Math.floor(elapsedBeats);

                console.log(`Resyncing metronome after seek: offset=${targetTime}秒, metronomeBeatOffset=${this.metronomeBeatOffset}秒, elapsedBeats=${elapsedBeats}, currentBeat=${beatInBar}, totalBeats=${totalBeats}`);

                // メトロノームの拍位置を更新
                this.metronome.currentBeat = beatInBar;
                this.metronome.totalBeats = totalBeats;

                // 振り子の位置も即座に更新
                this.metronome.updateVisuals(0);
            }
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

        if (!this.audioBuffer || !this.audioElement) return;

        const currentTime = this.audioElement.currentTime;
        const duration = this.audioBuffer.duration;
        const ratio = Math.min(1.0, Math.max(0, currentTime / duration));

        const containerWidth = container.offsetWidth;
        const left = ratio * containerWidth;

        playhead.style.left = `${left}px`;

        // ループ範囲のチェック
        this.checkLoop();

        // コード進行のハイライト更新
        this.updateChordProgressionHighlight();
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

        // キー表示
        if (this.detectedKey) {
            document.getElementById('detectedKey').textContent = this.detectedKey;
        } else {
            document.getElementById('detectedKey').textContent = '-';
        }

        // コード進行表示
        if (this.chordProgression && this.chordProgression.length > 0) {
            this.renderChordProgression();
        }
    }

    renderChordProgression() {
        // コード進行UIを描画（全小節分）
        const display = document.getElementById('chordProgressionDisplay');
        display.classList.add('active');

        // 全小節数を計算（曲の長さから）
        const duration = this.audioBuffer.duration;
        const beatDuration = 60.0 / this.detectedBPM;
        const beatsPerBar = this.metronome.beatsPerBar;
        const totalBars = Math.ceil((duration - this.audioStartOffset) / (beatDuration * beatsPerBar));

        // HTMLを構築（最大60小節まで）
        const maxBars = Math.min(totalBars, 60);
        let html = '<div class="chord-bars-container">';

        for (let bar = 1; bar <= maxBars; bar++) {
            const chord = this.getChordAtBeat(bar, 1);
            html += `<div class="chord-bar" data-bar="${bar}">${chord}</div>`;
        }

        html += '</div>';
        display.innerHTML = html;
    }

    getChordAtBeat(bar, beat) {
        // 指定された小節・拍のコードを取得
        if (!this.chordProgression || this.chordProgression.length === 0) {
            return '-';
        }

        // この拍以前で最も近いコードを探す
        let currentChord = 'N.C.';

        for (const entry of this.chordProgression) {
            if (entry.bar > bar) break;
            if (entry.bar === bar && entry.beat > beat) break;

            if (entry.bar < bar || (entry.bar === bar && entry.beat <= beat)) {
                currentChord = entry.chord;
            }
        }

        return currentChord;
    }

    updateChordProgressionHighlight() {
        // 現在再生中の位置に応じてコードをハイライトし、スクロール
        if (!this.isPlaying || !this.detectedBPM || this.chordProgression.length === 0) return;

        const currentTime = this.audioElement.currentTime - this.audioStartOffset;
        const beatDuration = 60.0 / this.detectedBPM;
        const beatsPerBar = this.metronome.beatsPerBar;

        // 現在の小節を計算
        const totalBeats = Math.floor(currentTime / beatDuration);
        const currentBar = Math.floor(totalBeats / beatsPerBar) + 1;

        // すべてのハイライトをクリア
        document.querySelectorAll('.chord-bar.active').forEach(el => el.classList.remove('active'));

        // 現在の小節をハイライト
        const barElement = document.querySelector(`.chord-bar[data-bar="${currentBar}"]`);
        if (barElement) {
            barElement.classList.add('active');

            // 現在の小節が中央に来るようにtransformでスライド
            const container = document.querySelector('.chord-bars-container');
            const display = document.getElementById('chordProgressionDisplay');
            const barWidth = 120; // CSSで指定した幅
            const displayWidth = display.clientWidth;

            // 中央に来るようにオフセットを計算
            const offset = (currentBar - 1) * barWidth - (displayWidth / 2) + (barWidth / 2);
            container.style.transform = `translateX(-${Math.max(0, offset)}px)`;
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

        // Canvas解像度を設定（高DPI対応）
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);

        // 背景をクリア
        const isDarkMode = !document.body.classList.contains('light-mode');
        ctx.fillStyle = isDarkMode ? '#2c2c2c' : '#f5f5f5';
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

        // 波形を線で描画（よくある波形ビューアスタイル）
        ctx.strokeStyle = isDarkMode ? '#4a90e2' : '#2c7fd4';
        ctx.lineWidth = 1;
        ctx.beginPath();

        for (let i = 0; i < width; i++) {
            // 各ピクセルに対応するサンプル範囲の最大値と最小値を取得
            const start = Math.floor(i * step);
            const end = Math.floor((i + 1) * step);

            let min = 1.0;
            let max = -1.0;

            for (let j = start; j < end && j < channelData.length; j++) {
                const sample = channelData[j];
                if (sample < min) min = sample;
                if (sample > max) max = sample;
            }

            // 最小値から最大値まで縦線を描画
            const yMin = (1 - min) * amp;
            const yMax = (1 - max) * amp;

            ctx.moveTo(i + 0.5, yMin);
            ctx.lineTo(i + 0.5, yMax);
        }

        ctx.stroke();
    }

    // 選択範囲の表示を更新
    updateSelectionDisplay(startX, endX, containerWidth) {
        const selection = document.getElementById('waveformSelection');
        const left = startX;
        const width = endX - startX;

        selection.style.left = `${left}px`;
        selection.style.width = `${width}px`;
        selection.classList.add('active');
    }

    // 選択範囲をクリア
    clearSelection() {
        const selection = document.getElementById('waveformSelection');
        selection.classList.remove('active');
        this.loopStart = null;
        this.loopEnd = null;
    }

    // ループ再生のチェック（updatePlayheadで呼ぶ）
    checkLoop() {
        if (!this.isPlaying || this.loopStart === null || this.loopEnd === null || !this.audioElement) return;

        const currentTime = this.audioElement.currentTime;

        // ループ終了位置を超えた場合、ループ開始位置に戻る
        if (currentTime >= this.loopEnd) {
            console.log(`Loop: ${currentTime.toFixed(2)}s >= ${this.loopEnd.toFixed(2)}s, jumping to ${this.loopStart.toFixed(2)}s`);
            this.seekTo(this.loopStart / this.audioBuffer.duration);
        }
    }

    // カウントイン実行
    executeCountIn() {
        const beatsPerBar = this.metronome.beatsPerBar;
        const tempo = this.detectedBPM || this.metronome.tempo;
        const beatDuration = 60.0 / tempo; // 1拍の長さ（秒）

        console.log(`Count-in: ${beatsPerBar} beats at ${tempo} BPM (${beatDuration}s per beat)`);

        // メトロノームを一時的に開始（カウントインのため）
        if (!this.metronome.isPlaying) {
            this.metronome.start();
        }

        // カウントイン終了後に曲を再生
        const totalCountInDuration = beatDuration * beatsPerBar * 1000; // ミリ秒
        setTimeout(() => {
            console.log('Count-in finished, starting music...');
            // countInEnabledを一時的にfalseにして再帰を防ぐ
            const originalCountInEnabled = this.countInEnabled;
            this.countInEnabled = false;
            this.playMusic();
            this.countInEnabled = originalCountInEnabled;
        }, totalCountInDuration);
    }
}
