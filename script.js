// 移除明文后门密码，目前是纯净物理隔离版本

const regularItems = [
    { key: 'particle', name: '悬浮粒子', isMicro: false }, { key: 'pressure', name: '静压差', isMicro: false },
    { key: 'air', name: '换气次数/风速/风量', isMicro: false }, { key: 'temphum', name: '温湿度', isMicro: false },
    { key: 'noise', name: '噪声', isMicro: false }, { key: 'lux', name: '照度', isMicro: false },
    { key: 'planktonic', name: '浮游菌', isMicro: true }, { key: 'settling', name: '沉降菌', isMicro: true }
];
const specialItems = [
    { key: 'vibration', name: '振动', isMicro: false }, { key: 'recovery', name: '自净时间', isMicro: false },
    { key: 'airflow', name: '气流流型', isMicro: false }, { key: 'leakage', name: '高效检漏', isMicro: false },
    { key: 'uv', name: '紫外灯辐射强度', isMicro: false }, { key: 'surface', name: '表面微生物', isMicro: true }
];
const testItems = [...regularItems, ...specialItems];

const combinedLevels = [
    "5级", "6级", "7级", "8级", "9级",
    "100级", "1000级", "10000级", "100000级", "300000级",
    "I级", "II级", "III级", "IV级",
    "A级", "B级", "C级", "D级"
];

const basisOptions = [
    "GB 50591 洁净室施工及验收规范", "GB 50073 洁净厂房设计规范",
    "GB/T 16292 医药工业洁净室(区)悬浮粒子的测试方法", "GB/T 16294 医药工业洁净室(区)沉降菌的测试方法",
    "GB/T 16293 医药工业洁净室(区)浮游菌的测试方法", "GB 50457 医药工业洁净厂房设计规范",
    "GB 50333 医院洁净手术部建筑技术规范", "GB 51110 洁净厂房施工及质量验收规范",
    "GB 50447 实验动物设施建筑技术规范", "GB 14925 实验动物环境及设施",
    "WS/T 367 医疗机构消毒技术规范", "GB 15982 医院消毒卫生标准",
    "YBB 00412004 药品包装材料生产厂房洁净室(区)的测试方法", "GB 50346 生物安全实验室建筑技术规范",
    "GB/T 25915.1 洁净室及相关受控环境第1部分:空气洁净度等级", "GB/T 25915.3 洁净室及相关受控环境第3部分:检测方法",
    "GB/T 13554 高效空气过滤器", "YY/T 0033 无菌医疗器具生产管理规范",
    "GB 50472 电子工业洁净厂房设计规范", "GB 50462 数据中心基础设施施工及验收规范",
    "GB 50243 通风与空调工程施工质量验收规范", "药品生产质量管理规范（2010年修订)",
    "中华人民共和国药典（2020年版）", "ISO 14644-1", "ISO 14644-3"
];

const GITEE_PULL_URL = "https://gitee.com/zhang_jia_shu/cleanroom-config/raw/master/latest_price.json";

window.onload = async function () {
    initBasisCheckboxes();

    // 1. 启动时自动从云端静默拉取最新配置
    await fetchCloudConfig(false);

    // 2. 检查是否有本地缓存配置
    const saved = localStorage.getItem('cleanroomPricesV10');
    if (!saved) {
        document.getElementById('currentConfigStatus').innerHTML = "⚠️ <b>尚未接入系统！请确保网络畅通或手动导入离线包</b>";
        document.getElementById('currentConfigStatus').style.color = "#dc2626";
    }

    // 启动时优先恢复草稿箱数据
    const restored = restoreDraft();
    if (!restored) {
        addRoom();
    } else {
        calculateAll();
    }

    // 启动云端更新轮询监控
    startCloudSyncPolling();
};

function initBasisCheckboxes() {
    const testBox = document.getElementById('testBasisBox');
    const evalBox = document.getElementById('evalBasisBox');

    let htmlStr = '';
    basisOptions.forEach(basis => {
        htmlStr += `<label><input type="checkbox" value="${basis}"> ${basis}</label>`;
    });
    htmlStr += `<label style="border-top: 1px dashed #eee; padding-top: 8px; margin-top: 5px;">
                  <input type="checkbox" class="basis-custom-chk"> 自定义录入: 
                  <input type="text" class="basis-custom-txt" style="width: 250px;" placeholder="在此输入标准名称...">
                </label>`;

    testBox.innerHTML = htmlStr;
    evalBox.innerHTML = htmlStr;
}

function getCheckedBasis(boxId) {
    const box = document.getElementById(boxId);
    const regularChecks = box.querySelectorAll('input[type="checkbox"]:not(.basis-custom-chk):checked');
    let results = Array.from(regularChecks).map(c => c.value);

    const customChk = box.querySelector('.basis-custom-chk');
    const customTxt = box.querySelector('.basis-custom-txt');
    if (customChk && customChk.checked && customTxt.value.trim() !== '') {
        results.push(customTxt.value.trim());
    }
    return results.join('\n');
}

// ====== 管理员 UI 逻辑已剥离至 admin.html 和 admin.js ======
// 此文件现在仅包含存粹的客户端业务逻辑

function buildDefaultPrices() {
    let defaultData = {};
    combinedLevels.forEach(level => {
        defaultData[level] = {};
        testItems.forEach(item => {
            defaultData[level][item.key] = { threshold: 10, pBelow: 100, pAbove: 80 };
        });
    });
    return defaultData;
}

