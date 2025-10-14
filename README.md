# Web Audio Metronome / Web Audio メトロノーム

[English](#english) | [日本語](#japanese)

---

<a name="english"></a>
## English

A simple yet feature-rich web metronome app. Runs in your browser and is completely free to use.

### 🔗 Demo

[Try it now](https://nattuhan.github.io/metronome/)

### ✨ Features

#### Basic Functions
- **Tempo Settings**: 1-300 BPM range
- **Time Signature**: Choose from 1-8 beats per bar
- **Sound Types**: 4 different sounds (Click, Beep, Wood, Cowbell)
- **Rhythm Patterns**: Simple, Eighth Notes, Triplets, Sixteenth Notes, Sextuplets
- **Subdivision Sounds**: Optional different sound for subdivisions
- **Volume Control**: 0-100% adjustable

#### Visual Feedback
- **Pendulum Animation**: Classic metronome movement
- **Pulse Animation**: BPM display scales with the beat
- **Flash Animation**: Entire screen flashes with the beat
- **Beat Indicator**: Shows current beat position (e.g., 3/4)

#### Convenience Features
- **Tap Tempo**: Tap the button repeatedly to set tempo intuitively
- **Preset Tempos**: One-click access to common tempos
  - Largo (60 BPM)
  - Andante (80 BPM)
  - Moderato (120 BPM)
  - Allegro (140 BPM)
  - Presto (180 BPM)
- **Custom Presets**: Save, load, and delete your own tempo configurations
- **Timer Function**: Set minutes and seconds, with alarm sound on completion
- **Keyboard Shortcuts**: Control with your keyboard
- **Dark/Light Mode**: Toggle between dark and light themes
- **Multilingual**: Japanese and English support
- **Settings Persistence**: Your settings are automatically saved

### 🎹 Usage

#### Basic Controls
1. Click the **Start** button to begin
2. Adjust **BPM** using the slider or number input
3. Select **time signature** (default is 4/4)
4. Choose your preferred **sound** and **rhythm pattern**
5. Adjust **volume** as needed

#### Keyboard Shortcuts
- `Space` - Play/Stop
- `↑` / `↓` - Tempo ±1 (Hold Shift for ±10)
- `T` - Tap Tempo

#### Tap Tempo
Tap the "Tap Tempo" button repeatedly at your desired tempo, and the BPM will automatically adjust to match your taps.

#### Custom Presets
1. Configure your desired tempo, time signature, and rhythm pattern
2. Click the **+ Save** button in the Presets panel
3. Enter a name for your preset
4. Click on a saved preset to load it
5. Click the × button to delete a preset

#### Timer Function
1. Enable the timer checkbox
2. Set minutes and seconds
3. Start the metronome
4. The timer counts down and plays an alarm when it reaches zero
5. The metronome automatically stops

### 🛠️ Technical Specifications

- **Web Audio API**: High-precision timing control
- **Pure JavaScript**: No frameworks required
- **Responsive Design**: Works on smartphones and tablets
- **Offline Support**: No internet connection needed after loading
- **localStorage**: Settings and presets are saved locally

### 🌐 Browser Support

- Chrome / Edge (Recommended)
- Firefox
- Safari
- Opera

*Requires a modern browser with Web Audio API support*

### 📄 License

MIT License - Free to use, modify, and distribute

### 🤝 Contributing

Bug reports and feature requests are welcome on GitHub Issues.

### 👨‍💻 Author

Created with Claude Code by Anthropic

---

**Enjoy your music!**

---

<a name="japanese"></a>
## 日本語

シンプルで高機能なWebメトロノームアプリです。ブラウザで動作し、完全無料で使用できます。

### 🔗 デモ

[今すぐ試す](https://nattuhan.github.io/metronome/)

### ✨ 特徴

#### 基本機能
- **テンポ設定**: 1〜300 BPMまで対応
- **拍子設定**: 1〜8拍まで選択可能
- **音色**: 4種類の音色（クリック、ビープ、ウッド、カウベル）
- **リズムパターン**: シンプル、8分音符、3連符、16分音符、6連符
- **細分化拍の音**: 細分化された拍に別の音を使用可能
- **音量調整**: 0〜100%まで調整可能

#### ビジュアル機能
- **振り子アニメーション**: クラシックなメトロノームの動き
- **パルスアニメーション**: BPM表示が拍に合わせて拡大縮小
- **点滅アニメーション**: 画面全体が拍に合わせて点滅
- **拍インジケーター**: 現在の拍位置を表示（例: 3/4）

#### 便利な機能
- **タップテンポ**: ボタンを連打してテンポを直感的に設定
- **プリセットテンポ**: よく使われるテンポをワンクリックで設定
  - Largo（60 BPM）- ゆっくり
  - Andante（80 BPM）- 歩く速さ
  - Moderato（120 BPM）- 中くらい
  - Allegro（140 BPM）- 速め
  - Presto（180 BPM）- とても速い
- **カスタムプリセット**: 自分の設定を保存・読み込み・削除
- **タイマー機能**: 分・秒単位で設定可能、終了時にアラーム音
- **キーボードショートカット**: キーボードで素早く操作
- **ダーク/ライトモード**: テーマの切り替え
- **多言語対応**: 日本語・英語対応
- **設定の保存**: 設定が自動的に保存されます

### 🎹 使い方

#### 基本操作
1. **スタートボタン**をクリックして再生
2. **テンポスライダー**または数値入力でBPMを調整
3. **拍子**を選択（デフォルトは4拍子）
4. **音色**や**リズムパターン**を好みに合わせて変更
5. **音量**を調整

#### キーボードショートカット
- `Space` - 再生/停止
- `↑` / `↓` - テンポを±1調整（Shiftキー併用で±10）
- `T` - タップテンポ

#### タップテンポの使い方
「タップテンポ」ボタンを希望するテンポで連打すると、自動的にそのテンポが設定されます。

#### カスタムプリセット
1. 希望のテンポ、拍子、リズムパターンを設定
2. プリセットパネルの **+ 保存** ボタンをクリック
3. プリセット名を入力
4. 保存したプリセットをクリックして読み込み
5. ×ボタンでプリセットを削除

#### タイマー機能
1. タイマーのチェックボックスを有効化
2. 分と秒を設定
3. メトロノームを開始
4. タイマーがカウントダウンし、ゼロになるとアラーム音が鳴ります
5. メトロノームが自動的に停止します

### 🛠️ 技術仕様

- **Web Audio API**: 高精度なタイミング制御
- **Pure JavaScript**: フレームワーク不要
- **レスポンシブデザイン**: スマートフォンやタブレットにも対応
- **オフライン対応**: 読み込み後はインターネット接続不要
- **localStorage**: 設定とプリセットをローカルに保存

### 🌐 ブラウザ対応

- Chrome / Edge（推奨）
- Firefox
- Safari
- Opera

※ Web Audio APIをサポートする最新のブラウザで動作します

### 📄 ライセンス

MIT License - 自由に使用・改変・配布できます

### 🤝 貢献

バグ報告や機能提案は、GitHubのIssuesでお願いします。

### 👨‍💻 作者

Created with Claude Code by Anthropic

---

**楽しい音楽ライフを！**
