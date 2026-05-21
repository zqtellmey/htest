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

    // ================= 新增：去广告逻辑 (网络请求拦截) =================
    console.log("🛡️ 正在配置去广告拦截规则...");
    const adDomains = [
        'googlesyndication.com',
        'doubleclick.net',
        'googleadservices.com',
        'popads.net',
        'propellerads.com',
        'monetag.com',
        'a-ads.com',
        'mellowads.com'
    ];
    
    await page.route('**/*', route => {
        const url = route.request().url();
        if (adDomains.some(domain => url.includes(domain))) {
            // 拦截广告请求
            route.abort();
        } else {
            route.continue();
        }
    });
    // ===================================================================

    try {
        console.log(`🌐 正在访问网址: ${renewUrl}`);
        await page.goto(renewUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000); // 等待3秒

        // ================= 新增：去广告逻辑 (CSS 样式隐藏) =================
        try {
            console.log("🧹 正在清理页面上可能残留的广告元素...");
            await page.addStyleTag({ content: `
                ins.adsbygoogle, 
                div[id^="google_ads"], 
                div[class*="ad-container"], 
                .adsbygoogle { 
                    display: none !important; 
                    height: 0 !important; 
                    width: 0 !important; 
                    pointer-events: none !important;
                }
            `});
            console.log("✅ 页面广告元素已隐藏。");
        } catch (e) {
            console.log(`⚠️ 隐藏广告元素时出错 (可忽略): ${e.message}`);
        }
        // ===================================================================

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
            await page.waitForTimeout(4000); // 等待悬浮框及人机验证 iframe 彻底加载弹出
        } catch (e) {
            console.error(`❌ 点击第一个 Renew 按钮失败: ${e.message}`);
        }

        // 3. 谷歌人机验证打勾操作 (精准定位指定的 iframe)
        console.log("🤖 开始处理谷歌人机验证...");
        try {
            console.log("🔍 正在精准查找可见的 reCAPTCHA iframe...");
            // 使用你提供的精确 XPath 定位正确的 iframe
            const iframeElement = await page.waitForSelector('xpath=//*[@id="recaptchax"]/div/div/iframe', { timeout: 15000 });
            // 获取该 iframe 的内部执行环境
            const frame = await iframeElement.contentFrame();
            
            if (frame) {
                console.log("✅ 成功进入 iframe，准备定位打勾框...");
                // 在 iframe 内部使用 XPath 定位打勾元素并点击
                const recaptchaCheckbox = await frame.waitForSelector('xpath=//*[@id="recaptcha-anchor"]/div[1]', { timeout: 15000 });
                await recaptchaCheckbox.click();
                console.log("✅ 已点击人机验证框，等待验证通过...");
                await page.waitForTimeout(8000); // 给予验证码转圈和打勾充足的时间
            } else {
                console.error("❌ 找到了 iframe 元素，但无法获取其内容框架 (contentFrame)。");
            }
        } catch (e) {
            console.error(`❌ 查找或点击人机验证框失败: ${e.message}`);
        }

        // 4. 点击悬浮框中的第二个 Renew 按钮
        try {
            console.log("👆 准备点击第二个 Renew 按钮...");
            // 第二个按钮在主页面中，所以直接使用 page 去查找
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
