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
        await axios.post(url, form, { headers: form.getHeaders() });
    } catch (e) { console.error(e); }
}

async function main() {
    const renewUrl = process.env.RENEW_URL;
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_CHAT_ID;

    console.log("🚀 启动 CloakBrowser 隐身浏览器 (模仿真人)...");
    const browser = await launch({ headless: true });
    const page = await browser.newPage();
    
    // 设置合理的页面尺寸
    await page.setViewportSize({ width: 1280, height: 720 });

    try {
        console.log(`🌐 正在访问: ${renewUrl}`);
        // 核心：保持官方例子中的 networkidle 等待，确保环境稳定
        await page.goto(renewUrl, { waitUntil: 'networkidle' });
        
        // 1. 点击第一个 Renew 按钮
        console.log("👆 点击第一个 Renew 按钮...");
        const renewBtn1 = await page.waitForSelector('xpath=//*[@id="renew"]/div[2]/center/div/button', { timeout: 15000 });
        await renewBtn1.click();
        
        // 按照官方例子的精髓：这里不要去碰 iframe，直接等待 reCAPTCHA 自动评估
        console.log("⏳ 正在触发 reCAPTCHA 评估 (等待 5 秒)...");
        await new Promise(r => setTimeout(r, 5000)); 

        // 2. 尝试点击验证框 (如果它是主文档可见元素)
        // 按照官方逻辑，如果我们需要触发评分，就直接找那个触发验证的容器
        // 如果这里直接通过，说明 CloakBrowser 指纹成功了
        const checkbox = await page.$('xpath=//*[@id="recaptcha-anchor"]');
        if (checkbox) {
            console.log("✅ 发现验证框，执行点击...");
            await checkbox.click();
            await new Promise(r => setTimeout(r, 5000));
        }

        // 3. 点击第二个 Renew 按钮
        console.log("👆 点击第二个 Renew 按钮...");
        const renewBtn2 = await page.waitForSelector('xpath=//*[@id="rm-body"]/div[6]/div/div[6]/button[1]', { timeout: 10000 });
        await renewBtn2.click();
        
        console.log("✅ 操作流程执行完毕。");
        await new Promise(r => setTimeout(r, 5000));

    } catch (e) {
        console.error(`❌ 发生错误: ${e.message}`);
    } finally {
        const screenshotPath = "final_result.png";
        await page.screenshot({ path: screenshotPath, fullPage: true });
        if (tgToken && tgChatId) {
            await sendTelegramPhoto(tgToken, tgChatId, screenshotPath, "🔄 Server Renew 自动化操作结果。");
        }
        await browser.close();
    }
}

main();