function getSystemPrices() {
    const saved = localStorage.getItem('cleanroomPricesV10');
    if (saved) {
        let savedData = JSON.parse(saved);
        let defaultData = buildDefaultPrices();
        return { ...defaultData, ...savedData };
    }
    return buildDefaultPrices();
}

// ====== 客户端 Serverless 云端静默同频引擎 ======
// 因为本地双击打开HTML是 file:// 协议，直接请求 raw.gitee.com 会被浏览器的 CORS 反跨域机制无情拦截。
// 曲线救国：客户端也使用 Gitee 的官方查询 API 来获取文件内容（API 节点默认允许所有跨域 CORS 请求）
const GITEE_PULL_API = "https://gitee.com/api/v5/repos/zhang_jia_shu/cleanroom-config/contents/latest_price.json";

function startCloudSyncPolling() {
    // 设定为每 5 分钟轮询一次云端更新
    setInterval(async () => {
        await fetchCloudConfig(false);
    }, 5 * 60 * 1000); // 5分钟
}

function showUpdateNotification() {
    if (document.getElementById('cloud-update-notice')) return;
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    const toast = document.createElement('div');
    toast.id = 'cloud-update-notice';
    toast.className = `toast warning`;
    toast.style.pointerEvents = 'auto'; // 允许点击
    toast.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px;">
            <div style="font-weight:bold;">💡 检测到云端价格已更新！</div>
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:5px;">
                <button onclick="manualFetchCloudConfig(); this.closest('.toast').remove();" style="background:#fff;color:#f59e0b;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-weight:bold;">立即同步</button>
                <button onclick="this.closest('.toast').remove();" style="background:transparent;color:#fff;border:1px solid #fff;padding:4px 10px;border-radius:4px;cursor:pointer;">忽略</button>
            </div>
        </div>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
}

function manualFetchCloudConfig() {
    fetchCloudConfig(true);
}

async function fetchCloudConfig(isManual = false) {
    const statusEl = document.getElementById('currentConfigStatus');

    if (isManual || !window.__initialCloudFetchDone) {
        statusEl.innerHTML = "🔄 正在连接云端核对核心计价中枢...";
        statusEl.style.color = "#3b82f6";
    }

    try {
        const response = await fetch(`${GITEE_PULL_API}?access_token=cf337a366df0f575cc3d5a822b45d06a&t=${new Date().getTime()}`);
        if (!response.ok) throw new Error(`云端响应异常: ${response.status}`);

        const resJson = await response.json();
        if (!resJson.content) throw new Error("API 响应体未携带内容报文");

        const rawContentBase64 = resJson.content;
        const cleanBase64 = rawContentBase64.replace(/[\r\n\s]/g, '');
        const ourObfuscatedString = decodeURIComponent(escape(atob(cleanBase64)));
        const jsonStr = decodeURIComponent(escape(atob(ourObfuscatedString)));
        const parsedData = JSON.parse(jsonStr);

        if (parsedData.sign === "CLEANROOM_CONFIG_X1" && parsedData.data) {
            const localRaw = localStorage.getItem('cleanroomPricesV10_Meta');
            let localTime = 0;
            if (localRaw) {
                try { localTime = JSON.parse(localRaw).timestamp || 0; } catch (e) { }
            }

            if (parsedData.timestamp > localTime) {
                if (isManual || !window.__initialCloudFetchDone) {
                    localStorage.setItem('cleanroomPricesV10', JSON.stringify(parsedData.data));
                    localStorage.setItem('cleanroomPricesV10_Meta', JSON.stringify({ timestamp: parsedData.timestamp }));
                    showToast("🌤️ 已" + (isManual ? "手动" : "自动") + "从云端拉取今日最新价格并生效！", "success");
                    calculateAll();
                } else {
                    // 后台轮询发现了新版本，提醒用户手动更新
                    showUpdateNotification();
                    return;
                }
            } else {
                if (isManual) {
                    showToast("✅ 当前已是最新版本，无需同步！", "success");
                }
            }

            const importTime = new Date(parsedData.timestamp).toLocaleString();
            statusEl.innerHTML = `🟢 已连接云端，当前数据版本：${importTime}`;
            statusEl.style.color = "#10b981";
        } else {
            throw new Error("云端数据签名校验失败或格式错误。");
        }
    } catch (e) {
        console.warn("云端通信挂起，转为离线降级模式:", e);
        if (isManual) {
            showToast("❌ 手动同步失败：网络异常或云端拒绝连接", "danger");
        }

        if (!window.__initialCloudFetchDone || isManual) {
            showToast("⚠️ 离线模式：网络异常，正在使用本地最后一次更新的单价", "warning");
            const meta = localStorage.getItem('cleanroomPricesV10_Meta');
            if (meta) {
                const time = new Date(JSON.parse(meta).timestamp).toLocaleString();
                statusEl.innerHTML = `🟠 离线模式：当前使用系统缓存单价(${time})`;
                statusEl.style.color = "#f59e0b";
            } else {
                statusEl.innerHTML = "⚠️ <b>尚未接入系统！请确保网络畅通或手动导入离线包</b>";
                statusEl.style.color = "#dc2626";
            }
        }
    }
    window.__initialCloudFetchDone = true;
}

