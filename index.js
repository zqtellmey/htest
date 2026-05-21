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

    // 这里使用最简洁的官方启动方式
    // 关键点：在 Linux (Actions) 环境下，通常需要 --no-sandbox
    console.log("🚀 启动 CloakBrowser...");
    const browser = await launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();

    try {
        console.log(`🌐 访问: ${renewUrl}`);
        // 保持最简：使用官方例子中的跳转方式
        await page.goto(renewUrl, { waitUntil: 'networkidle' });
        
        // 1. 点击第一个 Renew 按钮
        console.log("👆 点击第一个按钮...");
        await page.click('xpath=//*[@id="renew"]/div[2]/center/div/button');
        
        // 2. 这里的等待至关重要：给予 CloakBrowser 注入指纹的时间
        console.log("⏳ 等待人机验证自动加载...");
        await page.waitForTimeout(10000);

        // 3. 按照你说的“自动打勾”，这里我们不进行复杂的 iframe 点击，
        // 而是尝试寻找那个“已打勾”的元素是否出现。
        // 如果它出现了，说明 CloakBrowser 成功欺骗了谷歌。
        const checkbox = await page.waitForSelector('xpath=//*[@id="recaptcha-anchor"]', { timeout: 15000 });
        await checkbox.click(); // 执行一次模拟真人点击
        
        console.log("✅ 已点击验证框，等待 10 秒评估...");
        await page.waitForTimeout(10000);

        // 4. 点击第二个 Renew 按钮
        console.log("👆 点击第二个按钮...");
        await page.click('xpath=//*[@id="rm-body"]/div[6]/div/div[6]/button[1]');
        
        console.log("✅ 流程完成。");

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
