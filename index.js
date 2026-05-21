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
        if (response.data.ok) { console.log("✅ 截图已成功发送至 Telegram。"); }
    } catch (error) { console.error(`❌ 发送 Telegram 消息时发生错误: ${error.message}`); }
}

async function main() {
    const renewUrl = process.env.RENEW_URL;
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_CHAT_ID;

    if (!renewUrl) return;

    // CloakBrowser 启动：这是所有隐身逻辑的基石
    console.log("🚀 启动 CloakBrowser...");
    const browser = await launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });

    // 广告拦截
    const adDomains = ['googlesyndication.com', 'doubleclick.net', 'googleadservices.com', 'popads.net', 'propellerads.com', 'monetag.com', 'a-ads.com', 'mellowads.com'];
    await page.route('**/*', route => {
        adDomains.some(domain => route.request().url().includes(domain)) ? route.abort() : route.continue();
    });

    try {
        console.log(`🌐 正在访问: ${renewUrl}`);
        await page.goto(renewUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(5000); // 增加页面加载缓冲

        // 1. 点击第一个 Renew
        console.log("👆 点击第一个 Renew 按钮...");
        const renewBtn1 = await page.waitForSelector('xpath=//*[@id="renew"]/div[2]/center/div/button', { timeout: 15000 });
        // 【关键改动】：不用 force: true，改用普通的 click，让 CloakBrowser 的鼠标移动注入生效
        await renewBtn1.click();
        console.log("✅ 已点击第一个按钮，等待验证框弹出...");
        await page.waitForTimeout(15000); // 必须留足时间给谷歌风控评估

        // 2. 谷歌人机验证 (保留你成功的 iframe 逻辑)
        console.log("🤖 开始处理谷歌人机验证...");
        const iframeElement = await page.waitForSelector('xpath=//*[@id="recaptchax"]/div/div/iframe', { timeout: 15000 });
        const frame = await iframeElement.contentFrame();
        if (frame) {
            const recaptchaCheckbox = await frame.waitForSelector('xpath=//*[@id="recaptcha-anchor"]/div[1]', { timeout: 15000 });
            // 【关键改动】：同样使用普通 click， cloakbrowser 会自动模拟点击时的鼠标轨迹
            await recaptchaCheckbox.click();
            console.log("✅ 已点击人机验证，等待验证通过...");
            await page.waitForTimeout(20000); // 再次延长等待，防止九宫格加载后被强行截断
        }

        // 3. 点击第二个 Renew
        console.log("👆 点击第二个 Renew 按钮...");
        const renewBtn2 = await page.waitForSelector('xpath=//*[@id="rm-body"]/div[6]/div/div[6]/button[1]', { timeout: 15000 });
        await renewBtn2.click();
        console.log("✅ 操作流程执行完毕。");
        await page.waitForTimeout(10000);

    } catch (e) {
        console.error(`❌ 错误: ${e.message}`);
    } finally {
        const screenshotPath = "final_result.png";
        await page.screenshot({ path: screenshotPath, fullPage: true });
        if (tgToken && tgChatId) await sendTelegramPhoto(tgToken, tgChatId, screenshotPath, "🔄 Server Renew 自动化运行结束。");
        await browser.close();
    }
}

main();
