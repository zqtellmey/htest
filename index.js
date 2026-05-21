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

        const response = await axios.post(url, form, {
            headers: form.getHeaders()
        });
        
        if (response.data.ok) {
            console.log("✅ 截图已成功发送至 Telegram。");
        } else {
            console.log(`❌ Telegram 发送失败: ${JSON.stringify(response.data)}`);
        }
    } catch (error) {
        console.error(`❌ 发送 Telegram 消息时发生错误: ${error.message}`);
    }
}

async function main() {
    const renewUrl = process.env.RENEW_URL;
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_CHAT_ID;

    if (!renewUrl) {
        console.error("❌ 未找到 RENEW_URL 环境变量。");
        return;
    }

    console.log("🚀 启动 CloakBrowser 隐身浏览器...");
    const browser = await launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });

    console.log("🛡️ 正在配置去广告拦截...");
    const adDomains = ['googlesyndication.com', 'doubleclick.net', 'googleadservices.com', 'popads.net', 'propellerads.com', 'monetag.com', 'a-ads.com', 'mellowads.com'];
    await page.route('**/*', route => {
        adDomains.some(domain => route.request().url().includes(domain)) ? route.abort() : route.continue();
    });

    try {
        console.log(`🌐 正在访问: ${renewUrl}`);
        await page.goto(renewUrl, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(5000); 

        // 1. 处理隐私框
        try {
            const consentBtn = await page.$("button.fc-button.fc-cta-consent.fc-primary-button");
            if (consentBtn) { await consentBtn.click(); await page.waitForTimeout(2000); }
        } catch (e) { console.log("ℹ️ 无需处理隐私框"); }

        // 2. 点击第一个 Renew 按钮 (加入强制点击)
        try {
            console.log("👆 准备点击第一个 Renew 按钮...");
            const renewBtn1 = await page.waitForSelector('xpath=//*[@id="renew"]/div[2]/center/div/button', { timeout: 15000 });
            await renewBtn1.click({ force: true });
            console.log("✅ 已点击第一个 Renew 按钮，等待加载...");
            await page.waitForTimeout(8000); // 增加等待时间，防止转圈过久
        } catch (e) {
            console.error(`❌ 点击第一个 Renew 按钮失败: ${e.message}`);
        }

        // 3. 谷歌人机验证
        console.log("🤖 开始处理谷歌人机验证...");
        try {
            const iframeElement = await page.waitForSelector('xpath=//*[@id="recaptchax"]/div/div/iframe', { timeout: 20000 });
            const frame = await iframeElement.contentFrame();
            if (frame) {
                const recaptchaCheckbox = await frame.waitForSelector('xpath=//*[@id="recaptcha-anchor"]/div[1]', { timeout: 15000 });
                await recaptchaCheckbox.click();
                console.log("✅ 已点击人机验证，等待验证通过...");
                await page.waitForTimeout(15000); // 增加验证等待时长
            }
        } catch (e) {
            console.error(`❌ 人机验证失败: ${e.message}`);
        }

        // 4. 点击第二个 Renew 按钮
        try {
            console.log("👆 准备点击第二个 Renew 按钮...");
            const renewBtn2 = await page.waitForSelector('xpath=//*[@id="rm-body"]/div[6]/div/div[6]/button[1]', { timeout: 15000 });
            await renewBtn2.click({ force: true });
            console.log("✅ 已点击悬浮框内的 Renew 按钮。");
            await page.waitForTimeout(15000); // 增加等待时间以确保请求完成
        } catch (e) {
            console.error(`❌ 点击第二个 Renew 按钮失败: ${e.message}`);
        }

    } catch (e) {
        console.error(`❌ 运行过程中发生错误: ${e.message}`);
    } finally {
        const screenshotPath = "renew_result.png";
        await page.screenshot({ path: screenshotPath, fullPage: true });
        if (tgToken && tgChatId) {
            await sendTelegramPhoto(tgToken, tgChatId, screenshotPath, "🔄 Server Renew 自动化脚本执行完毕。");
        }
        await browser.close();
        console.log("🛑 任务结束。");
    }
}

main();
