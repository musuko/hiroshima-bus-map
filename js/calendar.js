// js/calendar.js

window.CalendarManager = {
    /**
     * 今日有効な service_id を取得
     */
    async getTodayServiceIds(company) {
        try {
            const res = await fetch(`${company.staticPath}calendar.txt`);
            const text = await res.text();
            const lines = text.trim().split(/\r?\n/);
            const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));

            const now = new Date();
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const todayName = dayNames[now.getDay()];

            const serviceIdIdx = head.indexOf('service_id');
            const dayIdx = head.indexOf(todayName);

            const activeIds = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                if (cols[dayIdx] === '1') {
                    activeIds.push(cols[serviceIdIdx]);
                }
            }
            return activeIds;
        } catch (e) {
            console.error(`${company.name} カレンダー取得失敗:`, e);
            return [];
        }
    },

    /**
     * 今日が何ダイヤか判定
     */
    getDayLabel() {
        const day = new Date().getDay();
        if (day === 0) return { label: '日曜', color: '#e74c3c' };
        if (day === 6) return { label: '土曜', color: '#3498db' };
        return { label: '平日', color: '#2c3e50' };
    }
};

console.log("✅ calendar.js の読み込みが完了しました");
