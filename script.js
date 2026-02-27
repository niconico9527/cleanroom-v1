/**
 * 洁净室检测点数综合计算主函数
 * @param {string} standard - 执行标准 (例如: 'GB16292旧版', 'GB50591')
 * @param {number} area - 房间面积 (平方米)
 * @param {string|number} cleanLevel - 洁净度级别 (例如: 100, 10000, 100000, 300000)
 * @param {string} projectType - 检测项目名称 (例如: '悬浮粒子', '风量', '静压差' 等)
 * @returns {number} 最终的采样点数量
 */
function calculateCleanroomPoints(standard, area, cleanLevel, projectType) {
    // 数据预处理：确保传进来的面积是数字，级别是整数，防止代码报错
    const numArea = parseFloat(area) || 0;
    const numLevel = parseInt(cleanLevel, 10);

    // ==========================================
    // 新增：GB 16292 旧版 特殊逻辑拦截
    // ==========================================
    if (standard === 'GB16292旧版') {
        
        // 【逻辑1】悬浮粒子、浮游菌、沉降菌 —— 直接查表
        const microbialProjects = ['悬浮粒子', '洁净度', '浮游菌', '沉降菌'];
        if (microbialProjects.includes(projectType)) {
            return getGB16292TablePoints(numArea, numLevel);
        }

        // 【逻辑2】换气次数、风速、风量 —— 按面积分段计算并向上取整
        const windProjects = ['换气次数', '风速', '风量'];
        if (windProjects.includes(projectType)) {
            // 防止面积为0或负数导致计算异常，最小按1平米算
            const safeArea = numArea > 0 ? numArea : 1; 
            
            // Math.ceil() 的作用就是“有小数直接进位（向上取整）”
            if (safeArea < 100) {
                return Math.ceil(safeArea / 15);
            } else if (safeArea >= 100 && safeArea < 200) {
                return Math.ceil(safeArea / 17);
            } else if (safeArea >= 200 && safeArea < 400) {
                return Math.ceil(safeArea / 20);
            } else {
                return Math.ceil(safeArea / 22);
            }
        }
    }

    // ==========================================
    // 【逻辑3】其他项目或标准 —— 沿用原有 50591 逻辑
    // 如果不是旧版标准，或者测的是“静压差”、“温湿度”，就会走到这里
    // ==========================================
    return calculatePoints50591(numArea, numLevel, projectType); 
}

/**
 * 辅助函数：专门用于查询 GB16292 旧版的表 1 矩阵
 */
function getGB16292TablePoints(area, level) {
    if (area < 10) {
        if (level === 100) return 2; // 表中为2~3，自动报价默认取下限2
        return 2; 
    } else if (area >= 10 && area < 20) {
        if (level === 100) return 4;
        return 2;
    } else if (area >= 20 && area < 40) {
        if (level === 100) return 8;
        return 2;
    } else if (area >= 40 && area < 100) {
        if (level === 100) return 16;
        if (level === 10000) return 4;
        return 2;
    } else if (area >= 100 && area < 200) {
        if (level === 100) return 40;
        if (level === 10000) return 10;
        return 3;
    } else if (area >= 200 && area < 400) {
        if (level === 100) return 80;
        if (level === 10000) return 20;
        return 6;
    } else if (area >= 400 && area < 1000) {
        if (level === 100) return 160;
        if (level === 10000) return 40;
        return 13;
    } else if (area >= 1000 && area < 2000) {
        if (level === 100) return 400;
        if (level === 10000) return 100;
        return 32;
    } else if (area >= 2000) {
        if (level === 100) return 800;
        if (level === 10000) return 200;
        return 63;
    }
    
    return 2; // 保底返回值，防止出现未匹配到的异常级别
}

/**
 * 原有的 50591 计算逻辑函数
 * 注意：请把你之前写好的 50591 点数计算代码放在这个函数里面！
 */
function calculatePoints50591(area, level, projectType) {
    // 假设你之前有一个计算面积平方根的代码，你可以放在这里
    // 例如：
    // if (projectType === '悬浮粒子') { ... }
    
    return 1; // 这里只是个占位符，记得换成你原本的代码
}