// 简单的气泡提示工具（如果 script.js 以前没有注入则这里挂载）
function showToast(message, type = 'success') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ====== 全新的离线价格包反混淆导入引擎 ======
function handleImportPrices(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const fileContent = e.target.result;

            // 进行 Base64 解码和 URI 解码反混淆
            const rawJsonString = decodeURIComponent(atob(fileContent));
            const parsedData = JSON.parse(rawJsonString);

            // 安全校验文件指纹
            if (parsedData.sign !== "CLEANROOM_CONFIG_X1" || !parsedData.data) {
                alert("导入失败：该文件并非有效的洁净室价格配置包，或者版本不兼容。");
                return;
            }

            const importTime = new Date(parsedData.timestamp).toLocaleString();

            // 写入本地全局缓存覆盖
            localStorage.setItem('cleanroomPricesV10', JSON.stringify(parsedData.data));

            // UI 反馈
            const statusEl = document.getElementById('currentConfigStatus');
            if (statusEl) {
                statusEl.innerHTML = `✅ 已载入配置（文件时间：${importTime}）`;
                statusEl.style.color = "#10b981";
            }

            alert(`🎉 价格解包成功！系统已全局运用最新单价！`);

            // 如果页面上有正在编辑的房间草稿，用最新的价格无缝重算一遍
            calculateAll();

        } catch (error) {
            alert("导入异常：文件读取失败或数据损坏！请确保导入的是管理员下发的 .crm 价格配置包。");
            console.error(error);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}



function handleStandardChange() {
    const std = document.getElementById('standardSelect').value;
    const isPureGB = (std === 'GB');
    const isGB16292Old = (std === 'GB16292_OLD');

    const microbioCells = document.querySelectorAll('.cell-microbio');

    microbioCells.forEach(cell => {
        const cb = cell.querySelector('input[type="checkbox"]');
        if (isPureGB) {
            cell.classList.add('hidden-col');
            if (cb) cb.checked = false;
        } else {
            cell.classList.remove('hidden-col');
            if (cb && (cb.classList.contains('chk-planktonic') || cb.classList.contains('chk-settling'))) {
                cb.checked = true;
            }
        }
    });

    const allowedLevels = isGB16292Old ? ["100级", "10000级", "100000级", "300000级"] : combinedLevels;
    const levelSelects = document.querySelectorAll('.room-level');

    levelSelects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '';

        allowedLevels.forEach(lvl => {
            const opt = document.createElement('option');
            opt.value = lvl;
            opt.text = lvl;
            select.appendChild(opt);
        });

        if (allowedLevels.includes(currentValue)) {
            select.value = currentValue;
        } else {
            select.value = allowedLevels[0];
        }
    });

    calculateAll();
}

function handleManualEdit(inputElement) {
    if (inputElement.value === '') {
        inputElement.dataset.locked = "false";
        inputElement.classList.remove('manual-point');
        inputElement.classList.add('auto-point');
    } else {
        inputElement.dataset.locked = "true";
        inputElement.classList.remove('auto-point');
        inputElement.classList.add('manual-point');
    }
    calculateAll();
}

function fillDownRoomLevel() {
    const selects = document.querySelectorAll('.room-level');
    if (selects.length <= 1) return;

    const firstValue = selects[0].value;
    selects.forEach((sel, index) => {
        if (index > 0) sel.value = firstValue;
    });
    calculateAll();
}

let roomCount = 0;

function addRoom(importName = '', importLevel = '', importArea = '') {
    roomCount++;
    const tbody = document.getElementById('roomBody');
    const tr = document.createElement('tr');
    tr.id = `room_row_${roomCount}`;
    tr.className = 'room-group';

    let defaultName = importName ? importName : `房间 ${roomCount}`;
    let defaultArea = importArea ? importArea : 50;

    const currentStd = document.getElementById('standardSelect') ? document.getElementById('standardSelect').value : 'ISO';
    const allowedLevels = (currentStd === 'GB16292_OLD') ? ["100级", "10000级", "100000级", "300000级"] : combinedLevels;

    let levelSelectHtml = `<select class="room-level" onchange="calculateAll()">`;
    allowedLevels.forEach(lvl => {
        let selected = (lvl === importLevel) ? 'selected' : '';
        levelSelectHtml += `<option value="${lvl}" ${selected}>${lvl}</option>`;
    });
    levelSelectHtml += `</select>`;

    let regularHtml = `<div class="item-row regular-row">
        <span class="row-label">常规项目</span>
        <div class="items-grid">`;
    regularItems.forEach(item => {
        let isMicro = item.isMicro ? 'cell-microbio' : '';
        regularHtml += `
            <div class="item-box ${isMicro}">
                <label class="item-label">
                    <input type="checkbox" class="chk-${item.key}" checked onchange="calculateAll()">
                    ${item.name}
                </label>
                <input type="number" class="pt-input auto-point in-${item.key}" data-locked="false" oninput="handleManualEdit(this)">
            </div>
        `;
    });
    regularHtml += `</div></div>`;

    let specialHtml = `<div class="item-row special-row">
        <span class="row-label">特殊项目</span>
        <div class="items-grid">`;
    specialItems.forEach(item => {
        let isMicro = item.isMicro ? 'cell-microbio' : '';
        specialHtml += `
            <div class="item-box ${isMicro}">
                <label class="item-label">
                    <input type="checkbox" class="chk-${item.key}" onchange="calculateAll()">
                    ${item.name}
                </label>
                <input type="number" class="pt-input auto-point in-${item.key}" data-locked="false" oninput="handleManualEdit(this)">
            </div>
        `;
    });
    specialHtml += `</div></div>`;

    tr.innerHTML = `
        <td><input type="text" class="room-name" value="${defaultName}"></td>
        <td>${levelSelectHtml}</td>
        <td><input type="number" class="room-area" value="${defaultArea}" min="1" oninput="calculateAll()"></td>
        <td class="config-cell">
            ${regularHtml}
            ${specialHtml}
            <div class="collapsed-summary"></div>
        </td>
        <td><span class="room-total-text">¥ 0.00</span></td>
        <td><button class="btn btn-danger" onclick="removeRoom('${tr.id}')">删除</button></td>
    `;

    tbody.appendChild(tr);

    // 回车键全自动新增的新键盘流
    const areaInput = tr.querySelector('.room-area');
    areaInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addRoom();
            // 新增后，焦点自动跳转到最后一个新生成的房间名称输入框内
            const allRooms = document.querySelectorAll('.room-group');
            const newRoom = allRooms[allRooms.length - 1];
            if (newRoom) newRoom.querySelector('.room-name').focus();
        }
    });

    handleStandardChange();
}

