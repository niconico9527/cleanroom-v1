// === 核心数据词典 ===
const regularItems = [
    { key: 'particle', name: '悬浮粒子' }, { key: 'pressure', name: '静压差' },
    { key: 'air', name: '换气次数/风速' }, { key: 'temphum', name: '温湿度' },
    { key: 'noise', name: '噪声' }, { key: 'lux', name: '照度' },
    { key: 'planktonic', name: '浮游菌' }, { key: 'settling', name: '沉降菌' }
];
const specialItems = [
    { key: 'vibration', name: '振动' }, { key: 'recovery', name: '自净时间' },
    { key: 'airflow', name: '气流流型' }, { key: 'leakage', name: '高效检漏' },
    { key: 'uv', name: '紫外灯辐射强度' }, { key: 'surface', name: '表面微生物' }
];
const testItems = [...regularItems, ...specialItems];

const combinedLevels = [
    "5级", "6级", "7级", "8级", "9级",
    "100级", "1000级", "10000级", "100000级", "300000级",
    "I级", "II级", "III级", "IV级",
    "A级", "B级", "C级", "D级"
];

const levelGroups = [
    { name: "🔢 国际 ISO 标准", keys: ["5级", "6级", "7级", "8级", "9级"] },
    { name: "🏭 国标常规/旧版", keys: ["100级", "1000级", "10000级", "100000级", "300000级"] },
    { name: "💊 GMP 医药及生安", keys: ["A级", "B级", "C级", "D级"] },
    { name: "🏥 医院手术室专用", keys: ["I级", "II级", "III级", "IV级"] }
];

window.onload = function () {
    const adminSelect = document.getElementById('adminClassLevel');
    adminSelect.innerHTML = "";
    combinedLevels.forEach(lvl => {
        const opt = document.createElement('option');
        opt.value = lvl; opt.text = lvl;
        adminSelect.appendChild(opt);
    });

    loadAdminPricesToUI();
    
    // 初始化显示当前数据版本状态
    updateConfigStatus();
};

// 更新配置状态显示
function updateConfigStatus() {
    const statusEl = document.getElementById('currentConfigStatus');
    if (!statusEl) return;
    
    const meta = localStorage.getItem('cleanroomPricesV10_Meta');
    if (meta) {
        try {
            const metaData = JSON.parse(meta);
            const time = new Date(metaData.timestamp).toLocaleString();
            statusEl.innerHTML = `<i class="ph-fill ph-check-circle"></i> 🟢 已连接云端，当前数据版本：${time}`;
            statusEl.style.color = "#10b981";
        } catch (e) {
            statusEl.innerHTML = `<i class="ph-fill ph-info"></i> 🟠 当前使用系统缓存单价`;
            statusEl.style.color = "#f59e0b";
        }
    } else {
        // 检查是否有本地价格数据
        const saved = localStorage.getItem('cleanroomPricesV10');
        if (saved) {
            statusEl.innerHTML = `<i class="ph-fill ph-hard-drive"></i> 🟠 当前使用本地缓存单价（未同步云端）`;
            statusEl.style.color = "#f59e0b";
        } else {
            statusEl.innerHTML = `<i class="ph-fill ph-warning-circle"></i> ⚠️ <b>尚未接入系统！请拉取云端数据或导入离线包</b>`;
            statusEl.style.color = "#dc2626";
        }
    }
}

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
    // 依然借用同样的 LocalStorage Key 方便测试和预览，真正拆分后也不冲突
    const saved = localStorage.getItem('cleanroomPricesV10');
    if (saved) {
        return { ...buildDefaultPrices(), ...JSON.parse(saved) };
    }
    return buildDefaultPrices();
}

