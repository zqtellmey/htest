import { launch } from 'cloakbrowser';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';

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

    // 官方最佳实践：使用 Playwright，不要使用 Puppeteer
    // 关键点：cloakbrowser 会自动注入隐身补丁，不要在这个基础上做任何额外的 frame 操作
    console.log("🚀 启动 CloakBrowser (自动隐身模式)...");
    const browser = await launch({ headless: true });
    const page = await browser.newPage();
    
    // 设置合理的真人浏览环境
    await page.setViewportSize({ width: 1920, height: 1080 });

    try {
        console.log(`🌐 访问目标: ${renewUrl}`);
        await page.goto(renewUrl, { waitUntil: 'networkidle' });

        // 官方最佳实践：模拟真人行为，在触发验证前停留 15-30 秒
        console.log("⏳ 模拟真人浏览，等待 20 秒...");
        await page.waitForTimeout(20000); 

        // 1. 点击第一个按钮
        console.log("👆 点击 Renew 按钮...");
        // 关键点：使用 page.click()，不要用 force: true，这会让 CloakBrowser 模拟鼠标轨迹
        const renewBtn1 = await page.waitForSelector('xpath=//*[@id="renew"]/div[2]/center/div/button');
        await renewBtn1.click();

        // 2. 这里是关键！绝对不要进入 iframe！
        // 如果 CloakBrowser 指纹成功，reCAPTCHA 会检测到你是真人，自动通过
        // 如果这里必须要点击，请直接点击主文档中可见的触发元素，而不是 frame
        console.log("🤖 等待 reCAPTCHA 自动评估 (不要手动操作 iframe)...");
        await page.waitForTimeout(15000); 

        // 3. 点击后续按钮
        const renewBtn2 = await page.waitForSelector('xpath=//*[@id="rm-body"]/div[6]/div/div[6]/button[1]');
        await renewBtn2.click();
        
        console.log("✅ 操作流程结束。");
        await page.waitForTimeout(5000);

    } catch (e) {
        console.error(`❌ 错误: ${e.message}`);
    } finally {
        const screenshotPath = "final_result.png";
        await page.screenshot({ path: screenshotPath, fullPage: true });
        if (tgToken && tgChatId) {
            await sendTelegramPhoto(tgToken, tgChatId, screenshotPath, "🔄 Server Renew 结果");
        }
        await browser.close();
    }
}

main();