// 展开/折叠全部明细逻辑
let allRoomsCollapsed = false;
function toggleAllRoomsCollapse() {
    allRoomsCollapsed = !allRoomsCollapsed;
    document.querySelectorAll('.room-group').forEach(row => {
        if (allRoomsCollapsed) {
            row.classList.add('collapsed');
        } else {
            row.classList.remove('collapsed');
        }
    });
}

function removeRoom(rowId) {
    const tr = document.getElementById(rowId);
    if (!tr) return;

    // 删除前压入撤销栈
    pushUndoState();

    tr.remove();
    calculateAll();
}

// undoDeleteRoom 已被通用撤销/重做系统替代

function mapCustomerLevelToSystem(rawLevel) {
    if (!rawLevel) return combinedLevels[0];
    let lvl = rawLevel.toString().trim().toUpperCase();

    if (combinedLevels.includes(lvl)) return lvl;

    if (lvl.includes('三十万') || lvl.includes('30万') || lvl.includes('300000')) return "300000级";
    if (lvl.includes('十万') || lvl.includes('10万') || lvl.includes('100000')) return "100000级";
    if (lvl.includes('一万') || lvl.includes('万级') || lvl.includes('1万') || lvl.includes('10000')) return "10000级";
    if (lvl.includes('千级') || lvl.includes('1000')) return "1000级";
    if (lvl.includes('百级') || lvl.includes('100')) return "100级";

    if (lvl.includes('5级') || lvl.includes('ISO 5') || lvl.includes('ISO5')) return "5级";
    if (lvl.includes('6级') || lvl.includes('ISO 6') || lvl.includes('ISO6')) return "6级";
    if (lvl.includes('7级') || lvl.includes('ISO 7') || lvl.includes('ISO7')) return "7级";
    if (lvl.includes('8级') || lvl.includes('ISO 8') || lvl.includes('ISO8')) return "8级";
    if (lvl.includes('9级') || lvl.includes('ISO 9') || lvl.includes('ISO9')) return "9级";

    if (lvl.includes('A级') || lvl.includes('A类')) return "A级";
    if (lvl.includes('B级') || lvl.includes('B类')) return "B级";
    if (lvl.includes('C级') || lvl.includes('C类')) return "C级";
    if (lvl.includes('D级') || lvl.includes('D类')) return "D级";

    if (lvl.includes('I级') || lvl.includes('Ⅰ级')) return "I级";
    if (lvl.includes('II级') || lvl.includes('Ⅱ级')) return "II级";
    if (lvl.includes('III级') || lvl.includes('Ⅲ级')) return "III级";
    if (lvl.includes('IV级') || lvl.includes('Ⅳ级')) return "IV级";

    return combinedLevels[0];
}

function downloadImportTemplate() {
    const wsData = [
        ["检测区域", "房间名称\n（必填）", "房间编号", "洁净级别\n（必填）", "房间面积（m2）（必填）", "备注说明(系统不读取)"],
        ["1", "煮料间", "R-01", "万级", "55", "系统极其智能，级别填万级会自动识别为 10000级"],
        ["1", "灌装间", "R-02", "D级", "80", "您也可以直接用公司原本的《洁净检测委托单》导入！"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 22 }, { wch: 65 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "委托单导入模板");
    XLSX.writeFile(wb, "洁净检测委托单模板.xlsx");
}

function handleImportExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = e.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            let headerRowIndex = -1;
            let colName = -1, colLevel = -1, colArea = -1;

            for (let i = 0; i < Math.min(30, rawData.length); i++) {
                const row = rawData[i];
                if (!row) continue;
                for (let j = 0; j < row.length; j++) {
                    let cellValue = (row[j] || "").toString().replace(/\s+/g, '');
                    if (cellValue.includes("房间名称")) {
                        headerRowIndex = i;
                        break;
                    }
                }
                if (headerRowIndex !== -1) {
                    for (let j = 0; j < row.length; j++) {
                        let cellValue = (row[j] || "").toString().replace(/\s+/g, '');
                        if (cellValue.includes("房间名称")) colName = j;
                        else if (cellValue.includes("级别") || cellValue.includes("等级")) colLevel = j;
                        else if (cellValue.includes("面积")) colArea = j;
                    }
                    break;
                }
            }

            if (headerRowIndex === -1 || colName === -1 || colArea === -1) {
                alert("未能识别委托单格式，请确保表格中包含【房间名称】和【房间面积】的列名。");
                return;
            }

            let importedCount = 0;
            for (let i = headerRowIndex + 1; i < rawData.length; i++) {
                const row = rawData[i];
                if (!row || row.length === 0) continue;

                const rName = (row[colName] || "").toString().trim();
                const rawLevel = (row[colLevel] || "").toString().trim();
                const rArea = parseFloat(row[colArea]) || 0;

                if (rName || rArea > 0) {
                    const standardLevel = mapCustomerLevelToSystem(rawLevel);

                    const existingRooms = document.querySelectorAll('.room-group');
                    if (existingRooms.length === 1 && existingRooms[0].querySelector('.room-name').value === "房间 1" && parseFloat(existingRooms[0].querySelector('.room-area').value) === 50) {
                        existingRooms[0].remove();
                    }

                    addRoom(rName, standardLevel, rArea);
                    importedCount++;
                }
            }

            if (importedCount > 0) {
                alert(`成功为您从表单中批量导入了 ${importedCount} 个房间！`);
                calculateAll();
            } else {
                alert("未读取到有效的房间数据，请检查表格内容。");
            }
        } catch (error) {
            alert(`解析文件失败！请确保上传的是 Excel 文件。\n\n具体报错信息供排查: ${error.message || error}`);
            console.error(error);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsBinaryString(file);
}

