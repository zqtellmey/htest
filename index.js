import { launch } from 'cloakbrowser';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';

// 发送截图到 Telegram 的辅助函数
async function sendTelegramPhoto(token, chatId, photoPath, caption) {
    const url = `https://api.telegram.org/bot${token}/sendPhoto`;
    try {
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('caption', caption);
        form.append('photo', fs.createReadStream(photoPath));
        const response = await axios.post(url, form, { headers: form.getHeaders() });
        if (response.data.ok) { console.log("✅ 截图已发送至 Telegram。"); }
    } catch (e) { console.error(e); }
}

async function main() {
    const renewUrl = process.env.RENEW_URL;
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_CHAT_ID;

    if (!renewUrl) { console.error("❌ 环境变量 RENEW_URL 未设置"); return; }

    console.log("🚀 启动 CloakBrowser 隐身环境...");
    const browser = await launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });

    // 1. 去广告拦截规则 (保持原有，防止广告遮挡导致点击失败)
    const adDomains = ['googlesyndication.com', 'doubleclick.net', 'googleadservices.com', 'popads.net', 'propellerads.com', 'monetag.com', 'a-ads.com', 'mellowads.com'];
    await page.route('**/*', route => {
        adDomains.some(domain => route.request().url().includes(domain)) ? route.abort() : route.continue();
    });

    try {
        console.log(`🌐 访问网址: ${renewUrl}`);
        await page.goto(renewUrl, { waitUntil: 'networkidle' });

        // 2. CSS 屏蔽样式 (防止广告层遮挡关键按钮)
        await page.addStyleTag({ content: `ins.adsbygoogle, div[id^="google_ads"], div[class*="ad-container"], .adsbygoogle { display: none !important; }` });

        // 3. 稳健点击第一个 Renew 按钮
        console.log("🔍 定位并点击第一个 Renew 按钮...");
        const btn1 = await page.waitForSelector('xpath=//*[@id="renew"]/div[2]/center/div/button', { timeout: 20000, state: 'visible' });
        await btn1.scrollIntoViewIfNeeded();
        await btn1.click();
        
        console.log("✅ 第一个按钮点击成功，等待人机验证加载...");
        await page.waitForTimeout(20000); 

        // 4. 稳健点击第二个 Renew 按钮 (彻底解决 XPath 变动问题)
        // 使用 CSS 类名 + 文字内容过滤，不再依赖 div 嵌套层级
        console.log("👆 正在通过特征定位第二个 Renew 按钮...");
        const btn2Locator = page.locator('button.swal2-confirm.swal2-styled').filter({ hasText: 'Renew' });
        
        // 等待按钮出现
        await btn2Locator.waitFor({ state: 'visible', timeout: 20000 });
        await btn2Locator.scrollIntoViewIfNeeded();
        await btn2Locator.click();
        
        console.log("✅ 第二个 Renew 按钮点击成功，任务流程结束。");
        await page.waitForTimeout(5000);

    } catch (e) {
        console.error(`❌ 错误: ${e.message}`);
    } finally {
        const screenshotPath = "final_result.png";
        await page.screenshot({ path: screenshotPath, fullPage: true });
        if (tgToken && tgChatId) await sendTelegramPhoto(tgToken, tgChatId, screenshotPath, "🔄 Server Renew 执行完毕。");
        await browser.close();
        console.log("🛑 浏览器已关闭。");
    }
}

main();
