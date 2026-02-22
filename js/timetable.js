// js/timetable.js

async function showUnifiedTimetable(stopId) {
    console.log("1. 統合表示開始 stopId:", stopId);
    
    // --- ポップアップ要素を確実に捕まえるための待機処理 ---
    let container = null;
    for (let i = 0; i < 10; i++) { // 0.5秒間試行
        container = document.querySelector('.leaflet-popup-content');
        if (container) break;
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (!container) {
        console.warn("ポップアップコンテナが見つかりません。");
        return;
    }

    container.innerHTML = `<div style="min-width:200px;">本日の時刻表を抽出中...</div>`;

    try {
        const stopName = window.stopLookup[stopId]?.name || `停留所(${stopId})`;
        const dayInfo = window.CalendarManager.getDayLabel();
        let results = [];

        for (const company of BUS_COMPANIES.filter(c => c.active)) {
            const activeServices = await window.CalendarManager.getTodayServiceIds(company);
            if (activeServices.length === 0) continue;

            // trips.txt から今日の便を抽出
            const tripRes = await fetch(`${company.staticPath}trips.txt`);
            const tripText = await tripRes.text();
            const tripLines = tripText.trim().split(/\r?\n/);
            const tripHead = tripLines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            const tTripIdx = tripHead.indexOf('trip_id');
            const tServiceIdx = tripHead.indexOf('service_id');
            
            const todayTripIds = new Set();
            for (let i = 1; i < tripLines.length; i++) {
                const cols = tripLines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                if (activeServices.includes(cols[tServiceIdx])) {
                    todayTripIds.add(cols[tTripIdx]);
                }
            }

            // stop_times.txt から時刻を抽出
            const stRes = await fetch(`${company.staticPath}stop_times.txt`);
            const stText = await stRes.text();
            const stLines = stText.trim().split(/\r?\n/);
            const stHead = stLines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            const sIdx = stHead.indexOf('stop_id');
            const aIdx = stHead.indexOf('arrival_time');
            const hIdx = stHead.indexOf('stop_headsign');
            const tIdx = stHead.indexOf('trip_id');

            for (let i = 1; i < stLines.length; i++) {
                if (stLines[i].includes(stopId)) {
                    const cols = stLines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                    if (cols[sIdx] === stopId && todayTripIds.has(cols[tIdx])) {
                        results.push({
                            time: cols[aIdx]?.substring(0, 5) || "--:--",
                            headsign: cols[hIdx] || "運行予定",
                            company: company.name
                        });
                    }
                }
            }
        }

        results.sort((a, b) => a.time.localeCompare(b.time));

        let html = `
            <div style="max-height:300px; overflow-y:auto; min-width:220px;">
                <div style="padding-bottom:5px; border-bottom:2px solid ${dayInfo.color}; margin-bottom:5px;">
                    <strong style="font-size:1.1em;">${stopName}</strong><br>
                    <span style="font-size:0.85em; color:${dayInfo.color}; font-weight:bold;">${dayInfo.label}ダイヤ</span>
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:13px;">`;
        
        if (results.length === 0) {
            html += `<tr><td style="padding:10px; color:#999;">本日の運行はありません。</td></tr>`;
        } else {
            results.forEach(r => {
                html += `
                    <tr style="border-bottom:1px solid #eee;">
                        <td style="padding:6px 0; font-weight:bold; width:50px;">${r.time}</td>
                        <td style="padding:6px 5px;">
                            ${r.headsign} <br>
                            <small style="color:#888;">${r.company}</small>
                        </td>
                    </tr>`;
            });
        }
        container.innerHTML = html + `</table></div>`;
        console.log("3. 表示完了（曜日判定済）");

    } catch (error) {
        console.error("時刻表エラー:", error);
        container.innerHTML = "読込エラーが発生しました。";
    }
}

window.showUnifiedTimetable = showUnifiedTimetable;
console.log("✅ timetable.js の読み込みが完了しました");
