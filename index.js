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

    // 使用 CloakBrowser 启动器替代传统的 playwright.launch
    console.log("🚀 启动 CloakBrowser...");
    const browser = await launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });

    try {
        await page.goto(renewUrl, { waitUntil: 'networkidle' });
        
        // 1. 点击第一个按钮 (保留你确认成功的 XPath)
        console.log("👆 点击第一个按钮...");
        const btn1 = await page.waitForSelector('xpath=//*[@id="renew"]/div[2]/center/div/button', { timeout: 15000 });
        await btn1.click();
        await page.waitForTimeout(5000); 

        // 2. 谷歌人机验证 (严格保留你确认成功的 iframe 逻辑)
        // CloakBrowser 此时会在后台自动修复指纹，谷歌会认为这依然是真人
        console.log("🤖 处理人机验证...");
        const iframeElement = await page.waitForSelector('xpath=//*[@id="recaptchax"]/div/div/iframe', { timeout: 15000 });
        const frame = await iframeElement.contentFrame();
        if (frame) {
            const checkbox = await frame.waitForSelector('xpath=//*[@id="recaptcha-anchor"]/div[1]', { timeout: 15000 });
            await checkbox.click(); // 这里点击，CloakBrowser 会注入真人轨迹
            console.log("✅ 点击成功，等待结果...");
            await page.waitForTimeout(15000); 
        }

        // 3. 点击第二个按钮
        console.log("👆 点击第二个按钮...");
        const btn2 = await page.waitForSelector('xpath=//*[@id="rm-body"]/div[6]/div/div[6]/button[1]', { timeout: 15000 });
        await btn2.click();
        
        console.log("✅ 流程结束。");
        await page.waitForTimeout(5000);

    } catch (e) {
        console.error(`❌ 错误: ${e.message}`);
    } finally {
        const screenshotPath = "final_result.png";
        await page.screenshot({ path: screenshotPath, fullPage: true });
        if (tgToken && tgChatId) await sendTelegramPhoto(tgToken, tgChatId, screenshotPath, "✅ 运行结果截图");
        await browser.close();
    }
}

main();