function loadAdminPricesToUI() {
    const level = document.getElementById('adminClassLevel').value;
    const allPrices = getSystemPrices();
    const currentConfig = allPrices[level];
    const tbody = document.getElementById('adminPriceBody');
    tbody.innerHTML = '';

    testItems.forEach(item => {
        const config = currentConfig[item.key];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${item.name}</b></td>
            <td><input type="number" id="th_${item.key}" value="${config.threshold}" oninput="saveAdminPrices(true)"></td>
            <td><input type="number" id="pb_${item.key}" value="${config.pBelow}" oninput="saveAdminPrices(true)"></td>
            <td><input type="number" id="pa_${item.key}" value="${config.pAbove}" oninput="saveAdminPrices(true)"></td>
        `;
        tbody.appendChild(tr);
    });
}

function fillDownColumn(prefix) {
    const firstInput = document.getElementById(`${prefix}_${testItems[0].key}`);
    if (!firstInput) return;
    const fillValue = firstInput.value;
    testItems.forEach(item => {
        const input = document.getElementById(`${prefix}_${item.key}`);
        if (input) input.value = fillValue;
    });
    saveAdminPrices(true); // 批量填充后自动静默保存
}

function saveAdminPrices(silent = false) {
    const level = document.getElementById('adminClassLevel').value;
    let allPrices = getSystemPrices();
    testItems.forEach(item => {
        allPrices[level][item.key] = {
            threshold: parseInt(document.getElementById(`th_${item.key}`).value) || 0,
            pBelow: parseFloat(document.getElementById(`pb_${item.key}`).value) || 0,
            pAbove: parseFloat(document.getElementById(`pa_${item.key}`).value) || 0
        };
    });
    localStorage.setItem('cleanroomPricesV10', JSON.stringify(allPrices));
    if (!silent) alert(`【${level}】 的阶梯单价配置已暂存到管理员浏览器！`);
    return allPrices;
}

// === 高级分类复制弹窗逻辑 ===
function openCopyModal() {
    const currentLvl = document.getElementById('adminClassLevel').value;
    document.getElementById('copyModal').style.display = 'flex';
    document.getElementById('chkAllLevels').checked = false;

    const container = document.getElementById('levelGroupsContainer');
    container.innerHTML = '';

    levelGroups.forEach(grp => {
        let groupHtml = `<div class="lvl-group">
            <div class="lvl-group-title">
                <span>${grp.name}</span>
                <label style="font-weight:normal; font-size:12px; cursor:pointer; color:#3b82f6;"><input type="checkbox" onchange="toggleGroupModalLevels(this, '${grp.name}')"> 此组全选</label>
            </div>
            <div class="lvl-grid" data-group="${grp.name}">`;

        grp.keys.forEach(k => {
            let isCurrent = (k === currentLvl);
            let disabledStr = isCurrent ? 'disabled' : '';
            let textStr = isCurrent ? `<span style="color:#94a3b8; font-style:italic;">${k} (当前)</span>` : k;
            groupHtml += `<label class="lvl-label"><input type="checkbox" class="chk-modal-lvl" value="${k}" ${disabledStr}> ${textStr}</label>`;
        });
        groupHtml += `</div></div>`;
        container.innerHTML += groupHtml;
    });
}

function closeCopyModal() {
    document.getElementById('copyModal').style.display = 'none';
}

function toggleAllModalLevels(cb) {
    document.querySelectorAll('.chk-modal-lvl:not(:disabled)').forEach(input => input.checked = cb.checked);
    document.querySelectorAll('.lvl-group-title input[type="checkbox"]').forEach(input => input.checked = cb.checked);
}

function toggleGroupModalLevels(cb, groupName) {
    const grid = document.querySelector(`.lvl-grid[data-group="${groupName}"]`);
    if (grid) {
        grid.querySelectorAll('.chk-modal-lvl:not(:disabled)').forEach(input => input.checked = cb.checked);
    }
}

function executeCopy() {
    const checkedBoxes = document.querySelectorAll('.chk-modal-lvl:checked:not(:disabled)');
    if (checkedBoxes.length === 0) {
        alert("请至少选择一个目标级别！");
        return;
    }

    const currentLvl = document.getElementById('adminClassLevel').value;
    const targetLevels = Array.from(checkedBoxes).map(cb => cb.value);

    let allPrices = getSystemPrices();
    let sourceConfig = {};
    testItems.forEach(item => {
        sourceConfig[item.key] = {
            threshold: parseInt(document.getElementById(`th_${item.key}`).value) || 0,
            pBelow: parseFloat(document.getElementById(`pb_${item.key}`).value) || 0,
            pAbove: parseFloat(document.getElementById(`pa_${item.key}`).value) || 0
        };
    });

    // 保存当前级别
    allPrices[currentLvl] = JSON.parse(JSON.stringify(sourceConfig));

    // 复制给其他级别
    targetLevels.forEach(l => {
        allPrices[l] = JSON.parse(JSON.stringify(sourceConfig));
    });

    localStorage.setItem('cleanroomPricesV10', JSON.stringify(allPrices));
    closeCopyModal();
    alert(`当前规则已保存，并成功复制到 ${targetLevels.length} 个其它级别中！`);
}

// === 核心机制：混淆打包加密并导出 ===
function exportEncryptedConfig() {
    // 强制自动保存一次保证数据最新
    const allPrices = saveAdminPrices(true);

    // 增加数据混淆时间戳标记
    const payload = {
        sign: "CLEANROOM_CONFIG_X1",
        timestamp: new Date().getTime(),
        data: allPrices
    };

    // 简单粗暴的 Base64 编码进行文件混淆，防止被非技术人员肉眼看懂JSON
    const jsonString = JSON.stringify(payload);
    // encodeURIComponent 处理中文避免 btoa 报错
    const encodedData = btoa(encodeURIComponent(jsonString));

    // 生成当前日期文件名: 20260228
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const filename = `${dateStr}单价同步包.crm`; // .crm (cleanroom config) 伪装成专业后缀，防手贱点开

    const blob = new Blob([encodedData], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// === 管理员导入还原机制 ===
function importAdminEncryptedConfig(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const fileContent = e.target.result;
            const rawJsonString = decodeURIComponent(atob(fileContent));
            const parsedData = JSON.parse(rawJsonString);

            if (parsedData.sign !== "CLEANROOM_CONFIG_X1" || !parsedData.data) {
                alert("导入失败：非本平台派发的有效价格配置包。");
                return;
            }
// 直接覆写本地 Admin 全局配置
localStorage.setItem('cleanroomPricesV10', JSON.stringify(parsedData.data));

// 如果有时间戳，也保存到 Meta
if (parsedData.timestamp) {
    localStorage.setItem('cleanroomPricesV10_Meta', JSON.stringify({ timestamp: parsedData.timestamp }));
} else {
    // 清除云端同步标记，表示这是本地导入的数据
    localStorage.removeItem('cleanroomPricesV10_Meta');
}

// 刷新UI和状态
loadAdminPricesToUI();
updateConfigStatus();

const importTime = parsedData.timestamp ? new Date(parsedData.timestamp).toLocaleString() : '未知时间';
alert(`✅ 已成功解析并导入价格包！\n文件时间：${importTime}\n现在您可以基于它在此继续二次编辑。`);
            alert(`✅ 已成功解析并导入您选择的旧版价格包！现在您可以基于它在此继续二次编辑。`);

        } catch (error) {
            alert("读取失败，文件可能已损坏或被强制篡改。");
            console.error(error);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

// ==========================================
// ====== 核心：Gitee Serverless 云端同步引擎 ======
// ==========================================
const GITEE_CONFIG = {
    owner: "zhang_jia_shu",           // Gitee 用户名
    repo: "cleanroom-config",         // 仓库名
    path: "latest_price.json",        // 存储在云端的文件名
    token: "cf337a366df0f575cc3d5a822b45d06a" // 您的私人令牌
};

// 获取云端文件信息（为了拿到 sha，这是 Git 覆盖文件的必须参数）
async function getCloudFileInfo() {
    const url = `https://gitee.com/api/v5/repos/${GITEE_CONFIG.owner}/${GITEE_CONFIG.repo}/contents/${GITEE_CONFIG.path}?access_token=${GITEE_CONFIG.token}`;
    try {
        const response = await fetch(url);
        if (response.status === 404) return null; // 文件还不存在
        const data = await response.json();
        return data.sha;
    } catch (e) {
        console.error("获取云端文件失败:", e);
        return null;
    }
}

// 重新从云端反向全量同步配置
async function adminPullFromCloud() {
    const url = `https://gitee.com/api/v5/repos/${GITEE_CONFIG.owner}/${GITEE_CONFIG.repo}/contents/${GITEE_CONFIG.path}?t=${new Date().getTime()}`;
    try {
        showToast("正在查询云端配置...", "info");
        const response = await fetch(url);
        if (!response.ok) throw new Error(`云端响应异常: ${response.status}`);

        const resJson = await response.json();
        if (!resJson.content) throw new Error("API 响应体未携带内容报文");

        const rawContentBase64 = resJson.content;
        const cleanBase64 = rawContentBase64.replace(/[\r\n\s]/g, '');
        const ourObfuscatedString = decodeURIComponent(escape(atob(cleanBase64)));
        const jsonStr = decodeURIComponent(escape(atob(ourObfuscatedString)));
        const parsedData = JSON.parse(jsonStr);

        if (parsedData.sign === "CLEANROOM_CONFIG_X1" && parsedData.data) {
            localStorage.setItem('cleanroomPricesV10', JSON.stringify(parsedData.data));
            localStorage.setItem('cleanroomPricesV10_Meta', JSON.stringify({ timestamp: parsedData.timestamp }));
            loadAdminPricesToUI();
            updateConfigStatus(); // 更新状态显示
            showToast("成功从 Gitee 拉取最新云端配置覆盖本地！", "success");
        } else {
            throw new Error("云端数据签名校验失败或格式错误。");
        }
    } catch (e) {
        showToast("拉取失败：" + e.message, "danger");
        console.error(e);
        alert("从云端获取失败：请检查网络情况或仓库状态。");
    }
}

// 执行推送挂载
async function pushToCloud() {
    // 1. 整理与混淆当前最新配置
    saveAdminPrices(true); // 先强行保存一次确保是最新
    const allPrices = getSystemPrices();
    const exportData = {
        sign: "CLEANROOM_CONFIG_X1",
        timestamp: new Date().getTime(),
        version: "v1.1_cloud",
        data: allPrices
    };

    // 关键：Gitee API 要求内容必须是 Base64 格式
    const rawJson = JSON.stringify(exportData);
    // 解决中文 Base64 乱码问题的双重安全转换 (Btoa doesn't natively support utf-8)
    // 第一层：我们的业务混淆
    const step1Obfuscated = btoa(unescape(encodeURIComponent(rawJson)));

    // 第二层：发给 Gitee API Content 要求的纯 Base64 (这里虽然也是 Base64，但装在这个盒子里安全)
    const safeBase64Content = btoa(unescape(encodeURIComponent(step1Obfuscated)));

    // 2. 先尝试获取旧文件的 SHA 值（如果是更新必须带 SHA）
    showToast("努力连接 Gitee 云服务器中...", "info");
    document.getElementById('btnCloudPush').disabled = true;
    document.getElementById('btnCloudPush').innerHTML = "⏳ 正在同步全网...";

    const sha = await getCloudFileInfo();

    // 3. 构建推送到 Gitee 的请求体
    const url = `https://gitee.com/api/v5/repos/${GITEE_CONFIG.owner}/${GITEE_CONFIG.repo}/contents/${GITEE_CONFIG.path}`;
    const payload = {
        access_token: GITEE_CONFIG.token,
        content: safeBase64Content,
        message: `Admin Update: 自动推送最新单价配置 (${new Date().toLocaleString()})`
    };
    if (sha) payload.sha = sha;

    // 4. 发起强覆盖 PUT / POST 请求
    try {
        const method = sha ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast("数据上传成功");
        } else {
            const errData = await response.json();
            alert("❌ 同步云端失败，请检查网络或 Gitee 仓库配置：\n" + (errData.message || "未知异常"));
        }
    } catch (e) {
        alert("网络请求被拦截，可能是无外网环境或跨域阻断。请检查您的网络连接。");
    } finally {
        document.getElementById('btnCloudPush').disabled = false;
        document.getElementById('btnCloudPush').innerHTML = "🚀 一键发布到云端";
    }
}

// 简单的气泡提示工具（针对 Admin 端）
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
