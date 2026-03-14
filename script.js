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
    "中华人民共和国药典（2020年版）", "ISO 14644-1", "ISO 14644-3",
    "GB 50687 食品工业洁净用房建筑技术规范",
    "GB 15979 一次性使用卫生用品卫生要求",
    "GB 29923 特殊医学用途配方食品企业良好生产规范",
    "DB32/T 972 实验动物笼器具独立通气笼盒（IVC）系统",
    "DB32/T 2730 实验动物笼器具集中排风通气笼盒系统",
    "中华人民共和国药典（2025年版）"
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
    const isGB50333 = (std === 'GB50333');
    const isGB50591 = (std === 'GB50591');

    // 检测是否真的发生了标准切换
    const isStandardChanged = (window._currentStd !== std);
    window._currentStd = std;

    // 需求3：控制 GB50591 查表模式开关的显示/隐藏
    const tableLabel = document.getElementById('gb50591TableLabel');
    if (tableLabel) {
        tableLabel.style.display = isGB50591 ? 'inline-flex' : 'none';
        // 切换到其他标准时自动取消勾选
        if (!isGB50591) {
            const tableMode = document.getElementById('gb50591TableMode');
            if (tableMode) tableMode.checked = false;
        }
    }

    const microbioCells = document.querySelectorAll('.cell-microbio');

    microbioCells.forEach(cell => {
        const cb = cell.querySelector('input[type="checkbox"]');
        if (isPureGB) {
            cell.classList.add('hidden-col');
            // 仅在真实切换标准时强制重置，避免因为新增房间调用此方法毁掉用户的自定义勾选
            if (isStandardChanged && cb) cb.checked = false;
        } else {
            cell.classList.remove('hidden-col');
            // 同上，仅在真实切换标准时为了安全起见默认勾选浮游沉降菌
            if (isStandardChanged && cb && (cb.classList.contains('chk-planktonic') || cb.classList.contains('chk-settling'))) {
                cb.checked = true;
            }
        }
    });

    // 各标准的允许级别
    let allowedLevels;
    if (isGB16292Old) {
        allowedLevels = ["100级", "10000级", "100000级", "300000级"];
    } else if (isGB50333) {
        // 需求8：医院手术部使用 I~IV 级
        allowedLevels = ["I级", "II级", "III级", "IV级"];
    } else {
        allowedLevels = combinedLevels;
    }

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
    let allowedLevels;
    if (currentStd === 'GB16292_OLD') {
        allowedLevels = ["100级", "10000级", "100000级", "300000级"];
    } else if (currentStd === 'GB50333') {
        allowedLevels = ["I级", "II级", "III级", "IV级"];
    } else {
        allowedLevels = combinedLevels;
    }

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
            <div class="collapsed-summary">
                <!-- 动态 summary-pill 内容由 calculateAll 注入，但我们需要把编辑按钮固化在这里 -->
            </div>
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

