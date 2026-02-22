// js/calendar.js

window.CalendarManager = {
    /**
     * 特定の会社の calendar.txt から、今日有効な service_id のリストを返す
     */
    async getTodayServiceIds(company) {
        try {
            const res = await fetch(`${company.staticPath}calendar.txt`);
            if (!res.ok) throw new Error("calendar.txt not found");
            
            const text = await res.text();
            const lines = text.trim().split(/\r?\n/);
            const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));

            // 今日の曜日を取得 (0:日, 1:月, ..., 6:土)
            const now = new Date();
            const dayOfWeek = now.getDay();
            const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const todayColName = dayMap[dayOfWeek];

            const serviceIdIdx = head.indexOf('service_id');
            const todayIdx = head.indexOf(todayColName);

            if (serviceIdIdx === -1 || todayIdx === -1) return [];

            const activeIds = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                // 今日の曜日の列が "1" ならば、そのサービスIDは有効
                if (cols[todayIdx] === '1') {
                    activeIds.push(cols[serviceIdIdx]);
                }
            }
            
            console.log(`📅 ${company.name} の有効なServiceId (${todayColName}):`, activeIds);
            return activeIds;
        } catch (e) {
            console.error(`${company.name} のカレンダー取得失敗:`, e);
            return [];
        }
    },

    /**
     * 現在の曜日ラベルを返す (表示用)
     */
    getDayLabel() {
        const day = new Date().getDay();
        if (day === 0) return { label: '休日・日曜', color: '#e74c3c' };
        if (day === 6) return { label: '土曜', color: '#3498db' };
        return { label: '平日', color: '#2c3e50' };
    }
};

console.log("✅ calendar.js の読み込みが完了しました");
