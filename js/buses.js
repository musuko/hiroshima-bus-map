// 1. 【前処理】tripUpdateだけを集めて辞書を作る
const delayMap = {};
entities.forEach(item => {
    const update = item.tripUpdate; // 抜粋データに合わせて tripUpdate を参照
    if (update && update.trip && update.trip.tripId) {
        delayMap[update.trip.tripId] = update;
    }
});

// 2. 【メイン処理】車両位置をループ
entities.forEach(item => {
    const v = item.vehicle;
    if (!v || !v.position) return;

    const tripId = v.trip ? v.trip.tripId : null;
    const routeId = (v.trip && v.trip.routeId) ? v.trip.routeId : (v.routeId || null);
    
    // 遅延情報の照合
    let delayText = "";
    const myUpdate = tripId ? delayMap[tripId] : null;

    if (myUpdate && myUpdate.stopTimeUpdate) {
        // stopTimeUpdateの配列から最初のdelayを持っている要素を探す
        let delaySeconds = 0;
        const foundUpdate = myUpdate.stopTimeUpdate.find(stu => 
            (stu.departure && stu.departure.delay !== undefined) || 
            (stu.arrival && stu.arrival.delay !== undefined)
        );

        if (foundUpdate) {
            const event = foundUpdate.departure || foundUpdate.arrival;
            delaySeconds = event.delay;
        }

        const delayMin = Math.floor(delaySeconds / 60);
        if (delayMin > 0) {
            delayText = `<span style="background:#fff3cd; color:#856404; padding:2px 5px; border-radius:4px; font-size:0.85em; margin-left:5px;">${delayMin}分遅れ</span>`;
        } else if (delayMin < 0) {
            delayText = `<span style="background:#d1ecf1; color:#0c5460; padding:2px 5px; border-radius:4px; font-size:0.85em; margin-left:5px;">早着</span>`;
        } else {
            delayText = `<span style="background:#d4edda; color:#155724; padding:2px 5px; border-radius:4px; font-size:0.85em; margin-left:5px;">定時</span>`;
        }
    }

    // --- あとはこの delayText を popupContent に含めるだけ ---
