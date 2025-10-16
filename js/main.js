import { Metronome } from './metronome.js';
import { ThemeManager } from './theme-manager.js';
import { LanguageManager } from './language-manager.js';
import { MusicAnalyzer } from './music-analyzer.js';

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

// グローバルスコープにエクスポート（LanguageManagerから参照するため）
window.metronome = metronome;