const calcRules = {
    "GB": {
        particle: (a, l) => Math.ceil(Math.sqrt(a)),
        temphum: (a, l) => Math.max(2, Math.ceil(a / 100)),
        noise: (a, l) => Math.ceil(a / 100),
        lux: (a, l) => Math.ceil(a / 25),
        pressure: (a, l) => 1, air: (a, l) => 1, microbio: (a, l) => 0, fixed: (a, l) => 1
    },
    "GB50591": {
        particle: (a, l) => Math.ceil(Math.sqrt(a)),
        temphum: (a, l) => Math.max(2, Math.ceil(a / 100)),
        noise: (a, l) => a <= 15 ? 1 : 5,
        lux: (a, l) => a <= 20 ? 2 : Math.ceil(a / 4),
        pressure: (a, l) => 1, air: (a, l) => 1,
        microbio: (a, l) => Math.ceil(Math.sqrt(a)),
        fixed: (a, l) => 1
    },
    "ISO": {
        particle: (a, l) => {
            const t = [{ max: 2, pts: 1 }, { max: 4, pts: 2 }, { max: 6, pts: 3 }, { max: 8, pts: 4 }, { max: 10, pts: 5 }, { max: 24, pts: 6 }, { max: 28, pts: 7 }, { max: 32, pts: 8 }, { max: 36, pts: 9 }, { max: 52, pts: 10 }, { max: 56, pts: 11 }, { max: 64, pts: 12 }, { max: 68, pts: 13 }, { max: 72, pts: 14 }, { max: 76, pts: 15 }, { max: 104, pts: 16 }, { max: 108, pts: 17 }, { max: 116, pts: 18 }, { max: 148, pts: 19 }, { max: 156, pts: 20 }, { max: 192, pts: 21 }, { max: 232, pts: 22 }, { max: 276, pts: 23 }, { max: 352, pts: 24 }, { max: 436, pts: 25 }, { max: 636, pts: 26 }, { max: 1000, pts: 27 }];
            if (a <= 1000) { for (let i = 0; i < t.length; i++) if (a <= t[i].max) return t[i].pts; }
            return Math.ceil(27 * (a / 1000));
        },
        temphum: (a, l) => Math.max(2, Math.ceil(a / 100)),
        noise: (a, l) => Math.ceil(a / 100),
        lux: (a, l) => Math.ceil(a / 25),
        pressure: (a, l) => 1, air: (a, l) => 1, fixed: (a, l) => 1,
        microbio: (a, l) => {
            const t = [{ max: 2, pts: 1 }, { max: 4, pts: 2 }, { max: 6, pts: 3 }, { max: 8, pts: 4 }, { max: 10, pts: 5 }, { max: 24, pts: 6 }, { max: 28, pts: 7 }, { max: 32, pts: 8 }, { max: 36, pts: 9 }, { max: 52, pts: 10 }, { max: 56, pts: 11 }, { max: 64, pts: 12 }, { max: 68, pts: 13 }, { max: 72, pts: 14 }, { max: 76, pts: 15 }, { max: 104, pts: 16 }, { max: 108, pts: 17 }, { max: 116, pts: 18 }, { max: 148, pts: 19 }, { max: 156, pts: 20 }, { max: 192, pts: 21 }, { max: 232, pts: 22 }, { max: 276, pts: 23 }, { max: 352, pts: 24 }, { max: 436, pts: 25 }, { max: 636, pts: 26 }, { max: 1000, pts: 27 }];
            if (a <= 1000) { for (let i = 0; i < t.length; i++) if (a <= t[i].max) return t[i].pts; }
            return Math.ceil(27 * (a / 1000));
        }
    },
    "GB16292_OLD": {
        particle: (a, l) => {
            if (l === "100级") {
                if (a < 10) return 3; if (a < 20) return 4; if (a < 40) return 8; if (a < 100) return 16;
                if (a < 200) return 40; if (a < 400) return 80; if (a < 1000) return 160; if (a < 2000) return 400; return 800;
            } else if (l === "10000级") {
                if (a < 10) return 2; if (a < 20) return 2; if (a < 40) return 2; if (a < 100) return 4;
                if (a < 200) return 10; if (a < 400) return 20; if (a < 1000) return 40; if (a < 2000) return 100; return 200;
            } else if (l === "100000级" || l === "300000级") {
                if (a < 10) return 2; if (a < 20) return 2; if (a < 40) return 2; if (a < 100) return 2;
                if (a < 200) return 3; if (a < 400) return 6; if (a < 1000) return 13; if (a < 2000) return 32; return 63;
            }
            return 2;
        },
        microbio: (a, l) => {
            if (l === "100级") {
                if (a < 10) return 3; if (a < 20) return 4; if (a < 40) return 8; if (a < 100) return 16;
                if (a < 200) return 40; if (a < 400) return 80; if (a < 1000) return 160; if (a < 2000) return 400; return 800;
            } else if (l === "10000级") {
                if (a < 10) return 2; if (a < 20) return 2; if (a < 40) return 2; if (a < 100) return 4;
                if (a < 200) return 10; if (a < 400) return 20; if (a < 1000) return 40; if (a < 2000) return 100; return 200;
            } else if (l === "100000级" || l === "300000级") {
                if (a < 10) return 2; if (a < 20) return 2; if (a < 40) return 2; if (a < 100) return 2;
                if (a < 200) return 3; if (a < 400) return 6; if (a < 1000) return 13; if (a < 2000) return 32; return 63;
            }
            return 2;
        },
        air: (a, l) => {
            if (a < 100) return Math.ceil(a / 15);
            if (a >= 100 && a < 200) return Math.ceil(a / 17);
            if (a >= 200 && a < 400) return Math.ceil(a / 20);
            return Math.ceil(a / 22);
        },
        temphum: (a, l) => Math.max(2, Math.ceil(a / 100)),
        noise: (a, l) => a <= 15 ? 1 : 5,
        lux: (a, l) => a <= 20 ? 2 : Math.ceil(a / 4),
        pressure: (a, l) => 1,
        fixed: (a, l) => 1
    }
};

