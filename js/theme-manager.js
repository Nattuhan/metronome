// テーマ切り替え機能
export class ThemeManager {
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
