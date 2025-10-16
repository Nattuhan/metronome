// 音楽解析クラス
export class MusicAnalyzer {
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

        // ループ範囲選択用
        this.loopStart = null; // ループ開始位置（秒）
        this.loopEnd = null; // ループ終了位置（秒）
        this.isDragging = false; // ドラッグ中フラグ
        this.dragStartX = 0; // ドラッグ開始X座標

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
        console.log(`loopStart=${this.loopStart}, loopEnd=${this.loopEnd}`);

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

        let offset = this.pausedAt || this.firstBeatOffset;
        console.log(`offset=${offset}秒, audioBuffer.duration=${this.audioBuffer.duration}秒`);

        // offsetが曲の長さを超えていないかチェック
        if (offset >= this.audioBuffer.duration) {
            console.log('ERROR: offset exceeds duration, resetting to 0');
            this.pausedAt = 0;
            offset = this.firstBeatOffset;
        }

        // ループ範囲が設定されている場合、ループ範囲の長さを計算して再生時間を制限
        let duration = undefined; // undefinedの場合は最後まで再生
        if (this.loopStart !== null && this.loopEnd !== null) {
            // ループ範囲内から開始する場合、loopEndまでの長さを指定
            if (offset >= this.loopStart && offset < this.loopEnd) {
                duration = this.loopEnd - offset;
                console.log(`Loop mode: offset=${offset}, duration=${duration}, will stop at ${this.loopEnd}`);
            }
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
        const isLooping = (this.loopStart !== null && this.loopEnd !== null && duration !== undefined);

        this.sourceNode.onended = () => {
            console.log('sourceNode ended event fired');
            // このイベントが現在のsourceNodeのものか確認
            if (this.sourceNode === currentSourceNode) {
                // ループ範囲が設定されている場合はループ開始位置に戻る
                if (isLooping) {
                    console.log(`Loop ended, jumping back to ${this.loopStart}s`);
                    this.pausedAt = this.loopStart;
                    this.playMusic(); // 再度再生開始
                } else {
                    console.log('Ending playback (valid onended event)');
                    this.isPlaying = false;
                    this.pausedAt = 0;
                    this.updatePlayButton();
                    this.stopPlayheadUpdate();
                    if (this.syncWithMetronome) {
                        this.metronome.stop();
                    }
                }
            } else {
                console.log('Ignoring onended event from old sourceNode');
            }
        };

        // 曲を再生開始
        if (duration !== undefined) {
            console.log(`Starting with duration limit: ${duration}s`);
            this.sourceNode.start(this.audioContext.currentTime, offset, duration);
        } else {
            this.sourceNode.start(this.audioContext.currentTime, offset);
        }
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
            this.sourceNode.stop();
            this.sourceNode = null;
        }
        this.isPlaying = false;
        this.pausedAt = 0; // 停止したら最初から再生するようにリセット
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

        // ループ範囲のチェック
        this.checkLoop();
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
        if (!this.isPlaying || this.loopStart === null || this.loopEnd === null) return;

        const currentTime = this.audioContext.currentTime - this.startTime;

        // ループ終了位置を超えた場合、ループ開始位置に戻る
        if (currentTime >= this.loopEnd) {
            console.log(`Loop: ${currentTime.toFixed(2)}s >= ${this.loopEnd.toFixed(2)}s, jumping to ${this.loopStart.toFixed(2)}s`);
            this.seekTo(this.loopStart / this.audioBuffer.duration);
        }
    }
}