let currentExportRooms = [];
let currentGrandTotal = 0;

function calculateAll() {
    const standard = document.getElementById('standardSelect').value;
    const rule = calcRules[standard];
    const allPrices = getSystemPrices();
    const discount = parseFloat(document.getElementById('discountFactor').value) || 1.0;

    const paramsMap = [
        { key: 'particle', ruleKey: 'particle' }, { key: 'pressure', ruleKey: 'pressure' },
        { key: 'air', ruleKey: 'air' }, { key: 'temphum', ruleKey: 'temphum' },
        { key: 'noise', ruleKey: 'noise' }, { key: 'lux', ruleKey: 'lux' },
        { key: 'planktonic', ruleKey: 'microbio' }, { key: 'settling', ruleKey: 'microbio' },
        { key: 'vibration', ruleKey: 'fixed' }, { key: 'recovery', ruleKey: 'fixed' },
        { key: 'airflow', ruleKey: 'fixed' }, { key: 'leakage', ruleKey: 'fixed' },
        { key: 'uv', ruleKey: 'fixed' }, { key: 'surface', ruleKey: 'fixed' }
    ];

    let ptsByLevel = {};
    combinedLevels.forEach(lvl => {
        let emptyObj = {};
        paramsMap.forEach(p => emptyObj[p.key] = 0);
        ptsByLevel[lvl] = emptyObj;
    });

    let roomsTemp = [];

    const rows = document.querySelectorAll('.room-group');
    rows.forEach(tr => {
        const roomName = tr.querySelector('.room-name').value;
        const roomLevel = tr.querySelector('.room-level').value;
        const area = parseFloat(tr.querySelector('.room-area').value) || 0;

        let roomPts = {};
        let roomChecks = {};

        if (area > 0) {
            paramsMap.forEach(p => {
                const chk = tr.querySelector(`.chk-${p.key}`);
                const input = tr.querySelector(`.in-${p.key}`);

                const isHidden = chk.closest('.item-box').classList.contains('hidden-col');
                const isChecked = !isHidden && chk.checked;

                roomChecks[p.key] = isChecked;

                if (input.dataset.locked !== "true") {
                    // 核心升级：计算规则同时传入了面积和级别
                    input.value = rule[p.ruleKey](area, roomLevel);
                }

                let pts = isChecked ? (parseInt(input.value) || 0) : 0;
                roomPts[p.key] = pts;

                if (ptsByLevel[roomLevel]) {
                    ptsByLevel[roomLevel][p.key] += pts;
                }
            });
        }
        roomsTemp.push({ tr, roomName, roomLevel, area, roomPts, roomChecks });
    });

    currentGrandTotal = 0;
    currentExportRooms = [];

    roomsTemp.forEach(rt => {
        const config = allPrices[rt.roomLevel] || allPrices[combinedLevels[0]];
        const lvlPool = ptsByLevel[rt.roomLevel] || ptsByLevel[combinedLevels[0]];
        let roomTotal = 0;

        if (rt.area > 0) {
            paramsMap.forEach(p => {
                let actualPrice = lvlPool[p.key] <= config[p.key].threshold ? config[p.key].pBelow : config[p.key].pAbove;
                roomTotal += rt.roomPts[p.key] * actualPrice;
            });
            roomTotal = roomTotal * discount;
        }

        currentGrandTotal += roomTotal;
        rt.tr.querySelector('.room-total-text').innerText = '¥ ' + roomTotal.toFixed(2);

        if (rt.area > 0) {
            let items = [];
            let summaryHtml = '';
            paramsMap.forEach(p => {
                if (rt.roomChecks[p.key]) {
                    const itemName = testItems.find(t => t.key === p.key).name;
                    const itemPts = rt.roomPts[p.key];
                    items.push({
                        name: itemName,
                        pts: itemPts
                    });
                    summaryHtml += `<span class="summary-pill">${itemName}: <b>${itemPts}</b>点</span>`;
                }
            });

            if (summaryHtml === '') {
                summaryHtml = '<span class="summary-pill empty-pill">(未选任何项目)</span>';
            }
            const summaryDiv = rt.tr.querySelector('.collapsed-summary');
            if (summaryDiv) summaryDiv.innerHTML = summaryHtml;

            if (items.length > 0) {
                currentExportRooms.push({
                    roomName: rt.roomName,
                    roomLevel: rt.roomLevel,
                    area: rt.area,
                    roomTotal: roomTotal,
                    items: items
                });
            }
        }
    });

    animateGrandTotal(currentGrandTotal);
    saveDraft(); // 每次计算完毕后触发一次草稿箱保存
}

