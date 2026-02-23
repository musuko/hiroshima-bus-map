// js/timetable.js

/**
 * バス停クリック時に呼び出される統合関数
 */
async function showUnifiedTimetable(stopId, stopName) {
    console.log(`🚏 1. 統合表示開始 stopId: ${stopId}, stopName: ${stopName}`);
    
    // ポップアップ内の表示エリアを取得（DOMが生成されるのをわずかに待機）
    await new Promise(r => setTimeout(r, 100));
    const container = document.querySelector(`.timetable-content-${stopId}`);
    if (!container) {
        console.error("❌ 表示コンテナが見つかりません");
        return;
    }

    // 祝日・曜日のラベル取得（エラー防止ガード付き）
    let dayInfo = { label: '不明', color: '#666' };
    if (window.CalendarManager && typeof window.CalendarManager.getDayLabel === 'function') {
        dayInfo = window.CalendarManager.getDayLabel();
    }

    container.innerHTML = `<div style="color:${dayInfo.color}; font-weight:bold; margin-bottom:10px;">📅 本日の運行区分: ${dayInfo.label}</div>
                           <div class="loading">時刻表を生成中...</div>`;

    try {
        let allTimes = [];

        // 全ての有効な会社から時刻を収集
        for (const company of BUS_COMPANIES) {
            if (!company.active) continue;

            // 1. 今日有効な service_id を取得
            const activeServiceIds = await getServiceIdsForToday(company);
            if (activeServiceIds.length === 0) continue;

            // 2. trips.txt から有効な trip_id を抽出
            const validTripIds = await getValidTripIds(company, activeServiceIds);
            if (validTripIds.size === 0) continue;

            // 3. stop_times.txt から時刻を抽出
            const companyTimes = await fetchStopTimes(company, stopId, validTripIds);
            
            // 会社情報を付与して合流
            companyTimes.forEach(t => {
                t.companyName = company.name;
                allTimes.push(t);
            });
        }

        // 4. 全社の時刻を混ぜて時間順にソート
        allTimes.sort((a, b) => a.time.localeCompare(b.time));

        // 5. レンダリング
        renderUnifiedTable(container, allTimes);

    } catch (e) {
        console.error("❌ 時刻表エラー:", e);
        container.innerHTML = "<p>時刻表の読み込み中にエラーが発生しました。</p>";
    }
}

/**
 * calendar.txt と calendar_dates.txt を組み合わせて判定
 */
async function getServiceIdsForToday(company) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}${m}${d}`;

    // A. 曜日判定
    let serviceIds = [];
    try {
        const res = await fetch(`${company.staticPath}calendar.txt`);
        const text = await res.text();
        const lines = text.trim().split(/\r?\n/);
        const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayCol = dayNames[now.getDay()];
        const sIdx = head.indexOf('service_id');
        const dIdx = head.indexOf(todayCol);

        for (let i = 1; i < lines.length; i++) {
            const c = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            if (c[dIdx] === '1') serviceIds.push(c[sIdx]);
        }
    } catch (e) { console.warn(`${company.id} calendar.txt なし`); }

    // B. 例外判定 (calendar_dates.txt)
    try {
        const res = await fetch(`${company.staticPath}calendar_dates.txt`);
        if (res.ok) {
            const text = await res.text();
            const lines = text.trim().split(/\r?\n/);
            const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            const sIdx = head.indexOf('service_id');
            const dIdx = head.indexOf('date');
            const eIdx = head.indexOf('exception_type');

            const idSet = new Set(serviceIds);
            for (let i = 1; i < lines.length; i++) {
                const c = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                if (c[dIdx] === todayStr) {
                    if (c[eIdx] === '1') idSet.add(c[sIdx]);
                    else if (c[eIdx] === '2') idSet.delete(c[sIdx]);
                }
            }
            serviceIds = Array.from(idSet);
        }
    } catch (e) {}

    return serviceIds;
}

async function getValidTripIds(company, activeServiceIds) {
    const res = await fetch(`${company.staticPath}trips.txt`);
    const text = await res.text();
    const lines = text.trim().split(/\r?\n/);
    const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    const sIdx = head.indexOf('service_id');
    const tIdx = head.indexOf('trip_id');
    const activeSet = new Set(activeServiceIds);
    const validTrips = new Set();

    for (let i = 1; i < lines.length; i++) {
        const c = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        if (activeSet.has(c[sIdx])) validTrips.add(c[tIdx]);
    }
    return validTrips;
}

async function fetchStopTimes(company, stopId, validTripIds) {
    const res = await fetch(`${company.staticPath}stop_times.txt`);
    const text = await res.text();
    const lines = text.trim().split(/\r?\n/);
    const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    const tIdx = head.indexOf('trip_id');
    const sIdx = head.indexOf('stop_id');
    const aIdx = head.indexOf('arrival_time');
    const hIdx = head.indexOf('stop_headsign');

    const results = [];
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].includes(stopId)) {
            const c = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            if (c[sIdx] === stopId && validTripIds.has(c[tIdx])) {
                results.push({
                    time: c[aIdx].trim().substring(0, 5),
                    headsign: c[hIdx] ? c[hIdx].replace(/^"|"$/g, '') : "運行便"
                });
            }
        }
    }
    return results;
}

function renderUnifiedTable(container, times) {
    if (times.length === 0) {
        container.innerHTML = "<p>本日の運行予定はありません。</p>";
        return;
    }

    let html = `<table style="width:100%; border-collapse:collapse; font-size:13px;">`;
    times.forEach(t => {
        const color = t.companyName.includes("広電") ? "#8bc34a" : "#f44336";
        html += `<tr style="border-bottom:1px solid #eee;">
            <td style="padding:8px 0; font-weight:bold; font-size:1.2em; width:60px;">${t.time}</td>
            <td style="padding:8px 0;">
                <span style="font-size:0.8em; color:white; background:${color}; padding:1px 4px; border-radius:3px; margin-right:5px;">${t.companyName[0]}</span>
                ${t.headsign}
            </td>
        </tr>`;
    });
    html += `</table>`;
    container.innerHTML = html;
}

// グローバルスコープに公開
window.showUnifiedTimetable = showUnifiedTimetable;
