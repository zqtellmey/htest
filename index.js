import { launch } from 'cloakbrowser';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';

// 发送截图的辅助函数
async function sendTelegramPhoto(token, chatId, photoPath, caption) {
    const url = `https://api.telegram.org/bot${token}/sendPhoto`;
    try {
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('caption', caption);
        form.append('photo', fs.createReadStream(photoPath));
        await axios.post(url, form, { headers: form.getHeaders() });
    } catch (e) { console.error(e); }
}

async function main() {
    const renewUrl = process.env.RENEW_URL;
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_CHAT_ID;

    console.log("🚀 启动 CloakBrowser...");
    const browser = await launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });

    // 1. 恢复去广告拦截规则
    const adDomains = ['googlesyndication.com', 'doubleclick.net', 'googleadservices.com', 'popads.net', 'propellerads.com', 'monetag.com', 'a-ads.com', 'mellowads.com'];
    await page.route('**/*', route => {
        adDomains.some(domain => route.request().url().includes(domain)) ? route.abort() : route.continue();
    });

    try {
        console.log(`🌐 访问: ${renewUrl}`);
        await page.goto(renewUrl, { waitUntil: 'networkidle' });

        // 2. 恢复 CSS 屏蔽样式 (防止广告层遮挡按钮)
        await page.addStyleTag({ content: `ins.adsbygoogle, div[id^="google_ads"], div[class*="ad-container"], .adsbygoogle { display: none !important; }` });

        // 3. 稳健的第一个按钮点击逻辑
        console.log("🔍 定位并点击第一个 Renew 按钮...");
        const xpath1 = '//*[@id="renew"]/div[2]/center/div/button';
        const btn1 = await page.waitForSelector(xpath1, { timeout: 20000, state: 'visible' });
        await btn1.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);
        await btn1.click();
        
        console.log("✅ 点击成功，等待页面加载验证...");
        await page.waitForTimeout(20000); 

        // 4. 点击第二个按钮 (保留你的业务逻辑)
        console.log("👆 点击第二个 Renew 按钮...");
        const xpath2 = '//*[@id="rm-body"]/div[6]/div/div[6]/button[1]';
        const btn2 = await page.waitForSelector(xpath2, { timeout: 20000, state: 'visible' });
        await btn2.scrollIntoViewIfNeeded();
        await btn2.click();
        
        console.log("✅ 流程结束。");
        await page.waitForTimeout(5000);

    } catch (e) {
        console.error(`❌ 错误: ${e.message}`);
    } finally {
        const screenshotPath = "final_result.png";
        await page.screenshot({ path: screenshotPath, fullPage: true });
        if (tgToken && tgChatId) await sendTelegramPhoto(tgToken, tgChatId, screenshotPath, "✅ 运行结果");
        await browser.close();
    }
}

main();