// === 数字滚动动画逻辑 ===
let lastGrandTotal = 0;
let grandTotalAnimId = null;

function animateGrandTotal(endVal) {
    const obj = document.getElementById('grandTotal');
    const startVal = lastGrandTotal;
    const duration = 400; // 400ms动画时长
    let startTimestamp = null;

    cancelAnimationFrame(grandTotalAnimId);

    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentVal = startVal + progress * (endVal - startVal);
        obj.innerText = '¥ ' + currentVal.toFixed(2);

        if (progress < 1) {
            grandTotalAnimId = requestAnimationFrame(step);
        } else {
            lastGrandTotal = endVal;
            obj.innerText = '¥ ' + endVal.toFixed(2);
        }
    };
    grandTotalAnimId = requestAnimationFrame(step);
}

function exportToExcel() {
    const industry = document.getElementById('industrySelect').value;
    const selectedTestBasis = getCheckedBasis('testBasisBox');
    const selectedEvalBasis = getCheckedBasis('evalBasisBox');

    let excelData = [
        ["行业", "仪器名称", "洁净度等级", "面积(m²)", "检测参数", "检测点/次", "检测依据", "评价依据", "房间总计"]
    ];
    let merges = [];

    let globalStartRow = 1;
    let currentRow = 1;

    currentExportRooms.forEach(room => {
        let roomStartRow = currentRow;
        let roomParamCount = room.items.length;

        room.items.forEach((item) => {
            let isFirst = (roomStartRow === currentRow);
            excelData.push([
                isFirst ? industry : "",
                isFirst ? room.roomName : "",
                isFirst ? room.roomLevel : "",
                isFirst ? room.area : "",
                item.name,
                item.pts,
                isFirst ? selectedTestBasis : "",
                isFirst ? selectedEvalBasis : "",
                isFirst ? `¥ ${room.roomTotal.toFixed(2)}` : ""
            ]);
            currentRow++;
        });

        if (roomParamCount > 1) {
            const re = roomStartRow + roomParamCount - 1;
            merges.push({ s: { r: roomStartRow, c: 1 }, e: { r: re, c: 1 } });
            merges.push({ s: { r: roomStartRow, c: 2 }, e: { r: re, c: 2 } });
            merges.push({ s: { r: roomStartRow, c: 3 }, e: { r: re, c: 3 } });
            merges.push({ s: { r: roomStartRow, c: 6 }, e: { r: re, c: 6 } });
            merges.push({ s: { r: roomStartRow, c: 7 }, e: { r: re, c: 7 } });
            merges.push({ s: { r: roomStartRow, c: 8 }, e: { r: re, c: 8 } });
        }
    });

    let globalEndRow = currentRow - 1;

    if (globalEndRow >= globalStartRow) {
        if (globalEndRow > globalStartRow) {
            merges.push({ s: { r: globalStartRow, c: 0 }, e: { r: globalEndRow, c: 0 } });
        }
    } else {
        alert("没有可导出的数据，请检查是否添加了房间、输入了有效面积并勾选了检测项目！");
        return;
    }

    const ws = XLSX.utils.aoa_to_sheet(excelData);
    ws['!merges'] = merges;

    ws['!cols'] = [
        { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 22 },
        { wch: 10 }, { wch: 45 }, { wch: 45 }, { wch: 15 }
    ];

    ws['!rows'] = [{ hpx: 50 }];

    for (let col = 0; col < 9; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (ws[cellRef]) {
            ws[cellRef].s = {
                fill: { fgColor: { rgb: "3498DB" } },
                font: { color: { rgb: "FFFFFF" }, bold: true, sz: 12 },
                alignment: { vertical: "center", horizontal: "center" }
            };
        }
    }

    for (let r = 1; r <= globalEndRow; r++) {
        for (let c = 0; c < 9; c++) {
            const cellRef = XLSX.utils.encode_cell({ r: r, c: c });
            if (ws[cellRef]) {
                ws[cellRef].s = {
                    alignment: { vertical: "center", horizontal: "center", wrapText: true }
                };
            }
        }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "报价单明细");
    XLSX.writeFile(wb, `洁净室检测明细单_${industry}.xlsx`);
}

