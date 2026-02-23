// js/timetable.js

/**
 * バス停クリック時に呼び出される統合関数
 */
async function showUnifiedTimetable(rawStopId, stopName) {
    // 1. GTFS検索用のID (スペースを維持: "71220 1")
    const stopIdForSearch = String(rawStopId);
    
    // 2. セレクタ用のID (スペースをアンダースコアに置換: "71220_1")
    // HTML(stops.js)側のクラス名と一致させる
    const stopIdForSelector = stopIdForSearch.replace(/\s+/g, '_');
    
    console.log(`🚏 統合表示開始: ID="${stopIdForSearch}", Selector=".timetable-content-${stopIdForSelector}"`);
    
    // ポップアップがDOMに配置されるのを待つ
    await new Promise(r => setTimeout(r, 150));
    
    const container = document.querySelector(`.timetable-content-${stopIdForSelector}`);
    if (!container) {
        console.error(`❌ 表示コンテナが見つかりません: .timetable-content-${stopIdForSelector}`);
        return;
    }

    // 祝日・曜日ラベルの取得（CalendarManagerがある前提）
    let dayInfo = { label: '本日', color: '#666' };
    if (window.CalendarManager && typeof window.CalendarManager.getDayLabel === 'function') {
        dayInfo = window.CalendarManager.getDayLabel();
    }

    container.innerHTML = `
        <div style="color:${dayInfo.color}; font-weight:bold; margin-bottom:10px; font-size:12px;">
            📅 運行区分: ${dayInfo.label}
        </div>
        <div class="loading" style="font-size:11px; color:#999;">時刻表を生成中...</div>
    `;

    try {
        let allTimes = [];

        // 全ての有効な会社から時刻を収集
        for (const company of BUS_COMPANIES) {
            if (!company.active) continue;

            // 1. 今日有効な service_id を取得 (calendar_dates.txt対応)
            const activeServiceIds = await getServiceIdsForToday(company);
            if (activeServiceIds.length === 0) continue;

            // 2. trips.txt から有効な trip_id を抽出
            const validTripIds = await getValidTripIds(company, activeServiceIds);
            if (validTripIds.size === 0) continue;

            // 3. stop_times.txt から時刻を抽出 (スペース入りのIDで検索)
            const companyTimes = await fetchStopTimes(company, stopIdForSearch, validTripIds);
            
            // 会社情報を付与して合流
            companyTimes.forEach(t => {
                t.companyName = company.name;
                allTimes.push(t);
            });
        }

        // 4. 全社の時刻を混ぜて時間順にソート
        allTimes.sort((a, b) => a.time.localeCompare(b.time));

        // 5. 表示反映
        renderUnifiedTable(container, allTimes);

    } catch (e) {
        console.error("❌ 時刻表エラー:", e);
        container.innerHTML = "<p style='font-size:11px; color:red;'>時刻表の読み込み中にエラーが発生しました。</p>";
    }
}

/**
 * calendar.txt と calendar_dates.txt を組み合わせて今日の有効なIDを返す
 */
async function getServiceIdsForToday(company) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}${m}${d}`;

    let serviceIds = [];
    
    // A. 曜日による基本判定
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
    } catch (e) {
        console.warn(`${company.id}: calendar.txt 読み込みスキップ`);
    }

    // B. 日付例外による上書き (calendar_dates.txt)
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
                    if (c[eIdx] === '1') idSet.add(c[sIdx]); // 追加
                    else if (c[eIdx] === '2') idSet.delete(c[sIdx]); // 削除
                }
            }
            serviceIds = Array.from(idSet);
        }
    } catch (e) {
        // calendar_dates.txt がない場合は曜日判定のみで進む
    }

    return serviceIds;
}

/**
 * 有効な service_id を持つ trip_id を抽出
 */
async function getValidTripIds(company, activeServiceIds) {
    try {
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
            if (activeSet.has(c[sIdx])) {
                validTrips.add(c[tIdx]);
            }
        }
        return validTrips;
    } catch (e) {
        return new Set();
    }
}

/**
 * stop_times.txt から、特定のバス停かつ有効な便の時刻を抽出
 */
async function fetchStopTimes(company, stopId, validTripIds) {
    try {
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
            // 文字列照合による簡易フィルタリング（高速化）
            if (lines[i].includes(stopId)) {
                const c = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                // 厳密なID一致と、今日の有効な便かチェック
                if (c[sIdx] === stopId && validTripIds.has(c[tIdx])) {
                    results.push({
                        time: c[aIdx].trim().substring(0, 5),
                        headsign: c[hIdx] ? c[hIdx].replace(/^"|"$/g, '') : "運行便"
                    });
                }
            }
        }
        return results;
    } catch (e) {
        return [];
    }
}

/**
 * 最終的な時刻表をテーブル形式で描画
 */
function renderUnifiedTable(container, times) {
    if (times.length === 0) {
        container.innerHTML = "<p style='font-size:11px; color:#666;'>本日の運行予定はありません。</p>";
        return;
    }

    let html = `<table style="width:100%; border-collapse:collapse; font-size:13px;">`;
    times.forEach(t => {
        // 広電と広バスで色分け
        const isHiroden = t.companyName.includes("広電");
        const badgeColor = isHiroden ? "#8bc34a" : "#f44336";
        const shortName = isHiroden ? "広電" : "広バス";

        html += `<tr style="border-bottom:1px solid #eee;">
            <td style="padding:8px 0; font-weight:bold; font-size:1.2em; width:55px;">${t.time}</td>
            <td style="padding:8px 0;">
                <span style="font-size:0.75em; color:white; background:${badgeColor}; padding:1px 4px; border-radius:3px; margin-right:5px; vertical-align:middle;">
                    ${shortName}
                </span>
                <span style="vertical-align:middle;">${t.headsign}</span>
            </td>
        </tr>`;
    });
    html += `</table>`;
    container.innerHTML = html;
}

// グローバルスコープに公開して stops.js から呼べるようにする
window.showUnifiedTimetable = showUnifiedTimetable;

console.log("✅ timetable.js (完全版: 祝日・特殊ID・スペース置換対応) ロード完了");
