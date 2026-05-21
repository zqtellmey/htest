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

    // CloakBrowser 启动器
    console.log("🚀 启动 CloakBrowser...");
    const browser = await launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });

    try {
        console.log(`🌐 访问: ${renewUrl}`);
        await page.goto(renewUrl, { waitUntil: 'networkidle' });

        // 1. 点击第一个 Renew 按钮
        console.log("👆 点击第一个 Renew 按钮...");
        await page.click('xpath=//*[@id="renew"]/div[2]/center/div/button');
        
        // 2. 关键：这里什么都不做，只给时间
        // 让 CloakBrowser 的环境自动识别并完成人机验证
        console.log("⏳ 等待人机验证自动完成 (不进行点击操作)...");
        await page.waitForTimeout(20000); 

        // 3. 直接点击第二个按钮 (假设此时验证已通过)
        console.log("👆 点击第二个 Renew 按钮...");
        await page.click('xpath=//*[@id="rm-body"]/div[6]/div/div[6]/button[1]');
        
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