// --- 一键清空（带撤销栈保护） ---
function clearAllData() {
    // 清空前压入撤销栈
    pushUndoState();

    document.getElementById('industrySelect').selectedIndex = 0;
    document.getElementById('standardSelect').selectedIndex = 0;
    document.getElementById('discountFactor').value = "1.0";

    const checkboxes = document.querySelectorAll('.basis-container input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    const customInputs = document.querySelectorAll('.basis-custom-txt');
    customInputs.forEach(input => input.value = '');

    document.getElementById('roomBody').innerHTML = '';
    roomCount = 0;

    addRoom();
    handleStandardChange();
}

// === 草稿箱核心逻辑与 Toast 提醒 ===

function saveDraft() {
    const dataToSave = {
        industry: document.getElementById('industrySelect').value,
        standard: document.getElementById('standardSelect').value,
        discount: document.getElementById('discountFactor').value,
        rooms: []
    };

    document.querySelectorAll('.room-group').forEach(tr => {
        const roomName = tr.querySelector('.room-name').value;
        const roomLevel = tr.querySelector('.room-level').value;
        const area = tr.querySelector('.room-area').value;

        let checks = {};
        let manuals = {};
        tr.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            const cls = Array.from(cb.classList).find(c => c.startsWith('chk-'));
            if (cls) checks[cls.replace('chk-', '')] = cb.checked;
        });
        tr.querySelectorAll('.pt-input').forEach(input => {
            if (input.dataset.locked === "true") {
                const cls = Array.from(input.classList).find(c => c.startsWith('in-'));
                if (cls) manuals[cls.replace('in-', '')] = input.value;
            }
        });
        dataToSave.rooms.push({ roomName, roomLevel, area, checks, manuals });
    });

    localStorage.setItem('cleanroom_draft_v1', JSON.stringify(dataToSave));
}

function restoreDraft() {
    const saved = localStorage.getItem('cleanroom_draft_v1');
    if (saved) {
        try {
            const data = JSON.parse(saved);

            document.getElementById('industrySelect').value = data.industry || '食品';
            document.getElementById('standardSelect').value = data.standard || 'ISO';
            document.getElementById('discountFactor').value = data.discount || 1.0;

            if (data.rooms && data.rooms.length > 0) {
                document.getElementById('roomBody').innerHTML = '';
                roomCount = 0;

                data.rooms.forEach(r => {
                    addRoom(r.roomName, r.roomLevel, r.area);
                    const tr = document.getElementById(`room_row_${roomCount}`);

                    if (r.checks) {
                        for (let k in r.checks) {
                            const cb = tr.querySelector(`.chk-${k}`);
                            if (cb) cb.checked = r.checks[k];
                        }
                    }
                    if (r.manuals) {
                        for (let k in r.manuals) {
                            const input = tr.querySelector(`.in-${k}`);
                            if (input) {
                                input.value = r.manuals[k];
                                handleManualEdit(input);
                            }
                        }
                    }
                });
                return true;
            }
        } catch (e) {
            console.error("恢复草稿失败", e);
        }
    }
    return false;
}

// ================================================================
// 撤销/重做历史栈系统
// ================================================================
const UNDO_MAX = 30;
let undoStack = [];
let redoStack = [];

// 捕获当前完整页面状态快照
function captureSnapshot() {
    const snapshot = {
        industry: document.getElementById('industrySelect').value,
        standard: document.getElementById('standardSelect').value,
        discount: document.getElementById('discountFactor').value,
        rooms: []
    };
    document.querySelectorAll('.room-group').forEach(tr => {
        const roomName = tr.querySelector('.room-name').value;
        const roomLevel = tr.querySelector('.room-level').value;
        const area = tr.querySelector('.room-area').value;
        let checks = {};
        let manuals = {};
        tr.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            const cls = Array.from(cb.classList).find(c => c.startsWith('chk-'));
            if (cls) checks[cls.replace('chk-', '')] = cb.checked;
        });
        tr.querySelectorAll('.pt-input').forEach(input => {
            if (input.dataset.locked === "true") {
                const cls = Array.from(input.classList).find(c => c.startsWith('in-'));
                if (cls) manuals[cls.replace('in-', '')] = input.value;
            }
        });
        snapshot.rooms.push({ roomName, roomLevel, area, checks, manuals });
    });
    return JSON.stringify(snapshot);
}

// 从快照恢复页面状态（不触发 pushUndoState）
function restoreSnapshot(snapshotStr) {
    try {
        const data = JSON.parse(snapshotStr);
        document.getElementById('industrySelect').value = data.industry || '食品';
        document.getElementById('standardSelect').value = data.standard || 'ISO';
        document.getElementById('discountFactor').value = data.discount || 1.0;

        document.getElementById('roomBody').innerHTML = '';
        roomCount = 0;

        if (data.rooms && data.rooms.length > 0) {
            data.rooms.forEach(r => {
                addRoom(r.roomName, r.roomLevel, r.area);
                const tr = document.getElementById(`room_row_${roomCount}`);
                if (r.checks) {
                    for (let k in r.checks) {
                        const cb = tr.querySelector(`.chk-${k}`);
                        if (cb) cb.checked = r.checks[k];
                    }
                }
                if (r.manuals) {
                    for (let k in r.manuals) {
                        const input = tr.querySelector(`.in-${k}`);
                        if (input) {
                            input.value = r.manuals[k];
                            handleManualEdit(input);
                        }
                    }
                }
            });
        } else {
            addRoom();
        }
        calculateAll();
    } catch (e) {
        console.error('撤销/重做恢复失败', e);
    }
}

// 在破坏性操作前调用：保存当前状态到撤销栈
function pushUndoState() {
    undoStack.push(captureSnapshot());
    if (undoStack.length > UNDO_MAX) undoStack.shift();
    redoStack = []; // 新操作清空重做栈
    updateUndoRedoButtons();
}

function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(captureSnapshot());
    const prev = undoStack.pop();
    restoreSnapshot(prev);
    updateUndoRedoButtons();
}

function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(captureSnapshot());
    const next = redoStack.pop();
    restoreSnapshot(next);
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

// 键盘快捷键支持 Ctrl+Z / Ctrl+Y
document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
    }
});