// (已移除展开/折叠功能，转为弹窗编辑)

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
        pressure: (a, l) => 1,
        air: (a, l) => calcRules["GB16292_OLD"].air(a, l), // 需求5：换气复用旧版16292
        microbio: (a, l) => 0, fixed: (a, l) => 1
    },
    "GB50591": {
        particle: (a, l) => {
            // 需求3：双轨制 — 查表模式 vs 开根号模式
            const tableMode = document.getElementById('gb50591TableMode');
            if (!tableMode || !tableMode.checked) {
                return Math.ceil(Math.sqrt(a));
            }
            // 查表模式：表 E.4.2-1 测点数选用表
            let col = 3; // 默认 8~9级
            if (l.includes("5") || l.includes("100级")) col = 0;
            else if (l.includes("6") || l.includes("1000级")) col = 1;
            else if (l.includes("7") || l.includes("10000级")) col = 2;

            if (a < 10) return [3, 2, 2, 2][col];
            if (a < 20) return [4, 3, 2, 2][col];
            if (a < 40) return [8, 6, 2, 2][col];
            if (a < 100) return [16, 13, 4, 2][col];
            if (a < 200) return [40, 32, 10, 3][col];
            if (a < 400) return [80, 63, 20, 6][col];
            if (a < 1000) return [160, 126, 40, 13][col];
            if (a < 2000) return [400, 316, 100, 32][col];
            return [800, 623, 200, 63][col];
        },
        temphum: (a, l) => 1, // 需求4：温湿度固定1
        noise: (a, l) => a >= 15 ? 5 : 1, // 需求4：噪声≥15为5
        lux: (a, l) => a <= 20 ? 2 : Math.ceil(a / 4),
        pressure: (a, l) => 1,
        air: (a, l) => calcRules["GB16292_OLD"].air(a, l), // 需求4：换气复用旧版
        microbio: (a, l) => {
            // 需求3：微生物与悬浮粒子同逻辑
            return calcRules["GB50591"].particle(a, l);
        },
        fixed: (a, l) => 1
    },
    "ISO": {
        particle: (a, l) => {
            const t = [{ max: 2, pts: 1 }, { max: 4, pts: 2 }, { max: 6, pts: 3 }, { max: 8, pts: 4 }, { max: 10, pts: 5 }, { max: 24, pts: 6 }, { max: 28, pts: 7 }, { max: 32, pts: 8 }, { max: 36, pts: 9 }, { max: 52, pts: 10 }, { max: 56, pts: 11 }, { max: 64, pts: 12 }, { max: 68, pts: 13 }, { max: 72, pts: 14 }, { max: 76, pts: 15 }, { max: 104, pts: 16 }, { max: 108, pts: 17 }, { max: 116, pts: 18 }, { max: 148, pts: 19 }, { max: 156, pts: 20 }, { max: 192, pts: 21 }, { max: 232, pts: 22 }, { max: 276, pts: 23 }, { max: 352, pts: 24 }, { max: 436, pts: 25 }, { max: 636, pts: 26 }, { max: 1000, pts: 27 }];
            if (a <= 1000) { for (let i = 0; i < t.length; i++) if (a <= t[i].max) return t[i].pts; }
            return Math.ceil(27 * (a / 1000));
        },
        temphum: (a, l) => 1, // 需求6：温湿度固定1
        noise: (a, l) => a >= 15 ? 5 : 1, // 需求6：噪声同旧版
        lux: (a, l) => a <= 20 ? 2 : Math.ceil(a / 4), // 需求6：照度同旧版
        pressure: (a, l) => 1,
        air: (a, l) => calcRules["GB16292_OLD"].air(a, l), // 需求6：换气复用旧版
        fixed: (a, l) => 1,
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
        temphum: (a, l) => 1, // 需求1：温湿度固定1
        noise: (a, l) => a >= 15 ? 5 : 1, // 需求2：噪声≥15为5
        lux: (a, l) => a <= 20 ? 2 : Math.ceil(a / 4),
        pressure: (a, l) => 1,
        fixed: (a, l) => 1
    },
    // 需求8：GB50333 医院洁净手术部（基于国标第13.3.11条）
    "GB50333": {
        particle: (a, l) => {
            if (l.includes("I级") || l.includes("Ⅰ级")) return 13;
            if (l.includes("II级") || l.includes("Ⅱ级")) return 9;
            if (l.includes("III级") || l.includes("Ⅲ级")) return 7;
            return Math.ceil(Math.sqrt(a)); // IV级及其他降级处理
        },
        microbio: (a, l) => calcRules["GB50333"].particle(a, l),
        air: (a, l) => calcRules["GB16292_OLD"].air(a, l),
        temphum: (a, l) => 1,
        noise: (a, l) => a >= 15 ? 5 : 1,
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
            let summaryParts = [];
            paramsMap.forEach(p => {
                if (rt.roomChecks[p.key]) {
                    const itemName = testItems.find(t => t.key === p.key).name;
                    const itemPts = rt.roomPts[p.key];
                    items.push({
                        name: itemName,
                        pts: itemPts
                    });
                    summaryParts.push(`<span class="config-tag" onclick="openEditDetailsModal('${rt.tr.id}','${p.key}')">${itemName} <span class="tag-val">${itemPts}</span></span>`);
                }
            });

            if (summaryParts.length === 0) {
                summaryHtml = '<span class="config-tag-empty">未选任何项目</span>';
            } else {
                summaryHtml = summaryParts.join('<span class="config-tag-sep">·</span>');
            }

            summaryHtml += `<button class="edit-config-btn" onclick="openEditDetailsModal('${rt.tr.id}')" title="编辑检测项目与点数"><i class="ph ph-pencil-simple"></i> 编辑</button>`;

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
    if (confirm("确定要清空所有房间和数据吗？")) {
        pushUndoState();
        document.getElementById('roomBody').innerHTML = '';
        roomCount = 0;
        calculateAll();
        // 如果想要彻底清空并在空的时候显示提示，可以在 calculateAll 里处理
        // 或者保留一行空白的体验更好：
        // addRoom(); 
        // 但既然你希望完全清空，这里我就移除原有保留一行的代码
    }
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

// ================================================================
// 编辑详情弹窗逻辑（复选框 + 数值输入）
// ================================================================
let currentEditingRowId = null;

function openEditDetailsModal(rowId, focusKey) {
    currentEditingRowId = rowId;
    const tr = document.getElementById(rowId);
    if (!tr) return;

    const modal = document.getElementById('editDetailsModal');
    const body = document.getElementById('editDetailsBody');
    body.innerHTML = '';

    const area = parseFloat(tr.querySelector('.room-area').value) || 0;
    const roomLevel = tr.querySelector('.room-level').value;
    const standard = document.getElementById('standardSelect').value;
    const rule = calcRules[standard];
    const pMap = [
        { key: 'particle', ruleKey: 'particle' }, { key: 'pressure', ruleKey: 'pressure' },
        { key: 'air', ruleKey: 'air' }, { key: 'temphum', ruleKey: 'temphum' },
        { key: 'noise', ruleKey: 'noise' }, { key: 'lux', ruleKey: 'lux' },
        { key: 'planktonic', ruleKey: 'microbio' }, { key: 'settling', ruleKey: 'microbio' },
        { key: 'vibration', ruleKey: 'fixed' }, { key: 'recovery', ruleKey: 'fixed' },
        { key: 'airflow', ruleKey: 'fixed' }, { key: 'leakage', ruleKey: 'fixed' },
        { key: 'uv', ruleKey: 'fixed' }, { key: 'surface', ruleKey: 'fixed' }
    ];

    function renderItemRow(item) {
        const chk = tr.querySelector(`.chk-${item.key}`);
        const input = tr.querySelector(`.in-${item.key}`);
        let isMicro = item.isMicro ? 'cell-microbio' : '';
        let isHidden = chk.closest('.item-box').classList.contains('hidden-col') ? 'hidden-col' : '';
        let checked = chk.checked ? 'checked' : '';
        let val = input.value;

        let pInfo = pMap.find(p => p.key === item.key);
        let defaultValHtml = '';
        if (pInfo && input.dataset.locked === "true" && area > 0) {
            let defaultPts = rule[pInfo.ruleKey](area, roomLevel);
            defaultValHtml = `<span style="font-size: 11px; color: var(--warning); margin-left: auto;">(默认: ${defaultPts})</span>`;
        }

        return `
            <div class="modal-item-row ${isMicro} ${isHidden}" style="display: flex; align-items: center; padding: 6px 0; gap: 8px;">
                <label class="item-label" style="flex: 1; margin: 0; display: flex; align-items: center; gap: 6px; font-size: 13px;">
                    <input type="checkbox" id="modal_chk_${item.key}" ${checked} onchange="toggleModalInput('${item.key}')">
                    ${item.name}
                </label>
                ${defaultValHtml}
                <input type="number" id="modal_in_${item.key}" value="${val}" 
                    style="width: 50px; padding: 3px 6px; border: 1px solid var(--border-color); border-radius: 0; text-align: center; font-size: 13px; font-weight: 600; outline: none; transition: border-color 0.2s; ${checked ? '' : 'opacity: 0.3; pointer-events: none;'}"
                    onfocus="this.style.borderColor='var(--primary)'"
                    onblur="this.style.borderColor='var(--border-color)'">
                <span style="font-size: 12px; color: var(--text-faint); min-width: 14px;">点</span>
            </div>
        `;
    }

    let regularHtml = '';
    regularItems.forEach(item => { regularHtml += renderItemRow(item); });

    let specialHtml = '';
    specialItems.forEach(item => { specialHtml += renderItemRow(item); });

    body.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px;">
            <div>
                <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: var(--text-faint); padding: 6px 0; border-bottom: 1px solid var(--border-color);">常规项目</h4>
                ${regularHtml}
            </div>
            <div>
                <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: var(--text-faint); padding: 6px 0; border-bottom: 1px solid var(--border-color);">特殊项目</h4>
                ${specialHtml}
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    // 如果通过胶囊点击进来，自动聚焦到对应的输入框
    if (focusKey) {
        setTimeout(() => {
            const targetInput = document.getElementById(`modal_in_${focusKey}`);
            if (targetInput) {
                targetInput.focus();
                targetInput.select();
            }
        }, 100);
    }
}

function toggleModalInput(key) {
    const chk = document.getElementById(`modal_chk_${key}`);
    const input = document.getElementById(`modal_in_${key}`);
    if (chk && input) {
        if (chk.checked) {
            input.style.opacity = '1';
            input.style.pointerEvents = 'auto';
        } else {
            input.style.opacity = '0.3';
            input.style.pointerEvents = 'none';
        }
    }
}

function handleModalManualEdit(inputElement) {
    if (inputElement.value === '') {
        inputElement.dataset.locked = "false";
        inputElement.classList.remove('manual-point');
        inputElement.classList.add('auto-point');
    } else {
        inputElement.dataset.locked = "true";
        inputElement.classList.remove('auto-point');
        inputElement.classList.add('manual-point');
    }
}

function closeEditDetailsModal() {
    document.getElementById('editDetailsModal').style.display = 'none';
    currentEditingRowId = null;
}

function saveEditDetails() {
    if (!currentEditingRowId) return;
    const tr = document.getElementById(currentEditingRowId);
    if (!tr) return;

    pushUndoState();

    // 同步 checkbox 和数值
    testItems.forEach(item => {
        const modalChk = document.getElementById(`modal_chk_${item.key}`);
        const modalIn = document.getElementById(`modal_in_${item.key}`);
        const rowChk = tr.querySelector(`.chk-${item.key}`);
        const rowIn = tr.querySelector(`.in-${item.key}`);

        if (modalChk && rowChk) {
            rowChk.checked = modalChk.checked;
        }
        if (modalIn && rowIn) {
            rowIn.value = modalIn.value;
            if (modalIn.value !== '') {
                rowIn.dataset.locked = "true";
                rowIn.classList.remove('auto-point');
                rowIn.classList.add('manual-point');
            }
        }
    });

    closeEditDetailsModal();
    calculateAll();
}

// ================================================================
// 批量生成弹窗逻辑
// ================================================================
function openBatchAddModal() {
    const modal = document.getElementById('batchAddModal');

    // 渲染下拉等级
    const levelSelect = document.getElementById('batchRoomLevel');
    levelSelect.innerHTML = '';

    const currentStd = document.getElementById('standardSelect') ? document.getElementById('standardSelect').value : 'ISO';
    let allowedLevels;
    if (currentStd === 'GB16292_OLD') {
        allowedLevels = ["100级", "10000级", "100000级", "300000级"];
    } else if (currentStd === 'GB50333') {
        allowedLevels = ["I级", "II级", "III级", "IV级"];
    } else {
        allowedLevels = combinedLevels;
    }

    allowedLevels.forEach(lvl => {
        const opt = document.createElement('option');
        opt.value = lvl;
        opt.text = lvl;
        levelSelect.appendChild(opt);
    });

    // 渲染预设包含项目复选框
    const grid = document.getElementById('batchItemPresetGrid');
    let gridHtml = '';

    // 根据当前标准动态决定默认勾选项
    const std = document.getElementById('standardSelect').value;
    const isPureGB = (std === 'GB');

    // 默认勾选 6 个常规项目（与 addRoom 行为一致）
    let defaultChecked = ['particle', 'pressure', 'air', 'temphum', 'noise', 'lux'];
    if (!isPureGB) {
        // 非 GB 标准额外增加浮游菌和沉降菌
        defaultChecked.push('planktonic');
        defaultChecked.push('settling');
    }

    testItems.forEach(item => {
        let isMicro = item.isMicro ? 'cell-microbio' : '';
        // 简单处理隐藏列逻辑，这里偷懒用现成的标准判断
        let isHidden = (currentStd === 'GB' && item.isMicro) ? 'hidden-col' : '';
        let checked = defaultChecked.includes(item.key) ? 'checked' : '';

        gridHtml += `
            <div class="item-box ${isMicro} ${isHidden}" style="padding: 10px; flex-direction: row; justify-content: space-between; align-items: center;">
                <label class="item-label">
                    <input type="checkbox" id="batch_chk_${item.key}" ${checked}>
                    ${item.name}
                </label>
                <input type="number" id="batch_in_${item.key}" class="batch-pt-input" title="可缺省，空白走国标自动算">
            </div>
        `;
    });
    grid.innerHTML = gridHtml;

    // 初始化数值
    document.getElementById('batchRoomPrefix').value = "房间";
    document.getElementById('batchRoomCount').value = "5";
    document.getElementById('batchRoomArea').value = "50";

    modal.style.display = 'flex';
}

function closeBatchAddModal() {
    document.getElementById('batchAddModal').style.display = 'none';
}

function executeBatchAdd() {
    const prefix = document.getElementById('batchRoomPrefix').value.trim() || "房间";
    const count = parseInt(document.getElementById('batchRoomCount').value) || 5;
    const initialLevel = document.getElementById('batchRoomLevel').value;
    const initialArea = parseFloat(document.getElementById('batchRoomArea').value) || 50;

    if (count <= 0 || count > 100) {
        alert("请输入有效的生成数量 (1 - 100 之间)");
        return;
    }

    // 读取期望勾选的预设项目和自定义设定点数
    let presetChecks = {};
    let presetPts = {};

    testItems.forEach(item => {
        const chk = document.getElementById(`batch_chk_${item.key}`);
        const pin = document.getElementById(`batch_in_${item.key}`);
        if (chk) {
            presetChecks[item.key] = chk.checked;
        }
        if (pin && pin.value !== "") {
            presetPts[item.key] = pin.value;
        }
    });

    pushUndoState();

    // 找到已有的最大编号
    let maxNum = 0;
    const existingNames = document.querySelectorAll('.room-name');
    const regex = new RegExp(`^${prefix}(\\d+)$`);
    existingNames.forEach(input => {
        const match = input.value.trim().match(regex);
        if (match) {
            maxNum = Math.max(maxNum, parseInt(match[1], 10));
        }
    });

    // 批量生成
    const newRows = [];
    for (let i = 1; i <= count; i++) {
        let roomName = `${prefix}${maxNum + i}`;
        addRoom(roomName, initialLevel, initialArea);

        const allRooms = document.querySelectorAll('.room-group');
        newRows.push(allRooms[allRooms.length - 1]);
    }

    // 所有行都生成完毕后，再统一应用预设配置
    newRows.forEach(newRow => {
        if (newRow) {
            testItems.forEach(item => {
                const rowChk = newRow.querySelector(`.chk-${item.key}`);
                const rowIn = newRow.querySelector(`.in-${item.key}`);

                if (rowChk) {
                    rowChk.checked = presetChecks[item.key] || false;
                }
                if (rowIn && presetPts[item.key] !== undefined && rowChk.checked) {
                    rowIn.value = presetPts[item.key];
                    handleModalManualEdit(rowIn);
                }
            });
        }
    });

    closeBatchAddModal();
    calculateAll();
}