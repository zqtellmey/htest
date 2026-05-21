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
    // 从环境变量 (GitHub Secrets) 读取配置
    const renewUrl = process.env.RENEW_URL;
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_CHAT_ID;

    if (!renewUrl) {
        console.error("❌ 未找到 RENEW_URL 环境变量，请检查 GitHub Secrets 设置。");
        return;
    }

    console.log("🚀 启动 CloakBrowser 隐身浏览器...");
    const browser = await launch({ headless: true });
    const page = await browser.newPage();
    
    // 设置分辨率
    await page.setViewportSize({ width: 1920, height: 1080 });

    try {
        console.log(`🌐 正在访问网址: ${renewUrl}`);
        await page.goto(renewUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000); // 等待3秒

        // 1. 检测并处理欧洲隐私同意框
        try {
            console.log("🔍 检测是否弹出欧洲隐私同意框...");
            const consentBtn = await page.$("button.fc-button.fc-cta-consent.fc-primary-button");
            if (consentBtn) {
                const isVisible = await consentBtn.isVisible();
                if (isVisible) {
                    await consentBtn.click();
                    console.log("✅ 已点击同意隐私政策。");
                    await page.waitForTimeout(2000);
                }
            } else {
                console.log("ℹ️ 未检测到隐私同意框，继续下一步。");
            }
        } catch (e) {
            console.log(`⚠️ 处理隐私同意框时跳过: ${e.message}`);
        }

        // 2. 点击第一个 Renew 按钮
        try {
            console.log("👆 准备点击第一个 Renew 按钮...");
            const renewBtn1 = await page.waitForSelector('xpath=//*[@id="renew"]/div[2]/center/div/button', { timeout: 10000 });
            await renewBtn1.click();
            console.log("✅ 已点击第一个 Renew 按钮。");
            await page.waitForTimeout(3000); // 等待悬浮框弹出
        } catch (e) {
            console.error(`❌ 点击第一个 Renew 按钮失败: ${e.message}`);
        }

        // 3. 谷歌人机验证打勾操作 (使用提供的 XPath 定位)
        console.log("🤖 开始处理谷歌人机验证...");
        try {
            const recaptchaCheckbox = await page.waitForSelector('xpath=//*[@id="recaptcha-anchor"]/div[1]', { timeout: 15000 });
            await recaptchaCheckbox.click();
            console.log("✅ 已点击人机验证框，等待验证通过...");
            await page.waitForTimeout(6000); // 给予验证码转圈和打勾充足的时间
        } catch (e) {
            console.error(`❌ 查找或点击人机验证框失败，如果它在 iframe 内后续可能需要调整: ${e.message}`);
        }

        // 4. 点击悬浮框中的第二个 Renew 按钮
        try {
            console.log("👆 准备点击第二个 Renew 按钮...");
            const renewBtn2 = await page.waitForSelector('xpath=//*[@id="rm-body"]/div[6]/div/div[6]/button[1]', { timeout: 10000 });
            await renewBtn2.click();
            console.log("✅ 已点击悬浮框内的 Renew 按钮。");
            
            await page.waitForTimeout(10000); // 给服务器足够的时间处理 renew 请求
        } catch (e) {
            console.error(`❌ 点击第二个 Renew 按钮失败: ${e.message}`);
        }

    } catch (e) {
        console.error(`❌ 运行过程中发生未捕获的错误: ${e.message}`);
    } finally {
        // 截图保存当前最终状态
        const screenshotPath = "renew_result.png";
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 已保存最终结果截图: ${screenshotPath}`);

        // 发送通知
        if (tgToken && tgChatId) {
            await sendTelegramPhoto(tgToken, tgChatId, screenshotPath, "🔄 Server Renew 自动化脚本执行完毕，请查看最终状态。");
        } else {
            console.log("⚠️ 未配置 Telegram Token 或 Chat ID，跳过消息发送。");
        }

        // 退出浏览器
        await browser.close();
        console.log("🛑 浏览器已关闭。任务结束。");
    }
}

main();
