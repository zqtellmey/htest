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

    console.log("🚀 启动 CloakBrowser 隐身环境...");
    const browser = await launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });

    try {
        // 使用参考项目逻辑：先尝试加载，如果失败则尝试刷新一次
        console.log(`🌐 访问网址: ${renewUrl}`);
        await page.goto(renewUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);

        // 1. 点击第一个按钮
        await page.click('xpath=//*[@id="renew"]/div[2]/center/div/button');
        await page.waitForTimeout(3000);

        // 2. 这里是关键逻辑：不要手动点击 iframe 中的 checkbox，
        // 而是通过 cloackbrowser 的指纹，直接等待 reCAPTCHA 自动识别（如果是真人环境，它会自动变绿）
        console.log("🤖 等待 reCAPTCHA 自动评估 (Auto-solving)...");
        
        // 我们改为检测 reCAPTCHA 是否自动变为已验证状态 (data-state)
        // 这一步模拟了 clawdbrunner 项目中的判断逻辑
        const isVerified = await page.evaluate(() => {
            const el = document.querySelector('.recaptcha-checkbox');
            return el && el.getAttribute('aria-checked') === 'true';
        });

        if (!isVerified) {
            console.log("⚠️ 未自动通过，尝试点击 anchor 触发验证...");
            // 如果没自动通过，再尝试一次轻度点击
            const anchor = await page.waitForSelector('xpath=//*[@id="recaptcha-anchor"]', { timeout: 10000 });
            await anchor.click();
            await page.waitForTimeout(10000); // 必须留足时间给它加载
        }

        // 3. 点击第二个 Renew 按钮
        await page.click('xpath=//*[@id="rm-body"]/div[6]/div/div[6]/button[1]');
        
        console.log("✅ 流程结束。");
        await page.waitForTimeout(3000);

    } catch (e) {
        console.error(`❌ 错误: ${e.message}`);
    } finally {
        const screenshotPath = "final_result.png";
        await page.screenshot({ path: screenshotPath, fullPage: true });
        if (tgToken && tgChatId) await sendTelegramPhoto(tgToken, tgChatId, screenshotPath, "🔄 Server Renew 结果");
        await browser.close();
    }
}

main();
